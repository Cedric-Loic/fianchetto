/*
 * @sq/coach — logique pure du coach (étape 7) : classification des coups, précision,
 * explications locales des erreurs, lecture des PGN. Aucun I/O : le serveur fournit les
 * évaluations Stockfish et stocke les résultats.
 */
export {
  balanceAfterLine,
  forkTargets,
  materialBalance,
  uciToSan,
  winsMaterial,
  type ForkTarget,
} from './board.js';
export { explainMove, type EngineEval, type Explanation, type MoveContext } from './explain.js';
export { parseGame, splitPgn, type ParsedGame } from './pgn.js';
export { buildReview, type ReviewInput } from './review.js';
export { classify, formatEval, gameAccuracy, moveAccuracy, winChance } from './win.js';
export { INITIAL_GLICKO, updateGlicko, type Glicko } from './glicko.js';
export { puzzlesFromReview, type OwnPuzzleCandidate } from './own-puzzles.js';
