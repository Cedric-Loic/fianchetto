import { Chess } from 'chess.js';
import {
  MOVE_CLASSES,
  type ClassCounts,
  type Color,
  type GameReview,
  type ReviewMove,
} from '@sq/shared';
import { uciToSan } from './board.js';
import { explainMove, type EngineEval } from './explain.js';
import { classify, gameAccuracy, moveAccuracy, winChance } from './win.js';

/** Partie à analyser : positions réelles (initiale puis une par demi-coup) et coups joués. */
export interface ReviewInput {
  positions: string[];
  moves: { uci: string; san: string }[];
}

const emptyCounts = (): ClassCounts =>
  Object.fromEntries(MOVE_CLASSES.map((c) => [c, 0])) as ClassCounts;

/** Longueur de la ligne principale conservée dans la revue (exploration, « Voir la ligne »). */
const PV_PLIES = 10;

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Revue d'une partie à partir des évaluations moteur de chaque position (`evals[i]` évalue
 * `positions[i]`) : classe, précision et explication de chaque coup, bilan par camp.
 */
export function buildReview(input: ReviewInput, evals: readonly EngineEval[]): GameReview {
  if (
    evals.length !== input.positions.length ||
    input.positions.length !== input.moves.length + 1
  ) {
    throw new Error('Évaluations incohérentes avec la partie.');
  }
  const moves: ReviewMove[] = [];
  const counts = { w: emptyCounts(), b: emptyCounts() };
  const accuracies: Record<Color, number[]> = { w: [], b: [] };

  input.moves.forEach((move, i) => {
    const fenBefore = input.positions[i] ?? '';
    const fenAfter = input.positions[i + 1] ?? '';
    const before = evals[i] as EngineEval;
    const after = evals[i + 1] as EngineEval;
    const chess = new Chess(fenBefore);
    const color = chess.turn();
    const winBefore = winChance(before, color);
    const winAfter = winChance(after, color);
    const loss = Math.max(0, winBefore - winAfter);
    // Un coup forcé (seul coup légal) ou le coup du moteur est toujours le meilleur.
    const isBest = before.bestMoveUci === move.uci || chess.moves().length === 1;
    const classification = classify(isBest, loss);
    const accuracy = moveAccuracy(loss);
    counts[color][classification]++;
    accuracies[color].push(accuracy);
    const needsExplanation =
      classification === 'inaccuracy' ||
      classification === 'mistake' ||
      classification === 'blunder';
    moves.push({
      ply: i + 1,
      color,
      san: move.san,
      uci: move.uci,
      classification,
      winBefore: round1(winBefore),
      winAfter: round1(winAfter),
      accuracy: round1(accuracy),
      explanation: needsExplanation
        ? explainMove({ color, fenBefore, fenAfter, playedUci: move.uci, before, after })
        : null,
    });
  });

  return {
    positions: [...input.positions],
    evals: evals.map((e, i) => ({
      evalCp: e.evalCp,
      mate: e.mate,
      bestMoveUci: e.bestMoveUci,
      bestMoveSan: e.bestMoveUci ? uciToSan(input.positions[i] ?? '', e.bestMoveUci) : null,
      pv: e.pv.slice(0, PV_PLIES),
    })),
    moves,
    accuracy: { w: gameAccuracy(accuracies.w), b: gameAccuracy(accuracies.b) },
    counts,
  };
}
