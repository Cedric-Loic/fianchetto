import type { FastifyInstance } from 'fastify';
import { AnalysisEventSchema, AnalysisStreamQuerySchema, type AnalysisEvent } from '@sq/shared';
import { currentUser } from '../auth.js';
import type { GameStore } from '../persistence/db.js';
import { analysablePosition } from './position.js';
import type { AnalysisService } from './service.js';

/**
 * Moteur en direct (étape 12) : flux SSE `GET /api/analysis/stream?fen=…&multipv=3`, réservé
 * aux utilisateurs connectés. La route ne prend qu'une FEN : aucun identifiant de partie.
 * `analysis` nul : moteur désactivé (503).
 */
export function registerAnalysisRoutes(
  app: FastifyInstance,
  store: GameStore,
  analysis: AnalysisService | null,
): void {
  // Journal sobre : l'URL (qui contient la FEN) n'est pas journalisée au niveau info.
  app.get('/api/analysis/stream', { logLevel: 'warn' }, (request, reply) => {
    if (!currentUser(store, request)) {
      return reply.code(401).send({ error: 'NOT_AUTHENTICATED' });
    }
    const parsed = AnalysisStreamQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: 'BAD_REQUEST' });
    const { fen, multipv } = parsed.data;
    if (!analysablePosition(fen)) return reply.code(400).send({ error: 'INVALID_FEN' });
    if (!analysis) return reply.code(503).send({ error: 'ENGINE_UNAVAILABLE' });

    reply.hijack();
    const res = reply.raw;
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    });
    let open = true;
    const write = (event: AnalysisEvent) => {
      if (!open) return;
      // Liste blanche : seuls des événements conformes au contrat sortent.
      res.write(`data: ${JSON.stringify(AnalysisEventSchema.parse(event))}\n\n`);
      if (event.type !== 'lines') {
        open = false;
        res.end();
      }
    };
    const search = analysis.start(fen, multipv, write);
    // Fermeture par le client (ou fin normale) : la recherche est arrêtée.
    res.on('close', () => {
      open = false;
      void search.stop();
    });
    return reply;
  });
}
