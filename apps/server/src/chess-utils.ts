import { Chess } from 'chess.js';
import type { LegalMove, PuzzleStep } from '@sq/shared';

/** Coups légaux (cases de départ et d'arrivée, promotions regroupées). */
export function legalMoves(chess: Chess): LegalMove[] {
  const seen = new Set<string>();
  const out: LegalMove[] = [];
  for (const m of chess.moves({ verbose: true })) {
    const key = m.from + m.to;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ from: m.from, to: m.to });
  }
  return out;
}

/** Joue un coup UCI sur `chess` ; renvoie l'étape, ou `null` si le coup est illégal. */
export function playStep(chess: Chess, uci: string): PuzzleStep | null {
  try {
    const m = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      ...(uci.length > 4 ? { promotion: uci[4] } : {}),
    });
    return { uci: m.lan, san: m.san, fen: chess.fen() };
  } catch {
    return null;
  }
}

/** Suite de coups jouée sur une copie de la position. */
export function playLine(fen: string, moves: readonly string[]): PuzzleStep[] {
  const chess = new Chess(fen);
  const steps: PuzzleStep[] = [];
  for (const uci of moves) {
    const step = playStep(chess, uci);
    if (!step) break;
    steps.push(step);
  }
  return steps;
}
