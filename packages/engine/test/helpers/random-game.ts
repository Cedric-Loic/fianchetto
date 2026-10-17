import { expect } from 'vitest';
import fc from 'fast-check';
import {
  SQUARES,
  ViewerBoardStateSchema,
  opposite,
  pawnStartSquares,
  type Color,
  type MoveIntent,
  type PublicMove,
  type Square,
  type Viewer,
  type ViewerBoardState,
} from '@sq/shared';
import { SecretQueenGame, projectForViewer, type SecretChoice } from '../../src/index.js';
import { Mirror, type MirrorMove } from './mirror.js';

/*
 * Parties aléatoires pour les tests de propriétés (fast-check) et de stress.
 * Chaque partie est déterminée par un scénario (secrets, graine, fin externe éventuelle) ; le
 * miroir chess.js (positions réelles) sert d'oracle indépendant du moteur.
 */

export type ExternalEnd = 'none' | 'resign' | 'draw' | 'flag';

export interface Scenario {
  secrets: SecretChoice;
  seed: number;
  /** Fin externe appliquée au demi-coup `externalAt` (si la partie n'est pas finie avant). */
  external: ExternalEnd;
  externalAt: number;
  /** Probabilité de choisir une prise quand il y en a (raccourcit les parties). */
  captureBias: number;
}

export function scenarioArbitrary(maxPlies: number): fc.Arbitrary<Scenario> {
  return fc.record({
    secrets: fc.record({
      w: fc.constantFrom(...pawnStartSquares('w')),
      b: fc.constantFrom(...pawnStartSquares('b')),
    }),
    seed: fc.integer(),
    external: fc.constantFrom<ExternalEnd>('none', 'none', 'resign', 'draw', 'flag'),
    externalAt: fc.integer({ min: 0, max: maxPlies }),
    captureBias: fc.constantFrom(0, 0.5, 0.9),
  });
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
export function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function pick<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)] as T;
}

export function chooseMove(
  moves: readonly MirrorMove[],
  random: () => number,
  captureBias: number,
): MirrorMove {
  const captures = moves.filter((m) => m.raw.captured !== undefined);
  if (captures.length > 0 && random() < captureBias) return pick(captures, random);
  return pick(moves, random);
}

const VIEWERS: readonly Viewer[] = ['w', 'b', 'public'];

/** SAN réelle d'un coup du miroir, calculée AVANT de le jouer. */
function realSan(mirror: Mirror, move: MirrorMove, all: readonly MirrorMove[]): string {
  const chess = mirror.chess as unknown as {
    _moveToSan(raw: MirrorMove['raw'], moves: MirrorMove['raw'][]): string;
  };
  return chess._moveToSan(
    move.raw,
    all.map((m) => m.raw),
  );
}

const PIECE_SAN = /^([NBRQK])[a-h]?[1-8]?(x?[a-h][1-8][+#]?)$/;
const PAWN_SAN = /^(?:[a-h]x)?[a-h][1-8](?:=[NBRQ])?[+#]?$/;
const COORDINATE_SAN = /^[a-h][1-8][-x][a-h][1-8][+#]?$/;

function suffix(san: string): string {
  return /[+#]$/.test(san) ? san.slice(-1) : '';
}

/**
 * Vérifie la notation publique d'un coup face à la SAN réelle :
 * - vrai pion : identique ;
 * - pièce affichée N, B, R, Q, K : identique à la désambiguïsation près ;
 * - dame secrète : notation de pion ou coordonnées, jamais de lettre de pièce.
 */
export function checkNotation(move: PublicMove, real: string, isSecret: boolean): void {
  expect(suffix(move.san)).toBe(suffix(real));
  expect(move.check).toBe(suffix(real) !== '');
  expect(move.checkmate).toBe(suffix(real) === '#');
  if (isSecret) {
    expect(move.displayedType).toBe('p');
    expect(move.promotion).toBeNull();
    expect(PAWN_SAN.test(move.san) || COORDINATE_SAN.test(move.san)).toBe(true);
    expect(move.san).not.toContain('=');
    return;
  }
  if (move.displayedType === 'p' || move.castle !== null) {
    expect(move.san).toBe(real);
    return;
  }
  const pub = PIECE_SAN.exec(move.san);
  const rl = PIECE_SAN.exec(real);
  expect(pub).not.toBeNull();
  expect(rl).not.toBeNull();
  expect([pub?.[1], pub?.[2]]).toEqual([rl?.[1], rl?.[2]]);
}

/** Assertion rapide (les `expect` de Vitest sont trop lents pour des centaines de milliers d'appels). */
export function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invariant violé : ${message}`);
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Invariants de la projection, pour les trois spectateurs, face au miroir réel.
 * `full` : compare aussi l'historique complet et valide le schéma Zod (coûteux).
 */
export function checkProjections(
  game: SecretQueenGame,
  mirror: Mirror,
  secrets: SecretChoice,
  full: boolean,
): Record<Viewer, ViewerBoardState> {
  const views = {} as Record<Viewer, ViewerBoardState>;
  for (const viewer of VIEWERS) views[viewer] = projectForViewer(game, viewer);
  const pub = views.public;

  // Ce qu'un camp voit en plus de la vue publique : uniquement `ownSecret`.
  const { moves: pubMoves, viewer: _pv, ownSecret: _po, ...pubRest } = pub;
  for (const color of ['w', 'b'] as const) {
    const { moves, viewer, ownSecret, ...rest } = views[color];
    check(viewer === color, 'viewer');
    check(same(rest, pubRest), `vue ${color} différente de la vue publique`);
    check(moves.length === pubMoves.length, 'longueur de l’historique');
    check(same(moves.at(-1), pubMoves.at(-1)), 'dernier coup');
    if (full) check(same(moves, pubMoves), 'historique');
    check(
      same(ownSecret, { pieceId: `${color}p${secrets[color]}`, square: mirror.secretSquares[color] }),
      `ownSecret ${color}`,
    );
  }
  check(pub.ownSecret === null, 'ownSecret public');
  if (full) check(same(ViewerBoardStateSchema.parse(pub), pub), 'schéma (clés non déclarées ?)');

  check(pub.turn === game.turn && pub.turn === mirror.chess.turn(), 'trait');
  check(pub.fullmoveNumber === Math.floor(game.plyCount / 2) + 1, 'numéro de coup');
  check(pubMoves.length === game.plyCount, 'historique');
  check(pub.inCheck === mirror.chess.inCheck(), 'échec');
  check((pub.result === null) === !game.isOver, 'result ssi fin');
  check((pub.reveal === null) === !game.isOver, 'reveal ssi fin');
  check(same(pub.result, game.result), 'result');

  // Pièces : triées par case, identifiants uniques, mêmes cases que la position réelle,
  // types affichés = types réels sauf sur les dames secrètes (affichées « p »).
  let lastIndex = -1;
  const ids = new Set<string>();
  const onBoard = { w: 0, b: 0 };
  for (const piece of pub.pieces) {
    const index = SQUARES.indexOf(piece.square);
    check(index > lastIndex, 'pièces triées par case');
    lastIndex = index;
    ids.add(piece.id);
    onBoard[piece.color]++;
    const real = mirror.realType(piece.square);
    check(real?.color === piece.color, `pièce absente de la position réelle en ${piece.square}`);
    if (mirror.secretSquares[piece.color] === piece.square) {
      check(piece.id === `${piece.color}p${secrets[piece.color]}`, 'identifiant de la dame');
      check(piece.type === 'p' && real.type === 'q', 'dame secrète affichée « p »');
    } else {
      check(piece.type === real.type, `type affiché ≠ type réel en ${piece.square}`);
    }
  }
  check(ids.size === pub.pieces.length, 'identifiants uniques');
  const realCount = SQUARES.filter((sq) => mirror.realType(sq) !== undefined).length;
  check(pub.pieces.length === realCount, 'même nombre de pièces affichées et réelles');
  check(pub.captured.w.length === 16 - onBoard.w, 'captures blanches');
  check(pub.captured.b.length === 16 - onBoard.b, 'captures noires');
  return views;
}

function randomIllegalIntent(legal: readonly MirrorMove[], random: () => number): MoveIntent {
  for (;;) {
    const intent = { from: pick(SQUARES, random), to: pick(SQUARES, random) };
    if (!legal.some((m) => m.intent.from === intent.from && m.intent.to === intent.to)) {
      return intent;
    }
  }
}

export interface RunOptions {
  maxPlies: number;
  /** Vérifie le schéma Zod tous les `schemaEvery` demi-coups (coûteux). */
  schemaEvery: number;
  /** Vérifie la restauration depuis la forme persistée en fin de partie. */
  checkRestore: boolean;
}

/** Joue une partie aléatoire et vérifie les invariants à chaque demi-coup. */
export function runRandomGame(scenario: Scenario, options: RunOptions): SecretQueenGame {
  const { secrets } = scenario;
  const random = prng(scenario.seed);
  const game = SecretQueenGame.create(secrets);
  const mirror = new Mirror(secrets);
  checkProjections(game, mirror, secrets, true);

  while (!game.isOver && game.plyCount < options.maxPlies) {
    if (scenario.external !== 'none' && game.plyCount === scenario.externalAt) break;
    const legal = mirror.legalMoves();
    const color = game.turn;

    // Refus sans motif et sans effet : coup illégal ou mauvais camp.
    if (random() < 0.1) {
      const before = projectForViewer(game, 'public');
      expect(game.play(color, randomIllegalIntent(legal, random))).toEqual({ ok: false });
      expect(game.play(opposite(color), pick(legal, random).intent)).toEqual({ ok: false });
      expect(projectForViewer(game, 'public')).toEqual(before);
    }

    const chosen = chooseMove(legal, random, scenario.captureBias);
    const isSecret = mirror.secretSquares[color] === chosen.intent.from;
    const real = realSan(mirror, chosen, legal);
    const outcome = game.play(color, chosen.intent);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) break;
    mirror.apply(chosen);
    checkNotation(outcome.move, real, isSecret);
    expect(outcome.result).toEqual(game.result);
    checkProjections(game, mirror, secrets, game.plyCount % options.schemaEvery === 0);
  }

  if (!game.isOver && scenario.external !== 'none') {
    const loser = game.turn;
    if (scenario.external === 'resign') game.resign(loser);
    else if (scenario.external === 'draw') game.agreeDraw();
    else game.flagFall(loser);
    expect(game.isOver).toBe(true);
    expect(() => game.agreeDraw()).toThrow();
    checkProjections(game, mirror, secrets, true);
  }

  if (game.isOver) {
    const reveal = projectForViewer(game, 'public').reveal;
    expect(reveal?.plies).toHaveLength(game.plyCount);
    expect(reveal?.secrets.w.finalSquare).toBe(mirror.secretSquares.w);
    expect(reveal?.secrets.b.finalSquare).toBe(mirror.secretSquares.b);
    expect(game.play(game.turn, pick(mirror.legalMoves(), random).intent)).toEqual({ ok: false });
  }

  if (options.checkRestore) {
    const restored = SecretQueenGame.restore(game.toPersisted());
    for (const viewer of VIEWERS) {
      expect(projectForViewer(restored, viewer)).toEqual(projectForViewer(game, viewer));
    }
  }
  return game;
}

/**
 * Indistinguabilité : deux mondes ne différant que par le secret du camp `hidden`. Tant que les
 * coups publics et les annonces sont identiques, l'adversaire (et la vue publique) reçoivent
 * exactement la même projection. On s'arrête dès que les mondes divergent publiquement.
 * Renvoie le nombre de demi-coups comparés.
 */
export function runTwinWorlds(
  base: SecretChoice,
  hidden: Color,
  otherSecret: Square,
  seed: number,
  maxPlies: number,
): number {
  const secretsB: SecretChoice = { ...base, [hidden]: otherSecret };
  const worlds = [base, secretsB].map((secrets) => ({
    game: SecretQueenGame.create(secrets),
    mirror: new Mirror(secrets),
  }));
  const [a, b] = worlds as [(typeof worlds)[number], (typeof worlds)[number]];
  const viewers: Viewer[] = [opposite(hidden), 'public'];
  const random = prng(seed);
  let compared = 0;

  for (;;) {
    for (const viewer of viewers) {
      const va = projectForViewer(a.game, viewer);
      const vb = projectForViewer(b.game, viewer);
      if (a.game.isOver) {
        // Après la fin, seule la révélation diffère.
        expect({ ...va, reveal: null }).toEqual({ ...vb, reveal: null });
      } else {
        expect(va).toEqual(vb);
      }
    }
    if (a.game.isOver || a.game.plyCount >= maxPlies) return compared;

    const legalB = b.mirror.legalMoves();
    const common = a.mirror
      .legalMoves()
      .filter((m) =>
        legalB.some(
          (n) =>
            n.intent.from === m.intent.from &&
            n.intent.to === m.intent.to &&
            n.intent.promotion === m.intent.promotion,
        ),
      );
    if (common.length === 0) return compared;
    const chosen = chooseMove(common, random, 0.3);
    const twin = legalB.find(
      (n) =>
        n.intent.from === chosen.intent.from &&
        n.intent.to === chosen.intent.to &&
        n.intent.promotion === chosen.intent.promotion,
    ) as MirrorMove;
    const color = a.game.turn;
    const ra = a.game.play(color, chosen.intent);
    const rb = b.game.play(color, chosen.intent);
    expect(ra.ok && rb.ok).toBe(true);
    a.mirror.apply(chosen);
    b.mirror.apply(twin);
    // Divergence publique (notation, annonce, fin) : les mondes ne sont plus comparables.
    if (JSON.stringify(ra) !== JSON.stringify(rb)) return compared;
    compared++;
  }
}
