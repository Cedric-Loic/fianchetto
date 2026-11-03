import { parentPort, workerData } from 'node:worker_threads';
import { BotLevelSchema, BotObservationSchema } from '@sq/shared';
import { SecretQueenBot } from './player.js';
import { UciEngine } from './uci.js';

/**
 * Point d'entrée du worker du bot. Il ne reçoit, par message, que des observations sérialisées
 * (validées par BotObservationSchema) : aucun accès à l'état du serveur.
 */
export type BotRequest =
  | { id: number; kind: 'chooseMove'; observation: unknown }
  | { id: number; kind: 'shouldAcceptDraw'; observation: unknown };
export type BotResponse = { id: number; ok: true; result: unknown } | { id: number; ok: false };

const engine = new UciEngine();
const bot = new SecretQueenBot(
  engine,
  BotLevelSchema.parse((workerData as { level: unknown }).level),
  { humanPace: (workerData as { humanPace?: boolean }).humanPace !== false },
);

parentPort?.on('message', (request: BotRequest | 'stop') => {
  if (request === 'stop') {
    engine.quit();
    process.exit(0);
  }
  void (async () => {
    try {
      const observation = BotObservationSchema.parse(request.observation);
      const result =
        request.kind === 'chooseMove'
          ? await bot.chooseMove(observation)
          : await bot.shouldAcceptDraw(observation);
      parentPort?.postMessage({ id: request.id, ok: true, result } satisfies BotResponse);
    } catch {
      parentPort?.postMessage({ id: request.id, ok: false } satisfies BotResponse);
    }
  })();
});
