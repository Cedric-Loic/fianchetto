import { describe, expect, it } from 'vitest';
import {
  buildReview,
  classify,
  formatEval,
  gameAccuracy,
  moveAccuracy,
  parseGame,
  splitPgn,
  winChance,
  type EngineEval,
} from '../src/index.js';

describe('probabilité de gain, précision, classes', () => {
  it('winChance : 50 % à égalité, symétrique, bornée, mat = ±1000', () => {
    expect(winChance({ evalCp: 0, mate: null }, 'w')).toBe(50);
    const plus = winChance({ evalCp: 300, mate: null }, 'w');
    expect(plus).toBeGreaterThan(70);
    expect(winChance({ evalCp: 300, mate: null }, 'b')).toBeCloseTo(100 - plus);
    expect(winChance({ evalCp: 5000, mate: null }, 'w')).toBeCloseTo(
      winChance({ evalCp: null, mate: 3 }, 'w'),
    );
    expect(winChance({ evalCp: null, mate: -2 }, 'w')).toBeLessThan(3);
  });

  it('classes selon la perte (seuils 2, 5, 10, 15)', () => {
    expect(classify(true, 40)).toBe('best');
    expect(classify(false, 1)).toBe('excellent');
    expect(classify(false, 3)).toBe('good');
    expect(classify(false, 7)).toBe('inaccuracy');
    expect(classify(false, 12)).toBe('mistake');
    expect(classify(false, 30)).toBe('blunder');
  });

  it('précision : 100 sans perte, décroissante, moyenne de partie', () => {
    expect(moveAccuracy(0)).toBeCloseTo(100, 3);
    expect(moveAccuracy(20)).toBeLessThan(moveAccuracy(5));
    expect(moveAccuracy(200)).toBe(0);
    expect(gameAccuracy([])).toBeNull();
    expect(gameAccuracy([100, 100])).toBe(100);
    expect(gameAccuracy([100, 0])).toBeLessThan(50);
  });

  it('évaluation lisible', () => {
    expect(formatEval({ evalCp: 120, mate: null })).toBe('+1,2');
    expect(formatEval({ evalCp: -50, mate: null })).toBe('−0,5');
    expect(formatEval({ evalCp: 0, mate: null })).toBe('0,0');
    expect(formatEval({ evalCp: null, mate: -2 })).toBe('#-2');
    expect(formatEval({ evalCp: 10_000, mate: null })).toBe('+∞');
  });
});

describe('revue de partie', () => {
  const game = parseGame('1. e4 e5 2. Nf3 Nc6 3. Nxe5 Nxe5 *');
  if (!game) throw new Error('PGN de test illisible');
  const ev = (evalCp: number, bestMoveUci: string, pv: string[] = [bestMoveUci]): EngineEval => ({
    evalCp,
    mate: null,
    bestMoveUci,
    pv,
  });
  const evals = [
    ev(30, 'e2e4'),
    ev(30, 'e7e5'),
    ev(30, 'g1f3'),
    ev(30, 'b8c6'),
    ev(30, 'f1b5'),
    ev(-250, 'c6e5'),
    ev(-270, 'd2d4'),
  ];

  it('classes, explications, précision et bilan par camp', () => {
    const review = buildReview(game, evals);
    expect(review.moves.map((m) => m.classification)).toEqual([
      'best',
      'best',
      'best',
      'best',
      'blunder',
      'best',
    ]);
    expect(review.moves[4]?.explanation?.kind).toBe('hanging-piece');
    expect(review.moves[0]?.explanation).toBeNull();
    expect(review.counts.w.blunder).toBe(1);
    expect(review.counts.b.best).toBe(3);
    expect(review.accuracy.b).toBe(100);
    expect(review.accuracy.w).toBeLessThan(80);
    expect(review.evals[0]?.bestMoveSan).toBe('e4');
    expect(review.positions).toHaveLength(7);
  });

  it('évaluations incohérentes refusées', () => {
    expect(() => buildReview(game, evals.slice(1))).toThrow();
  });
});

describe('lecture des PGN', () => {
  const chessCom = `[Event "Live Chess"]
[Site "Chess.com"]
[White "cedric"]
[Black "adversaire"]
[Result "0-1"]
[WhiteElo "1000"]
[TimeControl "180+2"]
[Link "https://www.chess.com/game/live/1"]

1. f3 {[%clk 0:03:01.9]} 1... e5 {[%clk 0:03:01]} 2. g4 {[%clk 0:03:02]} 2... Qh4# 0-1

[Event "Deuxième"]
[White "a"]
[Black "b"]
[Result "*"]

1. d4 d5 *
`;

  it('découpe un fichier de plusieurs parties et lit les en-têtes et coups', () => {
    const chunks = splitPgn(chessCom);
    expect(chunks).toHaveLength(2);
    const first = parseGame(chunks[0] ?? '');
    expect(first?.headers.White).toBe('cedric');
    expect(first?.headers.Link).toBe('https://www.chess.com/game/live/1');
    expect(first?.moves.map((m) => m.san)).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
    expect(first?.moves[3]?.uci).toBe('d8h4');
    expect(first?.positions).toHaveLength(5);
    expect(parseGame(chunks[1] ?? '')?.moves).toHaveLength(2);
  });

  it('position de départ libre, autres variantes et textes invalides', () => {
    const fromFen = parseGame('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1. e4 *');
    expect(fromFen?.positions[0]).toBe('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(parseGame('[Variant "Chess960"]\n\n1. e4 *')).toBeNull();
    expect(parseGame('ceci n’est pas un PGN')).toBeNull();
    expect(parseGame('[Event "vide"]\n\n*')).toBeNull();
    expect(splitPgn('﻿1. e4 e5 *')).toEqual(['1. e4 e5 *']);
  });
});
