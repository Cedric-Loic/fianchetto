import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  ClientMessageSchema,
  CreateGameRequestSchema,
  LOCAL_HOST,
  type ServerMessage,
} from '@sq/shared';
import { GameManager } from './games/manager.js';
import type { Participant } from './games/session.js';
import { serializeOutgoing } from './send.js';

export interface ServerOptions {
  /** Niveau de log pino ; `silent` dans les tests. */
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'silent';
}

/**
 * Construit l'application Fastify sans la démarrer (testable avec `app.inject`).
 * Les logs ne contiennent jamais de contenu de message (ni entrant ni sortant).
 */
export function buildServer(options: ServerOptions = {}): FastifyInstance {
  const app = Fastify({ logger: { level: options.logLevel ?? 'info' } });
  const games = new GameManager();
  app.addHook('onClose', () => games.disposeAll());

  app.get('/api/health', () => ({ status: 'ok' }));

  app.post('/api/games', async (request, reply) => {
    const parsed = CreateGameRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    if (parsed.data.mode !== 'hotseat') return reply.code(501).send({ error: 'NOT_IMPLEMENTED' });
    const session = games.createHotseat(parsed.data);
    return { gameId: session.id };
  });

  void app.register(websocket);
  void app.register((scope, _options, done) => {
    scope.get('/ws', { websocket: true }, (socket) => {
      let current: { session: ReturnType<GameManager['get']>; participant: Participant } | null =
        null;
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
          current?.session?.leave(current.participant);
          // Étape 2 : hot-seat uniquement, vue publique (aucun secret).
          const participant: Participant = { viewer: 'public', send };
          current = { session, participant };
          session.join(participant);
          return;
        }
        if (!current?.session) return send({ type: 'error', code: 'INVALID_ACTION' });
        current.session.handle(current.participant, message);
      });

      socket.on('close', () => current?.session?.leave(current.participant));
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
