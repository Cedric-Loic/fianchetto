import { describe, expect, it } from 'vitest';
import type { GameReview, ReviewMove } from '@sq/shared';
import { INITIAL_GLICKO, puzzlesFromReview, updateGlicko } from '../src/index.js';

describe('Glicko-2', () => {
  it('exemple de Glickman (un seul adversaire) : sens et ordre de grandeur', () => {
    const player = { rating: 1500, deviation: 200, volatility: 0.06 };
    const win = updateGlicko(player, { rating: 1400, deviation: 30 }, 1);
    const loss = updateGlicko(player, { rating: 1400, deviation: 30 }, 0);
    expect(win.rating).toBeGreaterThan(1500);
    expect(win.rating).toBeLessThan(1600);
    expect(loss.rating).toBeLessThan(1500);
    expect(win.deviation).toBeLessThan(200);
  });

  it('un nouveau joueur bouge beaucoup, puis se stabilise', () => {
    const first = updateGlicko(INITIAL_GLICKO, { rating: 1500, deviation: 80 }, 1);
    expect(first.rating - 1500).toBeGreaterThan(100);
    let p = INITIAL_GLICKO;
    for (let i = 0; i < 60; i++) p = updateGlicko(p, { rating: 1200, deviation: 80 }, i % 2);
    expect(p.deviation).toBeLessThan(120);
    const next = updateGlicko(p, { rating: 1200, deviation: 80 }, 1);
    expect(next.rating - p.rating).toBeLessThan(40);
  });

  it('battre un puzzle bien plus faible rapporte peu ; échouer coûte cher', () => {
    const p = { rating: 1500, deviation: 80, volatility: 0.06 };
    const easyWin = updateGlicko(p, { rating: 1000, deviation: 80 }, 1).rating - 1500;
    const easyLoss = updateGlicko(p, { rating: 1000, deviation: 80 }, 0).rating - 1500;
    expect(easyWin).toBeLessThan(3);
    expect(easyLoss).toBeLessThan(-10);
  });
});

describe('puzzles tirés de mes erreurs', () => {
  const move = (ply: number, cls: ReviewMove['classification'], winBefore = 50): ReviewMove => ({
    ply,
    color: ply % 2 === 1 ? 'w' : 'b',
    san: 'x',
    uci: `a${ply}a${ply}`,
    classification: cls,
    winBefore,
    winAfter: 10,
    accuracy: 10,
    explanation: cls === 'blunder' ? { kind: 'hanging-piece', text: '…' } : null,
  });
  const review = {
    positions: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5'],
    evals: [0, 1, 2, 3, 4, 5].map((i) => ({
      evalCp: i * 10,
      mate: null,
      bestMoveUci: `best${i}`,
      bestMoveSan: null,
    })),
    moves: [
      move(1, 'blunder'), // premier coup : pas de coup adverse avant
      move(2, 'best'),
      move(3, 'blunder'),
      move(4, 'mistake'), // camp adverse
      move(5, 'mistake', 10), // position déjà perdue
    ],
    accuracy: { w: null, b: null },
    counts: { w: {}, b: {} },
  } as unknown as GameReview;

  it('ne garde que mes erreurs et gaffes utiles, au format Lichess', () => {
    expect(puzzlesFromReview(review, 'w')).toEqual([
      {
        ply: 3,
        fen: 'p1',
        moves: ['a2a2', 'best2'],
        evalCp: 20,
        mate: null,
        kind: 'hanging-piece',
      },
    ]);
    expect(puzzlesFromReview(review, 'b').map((p) => p.ply)).toEqual([4]);
  });
});
