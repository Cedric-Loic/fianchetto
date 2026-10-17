import { isDeepStrictEqual } from 'node:util';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  GameResultSchema,
  opposite,
  pawnStartSquares,
  type Color,
  type GameResult,
  type ViewerBoardState,
} from '@sq/shared';
import { SecretQueenGame, projectForViewer, type SecretChoice } from '@sq/engine';
import { realPawnRankToken } from './canary.js';
import { LONG_TEST_MS, VIEWERS, playLine, playRandomGame } from './harness.js';
import { projectionViolations } from './invariants.js';
import { initialDisplayedPieces } from './public-board.js';
import { arbSecrets, arbSeeds } from './world-pairs.js';

/*
 * Projection (`docs/RULES.md` §2) : champs interdits, `ownSecret` jamais pour l'adversaire ni
 * pour `public`, `result` / `reveal` nuls avant la fin et présents après.
 */

function contextFor(
  game: SecretQueenGame,
  secrets: SecretChoice,
  viewer: ViewerBoardState['viewer'],
) {
  return {
    viewer,
    over: game.isOver,
    ...(viewer === 'public' ? {} : { ownSecretStart: secrets[viewer] }),
  };
}

function expectAllViewsConform(game: SecretQueenGame, secrets: SecretChoice, label: string) {
  for (const viewer of VIEWERS) {
    const violations = projectionViolations(
      projectForViewer(game, viewer),
      contextFor(game, secrets, viewer),
    );
    expect(violations, `${label} — projection ${viewer}`).toEqual([]);
  }
}

/** Contrôles après la fin : résultat et révélation exacts, identiques pour tous. */
function expectRevealed(game: SecretQueenGame, secrets: SecretChoice) {
  expect(game.isOver).toBe(true);
  const result = game.result;
  expect(result).not.toBeNull();
  const views = VIEWERS.map((viewer) => projectForViewer(game, viewer));
  for (const view of views) {
    expect(view.result).toEqual(result);
    expect(view.reveal).not.toBeNull();
    expect(isDeepStrictEqual(view.reveal, views[0]?.reveal)).toBe(true);
  }
  const reveal = views[0]?.reveal;
  if (!reveal) return;
  for (const color of ['w', 'b'] as const) {
    const pieceId = `${color}p${secrets[color]}`;
    const onBoard = views[0]?.pieces.find((piece) => piece.id === pieceId);
    expect(reveal.secrets[color]).toEqual({
      pieceId,
      initialSquare: secrets[color],
      finalSquare: onBoard?.square ?? null,
    });
    // Contrôle positif des canaris : la FEN réelle initiale contient la rangée de la dame.
    expect(reveal.realInitialFen).toContain(realPawnRankToken(color, secrets[color]));
  }
  expect(reveal.plies).toHaveLength(views[0]?.moves.length ?? -1);
  for (const ply of reveal.plies) {
    expect(ply.realSan.length).toBeGreaterThan(0);
    expect(ply.realFenAfter.length).toBeGreaterThan(0);
  }
}

function expectExactResult(result: GameResult, expected: Partial<GameResult>) {
  // Schéma exact : aucune information supplémentaire dans un résultat.
  expect(GameResultSchema.parse(result)).toStrictEqual(result);
  expect(result).toMatchObject(expected);
}

describe('projection : position initiale', () => {
  it('exacte pour chaque spectateur et chacun des 64 choix de secrets', () => {
    const pieces = initialDisplayedPieces();
    for (const w of pawnStartSquares('w')) {
      for (const b of pawnStartSquares('b')) {
        const secrets: SecretChoice = { w, b };
        const game = SecretQueenGame.create(secrets);
        for (const viewer of VIEWERS) {
          const view = projectForViewer(game, viewer);
          expect(view).toStrictEqual({
            viewer,
            pieces,
            turn: 'w',
            fullmoveNumber: 1,
            inCheck: false,
            moves: [],
            captured: { w: [], b: [] },
            ownSecret:
              viewer === 'public'
                ? null
                : { pieceId: `${viewer}p${secrets[viewer]}`, square: secrets[viewer] },
            result: null,
            reveal: null,
          });
        }
        expectAllViewsConform(game, secrets, `initiale ${w}/${b}`);
      }
    }
  });
});

describe('projection : parties aléatoires', () => {
  it(
    'invariants après chaque coup ; result et reveal nuls tant que la partie continue',
    () => {
      fc.assert(
        fc.property(arbSecrets, arbSeeds(200), (secrets, seeds) => {
          playRandomGame(secrets, seeds, {
            maxPlies: 100,
            onAttempt: (game, attempt) => {
              // Un refus ne change rien (vérifié dans refusal.test.ts) : on ne contrôle qu'après
              // un coup accepté.
              if (!attempt.result.ok) return;
              expectAllViewsConform(game, secrets, `demi-coup ${attempt.ply}`);
              if (!game.isOver) {
                for (const viewer of VIEWERS) {
                  const view = projectForViewer(game, viewer);
                  expect(view.result).toBeNull();
                  expect(view.reveal).toBeNull();
                }
              }
            },
          });
        }),
        { numRuns: 30 },
      );
    },
    LONG_TEST_MS,
  );

  it(
    "ownSecret : le sien seulement, qui suit sa pièce ; jamais celui de l'adversaire",
    () => {
      fc.assert(
        fc.property(arbSecrets, arbSeeds(200), (secrets, seeds) => {
          playRandomGame(secrets, seeds, {
            onAttempt: (game) => {
              expect(projectForViewer(game, 'public').ownSecret).toBeNull();
              for (const color of ['w', 'b'] as const) {
                const view = projectForViewer(game, color);
                const pieceId = `${color}p${secrets[color]}`;
                const square = view.pieces.find((p) => p.id === pieceId)?.square ?? null;
                expect(view.ownSecret).toEqual({ pieceId, square });
              }
            },
          });
        }),
        { numRuns: 25 },
      );
    },
    LONG_TEST_MS,
  );

  it(
    'après une fin externe : result et reveal présents et exacts pour tous',
    () => {
      const endings: Array<
        [string, (g: SecretQueenGame, c: Color) => GameResult, (c: Color) => Partial<GameResult>]
      > = [
        ['abandon', (g, c) => g.resign(c), (c) => ({ winner: opposite(c), reason: 'resignation' })],
        ['nulle par accord', (g) => g.agreeDraw(), () => ({ winner: null, reason: 'agreement' })],
        ['chute du drapeau', (g, c) => g.flagFall(c), () => ({})],
      ];
      fc.assert(
        fc.property(
          arbSecrets,
          arbSeeds(120),
          fc.constantFrom(...endings),
          fc.constantFrom<Color>('w', 'b'),
          (secrets, seeds, [, end, expected], color) => {
            const { game } = playRandomGame(secrets, seeds, { maxPlies: 60 });
            if (game.isOver) return;
            const result = end(game, color);
            expectExactResult(result, expected(color));
            if (result.reason === 'timeout') expect(result.winner).toBe(opposite(color));
            if (result.reason === 'timeout-vs-insufficient-material')
              expect(result.winner).toBeNull();
            expect(game.result).toEqual(result);
            expectRevealed(game, secrets);
            expectAllViewsConform(game, secrets, 'après la fin');
          },
        ),
        { numRuns: 40 },
      );
    },
    LONG_TEST_MS,
  );
});

describe('projection : fins naturelles et capture de la dame secrète', () => {
  it('mat par une vraie dame (mat de l’idiot) : résultat et révélation', () => {
    const secrets: SecretChoice = { w: 'a2', b: 'a7' };
    const { game, moves } = playLine(secrets, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(moves.at(-1)?.san).toBe('Qh4#');
    expectExactResult(game.result as GameResult, { winner: 'b', reason: 'checkmate' });
    expectRevealed(game, secrets);
    expectAllViewsConform(game, secrets, 'mat');
  });

  it('mat par la dame secrète : résultat et révélation', () => {
    const secrets: SecretChoice = { w: 'a2', b: 'e7' };
    const { game } = playLine(secrets, ['f2f3', 'a7a6', 'g2g4', 'e7h4']);
    expectExactResult(game.result as GameResult, { winner: 'b', reason: 'checkmate' });
    expectRevealed(game, secrets);
  });

  it('dame secrète capturée : affichée comme un pion, ownSecret.square nul', () => {
    // 1. e4 d5 2. exd5 Qxd5 : le « pion » e2 (dame secrète) est pris en d5 par la vraie dame.
    const secrets: SecretChoice = { w: 'e2', b: 'h7' };
    const { game, moves } = playLine(secrets, ['e2e4', 'd7d5', 'e4d5', 'd8d5']);
    expect(moves.map((m) => m.san)).toEqual(['e4', 'd5', 'exd5', 'Qxd5']);
    expect(moves.at(-1)?.capture).toEqual({ pieceId: 'wpe2', displayedType: 'p', square: 'd5' });
    expect(projectForViewer(game, 'w').ownSecret).toEqual({ pieceId: 'wpe2', square: null });
    for (const viewer of ['b', 'public'] as const) {
      const view = projectForViewer(game, viewer);
      expect(view.captured).toEqual({ w: ['p'], b: ['p'] });
      expect(view.ownSecret?.pieceId ?? null).not.toBe('wpe2');
    }
    expectAllViewsConform(game, secrets, 'dame capturée');
    game.resign('w');
    expectRevealed(game, secrets);
    expect(projectForViewer(game, 'b').reveal?.secrets.w.finalSquare).toBeNull();
  });
});
