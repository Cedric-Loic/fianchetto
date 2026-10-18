import { Chess, validateFen } from 'chess.js';
import type { UciLine } from '@sq/bot';
import type { EngineLine } from '@sq/shared';
import { playStep } from '../chess-utils.js';

/** Longueur maximale d'une ligne envoyée au client (demi-coups). */
export const MAX_PV = 12;

/**
 * Position acceptée par le moteur en direct, ou `null`. Refuse les FEN invalides pour chess.js
 * et celles où le camp qui n'a pas le trait est en échec (Stockfish quitte sur ces positions).
 * Renvoie la FEN normalisée par chess.js (roques et prise en passant cohérents).
 */
export function analysablePosition(fen: string): Chess | null {
  if (!validateFen(fen).ok) return null;
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  const waiting = chess.turn() === 'w' ? 'b' : 'w';
  const [king] = chess.findPiece({ type: 'k', color: waiting });
  if (!king || chess.isAttacked(king, chess.turn())) return null;
  return chess;
}

/** Position finale (mat ou pat) : aucun coup légal. */
export function isFinal(chess: Chess): boolean {
  return chess.moves().length === 0;
}

/** SAN de la ligne, jusqu'au premier coup illégal éventuel. */
export function sanLine(fen: string, pv: readonly string[]): string[] {
  const chess = new Chess(fen);
  const out: string[] = [];
  for (const uci of pv) {
    const step = playStep(chess, uci);
    if (!step) break;
    out.push(step.san);
  }
  return out;
}

/**
 * Convertit les lignes UCI (scores du point de vue du camp au trait) en lignes du point de vue
 * des Blancs, avec la suite tronquée à `MAX_PV` demi-coups et sa notation SAN.
 */
export function toEngineLines(fen: string, lines: readonly UciLine[]): EngineLine[] {
  const sign = new Chess(fen).turn() === 'w' ? 1 : -1;
  return lines.map((line, i) => {
    const sanPv = sanLine(fen, line.pv.slice(0, MAX_PV));
    return {
      multipv: i + 1,
      depth: line.depth ?? 0,
      evalCp: line.mate === null ? sign * Math.round(line.score) : null,
      mate: line.mate === null ? null : sign * line.mate,
      pv: line.pv.slice(0, sanPv.length),
      sanPv,
    };
  });
}
