import type { FastifyInstance } from 'fastify';
import { LessonMoveRequestSchema, LessonResultRequestSchema } from '@sq/shared';
import { currentUser } from '../auth.js';
import type { GameStore } from '../persistence/db.js';
import { orEngineUnavailable } from '../engine-unavailable.js';
import type { LessonService } from './service.js';

/** Routes des leçons (étape 10), réservées aux comptes (progression personnelle). */
export function registerLessonRoutes(
  app: FastifyInstance,
  store: GameStore,
  lessons: LessonService,
) {
  app.get('/api/lessons', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    return { lessons: lessons.list(user.id) };
  });

  app.get<{ Params: { id: string } }>('/api/lessons/:id', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    return lessons.view(user.id, request.params.id) ?? reply.code(404).send({ error: 'NOT_FOUND' });
  });

  app.post<{ Params: { id: string; index: string } }>(
    '/api/lessons/:id/exercises/:index/move',
    async (request, reply) => {
      const user = currentUser(store, request);
      if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
      const parsed = LessonMoveRequestSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
      return orEngineUnavailable(reply, async () => {
        const result = await lessons.move(
          request.params.id,
          Number(request.params.index),
          parsed.data.step,
          parsed.data.uci,
        );
        return result ?? reply.code(404).send({ error: 'NOT_FOUND' });
      });
    },
  );

  app.post<{ Params: { id: string } }>('/api/lessons/:id/result', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = LessonResultRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    return (
      lessons.result(user.id, request.params.id, parsed.data.correct) ??
      reply.code(404).send({ error: 'NOT_FOUND' })
    );
  });
}
