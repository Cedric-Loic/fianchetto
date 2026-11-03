import type { Color, ExplanationKind, GameReview } from '@sq/shared';

/**
 * Puzzle tiré d'une de mes erreurs : même format que la base Lichess (position avant le coup
 * adverse, puis ce coup et le meilleur coup), avec l'évaluation de la position à résoudre.
 */
export interface OwnPuzzleCandidate {
  /** Demi-coup de l'erreur dans la partie (à partir de 1). */
  ply: number;
  fen: string;
  /** [coup adverse qui précède, meilleur coup] en UCI. */
  moves: [string, string];
  /** Évaluation de la position à résoudre (point de vue des Blancs). */
  evalCp: number | null;
  mate: number | null;
  kind: ExplanationKind | null;
}

/**
 * Erreurs et gaffes du camp `color` où il y avait quelque chose à trouver : position pas déjà
 * perdue (au moins 25 % de chances de gain avant le coup) et meilleur coup connu.
 */
export function puzzlesFromReview(review: GameReview, color: Color): OwnPuzzleCandidate[] {
  const out: OwnPuzzleCandidate[] = [];
  review.moves.forEach((move, i) => {
    if (i < 1 || move.color !== color) return;
    if (move.classification !== 'mistake' && move.classification !== 'blunder') return;
    const best = review.evals[i]?.bestMoveUci;
    const previous = review.moves[i - 1];
    const fen = review.positions[i - 1];
    if (!best || !previous || fen === undefined || move.winBefore < 25) return;
    const evaluation = review.evals[i];
    out.push({
      ply: move.ply,
      fen,
      moves: [previous.uci, best],
      evalCp: evaluation?.evalCp ?? null,
      mate: evaluation?.mate ?? null,
      kind: move.explanation?.kind ?? null,
    });
  });
  return out;
}
