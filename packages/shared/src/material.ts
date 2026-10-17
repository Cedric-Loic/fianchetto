import type { Color, PieceType } from './chess.js';

/** Valeur conventionnelle des pièces, appliquée aux types AFFICHÉS (§3.6). */
export const PIECE_VALUES: Readonly<Record<PieceType, number>> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/**
 * Avantage matériel d'un camp, calculé sur les pièces capturées (types affichés).
 * `captured.w` = pièces blanches capturées. Résultat positif : `color` mène.
 */
export function materialAdvantage(
  captured: Readonly<Record<Color, readonly PieceType[]>>,
  color: Color,
): number {
  const sum = (types: readonly PieceType[]) => types.reduce((acc, t) => acc + PIECE_VALUES[t], 0);
  const lostByWhite = sum(captured.w);
  const lostByBlack = sum(captured.b);
  const whiteLead = lostByBlack - lostByWhite;
  return color === 'w' ? whiteLead : -whiteLead;
}
