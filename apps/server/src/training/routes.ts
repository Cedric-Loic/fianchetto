import type { FastifyInstance, FastifyRequest } from 'fastify';
import { CheckMoveRequestSchema, HintRequestSchema, type CheckMoveResponse } from '@sq/shared';
import type { GameSession } from '../games/session.js';
import type { TrainingService } from './service.js';

/**
 * Routes des parties d'entraînement (étape 9) : indice et garde-fou, pour le propriétaire de la
 * partie, à son tour, en classique seulement (`trainingPosition` est nul sinon).
 */
export function registerTrainingRoutes(
  app: FastifyInstance,
  training: TrainingService,
  findLocal: (id: string, request: FastifyRequest) => { session: GameSession } | null,
): void {
  const position = (id: string, request: FastifyRequest) => {
    const found = findLocal(id, request);
    if (!found || found.session.mode !== 'bot') return null;
    return found.session.trainingPosition();
  };

  app.post<{ Params: { id: string } }>('/api/games/:id/hint', async (request, reply) => {
    const parsed = HintRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const pos = position(request.params.id, request);
    if (!pos) return reply.code(409).send({ error: 'NOT_AVAILABLE' });
    const hint = await training.hint(pos.fen, parsed.data.level);
    return hint ?? reply.code(503).send({ error: 'ENGINE_UNAVAILABLE' });
  });

  app.post<{ Params: { id: string } }>('/api/games/:id/check-move', async (request, reply) => {
    const parsed = CheckMoveRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const pos = position(request.params.id, request);
    if (!pos) return reply.code(409).send({ error: 'NOT_AVAILABLE' });
    const response: CheckMoveResponse = {
      warning: await training.checkMove(pos.fen, pos.color, parsed.data.uci),
    };
    return response;
  });
}
