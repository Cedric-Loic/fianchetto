import { Chess } from 'chess.js';
import { afterAll, describe, expect, it } from 'vitest';
import { UciEngine } from '@sq/bot';
import { LESSONS, winChance } from '@sq/coach';

/*
 * Vérification des exercices des leçons par Stockfish (long : `pnpm test:stress`).
 * - mode `exact` : chaque coup du joueur est le meilleur coup du moteur (ou un autre mat) ;
 * - mode `engine` : la solution est acceptée et chaque piège refusé, avec la tolérance de
 *   l'exercice.
 */

const engine = new UciEngine();
afterAll(() => engine.quit());

function play(chess: Chess, uci: string) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

/** Évaluation (point de vue des Blancs) d'une position, finale comprise. */
async function whiteCp(fen: string): Promise<number> {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return chess.turn() === 'w' ? -100_000 : 100_000;
  if (chess.isGameOver()) return 0;
  const [line] = await engine.analyze(fen, { movetimeMs: 400, multipv: 1, skill: 20 });
  return (line?.score ?? 0) * (chess.turn() === 'w' ? 1 : -1);
}

const cases = LESSONS.flatMap((l) =>
  l.exercises.filter((e) => e.mode !== 'choice').map((e, i) => [`${l.id}#${i}`, e] as const),
);

describe('exercices des leçons vérifiés par Stockfish', () => {
  it.each(cases)('%s', async (_tag, e) => {
    const chess = new Chess(e.fen);
    const color = chess.turn();
    if (e.mode === 'exact') {
      for (const [k, uci] of e.solution.entries()) {
        if (k % 2 === 0) {
          const fen = chess.fen();
          const [best] = await engine.analyze(fen, { movetimeMs: 600, multipv: 1, skill: 20 });
          const probe = new Chess(fen);
          play(probe, uci);
          expect(best?.move === uci || probe.isCheckmate(), `coup ${k} (${uci})`).toBe(true);
        }
        play(chess, uci);
      }
      return;
    }
    const before = winChance({ evalCp: await whiteCp(e.fen), mate: null }, color);
    for (const uci of [...e.solution, ...(e.traps ?? [])]) {
      const after = new Chess(e.fen);
      play(after, uci);
      const loss = before - winChance({ evalCp: await whiteCp(after.fen()), mate: null }, color);
      const accepted = loss <= (e.tolerance ?? 5);
      expect(accepted, `${uci} (perte ${loss.toFixed(1)})`).toBe(!e.traps?.includes(uci));
    }
  });
});
