import { z } from 'zod';
import { LessonExerciseSchema } from './lesson.js';
import { SkillIdSchema } from './skills.js';

/*
 * Examens de palier (étape 15) : 20 questions tirées des exercices des leçons du palier (mêlant
 * finales, calcul, tactique, stratégie), puis un mini-test de 5 questions après le premier
 * chapitre de finales. Réussite à 80 % : le passage au palier suivant est conseillé, jamais
 * bloquant. Chaque question est jugée par les routes des leçons (le serveur reste juge).
 */

export const EXAM_STAGES = [1, 2, 3] as const;
export const ExamStageSchema = z.number().int().min(1).max(3);
export const EXAM_SIZE = 20;
export const EXAM_MINI_SIZE = 5;
export const EXAM_PASS_RATIO = 0.8;

export const ExamKindSchema = z.enum(['stage', 'mini']);
export type ExamKind = z.infer<typeof ExamKindSchema>;

export const ExamSummarySchema = z.object({
  stage: ExamStageSchema,
  /** Meilleur score (réponses justes du premier coup), `null` si jamais passé. */
  best: z.number().int().nullable(),
  /** Taille de l'examen (20). */
  total: z.number().int(),
  passed: z.boolean(),
  /** Le palier contient assez d'exercices pour composer l'examen. */
  available: z.boolean(),
  /** Mini-test de 5 questions réussi (palier 1 seulement). */
  miniPassed: z.boolean(),
});
export type ExamSummary = z.infer<typeof ExamSummarySchema>;

export const ExamsResponseSchema = z.object({ exams: z.array(ExamSummarySchema) });
export type ExamsResponse = z.infer<typeof ExamsResponseSchema>;

export const ExamQuestionSchema = z.object({
  /** Leçon et indice de l'exercice : sert à juger la réponse par les routes des leçons. */
  lesson: z.string(),
  index: z.number().int(),
  skill: SkillIdSchema,
  exercise: LessonExerciseSchema,
});
export type ExamQuestion = z.infer<typeof ExamQuestionSchema>;

export const ExamStartResponseSchema = z.object({
  stage: ExamStageSchema,
  kind: ExamKindSchema,
  questions: z.array(ExamQuestionSchema),
});
export type ExamStartResponse = z.infer<typeof ExamStartResponseSchema>;

/** Fin d'examen : nombre de réponses justes du premier coup (le serveur borne et compare à 80 %). */
export const ExamResultRequestSchema = z.object({
  kind: ExamKindSchema,
  correct: z.number().int().min(0).max(EXAM_SIZE),
});
export const ExamResultResponseSchema = z.object({
  exam: ExamSummarySchema,
  passedNow: z.boolean(),
});
export type ExamResultResponse = z.infer<typeof ExamResultResponseSchema>;
