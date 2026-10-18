import type { FastifyInstance } from 'fastify';
import type { EndgameStartResponse, EndgamesResponse } from '@sq/shared';
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
}
