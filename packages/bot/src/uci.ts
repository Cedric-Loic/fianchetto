import { spawn, type ChildProcessByStdio } from 'node:child_process';
import { createRequire } from 'node:module';
import type { Readable, Writable } from 'node:stream';

/** Ligne d'analyse UCI : coup (notation UCI) et score du point de vue du camp au trait. */
export interface UciLine {
  move: string;
  /** Centipions ; un mat est converti en ±(100 000 − 100 × distance). */
  score: number;
  mate: number | null;
  /** Ligne principale complète (UCI), qui commence par `move`. */
  pv: string[];
  /** Profondeur de recherche (plies) de cette ligne ; absente pour un coup de repli sans `info`. */
  depth?: number;
}

/** Options d'une analyse continue (`analyzeStream`). */
export interface StreamOptions {
  multipv: number;
  /** Profondeur à laquelle la recherche s'arrête d'elle-même (défaut 22). */
  maxDepth?: number;
  /** Durée maximale avant arrêt automatique, en millisecondes (défaut 30 000). */
  maxMs?: number;
  /** Skill Level de Stockfish (défaut 20 : pleine force). */
  skill?: number;
}

/** Analyse continue en cours : `stop()` l'interrompt, `done` donne les dernières lignes. */
export interface AnalysisStream {
  /** Interrompt la recherche et attend sa fin. Sans effet (ni erreur) si elle est déjà finie. */
  stop(): Promise<void>;
  /** Dernières lignes complètes, triées par multipv ; rejette si le moteur meurt. */
  done: Promise<UciLine[]>;
}

export interface SearchOptions {
  movetimeMs: number;
  multipv: number;
  skill: number;
  /**
   * Délai de réponse maximal en millisecondes (défaut : `movetimeMs` + 10 s). Au-delà, la
   * recherche est arrêtée puis rejetée.
   */
  timeoutMs?: number;
}

const MATE_SCORE = 100_000;

/** Ligne `info` analysée : index multipv, profondeur, borne éventuelle et ligne d'analyse. */
interface InfoLine {
  multipv: number;
  bound: boolean;
  line: UciLine;
}

function parseInfo(text: string): InfoLine | null {
  if (!text.startsWith('info ')) return null;
  const m = /multipv (\d+) score (cp|mate) (-?\d+)(.*) pv (.+)$/.exec(text);
  if (!m) return null;
  const value = Number(m[3]);
  const mate = m[2] === 'mate' ? value : null;
  const score = mate === null ? value : Math.sign(mate || -1) * (MATE_SCORE - 100 * Math.abs(mate));
  const pv = (m[5] ?? '').trim().split(/\s+/);
  const depth = /\bdepth (\d+)/.exec(text);
  const line: UciLine = { move: pv[0] ?? '', score, mate, pv };
  if (depth) line.depth = Number(depth[1]);
  return { multipv: Number(m[1]), bound: /bound/.test(m[4] ?? ''), line };
}

function sortedLines(lines: Map<number, UciLine>): UciLine[] {
  return [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
}

/** Délai maximal pour `uciok` (démarrage du WASM) et pour `readyok`. */
const INIT_TIMEOUT_MS = 10_000;
const READY_TIMEOUT_MS = 10_000;
/** Après un délai dépassé : temps laissé au moteur pour répondre à « stop » avant d'être tué. */
const STOP_GRACE_MS = 1000;
/** Après `quit()` : temps laissé au processus pour se terminer avant d'être tué. */
const QUIT_GRACE_MS = 1000;

/**
 * Stockfish (paquet npm `stockfish`, moteur WASM « lite » mono-thread) lancé en processus
 * enfant Node et piloté en UCI. Une seule recherche à la fois (file d'attente).
 *
 * Invariant : la file n'est libérée qu'après le `bestmove` de la recherche en cours (ou la mort
 * du processus). Une ligne `bestmove` ne peut donc répondre qu'à la recherche qui l'a demandée ;
 * par prudence, les sorties d'une recherche antérieure encore attendue sont de toute façon
 * ignorées (compteur `#pendingGo`).
 */
export class UciEngine {
  #child: ChildProcessByStdio<Writable, Readable, null>;
  #buffer = '';
  #listeners: ((line: string) => void)[] = [];
  #queue: Promise<unknown>;
  /** Processus arrêté (fin normale, plantage ou tué) : toute recherche échoue aussitôt. */
  #dead = false;
  #quitting = false;
  #onDeath: (() => void)[] = [];
  /** Nombre de `go` envoyés dont le `bestmove` n'est pas encore arrivé. */
  #pendingGo = 0;

  constructor() {
    const require = createRequire(import.meta.url);
    const { findEngine } = require('stockfish') as { findEngine: (name: string) => string };
    // stderr ignoré : un tampon jamais lu finirait par bloquer le processus enfant.
    this.#child = spawn(process.execPath, [findEngine('lite-single')], {
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    this.#child.on('exit', () => this.#markDead());
    this.#child.on('error', () => this.#kill());
    // EPIPE (écriture vers un processus mort) : sans ce gestionnaire, l'erreur ferait planter
    // le processus hôte.
    this.#child.stdin.on('error', () => this.#kill());
    this.#child.stdout.on('error', () => this.#kill());
    this.#child.stdout.on('data', (chunk: Buffer) => {
      this.#buffer += chunk.toString();
      const lines = this.#buffer.split('\n');
      this.#buffer = lines.pop() ?? '';
      for (const raw of lines) this.#dispatch(raw.trim());
    });
    this.#send('uci');
    // La file commence par l'attente de `uciok` : aucune recherche avant l'initialisation.
    this.#queue = this.#waitFor((l) => l === 'uciok', undefined, INIT_TIMEOUT_MS).catch(() =>
      this.#kill(),
    );
  }

  /** Faux si le processus Stockfish s'est arrêté (il faut alors en créer un autre). */
  get alive(): boolean {
    return !this.#dead;
  }

  /** Identifiant système du processus Stockfish (diagnostic et tests). */
  get pid(): number | undefined {
    return this.#child.pid;
  }

  #dispatch(line: string): void {
    // Sorties d'une recherche antérieure non encore close : elles ne concernent personne.
    if (line.startsWith('bestmove')) {
      const stale = this.#pendingGo > 1;
      this.#pendingGo = Math.max(0, this.#pendingGo - 1);
      if (stale) return;
    } else if (line.startsWith('info') && this.#pendingGo > 1) {
      return;
    }
    for (const l of [...this.#listeners]) l(line);
  }

  #markDead(): void {
    if (this.#dead) return;
    this.#dead = true;
    for (const fail of this.#onDeath.splice(0)) fail();
  }

  /** Tue le processus ; le moteur est aussitôt considéré comme mort. */
  #kill(): void {
    this.#markDead();
    if (this.#child.exitCode === null && this.#child.signalCode === null) {
      this.#child.kill('SIGKILL');
    }
  }

  /** Écrit une commande ; no-op sûr si le processus est mort. */
  #send(command: string): void {
    if (this.#dead || !this.#child.stdin.writable) return;
    try {
      this.#child.stdin.write(`${command}\n`);
    } catch {
      this.#kill();
    }
  }

  /** Attend une ligne du moteur. Échoue si le processus meurt ou après `timeoutMs`. */
  #waitFor(
    predicate: (line: string) => boolean,
    onLine?: (line: string) => void,
    timeoutMs = 10_000,
  ) {
    return new Promise<string>((resolve, reject) => {
      if (this.#dead) return reject(new Error('Moteur arrêté.'));
      const done = () => {
        this.#listeners = this.#listeners.filter((l) => l !== listener);
        this.#onDeath = this.#onDeath.filter((f) => f !== fail);
        clearTimeout(timer);
      };
      const listener = (line: string) => {
        onLine?.(line);
        if (predicate(line)) {
          done();
          resolve(line);
        }
      };
      const fail = () => {
        done();
        reject(new Error('Moteur arrêté.'));
      };
      const timer = setTimeout(() => {
        done();
        reject(new Error('Moteur sans réponse.'));
      }, timeoutMs);
      this.#listeners.push(listener);
      this.#onDeath.push(fail);
    });
  }

  /** Applique les options et attend `readyok` ; un moteur muet est tué. */
  async #prepare(skill: number, multipv: number): Promise<void> {
    this.#send(`setoption name Skill Level value ${skill}`);
    this.#send(`setoption name MultiPV value ${multipv}`);
    this.#send('isready');
    try {
      await this.#waitFor((l) => l === 'readyok', undefined, READY_TIMEOUT_MS);
    } catch (error) {
      this.#kill();
      throw error;
    }
  }

  /**
   * Lance une recherche (`go …`) et attend SON `bestmove`. Si rien n'arrive avant `timeoutMs`,
   * envoie « stop » et attend le `bestmove` au plus `STOP_GRACE_MS` avant de rejeter ; s'il ne
   * vient pas, le processus est tué. Dans tous les cas, la recherche est close quand la
   * promesse se règle : la suivante ne peut pas recevoir sa réponse.
   */
  async #search(go: string, onLine: (line: string) => void, timeoutMs: number): Promise<string> {
    if (this.#dead) throw new Error('Moteur arrêté.');
    const isBest = (l: string) => l.startsWith('bestmove');
    this.#pendingGo++;
    this.#send(go);
    try {
      return await this.#waitFor(isBest, onLine, timeoutMs);
    } catch (error) {
      if (this.#dead) throw error;
      this.#send('stop');
      try {
        await this.#waitFor(isBest, onLine, STOP_GRACE_MS);
      } catch {
        this.#kill();
      }
      throw error;
    }
  }

  /** Analyse une position (FEN) et renvoie les `multipv` meilleurs coups. */
  analyze(fen: string, options: SearchOptions): Promise<UciLine[]> {
    const run = async () => {
      const lines = new Map<number, UciLine>();
      await this.#prepare(options.skill, options.multipv);
      this.#send(`position fen ${fen}`);
      const best = await this.#search(
        `go movetime ${Math.max(10, Math.round(options.movetimeMs))}`,
        (l) => {
          const info = parseInfo(l);
          if (info) lines.set(info.multipv, info.line);
        },
        options.timeoutMs ?? options.movetimeMs + 10_000,
      );
      const result = sortedLines(lines);
      const bestMove = best.split(' ')[1];
      if (result.length === 0 && bestMove && bestMove !== '(none)') {
        result.push({ move: bestMove, score: 0, mate: null, pv: [bestMove] });
      }
      return result;
    };
    const next = this.#queue.then(run, run);
    this.#queue = next.catch(() => undefined);
    return next;
  }

  /**
   * Analyse continue d'une position (FEN), pour un « moteur en direct ». La recherche passe
   * par la même file que `analyze` (elle attend la fin des recherches précédentes et les
   * suivantes l'attendent). `onUpdate` reçoit, à chaque profondeur terminée, les lignes les
   * plus récentes triées par multipv ; les scores sont, comme pour `analyze`, du point de vue
   * du camp au trait. Arrêt automatique à `maxDepth` ou après `maxMs`.
   */
  analyzeStream(
    fen: string,
    options: StreamOptions,
    onUpdate: (lines: UciLine[]) => void,
  ): AnalysisStream {
    const maxDepth = options.maxDepth ?? 22;
    const maxMs = options.maxMs ?? 30_000;
    // `stopRequested` : stop() appelé (avant ou pendant la recherche) ; `searching` : le moteur
    // calcule pour ce flux, donc un « stop » le concerne lui et pas une recherche suivante.
    let stopRequested = false;
    let searching = false;
    const run = async (): Promise<UciLine[]> => {
      if (stopRequested) return [];
      // Lignes complètes de la dernière profondeur publiée, et lignes en cours de profondeur.
      let published = new Map<number, UciLine>();
      let current = new Map<number, UciLine>();
      let currentDepth = 0;
      const publish = () => {
        if (current.size === 0) return;
        published = current;
        current = new Map();
        onUpdate(sortedLines(published));
      };
      await this.#prepare(options.skill ?? 20, options.multipv);
      if (stopRequested) return [];
      this.#send(`position fen ${fen}`);
      searching = true;
      let interrupted = false;
      const timer = setTimeout(() => {
        interrupted = true;
        if (searching) this.#send('stop');
      }, maxMs);
      try {
        await this.#search(
          `go depth ${maxDepth}`,
          (l) => {
            if (l.startsWith('bestmove')) {
              searching = false;
              return;
            }
            const info = parseInfo(l);
            // Les lignes bornées (fenêtre d'aspiration) sont provisoires : on les ignore.
            if (!info || info.bound || info.line.depth === undefined) return;
            const depth = info.line.depth;
            // Nouvelle profondeur alors que la précédente n'avait pas toutes ses multipv
            // (moins de coups légaux que demandé, ou recherche interrompue) : on la publie.
            if (depth > currentDepth && current.size > 0) publish();
            currentDepth = Math.max(currentDepth, depth);
            if (depth < currentDepth) return;
            current.set(info.multipv, info.line);
            if (current.size >= options.multipv) publish();
          },
          maxMs + 10_000,
        );
      } finally {
        searching = false;
        clearTimeout(timer);
      }
      // Fin naturelle (maxDepth) : la dernière profondeur est complète même si elle a moins de
      // lignes que demandé. Interrompue par « stop », elle ne l'est pas : on garde la dernière
      // profondeur complète, sauf s'il n'y en a aucune.
      if (!interrupted && !stopRequested) publish();
      else if (published.size === 0) publish();
      return sortedLines(published);
    };
    const done = this.#queue.then(run, run);
    this.#queue = done.catch(() => undefined);
    // Évite un rejet non géré si l'appelant n'observe que `stop()`.
    done.catch(() => undefined);
    return {
      done,
      stop: () => {
        stopRequested = true;
        if (searching) this.#send('stop');
        return done.then(
          () => undefined,
          () => undefined,
        );
      },
    };
  }

  /**
   * Arrête le moteur (idempotent). Les attentes en cours sont rejetées aussitôt ; le processus
   * est tué s'il ne s'est pas terminé après `QUIT_GRACE_MS`.
   */
  quit(): void {
    if (this.#quitting) return;
    this.#quitting = true;
    this.#send('quit');
    this.#markDead();
    try {
      this.#child.stdin.end();
    } catch {
      // flux déjà détruit : rien à fermer
    }
    if (this.#child.exitCode !== null || this.#child.signalCode !== null) return;
    const timer = setTimeout(() => this.#kill(), QUIT_GRACE_MS);
    timer.unref();
    this.#child.once('exit', () => clearTimeout(timer));
  }
}
