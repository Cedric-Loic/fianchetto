import { z } from 'zod';

/*
 * Tableau de bord du coach (étape 11) : plan de la semaine, phase du programme, profil de
 * faiblesses, courbes de progression, bilan mensuel, recommandations. Calculé par le serveur à
 * partir des parties analysées, des puzzles et des leçons de l'utilisateur.
 */

export const WeeklyTaskSchema = z.object({
  id: z.enum(['puzzles', 'slow-games', 'reviews', 'lesson']),
  label: z.string(),
  done: z.number().int(),
  target: z.number().int(),
  href: z.string(),
});
export type WeeklyTask = z.infer<typeof WeeklyTaskSchema>;

export const PhaseCriterionSchema = z.object({
  label: z.string(),
  /** Valeur actuelle lisible (« 1,4 », « 6 / 10 »), `null` si pas encore mesurable. */
  value: z.string().nullable(),
  target: z.string(),
  met: z.boolean(),
});

export const PointSchema = z.object({ date: z.string(), value: z.number() });
export type Point = z.infer<typeof PointSchema>;

export const SeriesSchema = z.object({
  id: z.string(),
  label: z.string(),
  points: z.array(PointSchema),
});
export type Series = z.infer<typeof SeriesSchema>;

export const MonthStatsSchema = z.object({
  /** « 2026-10 ». */
  month: z.string(),
  games: z.number().int(),
  accuracy: z.number().nullable(),
  blunders: z.number().nullable(),
  puzzleRating: z.number().int().nullable(),
  puzzles: z.number().int(),
  lessons: z.number().int(),
  chessComRapid: z.number().int().nullable(),
  chessComBlitz: z.number().int().nullable(),
});
export type MonthStats = z.infer<typeof MonthStatsSchema>;

export const TargetSchema = z.object({
  label: z.string(),
  start: z.string().nullable(),
  current: z.string().nullable(),
  target: z.string(),
  met: z.boolean(),
});
export type Target = z.infer<typeof TargetSchema>;

export const RecommendationSchema = z.object({ text: z.string(), href: z.string() });
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const CoachDashboardSchema = z.object({
  phase: z.object({
    current: z.number().int().min(1).max(4),
    title: z.string(),
    focus: z.string(),
    /** Critères pour passer à la phase suivante (vide en phase 4). */
    criteria: z.array(PhaseCriterionSchema),
  }),
  week: z.object({ start: z.string(), tasks: z.array(WeeklyTaskSchema) }),
  weaknesses: z.object({
    /** Nombre de parties analysées prises en compte (20 dernières au plus). */
    games: z.number().int(),
    perGame: z
      .object({
        blunder: z.number(),
        mistake: z.number(),
        inaccuracy: z.number(),
      })
      .nullable(),
    accuracy: z.number().nullable(),
    /** Types d'erreurs (explications de la revue), du plus fréquent au moins fréquent. */
    kinds: z.array(z.object({ kind: z.string(), count: z.number().int() })),
    /** Erreurs et gaffes par phase de jeu. */
    phases: z.object({
      opening: z.number().int(),
      middlegame: z.number().int(),
      endgame: z.number().int(),
    }),
    /** Thèmes de puzzles les moins réussis (au moins 5 essais). */
    weakThemes: z.array(
      z.object({ theme: z.string(), rate: z.number(), attempts: z.number().int() }),
    ),
  }),
  curves: z.array(SeriesSchema),
  months: z.array(MonthStatsSchema),
  targets: z.array(TargetSchema),
  recommendations: z.array(RecommendationSchema),
});
export type CoachDashboard = z.infer<typeof CoachDashboardSchema>;
