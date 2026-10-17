import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRequire } from 'node:module';

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

/**
 * Stockfish (paquet npm `stockfish`, moteur WASM « lite » mono-thread) lancé en processus
 * enfant Node et piloté en UCI. Une seule recherche à la fois (file d'attente).
 */
export class UciEngine {
  #child: ChildProcessWithoutNullStreams;
  #buffer = '';
  #listeners: ((line: string) => void)[] = [];
  #queue: Promise<unknown> = Promise.resolve();
  /** Processus arrêté (fin normale ou plantage) : toute recherche échoue aussitôt. */
  #dead = false;
  #onDeath: (() => void)[] = [];

  constructor() {
    const require = createRequire(import.meta.url);
    const { findEngine } = require('stockfish') as { findEngine: (name: string) => string };
    this.#child = spawn(process.execPath, [findEngine('lite-single')], { stdio: 'pipe' });
    this.#child.on('exit', () => {
      this.#dead = true;
      for (const fail of this.#onDeath.splice(0)) fail();
    });
    this.#child.on('error', () => undefined);
    this.#child.stdout.on('data', (chunk: Buffer) => {
      this.#buffer += chunk.toString();
      const lines = this.#buffer.split('\n');
      this.#buffer = lines.pop() ?? '';
      for (const line of lines) for (const l of [...this.#listeners]) l(line.trim());
    });
    this.#send('uci');
  }

  /** Faux si le processus Stockfish s'est arrêté (il faut alors en créer un autre). */
  get alive(): boolean {
    return !this.#dead;
  }

  #send(command: string): void {
    if (!this.#dead) this.#child.stdin.write(`${command}\n`);
  }

  /**
   * Attend une ligne du moteur. Échoue si le processus meurt ou si rien n'arrive avant
   * `timeoutMs` (le moteur reçoit alors « stop », au cas où il serait seulement en retard).
   */
  #waitFor(
    predicate: (line: string) => boolean,
    onLine?: (line: string) => void,
    timeoutMs = 10_000,
  ) {
    return new Promise<string>((resolve, reject) => {
      if (this.#dead) return reject(new Error('Moteur arrêté.'));
      let timer: NodeJS.Timeout | null = null;
      const done = () => {
        this.#listeners = this.#listeners.filter((l) => l !== listener);
        this.#onDeath = this.#onDeath.filter((f) => f !== fail);
        if (timer) clearTimeout(timer);
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
      this.#listeners.push(listener);
      this.#onDeath.push(fail);
      timer = setTimeout(() => {
        // Dernière chance : « stop » force une réponse immédiate d'une recherche en cours.
        this.#send('stop');
        timer = setTimeout(() => {
          done();
          reject(new Error('Moteur sans réponse.'));
        }, 2000);
      }, timeoutMs);
    });
  }

  /** Analyse une position (FEN) et renvoie les `multipv` meilleurs coups. */
  analyze(fen: string, options: SearchOptions): Promise<UciLine[]> {
    const run = async () => {
      const lines = new Map<number, UciLine>();
      this.#send(`setoption name Skill Level value ${options.skill}`);
      this.#send(`setoption name MultiPV value ${options.multipv}`);
      this.#send('isready');
      await this.#waitFor((l) => l === 'readyok');
      this.#send(`position fen ${fen}`);
      this.#send(`go movetime ${Math.max(10, Math.round(options.movetimeMs))}`);
      const best = await this.#waitFor(
        (l) => l.startsWith('bestmove'),
        (l) => {
          const info = parseInfo(l);
          if (info) lines.set(info.multipv, info.line);
        },
        options.movetimeMs + 10_000,
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
      this.#send(`setoption name Skill Level value ${options.skill ?? 20}`);
      this.#send(`setoption name MultiPV value ${options.multipv}`);
      this.#send('isready');
      await this.#waitFor((l) => l === 'readyok');
      if (stopRequested) return [];
      this.#send(`position fen ${fen}`);
      this.#send(`go depth ${maxDepth}`);
      searching = true;
      let interrupted = false;
      const timer = setTimeout(() => {
        interrupted = true;
        if (searching) this.#send('stop');
      }, maxMs);
      try {
        await this.#waitFor(
          (l) => l.startsWith('bestmove'),
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

  quit(): void {
    this.#send('quit');
    this.#child.kill();
  }
}
