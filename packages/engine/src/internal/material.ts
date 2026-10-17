import { opposite, type Color, type PieceType, type Square } from '@sq/shared';
import { fileIndex, rankNumber } from './board.js';

/*
 * Matériel suffisant pour mater, calculé sur les pièces RÉELLES (docs/RULES.md §5).
 */

export interface RealPiece {
  readonly color: Color;
  readonly type: PieceType;
  readonly square: Square;
}

function isLightSquare(square: Square): boolean {
  // a1 (colonne 0, rangée 1) est une case sombre.
  return (fileIndex(square) + rankNumber(square)) % 2 === 0;
}

/** Les fous présents sur l'échiquier (des deux camps) occupent-ils les deux couleurs de cases ? */
function bishopsOnBothColors(pieces: readonly RealPiece[]): boolean {
  const colors = new Set(pieces.filter((p) => p.type === 'b').map((p) => isLightSquare(p.square)));
  return colors.size === 2;
}

/**
 * Chute du drapeau : `color` (le camp qui a encore du temps) est-il incapable de mater, quelle que
 * soit la suite de coups légaux ? Règle de lichess, approximation reconnue de l'article 6.9 FIDE :
 * - roi seul : incapable ;
 * - roi + un seul cavalier : incapable si l'adversaire n'a que roi et dame(s) (rien pour bloquer
 *   son propre roi) ;
 * - roi + fou(s) : incapable sauf si des fous occupent les deux couleurs de cases ou si
 *   l'adversaire a un cavalier ou un pion ;
 * - tout autre matériel (pion, tour, dame, plusieurs pièces mineures mixtes) : capable.
 */
export function cannotMate(pieces: readonly RealPiece[], color: Color): boolean {
  const own = pieces.filter((p) => p.color === color && p.type !== 'k');
  const theirs = pieces.filter((p) => p.color === opposite(color) && p.type !== 'k');
  if (own.length === 0) return true;
  if (own.every((p) => p.type === 'n')) {
    return own.length === 1 && theirs.every((p) => p.type === 'q');
  }
  if (own.every((p) => p.type === 'b')) {
    return !bishopsOnBothColors(pieces) && !theirs.some((p) => p.type === 'n' || p.type === 'p');
  }
  return false;
}
