import { fileURLToPath } from 'node:url';
import cookie from '@fastify/cookie';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  ClientMessageSchema,
  CreateGameRequestSchema,
  LOCAL_HOST,
  type GameConfig,
  type LeaderboardResponse,
  type ProfileResponse,
  type ServerMessage,
} from '@sq/shared';
import { currentUser, registerAuthRoutes, toPublicUser } from './auth.js';
import type { BotDriver } from './bot/driver.js';
import { loadConfig } from './config.js';
import { GameManager } from './games/manager.js';
import type { GameSession, Participant } from './games/session.js';
import { GameStore } from './persistence/db.js';
import { serializeOutgoing } from './send.js';

const DEFAULT_DB = fileURLToPath(new URL('../../../data/secret-queen.db', import.meta.url));

export interface ServerOptions {
  /** Niveau de log pino ; `silent` dans les tests. */
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'silent';
  /** Fichier SQLite ; `:memory:` pour les tests. Défaut : <racine du dépôt>/data/secret-queen.db. */
  dbPath?: string;
  config?: GameConfig;
  /** Fabrique de bots (tests). Par défaut : bot Stockfish dans un worker. */
  createBot?: ConstructorParameters<typeof GameManager>[0]['createBot'];
}
export type { BotDriver };

/**
 * Construit l'application Fastify sans la démarrer (testable avec `app.inject`).
 * Les logs ne contiennent jamais de contenu de message (ni entrant ni sortant).
 */
export function buildServer(options: ServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: { level: options.logLevel ?? 'info' } });
  const config = options.config ?? loadConfig();
  const store = new GameStore(options.dbPath ?? DEFAULT_DB);
  const games = new GameManager({ store, config, createBot: options.createBot });
  app.addHook('onClose', () => {
    games.disposeAll();
    store.close();
  });

  void app.register(cookie);
  app.get('/api/health', () => ({ status: 'ok' }));
  registerAuthRoutes(app, store, config);

  app.get('/api/bot-levels', () => config.botLevels);

  app.get('/api/leaderboard', (): LeaderboardResponse => ({
    entries: store.leaderboard().map((u, i) => ({
      rank: i + 1,
      username: u.username,
      rating: u.rating,
      gamesPlayed: u.gamesPlayed,
    })),
  }));

  app.get<{ Params: { username: string } }>('/api/profile/:username', (request, reply) => {
    const user = store.findUserByName(request.params.username);
    if (!user) return reply.code(404).send({ error: 'NOT_FOUND' });
    const profile: ProfileResponse = { user: toPublicUser(user), history: store.history(user.id) };
    return profile;
  });

  app.get('/api/games/active', (request, reply) => {
    const user = currentUser(store, request);
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const id = store.activeGameOf(user.id);
    return { gameId: id && games.get(id) ? id : null };
  });

  app.post('/api/games', (request, reply) => {
    const parsed = CreateGameRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const user = currentUser(store, request);
    if (parsed.data.mode === 'hotseat') {
      return { gameId: games.createHotseat({ ...parsed.data, ownerId: user?.id ?? null }).id };
    }
    if (!user) return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    const session = games.createBotGame({ ...parsed.data, userId: user.id });
    return { gameId: session.id };
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
