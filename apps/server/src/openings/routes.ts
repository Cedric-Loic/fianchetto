import type { FastifyInstance } from 'fastify';
import {
  ColorSchema,
  OpeningDeviationRequestSchema,
  OpeningResultRequestSchema,
  type OpeningDeviationResponse,
} from '@sq/shared';
import { currentUser } from '../auth.js';
import type { GameStore } from '../persistence/db.js';
import type { OpeningService } from './service.js';

/** Routes du répertoire d'ouvertures (lot 4d), réservées aux comptes. */
export function registerOpeningRoutes(
  app: FastifyInstance,
  store: GameStore,
  openings: OpeningService,
): void {
  app.get('/api/openings', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    return openings.list(user.id);
  });

  // Ligne à réviser, éventuellement d'un seul camp (`?color=w`).
  app.get<{ Querystring: { color?: string } }>('/api/openings/next', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const color = ColorSchema.safeParse(request.query.color);
    return openings.next(user.id, color.success ? color.data : null);
  });

  app.get<{ Params: { id: string } }>('/api/openings/:id', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    return (
      openings.drill(user.id, request.params.id) ?? reply.code(404).send({ error: 'NOT_FOUND' })
    );
  });

  app.post<{ Params: { id: string } }>('/api/openings/:id/result', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = OpeningResultRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    return (
      openings.result(user.id, request.params.id, parsed.data.success) ??
      reply.code(404).send({ error: 'NOT_FOUND' })
    );
  });

  // Écart d'une partie (revue) avec le répertoire : calcul pur sur des coups fournis par le client.
  app.post('/api/openings/deviation', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = OpeningDeviationRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const response: OpeningDeviationResponse = {
      deviation: openings.deviation(parsed.data.moves, parsed.data.color),
    };
    return response;
  });
}
