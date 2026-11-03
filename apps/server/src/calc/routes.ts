import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  CalcAnswerRequestSchema,
  CalcDepthSchema,
  CalcStepRequestSchema,
  type CalcAnswerResponse,
  type CalcNextResponse,
  type CalcStepResponse,
} from '@sq/shared';
import { currentUser } from '../auth.js';
import type { GameStore } from '../persistence/db.js';
import type { CalcDepth } from './problem.js';
import type { CalcService } from './service.js';

/**
 * Une ligne de profondeur 3 compte 5 demi-coups : le contrat limite `line` à 4, trop court pour
 * `/answer` (la limite est relevée ici en attendant une correction du contrat).
 */
const AnswerRequestSchema = CalcAnswerRequestSchema.extend({
  line: z.array(z.string()).max(5),
});

/** Routes de l'entraîneur de calcul (étape 15), réservées aux comptes. */
export function registerCalcRoutes(app: FastifyInstance, store: GameStore, calc: CalcService) {
  app.get<{ Querystring: { depth?: string } }>('/api/calc/next', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const depth = CalcDepthSchema.safeParse(Number(request.query.depth ?? 1));
    if (!depth.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const response: CalcNextResponse = calc.next(user.id, depth.data as CalcDepth);
    return response;
  });

  app.post<{ Params: { id: string } }>('/api/calc/:id/step', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = CalcStepRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const problem = calc.find(request.params.id);
    if (!problem) return reply.code(404).send({ error: 'NOT_FOUND' });
    const response: CalcStepResponse = calc.step(problem, parsed.data.line, parsed.data.uci);
    return response;
  });

  app.post<{ Params: { id: string } }>('/api/calc/:id/answer', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = AnswerRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const problem = calc.find(request.params.id);
    if (!problem) return reply.code(404).send({ error: 'NOT_FOUND' });
    const { line, answer, hints } = parsed.data;
    const response: CalcAnswerResponse | null = calc.answer(
      user.id,
      problem,
      line,
      answer,
      hints ?? 0,
    );
    if (!response) return reply.code(400).send({ error: 'BAD_REQUEST' });
    return response;
  });
}
