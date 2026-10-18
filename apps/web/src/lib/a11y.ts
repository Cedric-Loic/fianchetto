import type { DisplayedPiece, Square } from '@sq/shared';

/* Libellés lus par les lecteurs d'écran (échiquier). */

const PIECE_NAMES: Record<string, string> = {
  p: 'pion',
  n: 'cavalier',
  b: 'fou',
  r: 'tour',
  q: 'dame',
  k: 'roi',
};

/** Nom lu d'une pièce affichée : « pion blanc », « tour noire ». */
export function pieceName(piece: Pick<DisplayedPiece, 'color' | 'type'>): string {
  const name = PIECE_NAMES[piece.type] ?? piece.type;
  const feminine = piece.type === 'r' || piece.type === 'q';
  const color =
    piece.color === 'w' ? (feminine ? 'blanche' : 'blanc') : feminine ? 'noire' : 'noir';
  return `${name} ${color}`;
}

/** Libellé d'une case pour les lecteurs d'écran : « e4, pion blanc » ou « e4, vide ». */
export function squareLabel(square: Square, piece: DisplayedPiece | undefined, crown: boolean) {
  if (!piece) return `${square}, vide`;
  return `${square}, ${pieceName(piece)}${crown ? ', dame secrète' : ''}`;
}
