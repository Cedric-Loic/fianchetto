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

/* Étape 13 — Régularité : seuils partagés par le serveur, le coach et l'interface. */

/** Puzzles à faire dans la journée pour la valider (série de jours, verrou du blitz). */
export const DAILY_PUZZLE_GOAL = 10;
/** Ou bien : minutes d'entraînement dans la journée pour la valider. */
export const DAILY_MINUTES_GOAL = 15;
/** Objectif hebdomadaire d'entraînement (semaine type du plan : 3 h). */
export const WEEKLY_MINUTES_TARGET = 180;

export const MonthVerdictSchema = z.enum(['ahead', 'on-track', 'behind']);
export type MonthVerdict = z.infer<typeof MonthVerdictSchema>;

/** Garde-fou « Es-tu sûr ? » : toujours (phase 1), une partie sur deux (phase 2), sinon coupé. */
export const GuardPolicySchema = z.enum(['always', 'alternate', 'off']);
export type GuardPolicy = z.infer<typeof GuardPolicySchema>;

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
  /** Minutes d'entraînement estimées sur le mois (voir `buildDashboard`). */
  minutes: z.number().int(),
  /** Elo chess.com visé ce mois-ci (cadence suivie : Rapide sinon Blitz), `null` avant la 1re mesure. */
  targetElo: z.number().int().nullable(),
  /** Elo du mois comparé à l'objectif interpolé ; `null` si pas d'Elo ce mois-ci. */
  verdict: MonthVerdictSchema.nullable(),
  /** Ajustement conseillé du plan pour ce mois (une phrase), `null` si rien à signaler. */
  advice: z.string().nullable(),
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
    /**
     * Erreurs et gaffes selon la pendule (lot 4d) : jouées en zeitnot (moins de 10 % du temps
     * initial) ou avec du temps. `null` si aucune partie récente n'a de pendule (`[%clk]`).
     */
    clock: z
      .object({
        /** Parties avec pendule prises en compte. */
        games: z.number().int(),
        lowTime: z.number().int(),
        withTime: z.number().int(),
      })
      .nullable(),
    /** Thèmes de puzzles les moins réussis (au moins 5 essais). */
    weakThemes: z.array(
      z.object({ theme: z.string(), rate: z.number(), attempts: z.number().int() }),
    ),
  }),
  curves: z.array(SeriesSchema),
  months: z.array(MonthStatsSchema),
  targets: z.array(TargetSchema),
  recommendations: z.array(RecommendationSchema),
  /** Thème de puzzles du jour (phase courante, pondéré vers les thèmes faibles). */
  themeOfDay: z.string(),
  /** Série de jours validés (`DAILY_PUZZLE_GOAL` puzzles ou `DAILY_MINUTES_GOAL` min). */
  streak: z.object({
    current: z.number().int(),
    best: z.number().int(),
    todayDone: z.boolean(),
    todayPuzzles: z.number().int(),
    todayMinutes: z.number().int(),
  }),
  /** Minutes d'entraînement estimées depuis lundi, et objectif (`WEEKLY_MINUTES_TARGET`). */
  minutes: z.object({ week: z.number().int(), target: z.number().int() }),
  /** « Pas de blitz avant les puzzles du jour » : vrai tant que la journée n'est pas validée. */
  blitzLocked: z.boolean(),
  blitzLockReason: z.string().nullable(),
  guard: GuardPolicySchema,
  /** Niveau du bot classique conseillé (score glissant visé : 40 à 60 %), `null` sans partie. */
  suggestedBotLevel: z.number().int().min(1).max(5).nullable(),
});
export type CoachDashboard = z.infer<typeof CoachDashboardSchema>;
