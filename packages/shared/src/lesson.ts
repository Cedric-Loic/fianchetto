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
]);
export type LessonSection = z.infer<typeof LessonSectionSchema>;

export const LessonExerciseSchema = z.object({
  fen: z.string(),
  prompt: z.string(),
  /** Camp qui joue (plateau orienté de son côté). */
  color: ColorSchema,
  legalMoves: z.array(LegalMoveSchema),
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
