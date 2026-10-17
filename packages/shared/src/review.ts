import { z } from 'zod';
import { ColorSchema } from './chess.js';
import { VariantSchema } from './game-state.js';

/*
 * Revue de partie (coach, étape 7) : évaluation Stockfish de chaque position, classification de
 * chaque coup, explication locale des erreurs, précision. Elle porte sur une partie TERMINÉE
 * (partie locale) ou importée (PGN, chess.com) : uniquement des positions réelles déjà connues
 * du joueur, aucune information secrète.
 */

/** Évaluation d'une position, du point de vue des Blancs. */
export const PositionEvalSchema = z.object({
  /** Centipions ; `null` si mat forcé (voir `mate`) ou position finale. */
  evalCp: z.number().int().nullable(),
  /** Mat en N (positif : les Blancs matent), sinon `null`. */
  mate: z.number().int().nullable(),
  bestMoveUci: z.string().nullable(),
  bestMoveSan: z.string().nullable(),
});
export type PositionEval = z.infer<typeof PositionEvalSchema>;

export const MOVE_CLASSES = [
  'best',
  'excellent',
  'good',
  'inaccuracy',
  'mistake',
  'blunder',
] as const;
export const MoveClassSchema = z.enum(MOVE_CLASSES);
export type MoveClass = z.infer<typeof MoveClassSchema>;

export const EXPLANATION_KINDS = [
  'missed-mate',
  'allowed-mate',
  'hanging-piece',
  'allowed-fork',
  'material-loss',
  'missed-fork',
  'missed-material',
  'generic',
] as const;
export const ExplanationKindSchema = z.enum(EXPLANATION_KINDS);
export type ExplanationKind = z.infer<typeof ExplanationKindSchema>;

export const ReviewMoveSchema = z.object({
  /** Numéro de demi-coup, à partir de 1. */
  ply: z.number().int().positive(),
  color: ColorSchema,
  san: z.string(),
  uci: z.string(),
  classification: MoveClassSchema,
  /** Probabilité de gain du joueur qui joue, avant (meilleur jeu) et après son coup, en %. */
  winBefore: z.number(),
  winAfter: z.number(),
  /** Précision du coup (0 à 100). */
  accuracy: z.number(),
  /** Explication en français des imprécisions, erreurs et gaffes ; `null` sinon. */
  explanation: z.object({ kind: ExplanationKindSchema, text: z.string() }).nullable(),
});
export type ReviewMove = z.infer<typeof ReviewMoveSchema>;

const PerColorCountsSchema = z.object({
  best: z.number().int(),
  excellent: z.number().int(),
  good: z.number().int(),
  inaccuracy: z.number().int(),
  mistake: z.number().int(),
  blunder: z.number().int(),
});
export type ClassCounts = z.infer<typeof PerColorCountsSchema>;

export const GameReviewSchema = z.object({
  /** FEN réelles : position initiale puis une par demi-coup (`positions.length = moves.length + 1`). */
  positions: z.array(z.string()),
  evals: z.array(PositionEvalSchema),
  moves: z.array(ReviewMoveSchema),
  /** Précision de chaque camp (`null` s'il n'a joué aucun coup). */
  accuracy: z.object({ w: z.number().nullable(), b: z.number().nullable() }),
  counts: z.object({ w: PerColorCountsSchema, b: PerColorCountsSchema }),
});
export type GameReview = z.infer<typeof GameReviewSchema>;

/** État de la revue d'une partie (analyse en arrière-plan). */
export const ReviewStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('none') }),
  z.object({ status: z.literal('queued') }),
  z.object({ status: z.literal('running'), progress: z.number().min(0).max(1) }),
  z.object({ status: z.literal('error') }),
  z.object({ status: z.literal('done'), review: GameReviewSchema }),
]);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

/** Contexte d'une revue : joueurs, camp de l'utilisateur, provenance. */
export const ReviewInfoSchema = z.object({
  gameId: z.string(),
  source: z.enum(['local', 'pgn', 'chesscom']),
  variant: VariantSchema,
  white: z.string(),
  black: z.string(),
  /** Camp de l'utilisateur (plateau orienté de son côté), `null` si inconnu. */
  userColor: ColorSchema.nullable(),
  result: z.string(),
  date: z.string().nullable(),
  url: z.string().nullable(),
});
export type ReviewInfo = z.infer<typeof ReviewInfoSchema>;

export const ReviewResponseSchema = z.object({
  info: ReviewInfoSchema,
  state: ReviewStatusSchema,
});
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

// --- Import de parties -------------------------------------------------------------------

export const ImportPgnRequestSchema = z.object({
  pgn: z.string().min(1).max(5_000_000),
  /** Pseudo de l'utilisateur dans ces parties (pour savoir quel camp il jouait). */
  as: z.string().max(40).optional(),
});
export type ImportPgnRequest = z.infer<typeof ImportPgnRequestSchema>;

export const ImportChessComRequestSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/),
  /** Nombre de parties récentes à récupérer. */
  max: z.number().int().min(1).max(200),
});
export type ImportChessComRequest = z.infer<typeof ImportChessComRequestSchema>;

export const ImportResultSchema = z.object({
  imported: z.number().int(),
  duplicates: z.number().int(),
  invalid: z.number().int(),
});
export type ImportResult = z.infer<typeof ImportResultSchema>;

/** Statistiques de l'utilisateur sur une partie analysée (son camp). */
export const UserGameStatsSchema = z.object({
  accuracy: z.number().nullable(),
  inaccuracy: z.number().int(),
  mistake: z.number().int(),
  blunder: z.number().int(),
});
export type UserGameStats = z.infer<typeof UserGameStatsSchema>;

export const ImportedGameSummarySchema = z.object({
  id: z.string(),
  source: z.enum(['pgn', 'chesscom']),
  white: z.string(),
  black: z.string(),
  whiteElo: z.number().int().nullable(),
  blackElo: z.number().int().nullable(),
  result: z.string(),
  date: z.string().nullable(),
  timeControl: z.string().nullable(),
  userColor: ColorSchema.nullable(),
  plies: z.number().int(),
  url: z.string().nullable(),
  review: z.enum(['none', 'queued', 'running', 'error', 'done']),
  /** Statistiques du camp de l'utilisateur, si la partie est analysée et le camp connu. */
  stats: UserGameStatsSchema.nullable(),
});
export type ImportedGameSummary = z.infer<typeof ImportedGameSummarySchema>;

export const ImportedGamesResponseSchema = z.object({
  games: z.array(ImportedGameSummarySchema),
});
export type ImportedGamesResponse = z.infer<typeof ImportedGamesResponseSchema>;
