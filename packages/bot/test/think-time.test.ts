import { describe, expect, it } from 'vitest';
import type { BotObservation } from '@sq/shared';
import { targetThinkMs } from '../src/think-time.js';

function obs(clock: BotObservation['state']['clock'], plies: number): BotObservation {
  return {
    botColor: 'b',
    rejections: [],
    state: {
      clock,
      board: { moves: Array.from({ length: plies }) },
    } as unknown as BotObservation['state'],
  };
}

const blitz = (ms: number) => ({
  remainingMs: { w: ms, b: ms },
  running: 'b' as const,
  incrementMs: 2000,
});

describe('temps de réflexion du bot', () => {
  it('3+2 en milieu de partie : quelques secondes, variables, jamais plus de 1/8 du temps', () => {
    const samples = Array.from({ length: 300 }, () => targetThinkMs(obs(blitz(150_000), 30)));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    expect(mean).toBeGreaterThan(2500);
    expect(mean).toBeLessThan(9000);
    expect(new Set(samples).size).toBeGreaterThan(50); // aléatoire
    expect(Math.max(...samples)).toBeLessThanOrEqual(150_000 / 8);
  });

  it("joue plus vite dans l'ouverture", () => {
    const avg = (plies: number) =>
      Array.from({ length: 300 }, () => targetThinkMs(obs(blitz(180_000), plies))).reduce(
        (a, b) => a + b,
        0,
      ) / 300;
    expect(avg(2)).toBeLessThan(avg(30) / 2);
  });

  it('presque plus de temps : il se dépêche sans perdre au temps', () => {
    for (let i = 0; i < 100; i++) {
      expect(targetThinkMs(obs(blitz(4_000), 40))).toBeLessThanOrEqual(500);
    }
  });

  it('sans pendule : entre 0,8 et 3 s', () => {
    for (let i = 0; i < 100; i++) {
      const t = targetThinkMs(obs(null, 20));
      expect(t).toBeGreaterThanOrEqual(800);
      expect(t).toBeLessThanOrEqual(3000);
    }
  });
});
