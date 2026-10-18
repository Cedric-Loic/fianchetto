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
});
export type EndgameSummary = z.infer<typeof EndgameSummarySchema>;

export const EndgamesResponseSchema = z.object({ endgames: z.array(EndgameSummarySchema) });
export type EndgamesResponse = z.infer<typeof EndgamesResponseSchema>;

export const EndgameStartResponseSchema = z.object({ gameId: z.string() });
export type EndgameStartResponse = z.infer<typeof EndgameStartResponseSchema>;
