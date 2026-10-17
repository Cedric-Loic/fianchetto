import {
  SQUARES,
  ViewerSchema,
  type DisplayedPiece,
  type Viewer,
  type ViewerBoardState,
} from '@sq/shared';
import { coreOf, type SecretQueenGame } from './internal/game.js';

/**
 * Seule source de ce que voit un spectateur (docs/RULES.md §2). `viewer` = 'w' | 'b' | 'public'.
 *
 * Construite champ par champ (liste blanche) : types AFFICHÉS uniquement, aucune donnée réelle
 * hormis les annonces publiques (échec, fin). `ownSecret` ne concerne que le spectateur lui-même ;
 * `result` et `reveal` sont non nuls si et seulement si la partie est terminée.
 */
export function projectForViewer(game: SecretQueenGame, viewer: Viewer): ViewerBoardState {
  if (!ViewerSchema.safeParse(viewer).success) throw new Error('Spectateur invalide.');
  const core = coreOf(game);

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
    ownSecret:
      viewer === 'public'
        ? null
        : { pieceId: core.secretId(viewer), square: core.secretSquare(viewer) },
    result,
    reveal: result === null ? null : core.reveal(),
    // Jamais de coups légaux en Secret Queen (§3.5 et docs/SECURITY.md).
    legalMoves: null,
  };
}
