/*
 * Point d'entrée public de @sq/shared (importable par le web).
 * `Secret<T>` n'est PAS exporté ici : il vit dans `@sq/shared/secret`, réservé à Node.
 */
export * from './chess.js';
export * from './time-control.js';
export * from './game-state.js';
export * from './events.js';
export * from './protocol.js';
export * from './bot.js';
export * from './api.js';
export * from './config.js';
export * from './material.js';

/** Seul message affiché pour un coup refusé, quel que soit le motif (§3.5). */
export const GENERIC_ILLEGAL_MOVE_MESSAGE = 'Coup illégal.';

/** Adresse d'écoute imposée (§2) : jamais d'écoute sur une interface réseau. */
export const LOCAL_HOST = '127.0.0.1';
export const DEFAULT_SERVER_PORT = 3001;
export const DEFAULT_WEB_PORT = 5173;
export * from './review.js';
export * from './puzzle.js';
export * from './lesson.js';
export * from './coach.js';
export * from './analysis.js';
export * from './endgame.js';
export * from './opening.js';
