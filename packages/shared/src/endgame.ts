import { z } from 'zod';
import { ColorSchema } from './chess.js';

/*
 * Finales contre le bot (lot 4b) : positions de référence jouées contre Stockfish à pleine force,
 * en partie d'entraînement depuis `fen`. Réussie quand le résultat attendu est atteint.
 */

export const EndgameSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  objective: z.string(),
  /** Position de départ ; le joueur (camp `color`) a le trait. */
  fen: z.string(),
  color: ColorSchema,
  /** `win` : gagner ; `draw` : tenir au moins la nulle (hors nulle par accord). */
  goal: z.enum(['win', 'draw']),
  /** Leçon liée (`#/lessons/<id>`), sinon `null`. */
  lesson: z.string().nullable(),
  /** Parties terminées depuis cette position. */
  attempts: z.number().int(),
  passed: z.boolean(),
  /** Palier du cours (1 : 1000-1200, 2 : 1200-1400, 3 : 1400-1600). */
  stage: z.number().int().min(1).max(3),
  /** Coups maximum du joueur pour réussir, `null` : pas de limite. */
  maxMoves: z.number().int().nullable(),
  /** Nombre d'indices propres à la finale (0 à 3), servis à la demande. */
  hints: z.number().int().min(0).max(3),
  /** Compétence travaillée. */
  skill: z.enum(['pawn-endgames', 'rook-endgames']),
  /** À rejouer : une carte de révision de cette finale est due (échec passé). */
  due: z.boolean(),
});
export type EndgameSummary = z.infer<typeof EndgameSummarySchema>;

export const EndgamesResponseSchema = z.object({ endgames: z.array(EndgameSummarySchema) });
export type EndgamesResponse = z.infer<typeof EndgamesResponseSchema>;

export const EndgameStartResponseSchema = z.object({ gameId: z.string() });
export type EndgameStartResponse = z.infer<typeof EndgameStartResponseSchema>;

/** Indice progressif d'une finale (1 = discret, 3 = presque la réponse), servi à la demande. */
export const EndgameHintRequestSchema = z.object({ level: z.number().int().min(1).max(3) });
export const EndgameHintResponseSchema = z.object({ hint: z.string() });
export type EndgameHintResponse = z.infer<typeof EndgameHintResponseSchema>;
