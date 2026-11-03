import type { FastifyInstance } from 'fastify';
import {
  ExamKindSchema,
  ExamResultRequestSchema,
  type ExamStartResponse,
  type ExamsResponse,
} from '@sq/shared';
import { currentUser } from '../auth.js';
import type { GameStore } from '../persistence/db.js';
import type { ExamService } from './service.js';

/** Routes des examens de palier (étape 15, lot 5), réservées aux comptes. */
export function registerExamRoutes(app: FastifyInstance, store: GameStore, exams: ExamService) {
  app.get('/api/exams', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const response: ExamsResponse = { exams: exams.list(user.id) };
    return response;
  });

  app.post<{ Params: { stage: string } }>('/api/exams/:stage/start', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const body = (request.body ?? {}) as { kind?: unknown };
    const kind = ExamKindSchema.safeParse(body.kind);
    if (!kind.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const response: ExamStartResponse | null = exams.start(Number(request.params.stage), kind.data);
    return response ?? reply.code(404).send({ error: 'NOT_FOUND' });
  });

  app.post<{ Params: { stage: string } }>('/api/exams/:stage/result', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = ExamResultRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const response = exams.result(
      user.id,
      Number(request.params.stage),
      parsed.data.kind,
      parsed.data.correct,
    );
    return response ?? reply.code(404).send({ error: 'NOT_FOUND' });
  });
}
