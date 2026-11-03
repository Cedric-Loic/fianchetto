import type { FastifyInstance, FastifyRequest } from 'fastify';
import { coachAnswerCorrect, coachPrompt } from '@sq/coach';
import {
  CoachAnswerRequestSchema,
  type CoachAnswerResponse,
  type CoachPromptResponse,
} from '@sq/shared';
import { currentUser } from '../auth.js';
import type { LearningService } from '../coach/learning.js';
import type { GameSession } from '../games/session.js';
import type { GameStore } from '../persistence/db.js';

/**
 * Parties coachées : question socratique avant chaque coup du joueur. Réservé aux parties
 * d'entraînement classiques (`trainingPosition` est nul sinon, Secret Queen compris). Les cases
 * attendues ne sortent qu'avec la réponse. Aucun appel moteur.
 */
export function registerCoachedRoutes(
  app: FastifyInstance,
  store: GameStore,
  learning: LearningService,
  findLocal: (id: string, request: FastifyRequest) => { session: GameSession } | null,
): void {
  const position = (id: string, request: FastifyRequest) => {
    const found = findLocal(id, request);
    if (!found || found.session.mode !== 'bot') return null;
    return found.session.trainingPosition();
  };

  app.post<{ Params: { id: string } }>('/api/games/:id/coach-prompt', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const pos = position(request.params.id, request);
    if (!pos) return reply.code(409).send({ error: 'NOT_AVAILABLE' });
    const prompt = coachPrompt(pos.fen);
    const response: CoachPromptResponse = {
      prompt: prompt && { ply: pos.ply, kind: prompt.kind, question: prompt.question },
    };
    return response;
  });

  app.post<{ Params: { id: string } }>('/api/games/:id/coach-answer', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = CoachAnswerRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const pos = position(request.params.id, request);
    if (!pos) return reply.code(409).send({ error: 'NOT_AVAILABLE' });
    // Question recalculée depuis la position courante ; périmée si le jeu a avancé ou reculé.
    const prompt = pos.ply === parsed.data.ply ? coachPrompt(pos.fen) : null;
    if (!prompt) return reply.code(409).send({ error: 'STALE_PROMPT' });
    const correct = coachAnswerCorrect(prompt, parsed.data.squares);
    learning.recordCoachPrompt(user.id, request.params.id, pos.ply, prompt.kind, correct);
    const response: CoachAnswerResponse = {
      correct,
      squares: prompt.squares as CoachAnswerResponse['squares'],
      explanation: prompt.explanation,
    };
    return response;
  });
}
