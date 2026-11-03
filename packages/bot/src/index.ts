/*
 * @sq/bot — bot d'échecs, classique et Secret Queen (§5). Le serveur ne l'utilise qu'à travers un worker
 * (`@sq/bot/worker`) qui reçoit uniquement des observations sérialisées.
 */
export { evaluatePositions, type PositionAnalysis } from './analysis.js';
export { classicWorld, computeBelief, worldsFor, type Hypothesis } from './belief.js';
export { LEVELS, type LevelSettings } from './levels.js';
export { SecretQueenBot } from './player.js';
export { targetThinkMs } from './think-time.js';
export { UciEngine, type AnalysisStream, type StreamOptions, type UciLine } from './uci.js';
export type { BotRequest, BotResponse } from './worker.js';

/** Fichier du worker, pour `new Worker(BOT_WORKER_URL, …)`. */
export const BOT_WORKER_URL = new URL('./worker-entry.mjs', import.meta.url);
