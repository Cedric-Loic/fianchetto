import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { opposite, type Viewer } from '@sq/shared';
import { projectForViewer } from '@sq/engine';
import { formatReport, persistedOf, runWorldPair, type Projector } from './harness.js';
import {
  allWorldPairs,
  arbWorldPairScenario,
  type ExternalEnding,
  type WorldPairScenario,
} from './world-pairs.js';

/*
 * Indistinguabilité (`docs/SPEC.md` §10) : deux mondes qui ne diffèrent que par le secret d'un
 * camp, même suite de coups acceptée dans les deux, mêmes annonces → l'adversaire et le public
 * voient STRICTEMENT la même chose (ordre des clés compris). Version longue :
 * `indistinguishability.stress.ts` (10 000 paires).
 */

export const RUNS = 200;
export const MAX_ATTEMPTS = 220;
export const MAX_PLIES = 60;

/** Propriété commune aux versions courte et longue. */
export function assertIndistinguishable(numRuns: number, maxPlies: number, maxAttempts: number) {
  fc.assert(
    fc.property(arbWorldPairScenario(maxAttempts), (scenario) => {
      const report = runWorldPair(scenario, { maxPlies, checkInvariants: true });
      if (report.leaks.length > 0) throw new Error(`fuite :\n${formatReport(scenario, report)}`);
    }),
    { numRuns },
  );
}

const ENDINGS: ExternalEnding[] = [
  'resign-hidden',
  'resign-observer',
  'draw',
  'flag-hidden',
  'flag-observer',
];

describe('indistinguabilité : paires de mondes', () => {
  it('position initiale : les 8 secrets adverses sont indiscernables (exhaustif)', () => {
    for (const pair of allWorldPairs({ w: 'd2', b: 'e7' })) {
      const scenario: WorldPairScenario = { pair, seeds: [], ending: 'none' };
      const report = runWorldPair(scenario, { checkInvariants: true });
      expect(report.leaks, formatReport(scenario, report)).toEqual([]);
    }
  });

  it('fin externe immédiate : même résultat, mêmes projections hors révélation (exhaustif)', () => {
    for (const pair of allWorldPairs({ w: 'a2', b: 'h7' })) {
      for (const ending of ENDINGS) {
        const scenario: WorldPairScenario = { pair, seeds: [], ending };
        const report = runWorldPair(scenario);
        expect(report.leaks, formatReport(scenario, report)).toEqual([]);
      }
    }
  });

  it(`parties aléatoires : ${RUNS} paires de mondes`, () => {
    assertIndistinguishable(RUNS, MAX_PLIES, MAX_ATTEMPTS);
  });

  it('le banc progresse réellement (suites communes non triviales)', () => {
    const scenarios = fc.sample(arbWorldPairScenario(MAX_ATTEMPTS), { numRuns: 40, seed: 7 });
    const lengths = scenarios.map((s) => runWorldPair(s, { maxPlies: MAX_PLIES }).committed.length);
    const average = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
    // Une moyenne trop faible voudrait dire que le banc ne compare presque rien.
    expect(average).toBeGreaterThan(15);
  });
});

describe('indistinguabilité : contrôles positifs (fuites injectées)', () => {
  /** Secret adverse d'un spectateur, lu dans la forme persistée (tests seulement). */
  const opponentSecretId = (viewer: Viewer, game: Parameters<Projector>[0]): string => {
    const color = viewer === 'public' ? 'w' : opposite(viewer);
    return `${color}p${persistedOf(game).secrets[color]}`;
  };

  const scenario = (hidden: 'w' | 'b', seeds: number[] = []): WorldPairScenario => ({
    pair:
      hidden === 'b'
        ? { hidden, observer: 'w', a: { w: 'e2', b: 'a7' }, b: { w: 'e2', b: 'h7' } }
        : { hidden, observer: 'b', a: { w: 'a2', b: 'e7' }, b: { w: 'h2', b: 'e7' } },
    seeds,
    ending: 'none',
  });

  it("détecte un ordre des pièces qui place le pion secret adverse en dernier", () => {
    const leaky: Projector = (game, viewer) => {
      const state = projectForViewer(game, viewer);
      const id = opponentSecretId(viewer, game);
      const pieces = [
        ...state.pieces.filter((p) => p.id !== id),
        ...state.pieces.filter((p) => p.id === id),
      ];
      return { ...state, pieces };
    };
    const report = runWorldPair(scenario('b'), { projector: leaky });
    expect(report.leaks.map((l) => l.step)).toContain('projection w');
  });

  it("détecte un ordre des clés dépendant du secret (octets différents)", () => {
    const leaky: Projector = (game, viewer) => {
      const state = projectForViewer(game, viewer);
      if (!opponentSecretId(viewer, game).endsWith('a2')) return state;
      const { viewer: v, ...rest } = state;
      return { ...rest, viewer: v };
    };
    const report = runWorldPair(scenario('w'), { projector: leaky });
    expect(report.leaks.some((l) => l.detail.includes('ordre des clés'))).toBe(true);
  });

  it('détecte un champ interdit, même identique dans les deux mondes (invariants)', () => {
    const leaky: Projector = (game, viewer) => ({
      ...projectForViewer(game, viewer),
      epSquare: null,
    });
    const report = runWorldPair(scenario('b'), { projector: leaky, checkInvariants: true });
    expect(report.leaks.some((l) => l.step.startsWith('invariants'))).toBe(true);
  });

  it('détecte une fuite qui n’apparaît qu’après quelques coups', () => {
    // Fuite : le numéro de coup est décalé dès que le pion secret adverse a quitté sa case.
    const leaky: Projector = (game, viewer) => {
      const state = projectForViewer(game, viewer);
      const id = opponentSecretId(viewer, game);
      const moved = state.moves.some((m) => m.pieceId === id);
      return moved ? { ...state, inCheck: !state.inCheck } : state;
    };
    const found = fc.sample(arbWorldPairScenario(MAX_ATTEMPTS), { numRuns: 60, seed: 11 }).some(
      (s) => runWorldPair(s, { projector: leaky, maxPlies: MAX_PLIES }).leaks.length > 0,
    );
    expect(found).toBe(true);
  });
});
