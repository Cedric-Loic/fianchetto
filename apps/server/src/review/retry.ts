import { Chess } from 'chess.js';
import { winChance } from '@sq/coach';
import type { PositionAnalysis } from '@sq/bot';
import type { GameReview, RetryMoveResponse } from '@sq/shared';
import { playStep } from '../chess-utils.js';

/** Perte de probabilité de gain (points de %) en deçà de laquelle un coup est « bon ». */
export const RETRY_TOLERANCE = 5;
/** Longueur de la réfutation montrée (demi-coups). */
const LINE_LENGTH = 8;

export type RetryOutcome =
  { kind: 'ok'; response: RetryMoveResponse } | { kind: 'bad-ply' | 'illegal' | 'engine' };

/**
 * « Apprends de tes erreurs » : juge un autre coup que celui joué au demi-coup `ply`, avec la
 * même tolérance que les puzzles tirés de mes parties (moins de 5 points de % de gain perdus).
 */
export async function judgeRetry(
  review: GameReview,
  ply: number,
  uci: string,
  evaluate: (fen: string) => Promise<PositionAnalysis | null>,
): Promise<RetryOutcome> {
  const fen = review.positions[ply - 1];
  const before = review.evals[ply - 1];
  if (!fen || !before || ply > review.moves.length) return { kind: 'bad-ply' };
  const chess = new Chess(fen);
  const color = chess.turn();
  const step = playStep(chess, uci);
  if (!step) return { kind: 'illegal' };
  const after = await evaluate(step.fen);
  if (!after) return { kind: 'engine' };
  const loss = winChance(before, color) - winChance(after, color);
  const verdict =
    step.uci === before.bestMoveUci ? 'best' : loss < RETRY_TOLERANCE ? 'good' : 'wrong';
  return {
    kind: 'ok',
    response: {
      verdict,
      san: step.san,
      fen: step.fen,
      line: after.pv.slice(0, LINE_LENGTH),
    },
  };
}
