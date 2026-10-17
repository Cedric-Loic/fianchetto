import type { DisplayedPiece, PublicMove, PieceType, Square } from '@sq/shared';

const BACK: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
const FILES = 'abcdefgh';

/** Position initiale publique, avec les identifiants du contrat (`wpe2`, `bng8`…). */
export function initialPieces(): DisplayedPiece[] {
  const pieces: DisplayedPiece[] = [];
  for (let i = 0; i < 8; i++) {
    const f = FILES[i] ?? 'a';
    const back = BACK[i] ?? 'r';
    for (const [color, rank, type] of [
      ['w', '1', back],
      ['w', '2', 'p'],
      ['b', '7', 'p'],
      ['b', '8', back],
    ] as const) {
      const square = `${f}${rank}` as Square;
      pieces.push({ id: `${color}${type}${square}`, color, type, square });
    }
  }
  return pieces;
}

/**
 * Rejoue les coups PUBLICS pour obtenir la position affichée après `count` demi-coups
 * (navigation dans l'historique) depuis `start` (position initiale, ou FEN de départ d'un
 * entraînement). N'utilise que des données publiques : aucun moteur.
 */
export function publicPositionAt(
  moves: readonly PublicMove[],
  count: number,
  start: readonly DisplayedPiece[] = initialPieces(),
): DisplayedPiece[] {
  const pieces = new Map(start.map((p) => [p.id, { ...p }]));
  for (const move of moves.slice(0, count)) {
    if (move.capture) pieces.delete(move.capture.pieceId);
    const piece = pieces.get(move.pieceId);
    if (piece) {
      piece.square = move.to;
      if (move.promotion) piece.type = move.promotion;
    }
    if (move.castle) {
      const rook = pieces.get(move.castle.rookId);
      if (rook) rook.square = move.castle.rookTo;
    }
  }
  return [...pieces.values()];
}
