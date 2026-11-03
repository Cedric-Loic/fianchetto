import { INITIAL_GLICKO } from '@sq/coach';
import type { CalcAnswerResponse, CalcNextResponse, CalcStepResponse } from '@sq/shared';
import { playStep } from '../chess-utils.js';
import type { LearningService } from '../coach/learning.js';
import type { GameStore } from '../persistence/db.js';
import {
  correctAnswer,
  explain,
  lineCorrect,
  parseCalc,
  replay,
  solutionSteps,
  toProblem,
  type CalcDepth,
  type ParsedCalc,
} from './problem.js';

/**
 * Entraîneur de calcul : tire un puzzle local, vérifie la légalité des coups saisis (sans état :
 * le serveur rejoue la ligne depuis la position du problème) et juge la ligne et la réponse.
 * La solution ne sort qu'avec la réponse de `answer`.
 */
export class CalcService {
  readonly #store: GameStore;
  readonly #learning: LearningService;
  readonly #now: () => number;

  constructor(store: GameStore, learning: LearningService, now: () => number = Date.now) {
    this.#store = store;
    this.#learning = learning;
    this.#now = now;
  }

  /** Problème décodé retrouvé par identifiant (puzzle Lichess local). */
  find(id: string): ParsedCalc | null {
    const puzzle = this.#store.puzzles.getLichess(id);
    return puzzle ? parseCalc(puzzle) : null;
  }

  /**
   * Problème suivant : une révision due de cette profondeur d'abord, sinon un puzzle jamais servi
   * en calcul, proche du classement puzzle du joueur. `problem: null` sans base ou sans puzzle.
   */
  next(userId: string, depth: CalcDepth): CalcNextResponse {
    const now = this.#now();
    for (const card of this.#store.cards(userId)) {
      if (card.source !== 'calc' || card.dueAt > now) continue;
      const parsed = this.find(card.ref);
      if (parsed?.depth === depth) return { problem: toProblem(parsed) };
    }
    const p = this.#store.puzzles;
    if (p.bankSize() === 0) return { problem: null };
    const rating = (p.glicko(userId) ?? INITIAL_GLICKO).rating;
    for (const fresh of [true, false]) {
      for (const [below, above] of [
        [200, 100],
        [500, 300],
        [3000, 3000],
      ] as const) {
        const puzzle = p.pickCalc(
          userId,
          { min: rating - below, max: rating + above },
          depth,
          fresh,
        );
        const parsed = puzzle ? parseCalc(puzzle) : null;
        if (parsed) return { problem: toProblem(parsed) };
      }
    }
    return { problem: null };
  }

  /** Légalité d'un coup après `line` ; un coup au-delà de la longueur du problème est refusé. */
  step(parsed: ParsedCalc, line: readonly string[], uci: string): CalcStepResponse {
    const refused = { legal: false, san: '' };
    if (line.length >= 2 * parsed.depth - 1) return refused;
    const chess = replay(parsed, line);
    const step = chess && playStep(chess, uci);
    return step ? { legal: true, san: step.san } : refused;
  }

  /** `null` : indice de réponse hors des options de la question. */
  answer(
    userId: string,
    parsed: ParsedCalc,
    line: readonly string[],
    answer: number,
    hints: number,
  ): CalcAnswerResponse | null {
    const options = toProblem(parsed).question.options;
    if (answer >= options.length) return null;
    const ok = lineCorrect(parsed, line);
    const correct = correctAnswer(parsed, line);
    const answerCorrect = answer === correct;
    this.#learning.recordCalc(userId, parsed.puzzle.id, parsed.depth, ok, answerCorrect, hints);
    return {
      lineCorrect: ok,
      answerCorrect,
      solution: solutionSteps(parsed),
      correctAnswer: correct,
      explanation: explain(
        parsed,
        solutionSteps(parsed),
        { lineCorrect: ok, answerCorrect },
        options,
        correct,
      ),
    };
  }
}
