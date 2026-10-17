/*
 * @sq/engine — moteur Secret Queen : position réelle, secrets, légalité, fins de partie,
 * projection par spectateur, notation publique et réelle. Logique pure : aucun I/O, aucun
 * aléatoire, aucune horloge. Il fournit aussi la variante classique (`ClassicGame`,
 * `projectClassic`), sur le même noyau sans dame secrète.
 *
 * L'état réel ne sort du moteur que par deux chemins :
 * - `projectForViewer` (ce que voit un spectateur, révélation comprise après la fin) ;
 * - `toPersisted()` (reprise après redémarrage), enveloppé dans `Secret<T>`.
 */
export type { PersistedClassicGame, PersistedGame, PlayResult, SecretChoice } from './types.js';
export { ClassicGame } from './internal/classic.js';
export { projectClassic } from './projection-classic.js';
export { SecretQueenGame } from './internal/game.js';
export { projectForViewer } from './projection.js';
