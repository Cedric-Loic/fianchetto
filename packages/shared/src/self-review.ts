import { z } from 'zod';

/*
 * Revue réflexive en deux temps (étape 15) : avant de voir le moteur, le joueur marque 1 à 3
 * moments où il a hésité et nomme son défaut de réflexion. Le serveur garde ces causes dans un
 * « profil de pensée ». Aucune donnée secrète : la revue n'existe qu'une fois la partie finie.
 */

export const THINKING_FLAWS = [
  'no-threat-check',
  'hope-chess',
  'stopped-early',
  'vague-plan',
  'time-pressure',
  'missed-tactic',
] as const;
export const ThinkingFlawSchema = z.enum(THINKING_FLAWS);
export type ThinkingFlaw = z.infer<typeof ThinkingFlawSchema>;

export const THINKING_FLAW_LABELS: Record<ThinkingFlaw, string> = {
  'no-threat-check': 'Je n’ai pas regardé sa menace',
  'hope-chess': 'J’ai espéré qu’il ne verrait pas',
  'stopped-early': 'Je me suis arrêté trop tôt',
  'vague-plan': 'Plan flou',
  'time-pressure': 'Manque de temps',
  'missed-tactic': 'Je n’ai pas vu la tactique',
};

/** Conseil court par défaut de réflexion (affiché dans le profil de pensée). */
export const THINKING_FLAW_ADVICE: Record<ThinkingFlaw, string> = {
  'no-threat-check': 'Avant chaque coup : « Que menace son dernier coup ? »',
  'hope-chess': 'Joue le meilleur coup de l’adversaire dans ta tête, pas celui qui t’arrange.',
  'stopped-early': 'Continue jusqu’à une position calme : plus d’échecs ni de prises en cours.',
  'vague-plan': 'Nomme ton plan en une phrase avant de jouer : quelle pièce, vers quelle case ?',
  'time-pressure':
    'Fixe un budget de temps par coup et garde de la réserve pour les moments critiques.',
  'missed-tactic': 'Cherche systématiquement échecs, prises et menaces, pour toi comme pour lui.',
};

export const SelfReviewMomentSchema = z.object({
  /** Demi-coup (1 = premier coup des Blancs) où le joueur a hésité. */
  ply: z.number().int().min(1).max(600),
  flaw: ThinkingFlawSchema,
});
export type SelfReviewMoment = z.infer<typeof SelfReviewMomentSchema>;

export const SelfReviewRequestSchema = z.object({
  moments: z.array(SelfReviewMomentSchema).min(1).max(3),
});
export type SelfReviewRequest = z.infer<typeof SelfReviewRequestSchema>;

export const SelfReviewSchema = z.object({
  gameId: z.string(),
  moments: z.array(SelfReviewMomentSchema),
  createdAt: z.number().int(),
});
export type SelfReview = z.infer<typeof SelfReviewSchema>;

/** `GET /api/reviews/:gameId/self` : `null` si le joueur n'a pas encore fait la revue réflexive. */
export const SelfReviewResponseSchema = z.object({ selfReview: SelfReviewSchema.nullable() });
export type SelfReviewResponse = z.infer<typeof SelfReviewResponseSchema>;

/** `GET /api/coach/thinking` : défauts de réflexion cumulés sur les parties revues. */
export const ThinkingProfileSchema = z.object({
  reviews: z.number().int(),
  counts: z.record(ThinkingFlawSchema, z.number().int()),
  /** Défaut le plus fréquent (`null` sans revue). */
  top: ThinkingFlawSchema.nullable(),
});
export type ThinkingProfile = z.infer<typeof ThinkingProfileSchema>;
