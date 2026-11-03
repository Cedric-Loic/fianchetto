import { z } from 'zod';
import { ColorSchema } from './chess.js';
import { LegalMoveSchema } from './game-state.js';

/*
 * Répertoire d'ouvertures (lot 4d) : lignes écrites pour le projet (Italienne avec les Blancs,
 * 1…e5 et 1…d5 avec les Noirs), révisées en répétition espacée. Le répertoire est public : les
 * coups des lignes sont envoyés au client, qui valide lui-même les coups de l'entraînement.
 */

export const OpeningLineSummarySchema = z.object({
  id: z.string(),
  /** Camp du joueur dans cette ligne. */
  color: ColorSchema,
  /** Famille de la ligne (« Partie italienne », « Contre 1. d4 »…). */
  group: z.string(),
  title: z.string(),
  /** Idée de la ligne, en une phrase. */
  idea: z.string(),
  /** Coups de la ligne depuis la position initiale (SAN anglaise). */
  moves: z.array(z.string()),
  /** `new` : jamais révisée ; `learned` : dernier intervalle atteint. */
  status: z.enum(['new', 'learning', 'learned']),
  /** Prochaine révision (ms), `null` pour une ligne nouvelle. */
  dueAt: z.number().nullable(),
  due: z.boolean(),
});
export type OpeningLineSummary = z.infer<typeof OpeningLineSummarySchema>;

export const OpeningsResponseSchema = z.object({
  lines: z.array(OpeningLineSummarySchema),
  /** Nombre de lignes dues aujourd'hui. */
  due: z.number().int(),
});
export type OpeningsResponse = z.infer<typeof OpeningsResponseSchema>;

/** Un demi-coup de la ligne : coup joué, position après, coups légaux avant (coups du joueur). */
export const OpeningStepSchema = z.object({
  uci: z.string(),
  san: z.string(),
  fen: z.string(),
  legalMoves: z.array(LegalMoveSchema),
});
export type OpeningStep = z.infer<typeof OpeningStepSchema>;

export const OpeningDrillSchema = z.object({
  line: OpeningLineSummarySchema,
  steps: z.array(OpeningStepSchema),
});
export type OpeningDrill = z.infer<typeof OpeningDrillSchema>;

/** Ligne à réviser : la plus en retard des lignes dues, sinon la prochaine ligne nouvelle. */
export const OpeningNextResponseSchema = z.object({
  drill: OpeningDrillSchema.nullable(),
  reason: z.enum(['due', 'new']).nullable(),
});
export type OpeningNextResponse = z.infer<typeof OpeningNextResponseSchema>;

export const OpeningResultRequestSchema = z.object({ success: z.boolean() });

/** Partie à comparer au répertoire (revue) : coups SAN depuis la position initiale. */
export const OpeningDeviationRequestSchema = z.object({
  moves: z.array(z.string().max(16)).max(600),
  color: ColorSchema,
});

export const OpeningDeviationSchema = z.object({
  /** Demi-coup (à partir de 1) qui quitte le répertoire. */
  ply: z.number().int().positive(),
  /** Numéro du coup (1. e4 → 1). */
  moveNumber: z.number().int().positive(),
  /** Le joueur a joué autre chose que son répertoire, ou l'adversaire a joué un coup non prévu. */
  by: z.enum(['player', 'opponent']),
  played: z.string(),
  /** Coup(s) prévu(s) par le répertoire à cet endroit. */
  expected: z.array(z.string()),
});
export type OpeningDeviation = z.infer<typeof OpeningDeviationSchema>;

export const OpeningDeviationResponseSchema = z.object({
  deviation: OpeningDeviationSchema.nullable(),
});
export type OpeningDeviationResponse = z.infer<typeof OpeningDeviationResponseSchema>;
