import type { FastifyInstance, FastifyRequest } from 'fastify';
import { parseGame, type ReviewInput } from '@sq/coach';
import {
  ImportChessComRequestSchema,
  ImportPgnRequestSchema,
  type GameReview,
  type ImportResult,
  type ImportedGamesResponse,
  type ImportedGameSummary,
  type ReviewInfo,
  type ReviewResponse,
  type UserGameStats,
} from '@sq/shared';
import { splitPgn } from '@sq/coach';
import { currentUser } from '../auth.js';
import type { GameSession } from '../games/session.js';
import type { GameStore, ImportedGameRow } from '../persistence/db.js';
import { ChessComError, fetchRecentGames, type JsonFetcher } from './chesscom.js';
import { importedRow } from './imports.js';
import type { ReviewService } from './service.js';

export interface ReviewDeps {
  store: GameStore;
  reviews: ReviewService;
  /** Partie locale consultable par l'auteur de la requête (même règle que le PGN). */
  findLocal: (id: string, request: FastifyRequest) => { session: GameSession } | null;
  fetcher?: JsonFetcher | undefined;
}

/** Nombre maximal de parties dans un import PGN (un fichier peut en contenir des milliers). */
const MAX_PGN_GAMES = 500;

type Target = { info: ReviewInfo; load: () => ReviewInput | null };

function localTarget(session: GameSession): Target {
  const state = session.stateFor('public');
  const result = state.board?.result;
  const human = session.botColor === 'w' ? 'b' : session.botColor === 'b' ? 'w' : null;
  return {
    info: {
      gameId: session.id,
      source: 'local',
      variant: session.variant,
      white: session.players.w.name,
      black: session.players.b.name,
      userColor: human,
      result: !result
        ? '*'
        : result.winner === null
          ? '1/2-1/2'
          : result.winner === 'w'
            ? '1-0'
            : '0-1',
      date: session.startedAt.slice(0, 10),
      url: null,
    },
    load: () => session.reviewInput(),
  };
}

function importedTarget(row: ImportedGameRow): Target {
  return {
    info: {
      gameId: row.id,
      source: row.source,
      variant: 'classic',
      white: row.white,
      black: row.black,
      userColor: row.userColor,
      result: row.result,
      date: row.date,
      url: row.url,
    },
    load: () => parseGame(row.pgn),
  };
}

/** Statistiques du camp de l'utilisateur dans une revue. */
function userStats(review: GameReview, row: ImportedGameRow): UserGameStats | null {
  if (!row.userColor) return null;
  const counts = review.counts[row.userColor];
  return {
    accuracy: review.accuracy[row.userColor],
    inaccuracy: counts.inaccuracy,
    mistake: counts.mistake,
    blunder: counts.blunder,
  };
}

/**
 * Routes du coach (étape 7) : revue d'une partie (locale terminée ou importée), import de
 * parties (PGN, chess.com à la demande), liste des parties importées.
 */
export function registerReviewRoutes(app: FastifyInstance, deps: ReviewDeps): void {
  const { store, reviews } = deps;

  /** Partie à revoir : locale TERMINÉE (règle de consultation du PGN) ou importée par soi. */
  const resolve = (id: string, request: FastifyRequest): Target | 'not-over' | null => {
    const local = deps.findLocal(id, request);
    if (local) return local.session.phase === 'ended' ? localTarget(local.session) : 'not-over';
    const user = currentUser(store, request);
    const row = store.getImported(id);
    return user && row && row.userId === user.id ? importedTarget(row) : null;
  };

  const respond = (target: Target): ReviewResponse => ({
    info: target.info,
    state: reviews.status(target.info.gameId),
  });

  app.get<{ Params: { id: string } }>('/api/reviews/:id', (request, reply) => {
    const target = resolve(request.params.id, request);
    if (target === 'not-over') return reply.code(409).send({ error: 'GAME_NOT_OVER' });
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND' });
    return respond(target);
  });

  app.post<{ Params: { id: string } }>('/api/reviews/:id', (request, reply) => {
    const target = resolve(request.params.id, request);
    if (target === 'not-over') return reply.code(409).send({ error: 'GAME_NOT_OVER' });
    if (!target) return reply.code(404).send({ error: 'NOT_FOUND' });
    reviews.request(target.info.gameId, target.load, { priority: true });
    return respond(target);
  });

  const save = (rows: (ImportedGameRow | null)[]): ImportResult => {
    const result: ImportResult = { imported: 0, duplicates: 0, invalid: 0 };
    for (const row of rows) {
      if (!row) result.invalid++;
      else if (store.addImported(row)) result.imported++;
      else result.duplicates++;
    }
    return result;
  };

  app.post('/api/imports/pgn', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = ImportPgnRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const names = [user.username, parsed.data.as ?? ''];
    const chunks = splitPgn(parsed.data.pgn).slice(0, MAX_PGN_GAMES);
    return save(chunks.map((pgn) => importedRow(pgn, { userId: user.id, source: 'pgn', names })));
  });

  app.post('/api/imports/chesscom', async (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const parsed = ImportChessComRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const { username, max } = parsed.data;
    try {
      const games = await fetchRecentGames(username, max, deps.fetcher);
      return save(
        games.map((g) =>
          importedRow(g.pgn, {
            userId: user.id,
            source: 'chesscom',
            url: g.url,
            names: [username],
          }),
        ),
      );
    } catch (error) {
      if (error instanceof ChessComError && error.code === 'NOT_FOUND') {
        return reply.code(404).send({ error: 'CHESSCOM_USER_NOT_FOUND' });
      }
      return reply.code(502).send({ error: 'CHESSCOM_UNAVAILABLE' });
    }
  });

  app.get('/api/imports', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const games = store.listImported(user.id).map((row): ImportedGameSummary => {
      const state = reviews.status(row.id);
      return {
        id: row.id,
        source: row.source,
        white: row.white,
        black: row.black,
        whiteElo: row.whiteElo,
        blackElo: row.blackElo,
        result: row.result,
        date: row.date,
        timeControl: row.timeControl,
        userColor: row.userColor,
        plies: row.plies,
        url: row.url,
        review: state.status,
        stats: state.status === 'done' ? userStats(state.review, row) : null,
      };
    });
    const response: ImportedGamesResponse = { games };
    return response;
  });

  app.delete<{ Params: { id: string } }>('/api/imports/:id', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    if (!store.deleteImported(request.params.id, user.id)) {
      return reply.code(404).send({ error: 'NOT_FOUND' });
    }
    return { ok: true };
  });

  /** Analyse par lot de toutes les parties importées non encore analysées. */
  app.post('/api/imports/review-all', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    let queued = 0;
    for (const row of store.listImported(user.id)) {
      const status = reviews.status(row.id).status;
      if (status === 'done' || status === 'queued' || status === 'running') continue;
      reviews.request(row.id, importedTarget(row).load);
      queued++;
    }
    return { queued };
  });
}
