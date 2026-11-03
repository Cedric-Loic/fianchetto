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

/**
 * Garde les identifiants des pièces d'une position à la suivante après le coup `uci`, pour que
 * la pièce jouée glisse (animation CSS) au lieu de réapparaître. Roque : la tour suit aussi.
 */
export function carryIds(
  previous: readonly DisplayedPiece[],
  next: DisplayedPiece[],
  uci: string,
): DisplayedPiece[] {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const moved = previous.find((p) => p.square === from);
  const moves = new Map<string, string>([[to, from]]);
  if (moved?.type === 'k' && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2) {
    const rank = from[1] ?? '1';
    const kingside = to[0] === 'g';
    moves.set(`${kingside ? 'f' : 'd'}${rank}`, `${kingside ? 'h' : 'a'}${rank}`);
  }
  const used = new Set<string>();
  return next.map((piece) => {
    const origin = moves.get(piece.square) ?? piece.square;
    const source = previous.find(
      (p) => p.square === origin && p.color === piece.color && !used.has(p.id),
    );
    if (!source) return piece;
    used.add(source.id);
    return { ...piece, id: source.id };
  });
}
