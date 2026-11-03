import { z } from 'zod';

/**
 * Primitives d'échecs communes à tous les paquets.
 * Toutes les données de ce fichier sont PUBLIQUES : elles décrivent des types AFFICHÉS.
 */

export const COLORS = ['w', 'b'] as const;
export const ColorSchema = z.enum(COLORS);
export type Color = z.infer<typeof ColorSchema>;

export function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

export const PIECE_TYPES = ['p', 'n', 'b', 'r', 'q', 'k'] as const;
export const PieceTypeSchema = z.enum(PIECE_TYPES);
export type PieceType = z.infer<typeof PieceTypeSchema>;

export const PROMOTION_PIECES = ['q', 'r', 'b', 'n'] as const;
export const PromotionPieceSchema = z.enum(PROMOTION_PIECES);
export type PromotionPiece = z.infer<typeof PromotionPieceSchema>;

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
export type File = (typeof FILES)[number];
export type Rank = (typeof RANKS)[number];
export type Square = `${File}${Rank}`;

/** Les 64 cases, ordre a1, a2, …, a8, b1, …, h8. */
export const SQUARES = FILES.flatMap((file) => RANKS.map((rank): Square => `${file}${rank}`)) as [
  Square,
  ...Square[],
];
export const SquareSchema = z.enum(SQUARES);

export function isSquare(value: string): value is Square {
  return /^[a-h][1-8]$/.test(value);
}

/**
 * Identifiant stable d'une pièce, pour l'animation et le suivi par le bot.
 * Format : couleur + type AFFICHÉ initial + case initiale, ex. « wpe2 », « bng8 ».
 * La dame secrète garde l'identifiant du pion qu'elle était (« wpe2 ») : aucun identifiant
 * n'encode le secret. Une pièce promue garde l'identifiant de son pion d'origine.
 */
export const PieceIdSchema = z.string().regex(/^[wb][pnbrqk][a-h][1-8]$/);
export type PieceId = z.infer<typeof PieceIdSchema>;

/** Pièce telle que vue par un joueur : `type` est toujours le type AFFICHÉ. */
export const DisplayedPieceSchema = z.object({
  id: PieceIdSchema,
  color: ColorSchema,
  type: PieceTypeSchema,
  square: SquareSchema,
});
export type DisplayedPiece = z.infer<typeof DisplayedPieceSchema>;

/** Intention de coup envoyée par un joueur (humain ou bot). Validée par le serveur. */
export const MoveIntentSchema = z.object({
  from: SquareSchema,
  to: SquareSchema,
  /** Uniquement pour la promotion d'un pion ordinaire. Ignoré sinon. */
  promotion: PromotionPieceSchema.optional(),
});
export type MoveIntent = z.infer<typeof MoveIntentSchema>;

/** Case de départ des pions d'une couleur (les 8 candidats au secret, H1). */
export function pawnStartSquares(color: Color): Square[] {
  const rank = color === 'w' ? '2' : '7';
  return FILES.map((file) => `${file}${rank}` as Square);
}
