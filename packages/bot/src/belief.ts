import { Chess } from 'chess.js';
import {
  FILES,
  opposite,
  type BotObservation,
  type Color,
  type MoveIntent,
  type PieceId,
  type Square,
} from '@sq/shared';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Une hypothèse sur la dame secrète adverse, compatible avec tout ce que le bot a observé. */
export interface Hypothesis {
  /** Identifiant du pion adverse supposé être la dame (il peut avoir été capturé). */
  pieceId: PieceId;
  /** Position réelle actuelle si l'hypothèse est vraie. */
  fen: string;
  weight: number;
}

/** Case de départ d'un identifiant de pion (`wpe2` → `e2`). */
const startSquare = (id: PieceId) => id.slice(2) as Square;

/** FEN de départ où les pions des cases données sont remplacés par des dames. */
function initialFen(queens: { color: Color; square: Square }[]): string {
  const chess = new Chess(START_FEN);
  for (const q of queens) {
    chess.remove(q.square);
    chess.put({ type: 'q', color: q.color }, q.square);
  }
  return chess.fen();
}

function tryMove(chess: Chess, move: MoveIntent): boolean {
  try {
    chess.move(move.promotion ? move : { from: move.from, to: move.to });
    return true;
  } catch {
    return false;
  }
}

/** Le coup refusé est-il légal dans ce monde ? (Si oui, l'hypothèse est fausse.) */
function isLegalHere(chess: Chess, move: MoveIntent): boolean {
  const probe = new Chess(chess.fen());
  const piece = probe.get(move.from);
  const lastRank = piece?.color === 'w' ? '8' : '1';
  const promotion =
    piece?.type === 'p' && move.to[1] === lastRank ? (move.promotion ?? 'q') : undefined;
  return tryMove(probe, promotion ? { ...move, promotion } : move);
}

/**
 * Croyance du bot (§5) : pour chaque pion adverse, on rejoue toute la partie publique dans le
 * monde « ce pion est la dame » et on élimine le monde dès qu'une observation le contredit :
 * coup public illégal dans ce monde, annonce d'échec différente, promotion d'une dame, refus
 * d'un coup du bot qui y serait légal. Élimination déterministe : le monde réel n'est jamais
 * éliminé. A priori uniforme sur les mondes restants.
 */
export function computeBelief(observation: BotObservation): Hypothesis[] {
  const board = observation.state.board;
  if (!board?.ownSecret) return [];
  const me = observation.botColor;
  const opponent = opposite(me);
  const ownStart = startSquare(board.ownSecret.pieceId);
  const rank = opponent === 'w' ? '2' : '7';
  const worlds: Hypothesis[] = [];

  for (const file of FILES) {
    const candidate: PieceId = `${opponent}p${file}${rank}`;
    const chess = new Chess(
      initialFen([
        { color: me, square: ownStart },
        { color: opponent, square: startSquare(candidate) },
      ]),
    );
    let consistent = true;
    for (let ply = 0; ply <= board.moves.length && consistent; ply++) {
      for (const r of observation.rejections) {
        if (r.ply === ply && isLegalHere(chess, r.move)) consistent = false;
      }
      const move = board.moves[ply];
      if (!move || !consistent) continue;
      const piece = chess.get(move.from);
      const lastRank = move.color === 'w' ? '8' : '1';
      // Une dame ne se promeut pas ; un vrai pion arrivé en dernière rangée se promeut toujours.
      if (piece?.type === 'q' && move.promotion !== null) consistent = false;
      else if (piece?.type === 'p' && move.to[1] === lastRank && move.promotion === null) {
        consistent = false;
      } else if (
        !tryMove(
          chess,
          move.promotion
            ? { from: move.from, to: move.to, promotion: move.promotion }
            : { from: move.from, to: move.to },
        )
      ) {
        consistent = false;
      } else if (chess.inCheck() !== move.check) consistent = false;
    }
    if (consistent) worlds.push({ pieceId: candidate, fen: chess.fen(), weight: 1 });
  }
  const total = worlds.length;
  return worlds.map((w) => ({ ...w, weight: 1 / total }));
}
