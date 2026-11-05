import { z } from 'zod';
import { ColorSchema } from './chess.js';
import { PuzzleStepSchema } from './puzzle.js';

/*
 * Exercices d'entraînement rapide (étape 17), tous tirés de la base de puzzles locale :
 * - « Trouve la menace » : tu viens de jouer ; quel coup adverse te fait mal ?
 * - Cycles Woodpecker : un lot fixe de puzzles refait en cycles de plus en plus rapides ;
 * - Contre la montre : puzzles de difficulté croissante, 3 ou 5 minutes, 3 erreurs au plus.
 * Le serveur juge ; la solution n'est envoyée qu'après la réponse.
 */

// --- Trouve la menace ----------------------------------------------------------------------

/**
 * Position à lire du point de vue du défenseur : `lastMove` est mon dernier coup, l'adversaire a
 * le trait. La menace (premier coup de la solution du puzzle) n'est pas envoyée.
 */
export const ThreatProblemSchema = z.object({
  id: z.string(),
  fen: z.string(),
  /** Mon camp (plateau orienté de son côté) ; l'adversaire a le trait. */
  color: ColorSchema,
  lastMove: z.object({ from: z.string(), to: z.string(), san: z.string() }),
  rating: z.number().int(),
});
export type ThreatProblem = z.infer<typeof ThreatProblemSchema>;

export const ThreatStatsSchema = z.object({
  attempts: z.number().int(),
  correct: z.number().int(),
  /** Bonnes réponses d'affilée (dernières tentatives). */
  streak: z.number().int(),
});
export type ThreatStats = z.infer<typeof ThreatStatsSchema>;

/** `GET /api/threats/next` : `problem` vaut `null` si la base de puzzles est absente. */
export const ThreatNextResponseSchema = z.object({
  problem: ThreatProblemSchema.nullable(),
  stats: ThreatStatsSchema,
});
export type ThreatNextResponse = z.infer<typeof ThreatNextResponseSchema>;

/** Réponse : le coup adverse redouté (case de départ, case d'arrivée). */
export const ThreatAnswerRequestSchema = z.object({
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
});
export const ThreatAnswerResponseSchema = z.object({
  correct: z.boolean(),
  /** La menace, puis la suite de la combinaison (révélées après la réponse). */
  line: z.array(PuzzleStepSchema),
  themes: z.array(z.string()),
  explanation: z.string(),
  stats: ThreatStatsSchema,
});
export type ThreatAnswerResponse = z.infer<typeof ThreatAnswerResponseSchema>;

// --- Cycles Woodpecker ---------------------------------------------------------------------

export const WOODPECKER_SIZES = [25, 50, 100, 200] as const;
export const WOODPECKER_MAX_CYCLES = 7;

export const WoodpeckerCycleSchema = z.object({
  cycle: z.number().int(),
  solved: z.number().int(),
  total: z.number().int(),
  /** Temps de résolution cumulé du cycle (somme des tentatives). */
  ms: z.number().int(),
});
export type WoodpeckerCycle = z.infer<typeof WoodpeckerCycleSchema>;

export const WoodpeckerStateSchema = z.object({
  set: z
    .object({
      size: z.number().int(),
      /** Cycle en cours (1 à `WOODPECKER_MAX_CYCLES`). */
      cycle: z.number().int(),
      /** Puzzles déjà faits dans le cycle en cours. */
      position: z.number().int(),
      solved: z.number().int(),
      ms: z.number().int(),
      /** Objectif du cycle : la moitié du temps du cycle précédent (`null` au premier cycle). */
      targetMs: z.number().int().nullable(),
      history: z.array(WoodpeckerCycleSchema),
      /** Tous les cycles sont faits. */
      finished: z.boolean(),
    })
    .nullable(),
  /** La base de puzzles est installée. */
  bank: z.boolean(),
});
export type WoodpeckerState = z.infer<typeof WoodpeckerStateSchema>;

export const WoodpeckerStartRequestSchema = z.object({
  size: z.union([z.literal(25), z.literal(50), z.literal(100), z.literal(200)]),
});

// --- Contre la montre ----------------------------------------------------------------------

export const RUSH_MINUTES = [3, 5] as const;
export const RUSH_MAX_ERRORS = 3;

export const RushResultRequestSchema = z.object({
  minutes: z.union([z.literal(3), z.literal(5)]),
  score: z.number().int().min(0).max(500),
  errors: z.number().int().min(0).max(RUSH_MAX_ERRORS),
});
export type RushResultRequest = z.infer<typeof RushResultRequestSchema>;

export const RushRecordsSchema = z.object({
  best: z.object({ 3: z.number().int().nullable(), 5: z.number().int().nullable() }),
  /** Dernières séries, de la plus récente à la plus ancienne. */
  recent: z.array(
    z.object({ minutes: z.number().int(), score: z.number().int(), at: z.number().int() }),
  ),
});
export type RushRecords = z.infer<typeof RushRecordsSchema>;
