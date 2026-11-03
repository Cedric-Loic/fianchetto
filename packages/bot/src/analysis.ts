import { Chess } from 'chess.js';
import type { UciEngine } from './uci.js';

const MATED = 10_000;

/** Évaluation d'une position réelle, du point de vue des Blancs, avec la ligne principale. */
export interface PositionAnalysis {
  /** Centipions ; `null` si mat forcé. Position finale : ±10 000 (mat) ou 0 (nulle). */
  evalCp: number | null;
  /** Mat en N (positif : les Blancs matent), sinon `null`. */
  mate: number | null;
  bestMoveUci: string | null;
  /** Ligne principale en UCI (vide en position finale). */
  pv: string[];
}

/**
 * Évalue chaque position (FEN réelles d'une partie terminée ou importée) par Stockfish à pleine
 * force. `onProgress` reçoit la part déjà faite (0 à 1).
 */
export async function evaluatePositions(
  engine: UciEngine,
  fens: readonly string[],
  options: { movetimeMs?: number; onProgress?: (done: number) => void } = {},
): Promise<PositionAnalysis[]> {
  const movetimeMs = options.movetimeMs ?? 150;
  const out: PositionAnalysis[] = [];
  for (const [i, fen] of fens.entries()) {
    const chess = new Chess(fen);
    const sign = chess.turn() === 'w' ? 1 : -1;
    if (chess.isGameOver()) {
      // Position finale : mat (le camp au trait est maté) ou nulle.
      const evalCp = chess.isCheckmate() ? -sign * MATED : 0;
      out.push({ evalCp, mate: null, bestMoveUci: null, pv: [] });
    } else {
      const [best] = await engine.analyze(fen, { movetimeMs, multipv: 1, skill: 20 });
      out.push({
        evalCp: best && best.mate === null ? sign * best.score : null,
        mate: best?.mate != null ? sign * best.mate : null,
        bestMoveUci: best?.move ?? null,
        pv: best?.pv ?? [],
      });
    }
    options.onProgress?.((i + 1) / fens.length);
  }
  return out;
}
