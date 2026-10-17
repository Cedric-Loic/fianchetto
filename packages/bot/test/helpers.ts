import {
  ClassicGame,
  SecretQueenGame,
  projectClassic,
  projectForViewer,
  type SecretChoice,
} from '@sq/engine';
import {
  SQUARES,
  type BotObservation,
  type BotRejection,
  type Color,
  type MoveIntent,
} from '@sq/shared';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Observation telle que le serveur la construirait : projection pour le camp du bot. */
export function observe(
  game: SecretQueenGame | ClassicGame,
  botColor: Color,
  rejections: BotRejection[] = [],
): BotObservation {
  return {
    botColor,
    rejections,
    state: {
      gameId: 'test',
      variant: game instanceof ClassicGame ? 'classic' : 'secret-queen',
      mode: 'bot',
      viewer: botColor,
      phase: 'playing',
      rated: true,
      training: false,
      initialFen:
        game instanceof ClassicGame
          ? game.positions()[0] === START
            ? null
            : (game.positions()[0] ?? null)
          : null,
      timeControl: 'untimed',
      players: {
        w: { name: 'w', rating: null, isBot: botColor === 'w', botLevel: null },
        b: { name: 'b', rating: null, isBot: botColor === 'b', botLevel: null },
      },
      selection: null,
      board:
        game instanceof ClassicGame
          ? projectClassic(game, botColor)
          : projectForViewer(game, botColor),
      clock: null,
      drawOffer: null,
      rematch: { offeredBy: null, nextGameId: null },
    },
  };
}

/** Générateur pseudo-aléatoire déterministe. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Joue un coup aléatoire accepté par le moteur (essais au hasard). */
export function randomMove(game: SecretQueenGame, random: () => number): MoveIntent | null {
  for (let i = 0; i < 4000; i++) {
    const from = SQUARES[Math.floor(random() * 64)];
    const to = SQUARES[Math.floor(random() * 64)];
    if (!from || !to) continue;
    const intent: MoveIntent = { from, to, promotion: 'q' };
    if (game.play(game.turn, intent).ok) return intent;
  }
  return null;
}

export function newGame(secrets: SecretChoice) {
  return SecretQueenGame.create(secrets);
}
