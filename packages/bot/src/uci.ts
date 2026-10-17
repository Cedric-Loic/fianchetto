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

  constructor() {
    const require = createRequire(import.meta.url);
    const { findEngine } = require('stockfish') as { findEngine: (name: string) => string };
    this.#child = spawn(process.execPath, [findEngine('lite-single')], { stdio: 'pipe' });
    this.#child.stdout.on('data', (chunk: Buffer) => {
      this.#buffer += chunk.toString();
      const lines = this.#buffer.split('\n');
      this.#buffer = lines.pop() ?? '';
      for (const line of lines) for (const l of [...this.#listeners]) l(line.trim());
    });
    this.#send('uci');
  }

  #send(command: string): void {
    this.#child.stdin.write(`${command}\n`);
  }

  #waitFor(predicate: (line: string) => boolean, onLine?: (line: string) => void) {
    return new Promise<string>((resolve) => {
      const listener = (line: string) => {
        onLine?.(line);
        if (predicate(line)) {
          this.#listeners = this.#listeners.filter((l) => l !== listener);
          resolve(line);
        }
      };
      this.#listeners.push(listener);
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
