import { z } from 'zod';
import { ColorSchema, SquareSchema } from './chess.js';
import { LegalMoveSchema } from './game-state.js';
import { PuzzleStepSchema } from './puzzle.js';

/*
 * Leçons (coach, étape 10) : explications, positions illustrées, puis exercices « trouve le coup »
 * validés par le serveur. La solution n'est envoyée qu'après l'exercice.
 */

export const LessonSummarySchema = z.object({
  id: z.string(),
  phase: z.number().int(),
  title: z.string(),
  summary: z.string(),
  minutes: z.number().int(),
  exercises: z.number().int(),
  /** Meilleur score (exercices réussis du premier coup), `null` si jamais terminée. */
  best: z.number().int().nullable(),
  passed: z.boolean(),
});
export type LessonSummary = z.infer<typeof LessonSummarySchema>;

export const LessonsResponseSchema = z.object({ lessons: z.array(LessonSummarySchema) });
export type LessonsResponse = z.infer<typeof LessonsResponseSchema>;

export const LessonSectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), title: z.string().nullable(), body: z.string() }),
  z.object({
    kind: z.literal('example'),
    fen: z.string(),
    caption: z.string(),
    arrows: z.array(z.object({ from: SquareSchema, to: SquareSchema })),
    marks: z.array(SquareSchema),
  }),
  /** Partie commentée pas à pas (étape 14) : chaque pas porte la position APRÈS le coup. */
  z.object({
    kind: z.literal('walkthrough'),
    title: z.string().nullable(),
    /** Position de départ. */
    fen: z.string(),
    steps: z.array(
      z.object({
        from: SquareSchema,
        to: SquareSchema,
        san: z.string(),
        fen: z.string(),
        comment: z.string(),
      }),
    ),
  }),
]);
export type LessonSection = z.infer<typeof LessonSectionSchema>;

export const LessonExerciseSchema = z.object({
  fen: z.string(),
  prompt: z.string(),
  /** Camp qui joue (plateau orienté de son côté). */
  color: ColorSchema,
  legalMoves: z.array(LegalMoveSchema),
  /** `move` : trouve le coup ; `squares` : désigne la ou les cases (pièce en prise, cible…). */
  kind: z.enum(['move', 'squares']).default('move'),
  /** Nombre d'indices progressifs disponibles (0 à 3). */
  hints: z.number().int().min(0).max(3).default(0),
});
export type LessonExercise = z.infer<typeof LessonExerciseSchema>;

export const LessonViewSchema = z.object({
  id: z.string(),
  phase: z.number().int(),
  title: z.string(),
  summary: z.string(),
  minutes: z.number().int(),
  sections: z.array(LessonSectionSchema),
  exercises: z.array(LessonExerciseSchema),
  /** Part d'exercices réussis du premier coup pour valider la leçon. */
  passRatio: z.number(),
  best: z.number().int().nullable(),
  passed: z.boolean(),
});
export type LessonView = z.infer<typeof LessonViewSchema>;

export const LessonMoveRequestSchema = z.object({
  /** Indice du coup attendu dans la suite de l'exercice (0, puis 2, 4… après chaque réponse). */
  step: z.number().int().min(0).max(40),
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  /** Indices consultés avant ce coup : un exercice réussi avec indice ne compte pas « du premier coup ». */
  hints: z.number().int().min(0).max(3).optional(),
});

export const LessonMoveResponseSchema = z.object({
  status: z.enum(['continue', 'solved', 'failed', 'illegal']),
  steps: z.array(PuzzleStepSchema),
  legalMoves: z.array(LegalMoveSchema),
  solution: z.array(PuzzleStepSchema).nullable(),
  /** Explication, à la fin de l'exercice. */
  explanation: z.string().nullable(),
});
export type LessonMoveResponse = z.infer<typeof LessonMoveResponseSchema>;

export const LessonResultRequestSchema = z.object({ correct: z.number().int().min(0).max(100) });

/** Exercice `squares` : cases désignées par le joueur (ensemble, sans ordre). */
export const LessonSquaresRequestSchema = z.object({
  squares: z.array(SquareSchema).min(1).max(8),
  hints: z.number().int().min(0).max(3).optional(),
});

export const LessonSquaresResponseSchema = z.object({
  status: z.enum(['solved', 'failed']),
  /** Bonnes cases, révélées seulement après un échec. */
  correct: z.array(SquareSchema).nullable(),
  explanation: z.string().nullable(),
});
export type LessonSquaresResponse = z.infer<typeof LessonSquaresResponseSchema>;

/** Indice progressif (1 = discret, 3 = presque la réponse) ; le texte n'est envoyé qu'à la demande. */
export const LessonHintRequestSchema = z.object({ level: z.number().int().min(1).max(3) });
export const LessonHintResponseSchema = z.object({ hint: z.string() });
export type LessonHintResponse = z.infer<typeof LessonHintResponseSchema>;
