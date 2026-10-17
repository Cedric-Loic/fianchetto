import { FILES, type Color, type PieceId, type PieceType, type Square } from '@sq/shared';

/*
 * Outils de base sur les cases et les pièces suivies par le moteur.
 * Fichiers et rangées sont manipulés en nombres : colonne 0 (a) à 7 (h), rangée 1 à 8.
 */

/** Pièce suivie par le moteur : identité stable, type affiché et type réel. */
export interface TrackedPiece {
  readonly id: PieceId;
  readonly color: Color;
  /** Type affiché aux joueurs (la dame secrète reste un « p »). */
  displayed: PieceType;
  /** Type dans la position réelle. */
  real: PieceType;
}

/** Pièce de l'échiquier public : couleur et type affiché uniquement. */
export interface PublicPiece {
  readonly color: Color;
  readonly type: PieceType;
}

export type PublicBoard = ReadonlyMap<Square, PublicPiece>;

export function fileIndex(square: Square): number {
  return square.charCodeAt(0) - 97;
}

export function rankNumber(square: Square): number {
  return square.charCodeAt(1) - 48;
}

/** Case de colonne `file` (0 à 7) et de rangée `rank` (1 à 8), `null` hors de l'échiquier. */
export function squareAt(file: number, rank: number): Square | null {
  const fileName = FILES[file];
  if (fileName === undefined || rank < 1 || rank > 8) return null;
  return `${fileName}${rank}` as Square;
}

const BACK_RANK: readonly PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

/**
 * Position de départ réelle : position standard où le pion de chaque case secrète est une dame
 * (aucune en classique : `secrets` vide).
 * Identifiant = couleur + type affiché initial + case initiale (la dame secrète garde « p »).
 */
export function initialPieces(
  secrets: Readonly<Partial<Record<Color, Square>>>,
): Map<Square, TrackedPiece> {
  const pieces = new Map<Square, TrackedPiece>();
  const place = (color: Color, type: PieceType, square: Square) => {
    const real = type === 'p' && secrets[color] === square ? 'q' : type;
    pieces.set(square, { id: `${color}${type}${square}`, color, displayed: type, real });
  };
  FILES.forEach((file, index) => {
    const officer = BACK_RANK[index] as PieceType;
    place('w', officer, `${file}1`);
    place('w', 'p', `${file}2`);
    place('b', 'p', `${file}7`);
    place('b', officer, `${file}8`);
  });
  return pieces;
}

/** Champ « placement » d'une FEN, à partir des types RÉELS. */
export function realPlacement(pieces: ReadonlyMap<Square, TrackedPiece>): string {
  const rows: string[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    let row = '';
    let empty = 0;
    for (let file = 0; file < 8; file++) {
      const piece = pieces.get(squareAt(file, rank) as Square);
      if (piece === undefined) {
        empty++;
        continue;
      }
      if (empty > 0) row += String(empty);
      empty = 0;
      row += piece.color === 'w' ? piece.real.toUpperCase() : piece.real;
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  return rows.join('/');
}
