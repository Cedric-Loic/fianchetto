import { Chess } from 'chess.js';
import { afterAll, describe, expect, it } from 'vitest';
import { UciEngine } from '@sq/bot';
import { ENDGAMES } from '@sq/coach';

/*
 * Finales contre le bot vérifiées par Stockfish (long : `pnpm test:stress`) : l'évaluation, du
 * point de vue du joueur (qui a le trait), correspond au résultat attendu.
 * - gagner : au moins +4 pions ou un mat pour le joueur ;
 * - tenir : évaluation proche de zéro (Stockfish connaît ces nulles théoriques).
 */

const engine = new UciEngine();
afterAll(() => engine.quit());

describe('finales vérifiées par Stockfish', () => {
  it.each(ENDGAMES.map((e) => [e.id, e] as const))('%s', async (_id, e) => {
    expect(new Chess(e.fen).isGameOver()).toBe(false);
    const [line] = await engine.analyze(e.fen, { movetimeMs: 1500, multipv: 1, skill: 20 });
    expect(line).toBeDefined();
    const score = line?.score ?? 0;
    if (e.goal === 'win') {
      expect(line?.mate === null ? score >= 400 : (line?.mate ?? 0) > 0, `éval ${score}`).toBe(
        true,
      );
    } else {
      expect(line?.mate ?? null, `mat ${line?.mate}`).toBeNull();
      expect(Math.abs(score), `éval ${score}`).toBeLessThanOrEqual(100);
    }
  });
});
