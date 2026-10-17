import { randomInt } from 'node:crypto';
import type { BotObservation } from '@sq/shared';

/** Facteur aléatoire autour de 1 (loi log-normale bornée) : la plupart des coups sont proches
 * de la moyenne, quelques-uns nettement plus rapides ou plus lents, comme un humain. */
function humanFactor(): number {
  // Box-Muller avec un tirage CSPRNG.
  const u = randomInt(1, 1_000_000) / 1_000_000 || 0.5;
  const v = randomInt(1_000_000) / 1_000_000;
  const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.min(2.2, Math.max(0.4, Math.exp(0.5 * normal)));
}

/**
 * Temps de réflexion « humain » visé pour un coup du bot, en millisecondes.
 * - Partie chronométrée : environ 1/40 du temps restant + 80 % de l'incrément, plus rapide dans
 *   l'ouverture, jamais plus de 1/8 du temps restant (le bot ne perd pas au temps).
 * - Sans pendule : 0,8 à 3 s environ.
 * Le temps de calcul de Stockfish est inclus : on n'attend que la différence.
 */
export function targetThinkMs(observation: BotObservation): number {
  const clock = observation.state.clock;
  const plies = observation.state.board?.moves.length ?? 0;
  const botMoves = Math.floor(plies / 2);
  const factor = humanFactor();
  if (!clock) return Math.round(Math.min(3000, Math.max(800, 1500 * factor)));
  const remaining = clock.remainingMs[observation.botColor];
  let base = remaining / 40 + clock.incrementMs * 0.8;
  if (botMoves < 6) base *= 0.35; // coups d'ouverture joués vite, comme un humain
  return Math.round(Math.min(remaining / 8, Math.max(300, base * factor)));
}
