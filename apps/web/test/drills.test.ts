import { afterEach, describe, expect, it } from 'vitest';
import {
  formatClock,
  knightDistance,
  randomSquare,
  saveVisionScore,
  squareColor,
  visionRecords,
} from '../src/lib/drills';

describe('entraînement rapide : utilitaires', () => {
  afterEach(() => localStorage.clear());

  it('formatClock : m:ss, puis h:mm:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(-5)).toBe('0:00');
    expect(formatClock(3_725_000)).toBe('1:02:05');
  });

  it('couleur des cases : a1 et h8 foncées, h1 et a8 claires', () => {
    expect(squareColor('a1')).toBe('dark');
    expect(squareColor('h8')).toBe('dark');
    expect(squareColor('h1')).toBe('light');
    expect(squareColor('a8')).toBe('light');
    expect(squareColor('e4')).toBe('light');
    expect(squareColor('d4')).toBe('dark');
  });

  it('distance du cavalier : cas connus (dont le coin, plus long)', () => {
    expect(knightDistance('g1', 'g1')).toBe(0);
    expect(knightDistance('g1', 'f3')).toBe(1);
    expect(knightDistance('b1', 'c3')).toBe(1);
    expect(knightDistance('e4', 'e5')).toBe(3);
    expect(knightDistance('a1', 'b2')).toBe(4);
    expect(knightDistance('a1', 'h8')).toBe(6);
  });

  it('case au hasard : jamais celle à éviter', () => {
    let calls = 0;
    // Premier tirage = a1 (évité), second = b1.
    const values = [0, 0, 0.13, 0];
    const random = () => values[calls++ % values.length] ?? 0;
    expect(randomSquare(random, 'a1')).toBe('b1');
  });

  it('records : seulement s’ils battent l’ancien', () => {
    expect(visionRecords()).toEqual({});
    expect(saveVisionScore('coords', 12)).toBe(true);
    expect(saveVisionScore('coords', 10)).toBe(false);
    expect(saveVisionScore('coords', 15)).toBe(true);
    expect(saveVisionScore('knight', 3)).toBe(true);
    expect(visionRecords()).toEqual({ coords: 15, knight: 3 });
  });
});
