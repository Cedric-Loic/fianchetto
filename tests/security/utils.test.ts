import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  pawnStartSquares,
  type PublicMove,
  type Square,
  type Viewer,
  type ViewerBoardState,
} from '@sq/shared';
import { Secret } from '@sq/shared/secret';
import {
  REDACTED,
  observableSerializations,
  realInitialFen,
  realPawnRankToken,
  secretCanaryTokens,
} from './canary.js';
import { bareRefusalViolations, projectionViolations, publicMoveViolations } from './invariants.js';
import {
  compareObservations,
  firstDifference,
  normalizeVolatile,
  omitKeysDeep,
} from './normalize.js';
import {
  candidateIntents,
  initialDisplayedPieces,
  intentKey,
  pickIntent,
  uci,
} from './public-board.js';
import { findForbidden, findRealStateByReflection } from './scan.js';
import { allWorldPairs, arbSeeds, arbWorldPair, arbWorldPairScenario } from './world-pairs.js';

/*
 * Auto-tests du banc : ils ne dépendent pas du moteur et prouvent que les détecteurs
 * détectent (contrôles positifs) sans fausse alerte sur une sortie conforme.
 */

function initialState(viewer: Viewer, ownSecret: Square | null = null): ViewerBoardState {
  return {
    viewer,
    pieces: initialDisplayedPieces(),
    turn: 'w',
    fullmoveNumber: 1,
    inCheck: false,
    moves: [],
    captured: { w: [], b: [] },
    ownSecret:
      viewer === 'public' || ownSecret === null
        ? null
        : { pieceId: `${viewer}p${ownSecret}`, square: ownSecret },
    result: null,
    reveal: null,
  };
}

const E4: PublicMove = {
  ply: 1,
  color: 'w',
  pieceId: 'wpe2',
  displayedType: 'p',
  from: 'e2',
  to: 'e4',
  san: 'e4',
  capture: null,
  promotion: null,
  castle: null,
  check: false,
  checkmate: false,
};

describe('canaris', () => {
  it('rangée FEN réelle et FEN initiale réelle', () => {
    expect(realPawnRankToken('w', 'e2')).toBe('PPPPQPPP');
    expect(realPawnRankToken('b', 'c7')).toBe('ppqppppp');
    expect(realInitialFen({ w: 'a2', b: 'h7' })).toBe(
      'rnbqkbnr/pppppppq/8/8/8/8/QPPPPPPP/RNBQKBNR',
    );
    expect(secretCanaryTokens('w', 'e2')).toEqual(['PPPPQPPP', 'wqe2']);
  });

  it('sérialisations observables : un Secret ne fuit pas, un objet nu fuit', () => {
    const marker = 'CANARY-serialisation';
    for (const text of Object.values(observableSerializations(new Secret(marker)))) {
      expect(text).not.toContain(marker);
    }
    const leaky = observableSerializations({ marker });
    expect(leaky.json).toContain(marker);
    expect(leaky.inspect).toContain(marker);
  });
});

describe('scan des champs interdits', () => {
  it('aucune fausse alerte sur une projection initiale conforme', () => {
    for (const viewer of ['w', 'b', 'public'] as const) {
      expect(findForbidden(initialState(viewer, viewer === 'public' ? null : 'e2'))).toEqual([]);
    }
  });

  it.each([
    ['fen', { fen: 'x' }],
    ['fen', { note: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPQPPP/RNBQKBNR w KQkq - 0 1' }],
    ['prise-en-passant', { epSquare: 'e3' }],
    ['prise-en-passant', { enPassant: null }],
    ['compteur-50-coups', { halfmoveClock: 0 }],
    ['compteur-50-coups', { fiftyMoveCounter: 3 }],
    ['droits-de-roque', { castlingRights: 'KQkq' }],
    ['repetition', { repetitionCount: 1 }],
    ['coups-legaux', { legalMoves: [] }],
    ['notation-ou-type-reel', { realSan: 'Qe4' }],
    ['notation-ou-type-reel', { pieces: [{ trueType: 'q' }] }],
    ['secret', { opponentSecret: 'e7' }],
    ['motif', { ok: false, reason: 'pinned' }],
    ['secret-masque', { leaked: REDACTED }],
    ['undefined', { castle: undefined }],
    ['non-donnee', { s: new Secret('x') }],
    ['non-donnee', { m: new Map() }],
  ])('détecte la règle %s', (rule, value) => {
    expect(findForbidden(value).map((f) => f.rule)).toContain(rule);
  });

  it('autorise ownSecret, result.reason, castle ; reveal seulement après la fin', () => {
    const allowed = {
      ownSecret: { pieceId: 'wpe2', square: 'e2' },
      result: { winner: null, reason: 'agreement' },
      castle: null,
    };
    expect(findForbidden(allowed)).toEqual([]);
    const ended = { reveal: { realInitialFen: realInitialFen({ w: 'e2', b: 'e7' }) } };
    expect(findForbidden(ended)).not.toEqual([]);
    expect(findForbidden(ended, { allowReveal: true })).toEqual([]);
  });

  it('recherche des jetons canaris dans les valeurs et les clés', () => {
    expect(findForbidden({ id: 'wqe2' }, { tokens: ['wqe2'] }).map((f) => f.rule)).toEqual([
      'canari',
    ]);
    expect(findForbidden({ wqe2: 1 }, { tokens: ['wqe2'] }).map((f) => f.rule)).toEqual(['canari']);
  });

  it('réflexion : détecte un moteur ou une FEN hors champ privé, ignore les champs #', () => {
    class FakeChess {
      fen() {
        return '8/8/8/8/8/8/8/8 w - - 0 1';
      }
      board() {
        return [];
      }
    }
    class PublicFields {
      chess = new FakeChess();
      cache = { lastFen: realInitialFen({ w: 'e2', b: 'e7' }) };
    }
    class PrivateFields {
      readonly #chess = new FakeChess();
      readonly secret = new Secret(realInitialFen({ w: 'e2', b: 'e7' }));
      get turn() {
        return this.#chess.fen().split(' ')[1];
      }
    }
    const rules = findRealStateByReflection(new PublicFields(), ['PPPPQPPP']).map((f) => f.rule);
    expect(rules).toContain('moteur-accessible');
    expect(rules).toContain('fen');
    expect(rules).toContain('canari');
    expect(findRealStateByReflection(new PrivateFields(), ['PPPPQPPP'])).toEqual([]);
  });
});

describe('normalisation et comparaison', () => {
  it('remplace pendules, horodatages et identifiants en conservant les égalités', () => {
    const value = {
      gameId: 'g-123',
      rematch: { nextGameId: null },
      clock: { remainingMs: { w: 1000, b: 2000 }, running: 'w' },
      startedAt: '2026-10-17T10:00:00.000Z',
      again: { gameId: 'g-123' },
      other: { gameId: 'g-456' },
      pieceId: 'wpe2',
    };
    expect(normalizeVolatile(value)).toEqual({
      gameId: '<gameId#1>',
      rematch: { nextGameId: null },
      clock: { remainingMs: { w: '<ms>', b: '<ms>' }, running: 'w' },
      startedAt: '<startedAt#1>',
      again: { gameId: '<gameId#1>' },
      other: { gameId: '<gameId#2>' },
      pieceId: 'wpe2',
    });
  });

  it("un ordre de clés différent n'est pas « identique » (octets différents)", () => {
    const result = compareObservations({ a: 1, b: 2 }, { b: 2, a: 1 });
    expect(result.deepEqual).toBe(true);
    expect(result.sameBytes).toBe(false);
    expect(result.identical).toBe(false);
  });

  it('première différence avec son chemin', () => {
    expect(firstDifference({ x: [1, { y: 2 }] }, { x: [1, { y: 3 }] })).toEqual({
      path: '$.x[1].y',
      a: 2,
      b: 3,
    });
    expect(firstDifference({ x: 1 }, { x: 1 })).toBeNull();
    expect(omitKeysDeep({ a: { ownSecret: 1, b: 2 } }, ['ownSecret'])).toEqual({ a: { b: 2 } });
  });
});

describe('invariants de projection', () => {
  it('une projection initiale conforme ne viole rien', () => {
    expect(projectionViolations(initialState('w', 'e2'), { viewer: 'w', over: false })).toEqual([]);
    expect(projectionViolations(initialState('public'), { viewer: 'public', over: false })).toEqual(
      [],
    );
  });

  const mutations: Array<[string, (s: ViewerBoardState) => unknown]> = [
    ['champ non déclaré', (s) => ({ ...s, epSquare: null })],
    ['ownSecret adverse', (s) => ({ ...s, ownSecret: { pieceId: 'bpe7', square: 'e7' } })],
    ['ownSecret public', (s) => ({ ...s, viewer: 'public' })],
    [
      'type réel visible',
      (s) => ({ ...s, pieces: s.pieces.map((p) => (p.id === 'bpe7' ? { ...p, type: 'q' } : p)) }),
    ],
    [
      'reveal avant la fin',
      (s) => ({ ...s, reveal: { secrets: {}, realInitialFen: '', plies: [] } }),
    ],
    ['result avant la fin', (s) => ({ ...s, result: { winner: 'w', reason: 'resignation' } })],
    ['pièces non triées', (s) => ({ ...s, pieces: [...s.pieces].reverse() })],
    ['captures incohérentes', (s) => ({ ...s, captured: { w: ['p'], b: [] } })],
  ];
  it.each(mutations)('détecte : %s', (_label, mutate) => {
    const mutated = mutate(initialState('w', 'e2')) as ViewerBoardState;
    expect(projectionViolations(mutated, { viewer: 'w', over: false })).not.toEqual([]);
  });

  it('notation : pion, coordonnées, pièce ; rejette la notation réelle', () => {
    expect(publicMoveViolations(E4)).toEqual([]);
    expect(publicMoveViolations({ ...E4, to: 'd5', san: 'e2-d5' })).toEqual([]);
    expect(publicMoveViolations({ ...E4, san: 'Qe4' })).not.toEqual([]);
    expect(
      publicMoveViolations({
        ...E4,
        san: 'e2-e4',
        capture: { pieceId: 'bpe7', displayedType: 'p', square: 'e4' },
      }),
    ).not.toEqual([]);
    expect(
      publicMoveViolations({
        ...E4,
        pieceId: 'wng1',
        displayedType: 'n',
        from: 'g1',
        to: 'e2',
        san: 'Nge2',
      }),
    ).toEqual([]);
    expect(publicMoveViolations({ ...E4, san: 'e4+', check: false })).not.toEqual([]);
  });

  it('refus nu : exactement { ok: false }', () => {
    expect(bareRefusalViolations({ ok: false })).toEqual([]);
    expect(bareRefusalViolations({ ok: false, reason: 'pinned' })).not.toEqual([]);
    expect(bareRefusalViolations({ ok: false, reason: undefined })).not.toEqual([]);
    const hidden = { ok: false };
    Object.defineProperty(hidden, 'why', { value: 'check', enumerable: false });
    expect(bareRefusalViolations(hidden)).not.toEqual([]);
    expect(
      bareRefusalViolations(Object.assign(Object.create({ why: 1 }) as object, { ok: false })),
    ).not.toEqual([]);
  });
});

describe('échiquier public', () => {
  it('les 20 coups légaux initiaux font partie des candidats', () => {
    const { displayed, pawnAsQueen } = candidateIntents(initialState('public'));
    const keys = new Set(displayed.map(intentKey));
    for (const file of 'abcdefgh') {
      expect(keys.has(`${file}2${file}3`)).toBe(true);
      expect(keys.has(`${file}2${file}4`)).toBe(true);
    }
    for (const move of ['b1a3', 'b1c3', 'g1f3', 'g1h3']) expect(keys.has(move)).toBe(true);
    const queenKeys = pawnAsQueen.map(intentKey);
    expect(queenKeys).toContain('e2e5');
    expect(queenKeys).toContain('e2a6');
    expect(queenKeys.some((k) => keys.has(k))).toBe(false);
  });

  it('pickIntent est déterministe et uci se lit correctement', () => {
    const state = initialState('public');
    expect(pickIntent(state, 12345)).toEqual(pickIntent(state, 12345));
    expect(uci('b7a8n')).toEqual({ from: 'b7', to: 'a8', promotion: 'n' });
    expect(uci('e2e4')).toEqual({ from: 'e2', to: 'e4' });
  });
});

describe('paires de mondes', () => {
  it('ne diffèrent que par le secret du camp caché', () => {
    fc.assert(
      fc.property(arbWorldPair, (pair) => {
        expect(pair.a[pair.hidden]).not.toBe(pair.b[pair.hidden]);
        expect(pair.a[pair.observer]).toBe(pair.b[pair.observer]);
        for (const world of [pair.a, pair.b]) {
          expect(pawnStartSquares('w')).toContain(world.w);
          expect(pawnStartSquares('b')).toContain(world.b);
        }
      }),
    );
  });

  it('énumération exhaustive : 2 camps × 8 × 7 paires', () => {
    const pairs = allWorldPairs({ w: 'a2', b: 'h7' });
    expect(pairs).toHaveLength(112);
    expect(new Set(pairs.map((p) => JSON.stringify(p))).size).toBe(112);
  });

  it('les graines forment des suites longues (pas le plafond par défaut de fast-check)', () => {
    const lengths = fc.sample(arbSeeds(200), { numRuns: 100, seed: 3 }).map((s) => s.length);
    const mean = lengths.reduce((sum, n) => sum + n, 0) / lengths.length;
    expect(mean).toBeGreaterThan(50);
    expect(Math.max(...lengths)).toBeGreaterThan(150);
  });

  it('les scénarios sont rejouables (même graine fast-check → même scénario)', () => {
    const first = fc.sample(arbWorldPairScenario(50), { numRuns: 5, seed: 42 });
    const second = fc.sample(arbWorldPairScenario(50), { numRuns: 5, seed: 42 });
    expect(first).toEqual(second);
  });
});
