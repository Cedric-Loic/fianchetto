import { z } from 'zod';

/*
 * Étape 14 — Coach pédagogique : compétences, cartes de révision, séance du jour.
 * Les compétences fusionnent les quatre vocabulaires du coach (types d'erreur, thèmes de puzzles,
 * leçons, finales) pour mesurer un niveau par compétence et justifier le plan.
 */

export const SKILL_IDS = [
  'method',
  'piece-safety',
  'threats',
  'forks',
  'pins-skewers',
  'discovered',
  'mates',
  'calculation',
  'opening-principles',
  'repertoire',
  'pawn-endgames',
  'rook-endgames',
  'plans',
  'time',
] as const;
export const SkillIdSchema = z.enum(SKILL_IDS);
export type SkillId = z.infer<typeof SkillIdSchema>;

export const SKILL_LABELS: Record<SkillId, string> = {
  method: 'Méthode de réflexion',
  'piece-safety': 'Sécurité des pièces',
  threats: 'Menaces adverses',
  forks: 'Fourchettes',
  'pins-skewers': 'Clouages et enfilades',
  discovered: 'Attaques découvertes',
  mates: 'Mats types',
  calculation: 'Calcul',
  'opening-principles': "Principes d'ouverture",
  repertoire: 'Répertoire',
  'pawn-endgames': 'Finales de pions',
  'rook-endgames': 'Finales de tours',
  plans: 'Plans et activité',
  time: 'Gestion du temps',
};

/** Thème de puzzle Lichess → compétence (les thèmes inconnus comptent pour le calcul). */
export const SKILL_FOR_THEME: Record<string, SkillId> = {
  hangingPiece: 'piece-safety',
  fork: 'forks',
  pin: 'pins-skewers',
  skewer: 'pins-skewers',
  discoveredAttack: 'discovered',
  mateIn1: 'mates',
  mateIn2: 'mates',
  mateIn3: 'mates',
  backRankMate: 'mates',
  smotheredMate: 'mates',
  attraction: 'calculation',
  deflection: 'calculation',
  sacrifice: 'calculation',
  advantage: 'calculation',
  endgame: 'pawn-endgames',
  pawnEndgame: 'pawn-endgames',
  rookEndgame: 'rook-endgames',
  opening: 'opening-principles',
};

/** Type d'erreur détecté en revue → compétence à travailler. */
export const SKILL_FOR_KIND: Record<string, SkillId> = {
  'hanging-piece': 'piece-safety',
  'missed-material': 'piece-safety',
  'allowed-fork': 'threats',
  'missed-fork': 'forks',
  'allowed-mate': 'threats',
  'missed-mate': 'mates',
  'allowed-pin': 'threats',
  'missed-pin': 'pins-skewers',
  'allowed-skewer': 'threats',
  'missed-skewer': 'pins-skewers',
  'endgame-conversion': 'pawn-endgames',
  'material-loss': 'calculation',
  generic: 'method',
};

export const SkillLevelSchema = z.object({
  id: SkillIdSchema,
  label: z.string(),
  /** Niveau sur 100 ; `null` tant qu'il n'y a aucune preuve. */
  level: z.number().int().min(0).max(100).nullable(),
  /** Différence avec le niveau d'il y a deux semaines (`null` si inconnue). */
  trend: z.number().int().nullable(),
  /** Nombre de preuves (tentatives, erreurs) prises en compte. */
  evidence: z.number().int().nonnegative(),
});
export type SkillLevel = z.infer<typeof SkillLevelSchema>;

// --- Cartes de révision ------------------------------------------------------------------------

export const CARD_SOURCES = ['mistake', 'exercise', 'endgame', 'opening'] as const;
export const CardSourceSchema = z.enum(CARD_SOURCES);
export type CardSource = z.infer<typeof CardSourceSchema>;

/** Intervalles de répétition espacée (jours) ; maîtrisée après 3 réussites espacées. */
export const CARD_INTERVALS_DAYS = [1, 3, 7, 21, 60] as const;
export const CARD_MASTERED_STEP = 3;

export const ReviewCardSchema = z.object({
  id: z.string(),
  source: CardSourceSchema,
  /** Référence du contenu : `leçon:index` (exercice) ou id du puzzle personnel (erreur). */
  ref: z.string(),
  skill: SkillIdSchema,
  /** Position de départ de l'exercice à rejouer. */
  fen: z.string(),
  prompt: z.string(),
  step: z.number().int().nonnegative(),
  dueAt: z.number().int(),
  mastered: z.boolean(),
});
export type ReviewCard = z.infer<typeof ReviewCardSchema>;

// --- Séance du jour ----------------------------------------------------------------------------

export const SESSION_STEP_KINDS = ['reviews', 'curriculum', 'puzzles', 'summary'] as const;
export const SessionStepKindSchema = z.enum(SESSION_STEP_KINDS);

export const SessionStepSchema = z.object({
  kind: SessionStepKindSchema,
  label: z.string(),
  minutes: z.number().int().nonnegative(),
  href: z.string(),
  done: z.boolean(),
});
export type SessionStep = z.infer<typeof SessionStepSchema>;

export const DailySessionSchema = z.object({
  /** « 2026-10-26 ». */
  day: z.string(),
  minutes: z.number().int(),
  steps: z.array(SessionStepSchema),
  /** Compétence travaillée en priorité aujourd'hui. */
  focus: SkillIdSchema.nullable(),
  /** Application proposée à la suite (finale, partie coachée). */
  followUp: z.object({ label: z.string(), href: z.string() }).nullable(),
});
export type DailySession = z.infer<typeof DailySessionSchema>;

/** Durée visée de la séance quotidienne (minutes). */
export const SESSION_MINUTES = 28;

// --- Réponses de l'API coach (étape 14) -----------------------------------------------------------

export const SkillsResponseSchema = z.object({ skills: z.array(SkillLevelSchema) });
export type SkillsResponse = z.infer<typeof SkillsResponseSchema>;

export const CurriculumStepSchema = z.object({
  type: z.enum(['lesson', 'endgame', 'opening']),
  id: z.string(),
  title: z.string(),
  href: z.string(),
  done: z.boolean(),
});
export type CurriculumStep = z.infer<typeof CurriculumStepSchema>;

export const CurriculumModuleSchema = z.object({
  id: z.string(),
  phase: z.number().int(),
  title: z.string(),
  skill: SkillIdSchema,
  steps: z.array(CurriculumStepSchema),
});
export type CurriculumModuleView = z.infer<typeof CurriculumModuleSchema>;

export const CurriculumResponseSchema = z.object({
  phase: z.number().int(),
  modules: z.array(CurriculumModuleSchema),
  /** Étape conseillée (ordre non bloquant), `null` si le parcours de la phase est terminé. */
  next: z.object({ moduleId: z.string(), step: CurriculumStepSchema }).nullable(),
});
export type CurriculumResponse = z.infer<typeof CurriculumResponseSchema>;

export const CardsResponseSchema = z.object({
  /** Cartes à revoir maintenant, les plus en retard d'abord. */
  due: z.array(ReviewCardSchema),
  total: z.number().int(),
  mastered: z.number().int(),
});
export type CardsResponse = z.infer<typeof CardsResponseSchema>;

export const DailySessionResponseSchema = z.object({ session: DailySessionSchema });
export type DailySessionResponse = z.infer<typeof DailySessionResponseSchema>;

/** Étape de la séance marquée comme faite (le serveur déduit aussi les étapes de l'activité). */
export const SessionProgressRequestSchema = z.object({ kind: SessionStepKindSchema });
