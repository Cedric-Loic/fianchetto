import { z } from 'zod';
import { ColorSchema } from './chess.js';
import {
  BotLevelSchema,
  EndReasonSchema,
  GameModeSchema,
  VariantSchema,
  ViewerGameStateSchema,
} from './game-state.js';
import { TimeControlIdSchema } from './time-control.js';

/*
 * Contrats REST (/api/*) : comptes, Elo, historique, création de partie, analyse.
 * Les parties elles-mêmes passent par le WebSocket (protocol.ts).
 */

export const UsernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[A-Za-z0-9_-]+$/);
export const PasswordSchema = z.string().min(8).max(128);

export const CredentialsSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
});
export type Credentials = z.infer<typeof CredentialsSchema>;

/** Elo d'un joueur dans une variante. */
export const RatingSchema = z.object({
  rating: z.number().int(),
  gamesPlayed: z.number().int().nonnegative(),
});
export type Rating = z.infer<typeof RatingSchema>;

export const UserPublicSchema = z.object({
  id: z.string(),
  username: UsernameSchema,
  /** Un Elo séparé par variante. */
  ratings: z.object({ classic: RatingSchema, 'secret-queen': RatingSchema }),
});
export type UserPublic = z.infer<typeof UserPublicSchema>;

export const CreateGameRequestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('bot'),
    variant: VariantSchema,
    level: BotLevelSchema,
    timeControl: TimeControlIdSchema,
    color: z.enum(['w', 'b', 'random']),
  }),
  z.object({
    mode: z.literal('hotseat'),
    variant: VariantSchema,
    timeControl: TimeControlIdSchema,
    whiteName: z.string().min(1).max(32),
    blackName: z.string().min(1).max(32),
  }),
]);
export type CreateGameRequest = z.infer<typeof CreateGameRequestSchema>;

export const CreateGameResponseSchema = z.object({ gameId: z.string() });
export type CreateGameResponse = z.infer<typeof CreateGameResponseSchema>;

export const GameSummarySchema = z.object({
  gameId: z.string(),
  variant: VariantSchema,
  mode: GameModeSchema,
  rated: z.boolean(),
  timeControl: TimeControlIdSchema,
  /** Camp joué par l'utilisateur (en hot-seat : `w`). */
  color: ColorSchema,
  opponentName: z.string(),
  /** `null` tant que la partie n'est pas terminée. */
  winner: ColorSchema.nullable(),
  reason: EndReasonSchema.nullable(),
  ratingBefore: z.number().int().nullable(),
  ratingAfter: z.number().int().nullable(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});
export type GameSummary = z.infer<typeof GameSummarySchema>;

export const ProfileResponseSchema = z.object({
  user: UserPublicSchema,
  history: z.array(GameSummarySchema),
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

export const LeaderboardResponseSchema = z.object({
  variant: VariantSchema,
  entries: z.array(
    z.object({
      rank: z.number().int().positive(),
      username: UsernameSchema,
      rating: z.number().int(),
      gamesPlayed: z.number().int().nonnegative(),
    }),
  ),
});
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

export const BotLevelInfoSchema = z.object({
  level: BotLevelSchema,
  name: z.string(),
  elo: z.number().int(),
});
export type BotLevelInfo = z.infer<typeof BotLevelInfoSchema>;

/** Partie en cours de l'utilisateur (reprise après rafraîchissement). */
export const ActiveGameResponseSchema = z.object({ gameId: z.string().nullable() });
export type ActiveGameResponse = z.infer<typeof ActiveGameResponseSchema>;

/**
 * Analyse d'une partie TERMINÉE (positions réelles). Refusée (409) avant la fin.
 * `plies[0]` = position initiale réelle, `plies[i]` = position après le demi-coup i.
 */
export const AnalysisResponseSchema = z.object({
  plies: z.array(
    z.object({
      ply: z.number().int().nonnegative(),
      /** Évaluation du point de vue des Blancs, en centipions ; `null` si mat forcé. */
      evalCp: z.number().int().nullable(),
      /** Mat en N (positif : les Blancs matent), sinon `null`. */
      mate: z.number().int().nullable(),
      bestMoveUci: z.string().nullable(),
      bestMoveSan: z.string().nullable(),
    }),
  ),
});
export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

/** Rejeu d'une partie terminée : dernier état, révélation comprise. */
export const ReplayResponseSchema = z.object({ state: ViewerGameStateSchema });
export type ReplayResponse = z.infer<typeof ReplayResponseSchema>;

export const ApiErrorSchema = z.object({ error: z.string() });
export type ApiError = z.infer<typeof ApiErrorSchema>;
