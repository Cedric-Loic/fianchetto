import {
  SQUARES,
  ViewerSchema,
  type DisplayedPiece,
  type Viewer,
  type ViewerBoardState,
} from '@sq/shared';
import { classicCoreOf, type ClassicGame } from './internal/classic.js';

/**
 * Vue d'une partie classique : rien n'est caché, la vue est la même pour tous les spectateurs
 * (seul le champ `viewer` change). Elle ajoute les coups légaux du camp au trait, pour l'aide
 * visuelle facultative du client. Jamais de révélation : la notation est déjà réelle.
 */
export function projectClassic(game: ClassicGame, viewer: Viewer): ViewerBoardState {
  if (!ViewerSchema.safeParse(viewer).success) throw new Error('Spectateur invalide.');
  const core = classicCoreOf(game);
  const pieces: DisplayedPiece[] = [];
  for (const square of SQUARES) {
    const piece = core.pieceAt(square);
    if (piece !== undefined) {
      pieces.push({ id: piece.id, color: piece.color, type: piece.displayed, square });
    }
  }
  const result = core.result;
  return {
    viewer,
    pieces,
    turn: core.turn,
    fullmoveNumber: Math.floor(core.plyCount / 2) + 1,
    inCheck: core.inCheck,
    moves: core.publicMoves(),
    captured: core.capturedDisplayed(),
    ownSecret: null,
    result,
    reveal: null,
    legalMoves: result === null ? core.legalMoves() : null,
  };
}
