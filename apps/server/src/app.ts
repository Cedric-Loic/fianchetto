import Fastify, { type FastifyInstance } from 'fastify';
import { LOCAL_HOST } from '@sq/shared';

export interface ServerOptions {
  /** Niveau de log pino ; `silent` dans les tests. */
  logLevel?: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'silent';
}

/**
 * Construit l'application Fastify sans la démarrer (testable avec `app.inject`).
 * Étape 0 : seule la route de santé existe. Le reste arrive à l'étape 2.
 */
export function buildServer(options: ServerOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: { level: options.logLevel ?? 'info' },
  });

  app.get('/api/health', () => ({ status: 'ok' }));

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
