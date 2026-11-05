import type { FastifyInstance } from 'fastify';
import { ThreatAnswerRequestSchema } from '@sq/shared';
import { currentUser } from '../auth.js';
import type { GameStore } from '../persistence/db.js';
import type { ThreatService } from './threat.js';

/** Routes de « Trouve la menace » (étape 17), réservées aux comptes. */
export function registerThreatRoutes(
  app: FastifyInstance,
  store: GameStore,
  threats: ThreatService,
) {
  app.get('/api/threats/next', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    return threats.next(user.id);
  });

  app.post<{ Params: { id: string } }>('/api/threats/:id/answer', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = ThreatAnswerRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const result = threats.answer(user.id, request.params.id, parsed.data.uci);
    if (result === 'NOT_FOUND') return reply.code(404).send({ error: result });
    if (result === 'ILLEGAL') return reply.code(422).send({ error: result });
    return result;
  });
}
