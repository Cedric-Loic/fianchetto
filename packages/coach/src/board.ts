import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { Color } from '@sq/shared';

/** Valeur conventionnelle des pièces (le roi n'est jamais échangé). */
export const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const NAME: Record<PieceSymbol, { name: string; feminine: boolean }> = {
  p: { name: 'pion', feminine: false },
  n: { name: 'cavalier', feminine: false },
  b: { name: 'fou', feminine: false },
  r: { name: 'tour', feminine: true },
  q: { name: 'dame', feminine: true },
  k: { name: 'roi', feminine: false },
};

/** « le cavalier f6 », « la dame d8 ». */
export function pieceLabel(type: PieceSymbol, square: string): string {
  const { name, feminine } = NAME[type];
  return `${feminine ? 'la' : 'le'} ${name} ${square}`;
}

/** « le », « la » : pronom complément pour reprendre la pièce. */
export function pronoun(type: PieceSymbol): string {
  return NAME[type].feminine ? 'la' : 'le';
}

/** « cavalier e5 » (sans article), pour les énumérations. */
export function pieceShort(type: PieceSymbol, square: string): string {
  return `${NAME[type].name} ${square}`;
}

/** Joue un coup UCI ; `null` s'il est illégal. */
export function playUci(chess: Chess, uci: string): Move | null {
  try {
    return chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length > 4 ? { promotion: uci[4] } : {}),
    });
  } catch {
    return null;
  }
}

/** Notation SAN d'un coup UCI dans une position ; `null` s'il est illégal. */
export function uciToSan(fen: string, uci: string): string | null {
  return playUci(new Chess(fen), uci)?.san ?? null;
}

/** Matériel de `color` moins celui de l'adversaire. */
export function materialBalance(chess: Chess, color: Color): number {
  let total = 0;
  for (const row of chess.board()) {
    for (const piece of row) {
      if (piece) total += (piece.color === color ? 1 : -1) * PIECE_VALUE[piece.type];
    }
  }
  return total;
}

/**
 * Bilan matériel pour `color` après une suite de coups UCI jouée depuis `fen` (au plus `plies`
 * demi-coups ; arrêt au premier coup illégal).
 */
export function balanceAfterLine(
  fen: string,
  line: readonly string[],
  color: Color,
  plies: number,
): number {
  const chess = new Chess(fen);
  for (const uci of line.slice(0, plies)) {
    if (!playUci(chess, uci)) break;
  }
  return materialBalance(chess, color);
}

/**
 * La prise `move` gagne-t-elle du matériel à coup sûr ? Oui si la pièce prise n'était pas
 * défendue, ou si elle vaut plus que la pièce qui prend.
 */
export function winsMaterial(fenBefore: string, move: Move): boolean {
  if (!move.captured) return false;
  const chess = new Chess(fenBefore);
  const defended = chess.attackers(move.to, chess.turn() === 'w' ? 'b' : 'w').length > 0;
  return !defended || PIECE_VALUE[move.captured] > PIECE_VALUE[move.piece];
}

export interface ForkTarget {
  type: PieceSymbol;
  square: string;
}

/**
 * Cibles d'une fourchette créée par le coup `uci` joué depuis `fen` : pièces adverses attaquées
 * par la pièce qui vient de jouer et qui sont soit le roi, soit plus précieuses qu'elle, soit
 * sans défense. Fourchette si au moins deux cibles ; sinon tableau vide.
 */
export function forkTargets(fen: string, uci: string): ForkTarget[] {
  const chess = new Chess(fen);
  const move = playUci(chess, uci);
  if (!move) return [];
  const color = move.color;
  const opponent = color === 'w' ? 'b' : 'w';
  const attackerValue = PIECE_VALUE[move.promotion ?? move.piece];
  // Une pièce qui peut être prise aussitôt avec profit ne fait pas de vraie fourchette : elle
  // est sans défense, ou une pièce adverse moins précieuse (hors roi) peut la prendre.
  const defended = chess.attackers(move.to, color).length > 0;
  for (const square of chess.attackers(move.to, opponent)) {
    const type = chess.get(square)?.type;
    if (!type) continue;
    if (!defended || (type !== 'k' && PIECE_VALUE[type] < attackerValue)) return [];
  }
  const targets: ForkTarget[] = [];
  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece || piece.color !== opponent) continue;
      if (!chess.attackers(piece.square, color).includes(move.to)) continue;
      const valuable =
        piece.type === 'k' ||
        PIECE_VALUE[piece.type] > attackerValue ||
        (piece.type !== 'p' && chess.attackers(piece.square, opponent).length === 0);
      if (valuable) targets.push({ type: piece.type, square: piece.square });
    }
  }
  // Le roi d'abord, puis les pièces les plus précieuses.
  const rank = (t: ForkTarget) => (t.type === 'k' ? 100 : PIECE_VALUE[t.type]);
  targets.sort((a, b) => rank(b) - rank(a));
  return targets.length >= 2 ? targets : [];
}

/** Finale : peu de matériel hors pions et rois (26 points au plus, les deux camps réunis). */
export function isEndgame(fen: string): boolean {
  let material = 0;
  for (const row of new Chess(fen).board()) {
    for (const p of row) if (p && p.type !== 'p' && p.type !== 'k') material += PIECE_VALUE[p.type];
  }
  return material <= 26;
}

/** Clouage ou enfilade : pièce de devant, pièce de derrière, sur la ligne de la pièce qui joue. */
export interface LineTactic {
  kind: 'pin' | 'skewer';
  front: ForkTarget;
  back: ForkTarget;
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

const squareAt = (file: number, rank: number) =>
  file >= 0 && file < 8 && rank >= 0 && rank < 8
    ? `${String.fromCharCode(97 + file)}${rank + 1}`
    : null;

/**
 * Clouages et enfilades créés par le coup `uci` joué depuis `fen` : la pièce de ligne (fou,
 * tour, dame) qui vient de jouer vise une pièce adverse derrière laquelle se trouve une autre
 * pièce adverse.
 * - clouage : la pièce de devant (hors pion) vaut moins que celle de derrière (ou celle-ci est
 *   le roi) ; elle ne peut pas bouger sans l'exposer ;
 * - enfilade : la pièce de devant est le roi ou vaut plus que celle de derrière, qui tombe une
 *   fois la première écartée (elle est sans défense, ou vaut plus que la pièce qui attaque).
 * Comme pour les fourchettes, rien si la pièce qui joue peut être prise aussitôt avec profit, et
 * rien si elle était déjà sur cette ligne (clouage préexistant). Tri : le plus fort d'abord.
 */
export function lineTactics(fen: string, uci: string): LineTactic[] {
  const chess = new Chess(fen);
  const move = playUci(chess, uci);
  if (!move) return [];
  const type = move.promotion ?? move.piece;
  if (type !== 'b' && type !== 'r' && type !== 'q') return [];
  const color = move.color;
  const opponent = color === 'w' ? 'b' : 'w';
  const moverValue = PIECE_VALUE[type];
  const defended = chess.attackers(move.to, color).length > 0;
  for (const square of chess.attackers(move.to, opponent)) {
    const t = chess.get(square)?.type;
    if (!t) continue;
    if (!defended || (t !== 'k' && PIECE_VALUE[t] < moverValue)) return [];
  }
  const dirs = [
    ...(type === 'b' ? [] : ROOK_DIRS),
    ...(type === 'r' ? [] : BISHOP_DIRS),
  ] as readonly (readonly [number, number])[];
  const toFile = move.to.charCodeAt(0) - 97;
  const toRank = Number(move.to[1]) - 1;
  const fromFile = move.from.charCodeAt(0) - 97;
  const fromRank = Number(move.from[1]) - 1;
  const found: LineTactic[] = [];
  for (const [df, dr] of dirs) {
    // Déjà sur cette ligne, du côté opposé : la tactique existait avant le coup.
    const dx = fromFile - toFile;
    const dy = fromRank - toRank;
    if (
      (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) &&
      Math.sign(dx) === -df &&
      Math.sign(dy) === -dr
    )
      continue;
    const pieces: ForkTarget[] = [];
    for (let k = 1; pieces.length < 2; k++) {
      const square = squareAt(toFile + df * k, toRank + dr * k);
      if (!square) break;
      const piece = chess.get(square as Square);
      if (!piece) continue;
      if (piece.color !== opponent) break;
      pieces.push({ type: piece.type, square });
    }
    const [front, back] = pieces;
    if (!front || !back) continue;
    const frontValue = front.type === 'k' ? 100 : PIECE_VALUE[front.type];
    const backValue = back.type === 'k' ? 100 : PIECE_VALUE[back.type];
    if (front.type !== 'p' && frontValue < backValue && back.type !== 'p') {
      found.push({ kind: 'pin', front, back });
    } else if (frontValue > backValue && back.type !== 'p') {
      // La pièce de devant s'écarte : elle ne compte pas parmi les défenseurs.
      const backDefended = chess
        .attackers(back.square as Square, opponent)
        .some((s) => s !== front.square);
      if (!backDefended || PIECE_VALUE[back.type] > moverValue) {
        found.push({ kind: 'skewer', front, back });
      }
    }
  }
  const worth = (t: LineTactic) =>
    t.kind === 'pin'
      ? t.back.type === 'k'
        ? 100
        : PIECE_VALUE[t.back.type]
      : PIECE_VALUE[t.back.type];
  return found.sort((a, b) => worth(b) - worth(a));
}
