import type { DisplayedPiece, PromotionPiece, Square } from '@sq/shared';

export interface LocalMove {
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
}

/**
 * Applique des coups « locaux » à l'affichage, sans aucune règle : coup en attente de
 * confirmation du serveur, ou premoves enchaînés. La pièce va sur la case visée, ce qui s'y
 * trouvait disparaît ; un roi qui se déplace de deux colonnes emmène sa tour (roque).
 */
export function applyLocalMoves(
  pieces: readonly DisplayedPiece[],
  moves: readonly LocalMove[],
): DisplayedPiece[] {
  let board = pieces.map((p) => ({ ...p }));
  for (const m of moves) {
    const piece = board.find((p) => p.square === m.from);
    if (!piece) continue;
    board = board.filter((p) => p.square !== m.to);
    piece.square = m.to;
    if (m.promotion && piece.type === 'p') piece.type = m.promotion;
    const df = m.to.charCodeAt(0) - m.from.charCodeAt(0);
    if (piece.type === 'k' && Math.abs(df) === 2) {
      const rank = m.from[1] ?? '1';
      const rookFrom = `${df > 0 ? 'h' : 'a'}${rank}` as Square;
      const rookTo = `${df > 0 ? 'f' : 'd'}${rank}` as Square;
      const rook = board.find((p) => p.square === rookFrom);
      if (rook) rook.square = rookTo;
    }
  }
  return board;
}
