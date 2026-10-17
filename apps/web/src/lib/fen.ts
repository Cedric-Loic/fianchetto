import type { Color, DisplayedPiece, PieceType, Square } from '@sq/shared';

/**
 * Lecture du placement d'une FEN (positions RÉELLES de la révélation, après la fin de partie).
 * Simple affichage : aucune règle de jeu.
 */
export function piecesFromFen(fen: string): DisplayedPiece[] {
  const pieces: DisplayedPiece[] = [];
  const rows = (fen.split(' ')[0] ?? '').split('/');
  rows.forEach((row, i) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += Number(ch);
        continue;
      }
      const color: Color = ch === ch.toUpperCase() ? 'w' : 'b';
      const type = ch.toLowerCase() as PieceType;
      const square = `${'abcdefgh'[file]}${8 - i}` as Square;
      pieces.push({ id: `${color}${type}${square}`, color, type, square });
      file++;
    }
  });
  return pieces;
}
