import type { GameConfig } from '@sq/shared';

/**
 * Nouveau classement Elo du joueur après une partie contre un adversaire de classement fixe.
 * `score` : 1 victoire, 0,5 nulle, 0 défaite. K dépend du nombre de parties déjà classées.
 */
export function updateRating(
  rating: number,
  opponent: number,
  score: 0 | 0.5 | 1,
  gamesPlayed: number,
  elo: GameConfig['elo'],
): number {
  const expected = 1 / (1 + 10 ** ((opponent - rating) / 400));
  const k = gamesPlayed < elo.provisionalGames ? elo.kProvisional : elo.kEstablished;
  return Math.round(rating + k * (score - expected));
}
