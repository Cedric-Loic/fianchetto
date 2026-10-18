import type { FastifyReply } from 'fastify';

/**
 * Stockfish indisponible (mort, délai dépassé) pendant une évaluation demandée par une route :
 * la route répond 503 `ENGINE_UNAVAILABLE` au lieu d'une erreur 500 ou d'un verdict faux.
 */
export class EngineUnavailableError extends Error {
  constructor() {
    super('Moteur indisponible.');
    this.name = 'EngineUnavailableError';
  }
}

/** Exécute `run` ; moteur indisponible → 503. Toute autre erreur est relancée. */
export async function orEngineUnavailable<T>(
  reply: FastifyReply,
  run: () => Promise<T>,
): Promise<T | FastifyReply> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof EngineUnavailableError) {
      return reply.code(503).send({ error: 'ENGINE_UNAVAILABLE' });
    }
    throw error;
  }
}
