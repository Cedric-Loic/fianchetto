import type { FastifyInstance } from 'fastify';
import {
  EndgameHintRequestSchema,
  type EndgameHintResponse,
  type EndgameStartResponse,
  type EndgamesResponse,
} from '@sq/shared';
import { currentUser } from '../auth.js';
import type { GameStore } from '../persistence/db.js';
import type { EndgameService } from './service.js';

/** Routes des finales contre le bot (lot 4b), réservées aux comptes. */
export function registerEndgameRoutes(
  app: FastifyInstance,
  store: GameStore,
  endgames: EndgameService,
): void {
  app.get('/api/endgames', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const response: EndgamesResponse = { endgames: endgames.list(user.id) };
    return response;
  });

  app.post<{ Params: { id: string } }>('/api/endgames/:id/start', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const gameId = endgames.start(user.id, request.params.id);
    if (!gameId) return reply.code(404).send({ error: 'NOT_FOUND' });
    const response: EndgameStartResponse = { gameId };
    return response;
  });

  // Indice d'une finale : un seul texte, au niveau demandé (jamais la liste complète).
  app.post<{ Params: { id: string } }>('/api/endgames/:id/hint', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = EndgameHintRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const hint = endgames.hint(user.id, request.params.id, parsed.data.level);
    if (hint === null) return reply.code(404).send({ error: 'NOT_FOUND' });
    const response: EndgameHintResponse = { hint };
    return response;
  });
}
