import { describe, expect, it } from 'vitest';
import type { ExplanationKind, GameReview, MoveClass, ReviewMove } from '@sq/shared';
import { threatFen } from '../src/analysis/useEngine';
import { guidedSummary, keyMoments, mistakesOf, splitSquares } from '../src/review/moments';

const zero = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };

function mv(
  ply: number,
  classification: MoveClass,
  winBefore: number,
  winAfter: number,
  kind: ExplanationKind | null = null,
): ReviewMove {
  return {
    ply,
    color: ply % 2 === 1 ? 'w' : 'b',
    san: `m${ply}`,
    uci: 'e2e4',
    classification,
    winBefore,
    winAfter,
    accuracy: 50,
    explanation: kind ? { kind, text: `explication ${ply}` } : null,
  };
}

function reviewOf(moves: ReviewMove[]): GameReview {
  return {
    positions: moves.map(() => 'fen').concat('fen'),
    evals: moves
      .map(() => ({ evalCp: 0, mate: null, bestMoveUci: null, bestMoveSan: null }))
      .concat({ evalCp: 0, mate: null, bestMoveUci: null, bestMoveSan: null }),
    moves,
    accuracy: { w: 81.4, b: 64 },
    counts: {
      w: { ...zero, blunder: 1, mistake: 1, inaccuracy: 2 },
      b: { ...zero, blunder: 1 },
    },
  };
}

describe('moments clés de la revue guidée', () => {
  const moves = [
    mv(1, 'best', 50, 50),
    mv(2, 'inaccuracy', 50, 44, 'generic'),
    mv(3, 'mistake', 55, 40, 'hanging-piece'),
    mv(4, 'blunder', 60, 10, 'allowed-fork'),
    mv(5, 'blunder', 85, 45, 'missed-fork'),
    mv(6, 'good', 55, 53),
    mv(7, 'inaccuracy', 45, 40, 'hanging-piece'),
  ];
  const review = reviewOf(moves);

  it('erreurs et gaffes du camp de l’utilisateur, gain manqué, tournant (une fois)', () => {
    const white = keyMoments(review, 'w');
    expect(white.map((m) => [m.ply, m.tags])).toEqual([
      [3, ['mistake']],
      // Tournant : la plus forte chute (60 → 10), même s'il s'agit d'un coup adverse.
      [4, ['turning-point']],
      [5, ['blunder', 'missed-win']],
    ]);
  });

  it('le tournant rejoint un moment existant sans doublon', () => {
    const black = keyMoments(review, 'b');
    expect(black.map((m) => [m.ply, m.tags])).toEqual([[4, ['blunder', 'turning-point']]]);
  });

  it('camp inconnu : les deux camps ; pas de tournant si la partie ne bascule jamais', () => {
    expect(keyMoments(review, null).map((m) => m.ply)).toEqual([3, 4, 5]);
    const calm = reviewOf([mv(1, 'good', 50, 48), mv(2, 'inaccuracy', 52, 42, 'generic')]);
    expect(keyMoments(calm, null)).toEqual([]);
    expect(mistakesOf(review, 'w').map((m) => m.ply)).toEqual([3, 5]);
  });

  it('bilan : précision, nombres par type, 3 conseils, thème de puzzles le plus fréquent', () => {
    const s = guidedSummary(review, 'w');
    expect(s.accuracy).toEqual([{ color: 'w', value: 81.4 }]);
    expect(s.counts).toEqual({ blunder: 1, mistake: 1, inaccuracy: 2 });
    expect(s.mainKind).toBe('hanging-piece');
    expect(s.puzzlesHref).toBe('#/puzzles/theme/hangingPiece');
    expect(s.tips).toHaveLength(3);
    expect(s.tips[0]).toContain('restent défendues');

    const both = guidedSummary(review, null);
    expect(both.accuracy.map((a) => a.color)).toEqual(['w', 'b']);
    expect(both.counts.blunder).toBe(2);

    // Erreur sans thème de puzzles : « Mes erreurs ».
    const generic = guidedSummary(reviewOf([mv(1, 'mistake', 50, 30, 'generic')]), 'w');
    expect(generic.puzzlesHref).toBe('#/puzzles/mine');
    expect(new Set(generic.tips).size).toBe(3);
  });
});

describe('cases citées dans une explication', () => {
  it('repère les cases, y compris dans une notation (Nxe5, Bc4)', () => {
    const parts = splitSquares('Le cavalier joué en e5 est en prise : Nxe5 puis Bc4, a10 non.');
    expect(parts.filter((p) => p.square).map((p) => p.square)).toEqual(['e5', 'e5', 'c4']);
    expect(parts.map((p) => p.text).join('')).toBe(
      'Le cavalier joué en e5 est en prise : Nxe5 puis Bc4, a10 non.',
    );
  });

  it('ignore les lettres dans un mot', () => {
    expect(splitSquares('tableau h2o ah1').filter((p) => p.square)).toEqual([]);
  });
});

describe('menace', () => {
  it('inverse le trait et efface la case en passant', () => {
    expect(threatFen('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2')).toBe(
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2',
    );
  });
});
