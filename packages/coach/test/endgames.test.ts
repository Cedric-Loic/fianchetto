import { Chess, validateFen } from 'chess.js';
import { describe, expect, it } from 'vitest';
import {
  ENDGAMES,
  endgameByFen,
  endgameById,
  endgameColor,
  endgameSucceeded,
  kpkResult,
  lessonById,
} from '../src/index.js';

/*
 * Bibliothèque des finales : positions légales (le camp sans le trait n'est pas en échec), pas
 * déjà terminées, identifiants uniques, leçons liées existantes. La cohérence avec l'évaluation
 * de Stockfish est vérifiée par `pnpm test:stress` (apps/server/test/endgames.stress.ts).
 */

function sideNotToMoveInCheck(fen: string): boolean {
  const parts = fen.split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  return new Chess(parts.join(' ')).inCheck();
}

describe('finales', () => {
  it('une douzaine de positions, identifiants et FEN uniques', () => {
    expect(ENDGAMES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(ENDGAMES.map((e) => e.id)).size).toBe(ENDGAMES.length);
    expect(new Set(ENDGAMES.map((e) => e.fen)).size).toBe(ENDGAMES.length);
  });

  it.each(ENDGAMES.map((e) => [e.id, e] as const))('%s : position légale', (_id, e) => {
    expect(validateFen(e.fen).ok).toBe(true);
    expect(sideNotToMoveInCheck(e.fen)).toBe(false);
    expect(new Chess(e.fen).isGameOver()).toBe(false);
    expect(e.objective.length).toBeGreaterThan(20);
    if (e.lesson) expect(lessonById(e.lesson), e.lesson).toBeDefined();
    expect(endgameById(e.id)).toBe(e);
    expect(endgameByFen(e.fen)).toBe(e);
  });

  it('chapitres : palier, indices, limite de coups cohérents', () => {
    for (const e of ENDGAMES) {
      expect([1, 2, 3], e.id).toContain(e.stage);
      expect(e.hints, e.id).toHaveLength(3);
      for (const h of e.hints ?? []) expect(h.length, e.id).toBeGreaterThan(5);
      // Une victoire a une limite de coups ; une nulle à tenir peut ne pas en avoir (durée laissée au bot).
      if (e.goal === 'win') expect(e.maxMoves, e.id).toBeGreaterThan(0);
      expect(
        e.objective.split(/[.!?]/).filter((x) => x.trim()).length,
        e.id,
      ).toBeGreaterThanOrEqual(2);
    }
    // Palier 1 : dix chapitres, chacun relié à un cours.
    const stage1 = ENDGAMES.filter((e) => e.stage === 1);
    expect(stage1.length).toBeGreaterThanOrEqual(10);
    for (const e of stage1) expect(e.lesson, e.id).toBeDefined();
  });

  it('finales roi et pion contre roi : l’objectif correspond à la base KPK', () => {
    let checked = 0;
    for (const e of ENDGAMES) {
      const result = kpkResult(e.fen);
      if (result === null) continue;
      checked++;
      const pawnColor = /P/.test(e.fen.split(' ')[0] ?? '') ? 'w' : 'b';
      if (endgameColor(e) === pawnColor) {
        // Le joueur a le pion : il doit pouvoir gagner (l'objectif « nulle » n'aurait pas de sens).
        expect(result, e.id).toBe('win');
        expect(e.goal, e.id).toBe('win');
      } else {
        // Le joueur défend : la nulle est le meilleur résultat possible, et elle doit exister.
        expect(result, e.id).toBe('draw');
        expect(e.goal, e.id).toBe('draw');
      }
    }
    expect(checked).toBeGreaterThanOrEqual(6);
  });

  it('réussite selon l’objectif', () => {
    const win = endgameById('lucena');
    const draw = endgameById('philidor');
    if (!win || !draw) throw new Error('finales manquantes');
    expect(endgameColor(win)).toBe('w');
    expect(endgameColor(draw)).toBe('b');
    expect(endgameSucceeded(win, { winner: 'w', reason: 'checkmate' })).toBe(true);
    expect(endgameSucceeded(win, { winner: null, reason: 'stalemate' })).toBe(false);
    expect(endgameSucceeded(win, { winner: 'b', reason: 'resignation' })).toBe(false);
    expect(endgameSucceeded(draw, { winner: null, reason: 'fifty-move-rule' })).toBe(true);
    expect(endgameSucceeded(draw, { winner: null, reason: 'threefold-repetition' })).toBe(true);
    expect(endgameSucceeded(draw, { winner: 'b', reason: 'checkmate' })).toBe(true);
    expect(endgameSucceeded(draw, { winner: null, reason: 'agreement' })).toBe(false);
    expect(endgameSucceeded(draw, { winner: 'w', reason: 'checkmate' })).toBe(false);
  });
});
