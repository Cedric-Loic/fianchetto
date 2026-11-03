import { z } from 'zod';
import { ColorSchema, MoveIntentSchema, SquareSchema } from './chess.js';
import { GameEventSchema } from './events.js';
import { ViewerGameStateSchema } from './game-state.js';

/*
 * Protocole WebSocket d'une partie (route /ws).
 *
 * Le serveur est autoritatif : le client n'envoie que des intentions et n'affiche que les
 * snapshots reçus. Le champ `color` des messages client n'est lu qu'en hot-seat (un même
 * client joue les deux camps) ; en mode bot, le camp est déduit de la session.
 */

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('join'), gameId: z.string().min(1) }),
  /** Hot-seat : fin de l'écran de passage, démarre le chrono de choix du camp `chooser`. */
  z.object({ type: z.literal('start-selection') }),
  /** Verrouille le pion secret (case de départ du pion choisi). */
  z.object({ type: z.literal('lock-secret'), square: SquareSchema }),
  z.object({
    type: z.literal('move'),
    /** Identifiant choisi par le client pour corréler un éventuel refus. */
    clientMoveId: z.string().min(1).max(64),
    move: MoveIntentSchema,
  }),
  z.object({ type: z.literal('resign'), color: ColorSchema.optional() }),
  z.object({ type: z.literal('offer-draw'), color: ColorSchema.optional() }),
  z.object({
    type: z.literal('answer-draw'),
    accept: z.boolean(),
    color: ColorSchema.optional(),
  }),
  z.object({ type: z.literal('offer-rematch'), color: ColorSchema.optional() }),
  /** Entraînement : reprendre son dernier coup (et la réponse du bot). */
  z.object({ type: z.literal('takeback') }),
  /**
   * Hot-seat uniquement : demande la case de la dame secrète du camp AU TRAIT, pendant que
   * le bouton « Voir ma dame secrète » est maintenu. Le client l'efface au relâchement.
   */
  z.object({ type: z.literal('peek-secret') }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const PROTOCOL_ERROR_CODES = [
  'BAD_MESSAGE',
  'NOT_AUTHENTICATED',
  'GAME_NOT_FOUND',
  'FORBIDDEN',
  'INVALID_ACTION',
  /** Le bot ne répond pas (moteur indisponible) ; aucune information sur la partie. */
  'BOT_UNAVAILABLE',
] as const;
export const ProtocolErrorCodeSchema = z.enum(PROTOCOL_ERROR_CODES);
export type ProtocolErrorCode = z.infer<typeof ProtocolErrorCodeSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  /** Vue complète, projetée pour le destinataire, et l'événement public qui l'a causée. */
  z.object({
    type: z.literal('snapshot'),
    state: ViewerGameStateSchema,
    cause: GameEventSchema.nullable(),
  }),
  /**
   * Coup refusé. Volontairement SANS motif (§3.5) : le client affiche toujours
   * GENERIC_ILLEGAL_MOVE_MESSAGE, quel que soit le motif réel.
   */
  z.object({ type: z.literal('move-rejected'), clientMoveId: z.string() }),
  /** Hot-seat : réponse à `peek-secret` pour le camp au trait. `null` = dame capturée. */
  z.object({
    type: z.literal('secret-peek'),
    color: ColorSchema,
    square: SquareSchema.nullable(),
  }),
  /** Erreur de protocole (jamais d'information de jeu, jamais d'écho du message reçu). */
  z.object({ type: z.literal('error'), code: ProtocolErrorCodeSchema }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
