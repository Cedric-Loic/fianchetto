import { REDACTED } from '@sq/shared/secret';
import { ServerMessageSchema, type ServerMessage } from '@sq/shared';

/**
 * Point d'envoi unique des messages WebSocket (docs/SECURITY.md §3) :
 * 1. le schéma Zod supprime toute clé non déclarée (liste blanche) ;
 * 2. un payload contenant « [REDACTED] » signale qu'un Secret s'y est glissé : il n'est pas
 *    envoyé (erreur de programmation).
 */
export function serializeOutgoing(message: ServerMessage): string {
  const json = JSON.stringify(ServerMessageSchema.parse(message));
  if (json.includes(REDACTED)) throw new Error('Message sortant refusé : contient un Secret.');
  return json;
}
