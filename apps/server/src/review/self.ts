import type { FastifyInstance } from 'fastify';
import {
  SelfReviewRequestSchema,
  THINKING_FLAWS,
  type SelfReviewResponse,
  type ThinkingFlaw,
  type ThinkingProfile,
} from '@sq/shared';
import { currentUser } from '../auth.js';
import type { GameSession } from '../games/session.js';
import type { GameStore } from '../persistence/db.js';

export interface SelfReviewDeps {
  store: GameStore;
  /** Partie locale (en mémoire ou terminée rechargée), quel que soit son propriétaire. */
  findGame: (id: string) => GameSession | undefined;
  now?: () => number;
}

/** Partie du joueur : nombre de demi-coups si elle est terminée, sinon la raison du refus. */
type Resolved = { plies: number } | 'not-found' | 'not-over';

/**
 * Revue réflexive (étape 15) : le joueur marque ses moments d'hésitation et nomme son défaut de
 * réflexion. Aucune donnée de partie n'est lue au-delà du nombre de demi-coups, qui est public ;
 * la partie doit être terminée (en Secret Queen, rien n'est donc révélé avant la fin) et
 * appartenir au joueur (partie locale dont il est propriétaire, ou partie qu'il a importée).
 */
export function registerSelfReviewRoutes(app: FastifyInstance, deps: SelfReviewDeps): void {
  const { store } = deps;
  const now = deps.now ?? Date.now;

  const resolve = (userId: string, gameId: string): Resolved => {
    const session = deps.findGame(gameId);
    if (session) {
      if (session.ownerId !== userId) return 'not-found';
      if (session.phase !== 'ended') return 'not-over';
      return { plies: session.stateFor('public').board?.moves.length ?? 0 };
    }
    const imported = store.getImported(gameId);
    return imported && imported.userId === userId ? { plies: imported.plies } : 'not-found';
  };

  app.post<{ Params: { gameId: string } }>('/api/reviews/:gameId/self', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const game = resolve(user.id, request.params.gameId);
    if (game === 'not-found') return reply.code(404).send({ error: 'NOT_FOUND' });
    if (game === 'not-over') return reply.code(409).send({ error: 'GAME_NOT_OVER' });
    const parsed = SelfReviewRequestSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.moments.some((m) => m.ply > game.plies)) {
      return reply.code(400).send({ error: 'BAD_REQUEST' });
    }
    store.saveSelfReview(user.id, request.params.gameId, parsed.data.moments, now());
    return reply.send(selfReviewOf(store, user.id, request.params.gameId));
  });

  app.get<{ Params: { gameId: string } }>('/api/reviews/:gameId/self', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const game = resolve(user.id, request.params.gameId);
    if (game === 'not-found') return reply.code(404).send({ error: 'NOT_FOUND' });
    if (game === 'not-over') return reply.code(409).send({ error: 'GAME_NOT_OVER' });
    return selfReviewOf(store, user.id, request.params.gameId);
  });

  app.get('/api/coach/thinking', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const { reviews, counts } = store.thinkingCounts(user.id);
    const full = Object.fromEntries(THINKING_FLAWS.map((f) => [f, counts[f] ?? 0])) as Record<
      ThinkingFlaw,
      number
    >;
    // Égalité : le premier défaut de la liste fait foi (ordre stable).
    let top: ThinkingFlaw | null = null;
    for (const flaw of THINKING_FLAWS) {
      if (full[flaw] > 0 && (top === null || full[flaw] > full[top])) top = flaw;
    }
    const profile: ThinkingProfile = { reviews, counts: full, top };
    return profile;
  });
}

function selfReviewOf(store: GameStore, userId: string, gameId: string): SelfReviewResponse {
  const saved = store.getSelfReview(userId, gameId);
  return {
    selfReview: saved ? { gameId, moments: saved.moments, createdAt: saved.createdAt } : null,
  };
}
