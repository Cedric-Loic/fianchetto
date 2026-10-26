import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  ClientMessageSchema,
  CreateGameRequestSchema,
  LOCAL_HOST,
  VariantSchema,
  type GameConfig,
  type LeaderboardResponse,
  type ProfileResponse,
  type ServerMessage,
} from '@sq/shared';
import { registerAnalysisRoutes } from './analysis/routes.js';
import { AnalysisService, type LiveEngine } from './analysis/service.js';
import { currentUser, registerAuthRoutes } from './auth.js';
import type { BotDriver } from './bot/driver.js';
import { humanPaceFromEnv, loadConfig } from './config.js';
import { GameManager, InvalidGameRequest } from './games/manager.js';
import type { GameSession, Participant } from './games/session.js';
import { GameStore } from './persistence/db.js';
import type { JsonFetcher } from './review/chesscom.js';
import { LearningService } from './coach/learning.js';
import { CoachService, registerCoachRoutes } from './coach/routes.js';
import { registerEndgameRoutes } from './endgames/routes.js';
import { EndgameService } from './endgames/service.js';
import { registerLessonRoutes } from './lessons/routes.js';
import { LessonService } from './lessons/service.js';
import { registerOpeningRoutes } from './openings/routes.js';
import { OpeningService } from './openings/service.js';
import { registerPuzzleRoutes } from './puzzles/routes.js';
import { PuzzleService } from './puzzles/service.js';
import { registerReviewRoutes } from './review/routes.js';
import { ReviewService, type ReviewEngine } from './review/service.js';
import { registerCoachedRoutes } from './training/coached.js';
import { registerTrainingRoutes } from './training/routes.js';
import { TrainingService } from './training/service.js';
import { serializeOutgoing } from './send.js';

const DEFAULT_DB = fileURLToPath(new URL('../../../data/secret-queen.db', import.meta.url));

export interface ServerOptions {
  /** Niveau de log pino ; `silent` dans les tests. */
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'silent';
  /** Fichier SQLite ; `:memory:` pour les tests. Défaut : <racine du dépôt>/data/secret-queen.db. */
  dbPath?: string;
  /** Base de puzzles Lichess. Défaut : `puzzles.db` à côté de la base principale. */
  puzzlesPath?: string;
  /** Destination des logs (tests : capture pour vérifier qu'aucun secret n'y apparaît). */
  logStream?: { write: (line: string) => void };
  config?: GameConfig;
  /** Fabrique de bots (tests). Par défaut : bot Stockfish dans un worker. */
  createBot?: ConstructorParameters<typeof GameManager>[0]['createBot'];
  /**
   * Bot par défaut : temps de réflexion « humain ». Défaut : variable d'environnement
   * `FIANCHETTO_HUMAN_PACE` (`0` le désactive, pour les tests de bout en bout), sinon oui.
   */
  botHumanPace?: boolean;
  /** Temps Stockfish par position pour les revues (tests : plus court). Défaut : 150 ms. */
  reviewMovetimeMs?: number;
  /** Moteur des revues et des évaluations (tests : faux moteur). Défaut : Stockfish. */
  createReviewEngine?: () => ReviewEngine;
  /** Accès à l'API chess.com (tests : faux serveur). Défaut : `fetch`. */
  chessComFetcher?: JsonFetcher;
  /**
   * Moteur en direct (`/api/analysis/stream`) : fabrique du moteur (tests), ou `null` pour le
   * désactiver. Défaut : un Stockfish dédié, créé à la demande.
   */
  createAnalysisEngine?: (() => LiveEngine) | null;
}
export type { BotDriver };
export { WorkerBot } from './bot/driver.js';

/**
 * Construit l'application Fastify sans la démarrer (testable avec `app.inject`).
 * Les logs ne contiennent jamais de contenu de message (ni entrant ni sortant).
 */
export function buildServer(options: ServerOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: options.logLevel ?? 'info',
      ...(options.logStream ? { stream: options.logStream } : {}),
    },
  });
  const config = options.config ?? loadConfig();
  const store = new GameStore(options.dbPath ?? DEFAULT_DB, {
    initialRating: config.elo.initial,
    ...(options.puzzlesPath ? { puzzlesPath: options.puzzlesPath } : {}),
  });
  const reviews = new ReviewService(store, {
    movetimeMs: options.reviewMovetimeMs,
    ...(options.createReviewEngine ? { createEngine: options.createReviewEngine } : {}),
  });
  const games = new GameManager({
    store,
    config,
    createBot: options.createBot,
    botHumanPace: options.botHumanPace ?? humanPaceFromEnv(),
    logger: app.log,
    // Revue lancée d'office à la fin d'une partie classique contre le bot (bilan du coach).
    afterEnd: (session, result) => {
      if (session.variant === 'classic' && session.mode === 'bot') {
        reviews.request(session.id, () => session.reviewInput());
      }
      endgames.onGameEnd(session, result);
    },
  });
  const endgames = new EndgameService(store, games);
  const training = new TrainingService((fen) => reviews.evaluate(fen));
  const coach = new CoachService(store, config.botLevels);
  const learning = new LearningService(store, {
    phaseOf: (userId) => coach.dashboard(userId).phase.current,
  });
  const lessons = new LessonService(
    store,
    (fen) => reviews.evaluate(fen, 400),
    (userId, id, index, solved, hints) => learning.recordExercise(userId, id, index, solved, hints),
  );
  const openings = new OpeningService(store);
  const puzzles = new PuzzleService(store, (fen) => reviews.evaluate(fen), {
    themeOfDay: (userId) => coach.themeOfDay(userId),
    onOwnJudged: (userId, puzzleId, ok) => learning.recordOwnPuzzle(userId, puzzleId, ok),
  });
  coach.attach(puzzles);
  const analysis =
    options.createAnalysisEngine === null
      ? null
      : new AnalysisService(
          options.createAnalysisEngine ? { createEngine: options.createAnalysisEngine } : {},
        );
  // Avant la fermeture des connexions : les flux SSE ouverts doivent se terminer.
  app.addHook('preClose', async () => {
    await analysis?.dispose();
  });
  app.addHook('onClose', () => {
    reviews.dispose();
    games.disposeAll();
    store.close();
  });

  void app.register(cookie);
  app.get('/api/health', () => ({ status: 'ok' }));
  registerAuthRoutes(app, store);

  app.get('/api/bot-levels', () => config.botLevels);

  // Classement d'une variante (`?variant=classic`), Secret Queen par défaut.
  app.get<{ Querystring: { variant?: string } }>('/api/leaderboard', (request) => {
    const parsed = VariantSchema.safeParse(request.query.variant ?? 'secret-queen');
    const variant = parsed.success ? parsed.data : 'secret-queen';
    const response: LeaderboardResponse = {
      variant,
      entries: store.leaderboard(variant).map((u, i) => ({
        rank: i + 1,
        username: u.username,
        rating: u.rating,
        gamesPlayed: u.gamesPlayed,
      })),
    };
    return response;
  });

  app.get<{ Params: { username: string } }>('/api/profile/:username', (request, reply) => {
    const user = store.findUserByName(request.params.username);
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' });
    const profile: ProfileResponse = {
      user: store.publicUser(user),
      history: store.history(user.id),
    };
    return profile;
  });

  app.get('/api/games/active', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const id = store.activeGameOf(user.id);
    return { gameId: id && games.get(id) ? id : null };
  });

  /**
   * Partie consultable par l'utilisateur courant, avec le camp de sa vue : mode bot →
   * propriétaire seulement ; hot-seat → vue publique.
   */
  const viewable = (id: string, request: Parameters<typeof currentUser>[1]) => {
    const session = games.get(id);
    if (!session) return null;
    if (session.mode === 'hotseat') return { session, viewer: 'public' as const };
    const user = currentUser(store, request);
    if (!user || user.id !== session.ownerId || !session.botColor) return null;
    return { session, viewer: session.botColor === 'w' ? ('b' as const) : ('w' as const) };
  };

  registerPuzzleRoutes(app, store, puzzles);
  registerLessonRoutes(app, store, lessons);
  registerEndgameRoutes(app, store, endgames);
  registerOpeningRoutes(app, store, openings);
  registerCoachRoutes(app, store, coach, learning);
  registerAnalysisRoutes(app, store, analysis);
  registerTrainingRoutes(
    app,
    training,
    (id, request) => viewable(id, request),
    (session) =>
      !session.ownerId || coach.guardActiveFor(session.id, session.ownerId, session.startedAt),
  );
  registerCoachedRoutes(app, store, learning, (id, request) => viewable(id, request));
  registerReviewRoutes(app, {
    store,
    reviews,
    findLocal: (id, request) => viewable(id, request),
    fetcher: options.chessComFetcher,
  });

  // Export de la notation. Classique : SAN standard. Secret Queen : notation publique pendant la
  // partie, réelle (PGN avec FEN de départ) après.
  app.get<{ Params: { id: string } }>('/api/games/:id/pgn', (request, reply) => {
    const found = viewable(request.params.id, request);
    if (!found) return reply.code(404).send({ error: 'NOT_FOUND' });
    const state = found.session.stateFor(found.viewer);
    const board = state.board;
    const result = board?.result
      ? board.result.winner === null
        ? '1/2-1/2'
        : board.result.winner === 'w'
          ? '1-0'
          : '0-1'
      : '*';
    const reveal = board?.reveal ?? null;
    const sans = reveal
      ? reveal.plies.map((p) => p.realSan)
      : (board?.moves ?? []).map((m) => m.san);
    const body = sans.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san}` : san)).join(' ');
    const event =
      state.variant === 'classic'
        ? 'Fianchetto, partie classique'
        : `Fianchetto, Secret Queen${reveal ? '' : ' (notation publique)'}`;
    const headers = [
      `[Event "${event}"]`,
      `[White "${state.players.w.name}"]`,
      `[Black "${state.players.b.name}"]`,
      `[Result "${result}"]`,
      ...(reveal ? ['[SetUp "1"]', `[FEN "${reveal.realInitialFen}"]`] : []),
    ];
    void reply.type('application/x-chess-pgn; charset=utf-8');
    return `${headers.join('\n')}\n\n${body} ${result}\n`;
  });

  app.post('/api/games', (request, reply) => {
    const parsed = CreateGameRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const user = currentUser(store, request);
    if (parsed.data.mode === 'hotseat') {
      return { gameId: games.createHotseat({ ...parsed.data, ownerId: user?.id ?? null }).id };
    }
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    try {
      const session = games.createBotGame({ ...parsed.data, userId: user.id });
      return { gameId: session.id };
    } catch (error) {
      if (error instanceof InvalidGameRequest)
        return reply.code(400).send({ error: 'BAD_REQUEST' });
      throw error;
    }
  });

  void app.register(websocket);
  void app.register((scope, _options, done) => {
    scope.get('/ws', { websocket: true }, (socket, request) => {
      const user = currentUser(store, request);
      let current: { session: GameSession; participant: Participant } | null = null;
      const send = (message: ServerMessage) => {
        try {
          socket.send(serializeOutgoing(message));
        } catch {
          app.log.error({ type: message.type }, 'Message sortant refusé');
        }
      };

      socket.on('message', (raw: Buffer) => {
        let data: unknown;
        try {
          data = JSON.parse(raw.toString('utf8'));
        } catch {
          return send({ type: 'error', code: 'BAD_MESSAGE' });
        }
        const parsed = ClientMessageSchema.safeParse(data);
        if (!parsed.success) return send({ type: 'error', code: 'BAD_MESSAGE' });
        const message = parsed.data;

        if (message.type === 'join') {
          const session = games.get(message.gameId);
          if (!session) return send({ type: 'error', code: 'GAME_NOT_FOUND' });
          // Mode bot : seul le propriétaire, avec la vue de SON camp. Hot-seat : vue publique.
          let viewer: Participant['viewer'] = 'public';
          if (session.mode === 'bot') {
            if (!user || user.id !== session.ownerId || !session.botColor) {
              return send({ type: 'error', code: 'FORBIDDEN' });
            }
            viewer = session.botColor === 'w' ? 'b' : 'w';
          }
          if (current) current.session.leave(current.participant);
          const participant: Participant = { viewer, send };
          current = { session, participant };
          session.join(participant);
          return;
        }
        if (!current) return send({ type: 'error', code: 'INVALID_ACTION' });
        current.session.handle(current.participant, message);
      });

      socket.on('close', () => current?.session.leave(current.participant));
    });
    done();
  });

  return app;
}

/**
 * Démarre le serveur sur 127.0.0.1 uniquement (§2) : l'hôte n'est volontairement pas
 * configurable, seul le port l'est.
 */
export async function startServer(port: number, options: ServerOptions = {}) {
  const app = buildServer(options);
  await app.listen({ host: LOCAL_HOST, port });
  return app;
}
