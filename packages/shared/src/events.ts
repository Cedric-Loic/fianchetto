import { z } from 'zod';
import { ColorSchema } from './chess.js';
import { GameResultSchema, PublicMoveSchema } from './game-state.js';

/**
 * Événements PUBLICS d'une partie : ce que les deux camps (et le bot) peuvent observer.
 * Servent de journal et de `cause` dans les snapshots (animations, sons).
 * Les refus de coups n'en font pas partie : un refus n'est communiqué qu'à son auteur.
 */
export const GameEventSchema = z.discriminatedUnion('kind', [
  /** Un camp a verrouillé son pion secret : l'adversaire ne voit que « prêt ». */
  z.object({ kind: z.literal('secret-locked'), color: ColorSchema }),
  z.object({ kind: z.literal('game-started') }),
  z.object({ kind: z.literal('move'), move: PublicMoveSchema }),
  z.object({ kind: z.literal('draw-offered'), by: ColorSchema }),
  z.object({ kind: z.literal('draw-declined'), by: ColorSchema }),
  z.object({ kind: z.literal('rematch-offered'), by: ColorSchema }),
  z.object({ kind: z.literal('game-ended'), result: GameResultSchema }),
]);
export type GameEvent = z.infer<typeof GameEventSchema>;
