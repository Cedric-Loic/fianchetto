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
export {
  LESSONS,
  PASS_RATIO,
  lessonById,
  type Exercise,
  type Lesson,
  type Section,
} from './lessons/index.js';
export {
  ACTIVITY_MINUTES,
  buildDashboard,
  computeStreak,
  estimateActivity,
  timeClassOf,
  weekStart,
  type DashboardGame,
  type DashboardInput,
  type TimeClass,
} from './dashboard.js';
export {
  BOT_MIN_GAMES,
  BOT_WINDOW,
  ELO_AT_12_MONTHS,
  ELO_AT_6_MONTHS,
  ELO_START,
  PHASE_THEMES,
  VERDICT_MARGIN,
  eloTarget,
  guardActive,
  guardPolicy,
  monthVerdict,
  suggestBotLevel,
  themeOfDay,
  type BotResult,
  type ThemeOfDayInput,
} from './regularity.js';
export {
  ENDGAMES,
  endgameByFen,
  endgameById,
  endgameColor,
  endgameSucceeded,
  type Endgame,
  type EndgameGoal,
} from './endgames.js';
