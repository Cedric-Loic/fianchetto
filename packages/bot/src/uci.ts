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
}

export interface SearchOptions {
  movetimeMs: number;
  multipv: number;
  skill: number;
}

const MATE_SCORE = 100_000;

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
          const m = /multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/.exec(l);
          if (!m) return;
          const value = Number(m[3]);
          const mate = m[2] === 'mate' ? value : null;
          const score =
            mate === null ? value : Math.sign(mate || -1) * (MATE_SCORE - 100 * Math.abs(mate));
          const pv = (m[4] ?? '').trim().split(/\s+/);
          lines.set(Number(m[1]), { move: pv[0] ?? '', score, mate, pv });
        },
        options.movetimeMs + 10_000,
      );
      const result = [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
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

  quit(): void {
    this.#send('quit');
    this.#child.kill();
  }
}
