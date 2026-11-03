import type { GameResult, PublicMove, ViewerGameState } from '@sq/shared';
import { REASONS, SIDE } from '../screens/labels';

export type Outcome = 'win' | 'loss' | 'draw';

/**
 * Issue vue par le spectateur : contre le bot, victoire ou défaite du joueur ; à deux sur
 * l'écran, toute partie gagnée est une victoire (celle du vainqueur).
 */
export function outcomeFor(result: GameResult, viewer: ViewerGameState['viewer']): Outcome {
  if (result.winner === null) return 'draw';
  if (viewer === 'public') return 'win';
  return result.winner === viewer ? 'win' : 'loss';
}

export function resultText(result: GameResult, state: ViewerGameState): string {
  if (result.winner === null) return `Partie nulle ${REASONS[result.reason]}`;
  return `${state.players[result.winner].name} (${SIDE[result.winner]}) gagne ${REASONS[result.reason]}`;
}

/** Annonce d'un coup pour les lecteurs d'écran : « Coup 12, Noirs : Cf6 ». */
export function moveAnnouncement(
  move: PublicMove,
  ply: number,
  format: (san: string) => string,
): string {
  return `Coup ${Math.ceil(ply / 2)}, ${SIDE[move.color]} : ${format(move.san)}`;
}
