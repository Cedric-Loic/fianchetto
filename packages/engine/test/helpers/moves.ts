import { expect } from 'vitest';
import type { MoveIntent, PromotionPiece, PublicMove, Square } from '@sq/shared';
import { SecretQueenGame, type SecretChoice } from '../../src/index.js';

/** « e2e4 » → { from: 'e2', to: 'e4' } ; « e7e8n » → promotion en cavalier. */
export function uci(text: string): MoveIntent {
  const from = text.slice(0, 2) as Square;
  const to = text.slice(2, 4) as Square;
  const promotion = text[4] as PromotionPiece | undefined;
  return promotion === undefined ? { from, to } : { from, to, promotion };
}

/** Joue une suite de coups (format UCI, séparés par des espaces) qui doivent tous être acceptés. */
export function playAll(game: SecretQueenGame, line: string): PublicMove[] {
  const played: PublicMove[] = [];
  for (const text of line.split(/\s+/).filter(Boolean)) {
    const outcome = game.play(game.turn, uci(text));
    if (!outcome.ok) throw new Error(`Coup refusé dans le test : ${text}`);
    played.push(outcome.move);
  }
  return played;
}

/** Crée une partie et joue la suite donnée. */
export function gameAfter(secrets: SecretChoice, line = ''): SecretQueenGame {
  const game = SecretQueenGame.create(secrets);
  playAll(game, line);
  return game;
}

/** Notations publiques d'une suite de coups. */
export function sans(game: SecretQueenGame, line: string): string[] {
  return playAll(game, line).map((move) => move.san);
}

/** Le coup est refusé sans motif et ne change rien. */
export function expectRefused(game: SecretQueenGame, text: string): void {
  const plies = game.plyCount;
  expect(game.play(game.turn, uci(text))).toEqual({ ok: false });
  expect(game.plyCount).toBe(plies);
}
