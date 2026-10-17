import {
  FILES,
  PROMOTION_PIECES,
  SQUARES,
  type Color,
  type DisplayedPiece,
  type MoveIntent,
  type Square,
  type ViewerBoardState,
} from '@sq/shared';

/**
 * Outils qui ne s'appuient QUE sur l'information publique (ce qu'un attaquant voit) :
 * formes de notation admises (`docs/RULES.md` §3) et générateur d'intentions candidates.
 */

/** Coup de pion : « e4 », « exd5 », « e8=Q », suffixes « + » / « # ». */
export const PAWN_SAN_RE = /^([a-h])(?:x([a-h]))?([1-8])(=[QRBN])?([+#])?$/;
/** Coup en coordonnées d'une pièce affichée pion : « a2-d5 », « a2xd5 ». */
export const COORD_SAN_RE = /^([a-h][1-8])([-x])([a-h][1-8])([+#])?$/;
/** Coup d'une pièce affichée autre que pion : « Nf3 », « Nge2 », « R1xa3 », « Qh4# ». */
export const PIECE_SAN_RE = /^([NBRQK])([a-h])?([1-8])?(x)?([a-h][1-8])([+#])?$/;
export const CASTLE_SAN_RE = /^(O-O(?:-O)?)([+#])?$/;

export function fileIndex(square: Square): number {
  return square.charCodeAt(0) - 97;
}

export function rankIndex(square: Square): number {
  return square.charCodeAt(1) - 49;
}

export function squareAt(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file] ?? 'a'}${rank + 1}` as Square;
}

/** « e2e4 », « b7a8n » → intention. Aide à l'écriture des scénarios. */
export function uci(text: string): MoveIntent {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(text);
  if (!match) throw new Error(`Intention mal formée : ${text}`);
  const intent: MoveIntent = { from: match[1] as Square, to: match[2] as Square };
  if (match[3]) intent.promotion = match[3] as MoveIntent['promotion'];
  return intent;
}

export function intentKey(intent: MoveIntent): string {
  return `${intent.from}${intent.to}${intent.promotion ?? ''}`;
}

type Board = ReadonlyMap<Square, DisplayedPiece>;

export function boardOf(state: Pick<ViewerBoardState, 'pieces'>): Board {
  return new Map(state.pieces.map((piece) => [piece.square, piece]));
}

const ROOK_DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
const BISHOP_DIRS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
] as const;
const QUEEN_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_JUMPS = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
] as const;

function slides(
  board: Board,
  from: Square,
  color: Color,
  dirs: ReadonlyArray<readonly [number, number]>,
  maxSteps: number,
): Square[] {
  const out: Square[] = [];
  for (const [df, dr] of dirs) {
    for (let step = 1; step <= maxSteps; step++) {
      const to = squareAt(fileIndex(from) + df * step, rankIndex(from) + dr * step);
      if (!to) break;
      const occupant = board.get(to);
      if (occupant && occupant.color === color) break;
      out.push(to);
      if (occupant) break;
    }
  }
  return out;
}

function withPromotions(from: Square, to: Square, color: Color): MoveIntent[] {
  const lastRank = color === 'w' ? 7 : 0;
  if (rankIndex(to) !== lastRank) return [{ from, to }];
  return PROMOTION_PIECES.map((promotion) => ({ from, to, promotion }));
}

/**
 * Coups pseudo-légaux sur l'échiquier PUBLIC pour une pièce de type affiché donné
 * (sans clouages ni échecs). Pour un pion : poussées, prises, diagonales vers une case vide
 * (tentatives de prise en passant) et promotions.
 */
export function displayedMoves(board: Board, piece: DisplayedPiece): MoveIntent[] {
  const { square: from, color } = piece;
  switch (piece.type) {
    case 'p': {
      const dir = color === 'w' ? 1 : -1;
      const startRank = color === 'w' ? 1 : 6;
      const out: MoveIntent[] = [];
      const one = squareAt(fileIndex(from), rankIndex(from) + dir);
      if (one && !board.has(one)) {
        out.push(...withPromotions(from, one, color));
        const two = squareAt(fileIndex(from), rankIndex(from) + 2 * dir);
        if (rankIndex(from) === startRank && two && !board.has(two)) out.push({ from, to: two });
      }
      for (const df of [-1, 1]) {
        const diag = squareAt(fileIndex(from) + df, rankIndex(from) + dir);
        if (!diag) continue;
        const occupant = board.get(diag);
        if (!occupant || occupant.color !== color) out.push(...withPromotions(from, diag, color));
      }
      return out;
    }
    case 'n':
      return slides(board, from, color, KNIGHT_JUMPS, 1).map((to) => ({ from, to }));
    case 'b':
      return slides(board, from, color, BISHOP_DIRS, 7).map((to) => ({ from, to }));
    case 'r':
      return slides(board, from, color, ROOK_DIRS, 7).map((to) => ({ from, to }));
    case 'q':
      return slides(board, from, color, QUEEN_DIRS, 7).map((to) => ({ from, to }));
    case 'k': {
      const out = slides(board, from, color, QUEEN_DIRS, 1).map((to) => ({ from, to }));
      const home: Square = color === 'w' ? 'e1' : 'e8';
      if (from === home) {
        const rank = color === 'w' ? '1' : '8';
        out.push({ from, to: `g${rank}` as Square }, { from, to: `c${rank}` as Square });
      }
      return out;
    }
  }
}

export interface Candidates {
  /** Coups pseudo-légaux selon les types affichés. */
  displayed: MoveIntent[];
  /** Coups de dame des pièces affichées pion (n'importe lequel peut être la dame secrète). */
  pawnAsQueen: MoveIntent[];
}

/** Intentions candidates pour le camp au trait, calculées sur la vue publique seulement. */
export function candidateIntents(state: Pick<ViewerBoardState, 'pieces' | 'turn'>): Candidates {
  const board = boardOf(state);
  const displayed: MoveIntent[] = [];
  const pawnAsQueen: MoveIntent[] = [];
  const seen = new Set<string>();
  const add = (list: MoveIntent[], intent: MoveIntent) => {
    const key = intentKey(intent);
    if (seen.has(key)) return;
    seen.add(key);
    list.push(intent);
  };
  const own = state.pieces.filter((piece) => piece.color === state.turn);
  for (const piece of own) {
    for (const intent of displayedMoves(board, piece)) add(displayed, intent);
  }
  const lastRank = state.turn === 'w' ? 7 : 0;
  for (const piece of own) {
    if (piece.type !== 'p') continue;
    for (const to of slides(board, piece.square, piece.color, QUEEN_DIRS, 7)) {
      add(pawnAsQueen, { from: piece.square, to });
      // Une dame secrète qui atteint la dernière rangée ignore toute promotion demandée.
      if (rankIndex(to) === lastRank) add(pawnAsQueen, { from: piece.square, to, promotion: 'n' });
    }
  }
  return { displayed, pawnAsQueen };
}

/** Intention arbitraire (le plus souvent illégale) dérivée d'un entier. */
export function arbitraryIntent(seed: number): MoveIntent {
  const from = SQUARES[seed % 64] ?? 'a1';
  const to = SQUARES[Math.floor(seed / 64) % 64] ?? 'a1';
  const promo = Math.floor(seed / 4096) % 6;
  const promotion = PROMOTION_PIECES[promo];
  return promotion && promo < 4 ? { from, to, promotion } : { from, to };
}

/**
 * Choisit une intention à partir d'un entier (fourni par fast-check, donc rejouable et
 * réductible) : ~65 % coups affichés, ~25 % coups de dame d'un « pion », ~10 % arbitraires.
 */
export function pickIntent(state: Pick<ViewerBoardState, 'pieces' | 'turn'>, seed: number) {
  const { displayed, pawnAsQueen } = candidateIntents(state);
  const bucket = seed % 100;
  const index = Math.floor(seed / 100);
  if (bucket < 65 && displayed.length > 0) return displayed[index % displayed.length] as MoveIntent;
  if (bucket < 90 && pawnAsQueen.length > 0) {
    return pawnAsQueen[index % pawnAsQueen.length] as MoveIntent;
  }
  return arbitraryIntent(index);
}

const BACK_RANK: readonly DisplayedPiece['type'][] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

/** Pièces affichées de la position initiale, triées par case (ordre de `SQUARES`). */
export function initialDisplayedPieces(): DisplayedPiece[] {
  const pieces: DisplayedPiece[] = [];
  for (const square of SQUARES) {
    const file = fileIndex(square);
    const rank = rankIndex(square);
    const color: Color | null = rank <= 1 ? 'w' : rank >= 6 ? 'b' : null;
    if (!color) continue;
    const type = rank === 1 || rank === 6 ? 'p' : (BACK_RANK[file] ?? 'r');
    pieces.push({ id: `${color}${type}${square}`, color, type, square });
  }
  return pieces;
}
