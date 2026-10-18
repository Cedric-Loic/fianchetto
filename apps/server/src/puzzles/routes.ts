import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PuzzleModeSchema, PuzzleMoveRequestSchema } from '@sq/shared';
import { currentUser } from '../auth.js';
import type { GameStore } from '../persistence/db.js';
import { orEngineUnavailable } from '../engine-unavailable.js';
import type { PuzzleService } from './service.js';

const NextRequestSchema = z.object({
  mode: PuzzleModeSchema,
  theme: z
    .string()
    .regex(/^[A-Za-z0-9]+$/)
    .max(40)
    .nullable()
    .optional(),
});

/** Routes des puzzles (étape 8) : réservées aux comptes (classement puzzle personnel). */
export function registerPuzzleRoutes(
  app: FastifyInstance,
  store: GameStore,
  puzzles: PuzzleService,
) {
  app.get('/api/puzzles/stats', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    return puzzles.stats(user.id);
  });

  app.post('/api/puzzles/next', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = NextRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const result = puzzles.next(user.id, parsed.data.mode, parsed.data.theme ?? null);
    if (typeof result === 'string') return reply.code(404).send({ error: result });
    return { attempt: result };
  });

  app.post<{ Params: { id: string } }>('/api/puzzles/:id/move', async (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = PuzzleMoveRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    return orEngineUnavailable(reply, async () => {
      const result = await puzzles.move(user.id, request.params.id, parsed.data.uci);
      return result ?? reply.code(404).send({ error: 'NOT_FOUND' });
    });
  });

  app.post<{ Params: { id: string } }>('/api/puzzles/:id/hint', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    return puzzles.hint(user.id, request.params.id) ?? reply.code(404).send({ error: 'NOT_FOUND' });
  });
}
