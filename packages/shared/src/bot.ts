import { z } from 'zod';
import { ColorSchema, MoveIntentSchema, type MoveIntent, type Square } from './chess.js';
import { ViewerGameStateSchema } from './game-state.js';

/**
 * Observation fournie au bot (§5). Elle ne contient QUE :
 * - la vue publique projetée pour le camp du bot (donc son propre secret, jamais celui
 *   de l'humain) ;
 * - les refus de ses propres coups.
 * Le bot tourne dans un worker séparé qui ne reçoit que ce message sérialisé : il n'a aucun
 * accès, ni par le type ni par l'API, à l'état réel de la partie.
 */
export const BotRejectionSchema = z.object({
  /** Nombre de demi-coups joués au moment de la tentative refusée. */
  ply: z.number().int().nonnegative(),
  move: MoveIntentSchema,
});
export type BotRejection = z.infer<typeof BotRejectionSchema>;

export const BotObservationSchema = z
  .object({
    botColor: ColorSchema,
    state: ViewerGameStateSchema,
    /** Tous les refus des coups du bot depuis le début de la partie. */
    rejections: z.array(BotRejectionSchema),
  })
  .refine((obs) => obs.state.viewer === obs.botColor, {
    message: 'La vue doit être projetée pour le camp du bot',
  });
export type BotObservation = z.infer<typeof BotObservationSchema>;

/** Interface stricte d'un bot. Implémentée par packages/bot, appelée par le serveur. */
export interface BotPlayer {
  /** Choisit le pion secret du bot, uniformément au hasard parmi `candidates`. */
  chooseSecret(candidates: readonly Square[]): Square;
  /** Choisit un coup. Un coup refusé sera signalé dans `rejections` à l'appel suivant. */
  chooseMove(observation: BotObservation): Promise<MoveIntent>;
  /** Répond à une proposition de nulle de l'adversaire. */
  shouldAcceptDraw(observation: BotObservation): Promise<boolean>;
}
