import { z } from 'zod';
import { ColorSchema } from './chess.js';
import { PuzzleStepSchema } from './puzzle.js';

/*
 * Entraîneur de calcul (étape 15) : une position s'affiche, plateau figé ; le joueur saisit sa
 * ligne (ses coups et les répliques adverses) sans que les pièces bougent, puis répond à une
 * question sur la position finale. Positions tirées des puzzles locaux. Le serveur juge ; la
 * solution n'est envoyée qu'après la réponse.
 */

/** Nombre de coups du joueur dans la ligne (1 à 3) ; la ligne compte `2 * depth - 1` demi-coups. */
export const CalcDepthSchema = z.number().int().min(1).max(3);

export const CalcTechniqueSchema = z.enum(['forced', 'candidates', 'long']);
export type CalcTechnique = z.infer<typeof CalcTechniqueSchema>;

export const CalcProblemSchema = z.object({
  id: z.string(),
  fen: z.string(),
  /** Camp du joueur (plateau orienté de son côté). */
  color: ColorSchema,
  depth: CalcDepthSchema,
  /** Demi-coups à saisir : `2 * depth - 1`. */
  plies: z.number().int(),
  technique: CalcTechniqueSchema,
  prompt: z.string(),
  /** Question posée après la ligne (réponse par indice dans `options`). */
  question: z.object({ text: z.string(), options: z.array(z.string()).min(2).max(8) }),
});
export type CalcProblem = z.infer<typeof CalcProblemSchema>;

/** `GET /api/calc/next?depth=n` : `problem` vaut `null` si la base de puzzles est absente. */
export const CalcNextResponseSchema = z.object({ problem: CalcProblemSchema.nullable() });
export type CalcNextResponse = z.infer<typeof CalcNextResponseSchema>;

/** Un coup saisi après `line` (coups UCI déjà saisis) : le serveur vérifie la légalité. */
export const CalcStepRequestSchema = z.object({
  line: z.array(z.string()).max(5),
  uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
});
export const CalcStepResponseSchema = z.object({
  legal: z.boolean(),
  /** Notation du coup (« Cxd5+ »), vide si illégal. */
  san: z.string(),
});
export type CalcStepResponse = z.infer<typeof CalcStepResponseSchema>;

export const CalcAnswerRequestSchema = z.object({
  line: z.array(z.string()).max(5),
  /** Indice de la réponse choisie dans `question.options`. */
  answer: z.number().int().min(0).max(7),
  /** Indices consultés (0 pour l'instant : réservé). */
  hints: z.number().int().min(0).max(3).optional(),
});
export const CalcAnswerResponseSchema = z.object({
  lineCorrect: z.boolean(),
  answerCorrect: z.boolean(),
  /** Bonne ligne, révélée après la réponse. */
  solution: z.array(PuzzleStepSchema),
  correctAnswer: z.number().int(),
  explanation: z.string(),
});
export type CalcAnswerResponse = z.infer<typeof CalcAnswerResponseSchema>;
