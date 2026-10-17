import { isDeepStrictEqual } from 'node:util';
import fc from 'fast-check';
import type {
  Color,
  GameResult,
  MoveIntent,
  PublicMove,
  Viewer,
  ViewerBoardState,
} from '@sq/shared';
import { Secret } from '@sq/shared/secret';
import {
  SecretQueenGame,
  projectForViewer,
  type PersistedGame,
  type PlayResult,
  type SecretChoice,
} from '@sq/engine';
import { bareRefusalViolations, projectionViolations } from './invariants.js';
import { compareObservations, describeDifference } from './normalize.js';
import { fileIndex, intentKey, pickIntent, rankIndex, uci } from './public-board.js';
import {
  arbWorldPairScenario,
  type ExternalEnding,
  type WorldPairScenario,
} from './world-pairs.js';

/**
 * Banc d'attaque contre l'API du moteur (`@sq/engine`). Seul module utilitaire qui importe le
 * moteur : les autres (canary, scan, normalize, public-board, invariants, world-pairs) sont
 * purs et testés sans lui.
 */

export const VIEWERS: readonly Viewer[] = ['w', 'b', 'public'];

/** Délai des tests de propriétés (le moteur coûte ~0,5 ms par coup accepté). */
export const LONG_TEST_MS = 120_000;

export type Projector = (game: SecretQueenGame, viewer: Viewer) => ViewerBoardState;
export const defaultProjector: Projector = (game, viewer) => projectForViewer(game, viewer);

/** Rejoue une suite d'intentions (toutes doivent être acceptées) avec create + play. */
export function replay(secrets: SecretChoice, intents: readonly MoveIntent[]): SecretQueenGame {
  const game = SecretQueenGame.create(secrets);
  intents.forEach((intent, index) => {
    if (!game.play(game.turn, intent).ok) {
      throw new Error(`rejeu : coup ${index + 1} (${intentKey(intent)}) refusé`);
    }
  });
  return game;
}

export interface PlayedLine {
  game: SecretQueenGame;
  moves: PublicMove[];
}

/** Joue une ligne de coups « e2e4 » ; chaque coup doit être accepté. */
export function playLine(secrets: SecretChoice, line: readonly string[]): PlayedLine {
  const game = SecretQueenGame.create(secrets);
  const moves: PublicMove[] = [];
  line.forEach((text, index) => {
    const result = game.play(game.turn, uci(text));
    if (!result.ok) {
      throw new Error(`ligne ${JSON.stringify(secrets)} : coup ${index + 1} (${text}) refusé`);
    }
    moves.push(result.move);
  });
  return { game, moves };
}

/** Lecture de la forme persistée (autorisée dans les tests par la liste blanche du lint). */
export function persistedOf(game: SecretQueenGame): PersistedGame {
  return game.toPersisted().expose();
}

export function wrapPersisted(persisted: PersistedGame): Secret<PersistedGame> {
  return new Secret(persisted);
}

export function gettersOf(game: SecretQueenGame) {
  return {
    turn: game.turn,
    plyCount: game.plyCount,
    isOver: game.isOver,
    result: game.result,
  };
}

export function snapshotAll(game: SecretQueenGame, project: Projector = defaultProjector) {
  return {
    w: project(game, 'w'),
    b: project(game, 'b'),
    public: project(game, 'public'),
    getters: gettersOf(game),
  };
}

export function applyEnding(
  game: SecretQueenGame,
  ending: Exclude<ExternalEnding, 'none'>,
  hidden: Color,
  observer: Color,
): GameResult {
  switch (ending) {
    case 'resign-hidden':
      return game.resign(hidden);
    case 'resign-observer':
      return game.resign(observer);
    case 'draw':
      return game.agreeDraw();
    case 'flag-hidden':
      return game.flagFall(hidden);
    case 'flag-observer':
      return game.flagFall(observer);
  }
}

// ---------------------------------------------------------------------------
// Parties aléatoires dans un seul monde
// ---------------------------------------------------------------------------

export interface Attempt {
  ply: number;
  color: Color;
  intent: MoveIntent;
  result: PlayResult;
}

/**
 * Joue une partie à partir de graines (une par tentative) et appelle `onAttempt` après
 * chaque tentative, acceptée ou refusée. Les intentions sont choisies sur la vue publique.
 */
export function playRandomGame(
  secrets: SecretChoice,
  seeds: readonly number[],
  options: {
    maxPlies?: number;
    onAttempt?: (game: SecretQueenGame, attempt: Attempt) => void;
  } = {},
): { game: SecretQueenGame; accepted: MoveIntent[] } {
  const maxPlies = options.maxPlies ?? 120;
  const game = SecretQueenGame.create(secrets);
  const accepted: MoveIntent[] = [];
  for (const seed of seeds) {
    if (game.isOver || accepted.length >= maxPlies) break;
    const color = game.turn;
    const intent = pickIntent(projectForViewer(game, 'public'), seed);
    const ply = game.plyCount;
    const result = game.play(color, intent);
    if (result.ok) accepted.push(intent);
    options.onAttempt?.(game, { ply, color, intent, result });
  }
  return { game, accepted };
}

// ---------------------------------------------------------------------------
// Paires de mondes (indistinguabilité, §10)
// ---------------------------------------------------------------------------

export interface Leak {
  /** Nombre de demi-coups communs joués au moment de la constatation. */
  ply: number;
  step: string;
  detail: string;
}

export interface WorldPairReport {
  committed: MoveIntent[];
  attempts: number;
  refusedInBoth: number;
  /** Coups acceptés dans un seul monde (refus = inférence admise, `RULES.md` §9) : écartés. */
  oneSided: number;
  /** Coups acceptés dans les deux mondes mais aux annonces différentes : écartés. */
  announcementMismatch: number;
  /**
   * Coups de la pièce qui est la dame secrète dans un monde et un vrai pion dans l'autre,
   * notés différemment par nature (prise en passant ou promotion du pion, coordonnées pour la
   * dame : `RULES.md` §3.1 et §9) : la suite publique diverge, coup écarté.
   */
  inherentDivergence: number;
  ended: GameResult | null;
  leaks: Leak[];
}

export interface WorldPairOptions {
  projector?: Projector;
  maxPlies?: number;
  /** Vérifie aussi tous les invariants de projection à chaque demi-coup (plus lent). */
  checkInvariants?: boolean;
  maxLeaks?: number;
}

/**
 * Le coup `intent` du camp caché peut-il LÉGITIMEMENT produire un coup public différent dans les
 * deux mondes ? Seulement si la pièce jouée est la dame secrète dans un monde (donc un vrai pion
 * dans l'autre) et si le coup est, pour le pion, une prise en passant (diagonale vers une case
 * vide) ou une promotion (dernière rangée). Dans tous les autres cas, un coup de pion de la dame
 * secrète doit être noté exactement comme celui du vrai pion (§3.1) : toute différence est une
 * fuite.
 */
export function isInherentDivergence(
  intent: MoveIntent,
  before: Pick<ViewerBoardState, 'pieces'>,
  pair: WorldPairScenario['pair'],
  mover: Color,
): boolean {
  if (mover !== pair.hidden) return false;
  const piece = before.pieces.find((p) => p.square === intent.from);
  const secretIds = [
    `${pair.hidden}p${pair.a[pair.hidden]}`,
    `${pair.hidden}p${pair.b[pair.hidden]}`,
  ];
  if (!piece || !secretIds.includes(piece.id) || piece.type !== 'p') return false;
  const forward = mover === 'w' ? 1 : -1;
  const lastRank = mover === 'w' ? 7 : 0;
  const diagonalToEmpty =
    Math.abs(fileIndex(intent.to) - fileIndex(intent.from)) === 1 &&
    rankIndex(intent.to) - rankIndex(intent.from) === forward &&
    !before.pieces.some((p) => p.square === intent.to);
  return diagonalToEmpty || rankIndex(intent.to) === lastRank;
}

function sameAnnouncements(
  a: Extract<PlayResult, { ok: true }>,
  b: Extract<PlayResult, { ok: true }>,
): boolean {
  return (
    a.move.check === b.move.check &&
    a.move.checkmate === b.move.checkmate &&
    isDeepStrictEqual(a.result, b.result)
  );
}

/**
 * Joue la même suite d'intentions dans les deux mondes d'une paire et compare tout ce que
 * voient l'observateur et le spectateur `public` (et le camp caché, hors `ownSecret`).
 *
 * - Refus dans les deux mondes : chaque refus doit être nu ; l'état ne change pas.
 * - Acceptation dans un seul monde : inférence admise ; le coup est écarté (le monde qui l'a
 *   accepté est reconstruit) et la suite continue.
 * - Acceptation dans les deux mais annonces différentes (échec, mat, fin) : hors du champ du
 *   §10 ; le coup est écarté.
 * - Acceptation dans les deux et mêmes annonces : toute différence observable est une FUITE.
 */
export function runWorldPair(
  scenario: WorldPairScenario,
  options: WorldPairOptions = {},
): WorldPairReport {
  const { pair, seeds, ending } = scenario;
  const project = options.projector ?? defaultProjector;
  const maxPlies = options.maxPlies ?? 80;
  const maxLeaks = options.maxLeaks ?? 5;
  const checkInvariants = options.checkInvariants ?? false;
  let gameA = SecretQueenGame.create(pair.a);
  let gameB = SecretQueenGame.create(pair.b);
  const report: WorldPairReport = {
    committed: [],
    attempts: 0,
    refusedInBoth: 0,
    oneSided: 0,
    announcementMismatch: 0,
    inherentDivergence: 0,
    ended: null,
    leaks: [],
  };
  const leak = (step: string, detail: string) => {
    if (report.leaks.length < maxLeaks) {
      report.leaks.push({ ply: report.committed.length, step, detail });
    }
  };
  const compare = (step: string, a: unknown, b: unknown, dropKeys: string[] = []) => {
    const result = compareObservations(a, b, { dropKeys });
    if (!result.identical) {
      const prefix = result.deepEqual ? 'ordre des clés différent — ' : '';
      leak(step, prefix + describeDifference(result.difference));
    }
  };
  const checkRefusal = (result: PlayResult, world: string) => {
    const violations = bareRefusalViolations(result);
    if (violations.length > 0) leak(`refus (monde ${world})`, violations.join(' ; '));
  };

  // Vue publique courante (monde A), base du choix des intentions ; inchangée après un refus.
  let publicView: ViewerBoardState = project(gameA, 'public');
  const compareWorlds = () => {
    const over = gameA.isOver;
    const reveal = over ? ['reveal'] : [];
    const viewsA = snapshotAll(gameA, project);
    const viewsB = snapshotAll(gameB, project);
    compare(`projection ${pair.observer}`, viewsA[pair.observer], viewsB[pair.observer], reveal);
    compare('projection public', viewsA.public, viewsB.public, reveal);
    compare(
      `projection ${pair.hidden} (hors ownSecret)`,
      viewsA[pair.hidden],
      viewsB[pair.hidden],
      ['ownSecret', ...reveal],
    );
    compare('getters', viewsA.getters, viewsB.getters);
    publicView = viewsA.public;
    if (!checkInvariants) return;
    // Les vues observateur et publique du monde B sont comparées à celles du monde A : il suffit
    // de contrôler les invariants du monde A et la vue du camp caché dans le monde B.
    const checks = [
      ...VIEWERS.map((viewer) => ['A', viewsA, pair.a, viewer] as const),
      ['B', viewsB, pair.b, pair.hidden] as const,
    ];
    for (const [world, views, secrets, viewer] of checks) {
      const violations = projectionViolations(views[viewer], {
        viewer,
        over: views.getters.isOver,
        ...(viewer === 'public' ? {} : { ownSecretStart: secrets[viewer] }),
      });
      if (violations.length > 0) {
        leak(`invariants (monde ${world}, ${viewer})`, violations.join(' ; '));
      }
    }
  };

  compareWorlds();
  for (const seed of seeds) {
    if (report.committed.length >= maxPlies || gameA.isOver || gameB.isOver) break;
    if (report.leaks.length >= maxLeaks) break;
    report.attempts++;
    const color = gameA.turn;
    // Les coups de dame d'un « pion » du camp caché ne peuvent être acceptés que dans un seul
    // monde (écartés à coup sûr) : on ne les tente que pour l'observateur.
    const intent = pickIntent(publicView, seed, { pawnAsQueen: color !== pair.hidden });
    const resultA = gameA.play(color, intent);
    const resultB = gameB.play(color, intent);
    if (!resultA.ok && !resultB.ok) {
      report.refusedInBoth++;
      checkRefusal(resultA, 'A');
      checkRefusal(resultB, 'B');
      continue;
    }
    if (!resultA.ok || !resultB.ok) {
      report.oneSided++;
      if (!resultA.ok) {
        checkRefusal(resultA, 'A');
        gameB = replay(pair.b, report.committed);
      } else {
        checkRefusal(resultB, 'B');
        gameA = replay(pair.a, report.committed);
        publicView = project(gameA, 'public');
      }
      continue;
    }
    if (!sameAnnouncements(resultA, resultB) || gameA.isOver !== gameB.isOver) {
      report.announcementMismatch++;
      gameA = replay(pair.a, report.committed);
      gameB = replay(pair.b, report.committed);
      publicView = project(gameA, 'public');
      continue;
    }
    if (
      !compareObservations(resultA.move, resultB.move).identical &&
      isInherentDivergence(intent, publicView, pair, color)
    ) {
      report.inherentDivergence++;
      gameA = replay(pair.a, report.committed);
      gameB = replay(pair.b, report.committed);
      publicView = project(gameA, 'public');
      continue;
    }
    report.committed.push(intent);
    compare('coup joué (PlayResult)', resultA, resultB);
    compareWorlds();
  }

  if (ending !== 'none' && !gameA.isOver && !gameB.isOver && report.leaks.length < maxLeaks) {
    const endA = applyEnding(gameA, ending, pair.hidden, pair.observer);
    const endB = applyEnding(gameB, ending, pair.hidden, pair.observer);
    // La chute du drapeau dépend du matériel RÉEL, mais pion et dame suffisent tous deux à
    // mater : le résultat ne doit pas dépendre du secret.
    compare(`fin externe (${ending})`, endA, endB);
    compareWorlds();
  }

  if (gameA.isOver && gameB.isOver) {
    report.ended = gameA.result;
    const revealA = project(gameA, 'public').reveal;
    const revealB = project(gameB, 'public').reveal;
    if (!revealA || !revealB) {
      leak('révélation', 'reveal absent après la fin');
    } else {
      if (revealA.secrets[pair.hidden].initialSquare !== pair.a[pair.hidden]) {
        leak('révélation', 'secret caché du monde A mal révélé');
      }
      if (revealB.secrets[pair.hidden].initialSquare !== pair.b[pair.hidden]) {
        leak('révélation', 'secret caché du monde B mal révélé');
      }
    }
  }
  return report;
}

export function formatReport(scenario: WorldPairScenario, report: WorldPairReport): string {
  const line = report.committed.map(intentKey).join(' ');
  const leaks = report.leaks.map((l) => `  - [demi-coup ${l.ply}] ${l.step} : ${l.detail}`);
  return [
    `paire : camp caché ${scenario.pair.hidden}, A=${JSON.stringify(scenario.pair.a)}, B=${JSON.stringify(scenario.pair.b)}`,
    `suite commune (${report.committed.length} demi-coups) : ${line || '(vide)'}`,
    `fin : ${scenario.ending} → ${JSON.stringify(report.ended)}`,
    ...leaks,
  ].join('\n');
}

/**
 * Propriété d'indistinguabilité sur `numRuns` paires de mondes aléatoires (versions courte et
 * longue). En cas de fuite, fast-check réduit le scénario et le message décrit la suite commune.
 */
export function assertIndistinguishable(numRuns: number, maxPlies: number, maxAttempts: number) {
  fc.assert(
    fc.property(arbWorldPairScenario(maxAttempts), (scenario) => {
      const report = runWorldPair(scenario, { maxPlies, checkInvariants: true });
      if (report.leaks.length > 0) throw new Error(`fuite :\n${formatReport(scenario, report)}`);
    }),
    { numRuns },
  );
}
