import { opposite, type Color, type PieceType, type PromotionPiece, type Square } from '@sq/shared';
import { fileIndex, rankNumber, squareAt, type PublicBoard } from './board.js';

/*
 * Notation publique (docs/RULES.md §3). Tout est calculé sur l'échiquier PUBLIC (types affichés,
 * avant le coup). Seule information réelle utilisée : la pièce qui joue est-elle la dame secrète
 * de son camp (le camp qui joue le sait toujours), et les annonces d'échec / mat.
 */

export interface PublicSanInput {
  /** Échiquier public AVANT le coup. */
  board: PublicBoard;
  color: Color;
  /** Type affiché de la pièce avant le coup. */
  displayedType: PieceType;
  /** La pièce est la dame secrète de `color` (affichée « p »). */
  isSecretQueen: boolean;
  from: Square;
  to: Square;
  /** Prise en passant (vrai pion uniquement). */
  enPassant: boolean;
  /** Promotion d'un vrai pion. */
  promotion: PromotionPiece | null;
  castle: 'king' | 'queen' | null;
  /** Le camp adverse est en échec dans la position réelle après le coup. */
  check: boolean;
  /** Le camp adverse est mat. */
  mate: boolean;
}

export function publicSan(input: PublicSanInput): string {
  return sanBody(input) + (input.mate ? '#' : input.check ? '+' : '');
}

function sanBody(input: PublicSanInput): string {
  const { board, color, displayedType, from, to } = input;
  if (input.castle !== null) return input.castle === 'king' ? 'O-O' : 'O-O-O';

  const capture = input.enPassant || board.get(to)?.color === opposite(color);

  if (displayedType === 'p') {
    // §3.1 : un vrai pion est toujours noté en pion ; la dame secrète seulement si son coup a
    // la géométrie d'un coup de pion sans promotion, sinon en coordonnées.
    if (input.isSecretQueen && !isPawnGeometry(board, color, from, to)) {
      return `${from}${capture ? 'x' : '-'}${to}`;
    }
    const promotion = input.promotion === null ? '' : `=${input.promotion.toUpperCase()}`;
    return `${capture ? `${from[0]}x` : ''}${to}${promotion}`;
  }

  const disambiguation = displayedType === 'k' ? '' : disambiguate(input);
  return `${displayedType.toUpperCase()}${disambiguation}${capture ? 'x' : ''}${to}`;
}

/**
 * Le coup de la dame secrète a-t-il la géométrie d'un coup de pion sans promotion (§3.1, cas 2) ?
 * Une diagonale vers une case vide n'en est jamais un (pas de prise en passant).
 */
export function isPawnGeometry(board: PublicBoard, color: Color, from: Square, to: Square): boolean {
  const forward = color === 'w' ? 1 : -1;
  const startRank = color === 'w' ? 2 : 7;
  const lastRank = color === 'w' ? 8 : 1;
  const fromRank = rankNumber(from);
  const toRank = rankNumber(to);
  if (fromRank < 2 || fromRank > 7 || toRank === lastRank) return false;

  const fileDelta = fileIndex(to) - fileIndex(from);
  const target = board.get(to);
  if (fileDelta === 0) {
    if (target !== undefined) return false;
    if (toRank === fromRank + forward) return true;
    if (fromRank !== startRank || toRank !== fromRank + 2 * forward) return false;
    return !board.has(squareAt(fileIndex(from), fromRank + forward) as Square);
  }
  return (
    Math.abs(fileDelta) === 1 &&
    toRank === fromRank + forward &&
    target !== undefined &&
    target.color !== color
  );
}

/**
 * Désambiguïsation SAN calculée sur l'échiquier public, sans clouages ni échecs (§3.2) : autres
 * pièces du même camp et du même type AFFICHÉ capables d'atteindre `to` selon leur mouvement.
 */
function disambiguate(input: PublicSanInput): string {
  const { board, color, displayedType, from, to } = input;
  const rivals: Square[] = [];
  for (const [square, piece] of board) {
    if (square === from || piece.color !== color || piece.type !== displayedType) continue;
    if (canReach(board, displayedType, square, to)) rivals.push(square);
  }
  if (rivals.length === 0) return '';
  if (!rivals.some((square) => square[0] === from[0])) return from[0] as string;
  if (!rivals.some((square) => square[1] === from[1])) return from[1] as string;
  return from;
}

/**
 * Une pièce de type `type` (cavalier, fou, tour ou dame) placée en `from` atteint-elle `to`
 * selon son mouvement ? Les pièces glissantes sont bloquées par toute pièce intermédiaire.
 * La case d'arrivée n'est pas examinée : elle est vide ou adverse pour le coup noté, donc pour
 * toutes les pièces rivales du même camp.
 */
export function canReach(board: PublicBoard, type: PieceType, from: Square, to: Square): boolean {
  const df = fileIndex(to) - fileIndex(from);
  const dr = rankNumber(to) - rankNumber(from);
  if (type === 'n') return Math.abs(df * dr) === 2;
  const straight = df === 0 || dr === 0;
  const diagonal = Math.abs(df) === Math.abs(dr);
  const allowed = type === 'r' ? straight : type === 'b' ? diagonal : straight || diagonal;
  if (!allowed || (df === 0 && dr === 0)) return false;

  const stepFile = Math.sign(df);
  const stepRank = Math.sign(dr);
  let file = fileIndex(from) + stepFile;
  let rank = rankNumber(from) + stepRank;
  while (file !== fileIndex(to) || rank !== rankNumber(to)) {
    if (board.has(squareAt(file, rank) as Square)) return false;
    file += stepFile;
    rank += stepRank;
  }
  return true;
}
