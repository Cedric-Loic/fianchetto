import { describe, expect, it } from 'vitest';
import type { PositionAnalysis } from '@sq/bot';
import { TrainingService } from '../src/training/service.js';

/** Service d'entraînement avec une évaluation imposée (meilleur coup choisi par le test). */
function withBest(bestMoveUci: string, extra: Partial<PositionAnalysis> = {}) {
  return new TrainingService(() =>
    Promise.resolve({ evalCp: 50, mate: null, bestMoveUci, pv: [bestMoveUci], ...extra }),
  );
}

// Cavalier blanc c3 attaqué par le pion b4.
const KNIGHT_ATTACKED = '4k3/8/8/8/1p6/2N5/8/4K3 w - - 0 1';

describe('indice de niveau 1 : zone à regarder', () => {
  it('pièce menacée marquée quand elle n’est pas celle du meilleur coup', async () => {
    const hint = await withBest('e1d2').hint(KNIGHT_ATTACKED, 1);
    expect(hint?.text).toContain('c3 est menacé');
    expect(hint?.marks).toEqual([{ square: 'c3', kind: 'hanging' }]);
  });

  it('jamais la case de départ ni d’arrivée du meilleur coup', async () => {
    const hint = await withBest('c3e4').hint(KNIGHT_ATTACKED, 1);
    expect(hint?.text).toContain('mets-le à l');
    const squares = (hint?.marks ?? []).map((m) => m.square);
    expect(squares).not.toContain('c3');
    expect(squares).not.toContain('e4');
    expect(hint?.marks).toEqual([{ square: 'b4', kind: 'attacker' }]);
    expect(hint).toMatchObject({ from: null, to: null });
  });

  it('prise gagnante : la cible, sauf si une seule pièce peut la prendre', async () => {
    const two = await withBest('c3d5').hint('4k3/8/8/3q4/8/2N1N3/8/4K3 w - - 0 1', 1);
    expect(two?.text).toBe('Une prise gagne du matériel.');
    expect(two?.marks).toEqual([{ square: 'd5', kind: 'target' }]);
    const one = await withBest('c3d5').hint('4k3/8/8/3q4/8/2N5/8/4K3 w - - 0 1', 1);
    expect(one?.text).toBe('Une prise gagne du matériel.');
    expect(one?.marks).toBeUndefined();
  });

  it('mat : le roi adverse ; niveaux 2 et 3 sans marques', async () => {
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    const service = withBest('h5f7', { evalCp: null, mate: 1 });
    expect((await service.hint(fen, 1))?.marks).toEqual([{ square: 'e8', kind: 'mate' }]);
    expect((await service.hint(fen, 2))?.marks).toBeUndefined();
    expect((await service.hint(fen, 3))?.marks).toBeUndefined();
  });
});
