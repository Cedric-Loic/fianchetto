import { Chess } from 'chess.js';
import type { AnalysisResponse } from '@sq/shared';
import type { UciEngine } from './uci.js';

const MATED = 10_000;

/**
 * Analyse d'une partie TERMINÉE : évaluation de chaque position réelle (FEN de la révélation)
 * par Stockfish à pleine force, du point de vue des Blancs, avec le meilleur coup.
 */
export async function analyzeGame(
  engine: UciEngine,
  fens: readonly string[],
  movetimeMs = 120,
): Promise<AnalysisResponse> {
  const plies: AnalysisResponse['plies'] = [];
  for (const [ply, fen] of fens.entries()) {
    const chess = new Chess(fen);
    const sign = chess.turn() === 'w' ? 1 : -1;
    if (chess.isGameOver()) {
      // Position finale : mat (le camp au trait est maté) ou nulle.
      const evalCp = chess.isCheckmate() ? -sign * MATED : 0;
      plies.push({ ply, evalCp, mate: null, bestMoveUci: null, bestMoveSan: null });
      continue;
    }
    const [best] = await engine.analyze(fen, { movetimeMs, multipv: 1, skill: 20 });
    let bestMoveSan: string | null = null;
    if (best) {
      try {
        bestMoveSan = chess.move({
          from: best.move.slice(0, 2),
          to: best.move.slice(2, 4),
          promotion: best.move[4],
        }).san;
      } catch {
        bestMoveSan = null;
      }
    }
    plies.push({
      ply,
      evalCp: best && best.mate === null ? sign * best.score : null,
      mate: best?.mate != null ? sign * best.mate : null,
      bestMoveUci: best?.move ?? null,
      bestMoveSan,
    });
  }
  return { plies };
}
