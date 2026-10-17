import { Chess } from 'chess.js';
import { LESSONS, PASS_RATIO, lessonById, winChance, type Lesson } from '@sq/coach';
import type { LessonMoveResponse, LessonSummary, LessonView, PuzzleStep, Square } from '@sq/shared';
import type { PositionAnalysis } from '@sq/bot';
import { legalMoves, playLine, playStep } from '../chess-utils.js';
import type { GameStore } from '../persistence/db.js';

const square = (s: string) => s as Square;

/**
 * Leçons : contenu (sans les solutions), validation des coups des exercices, progression. La
 * validation est sans état : la position courante se déduit de l'exercice et de l'étape.
 */
export class LessonService {
  readonly #store: GameStore;
  readonly #evaluate: (fen: string) => Promise<PositionAnalysis | null>;

  constructor(store: GameStore, evaluate: (fen: string) => Promise<PositionAnalysis | null>) {
    this.#store = store;
    this.#evaluate = evaluate;
  }

  #progress(userId: string, lesson: Lesson) {
    const best = this.#store.lessonBest(userId, lesson.id);
    return {
      best,
      passed: best !== null && best >= Math.ceil(PASS_RATIO * lesson.exercises.length),
    };
  }

  list(userId: string): LessonSummary[] {
    return LESSONS.map((l) => ({
      id: l.id,
      phase: l.phase,
      title: l.title,
      summary: l.summary,
      minutes: l.minutes,
      exercises: l.exercises.length,
      ...this.#progress(userId, l),
    }));
  }

  view(userId: string, id: string): LessonView | null {
    const lesson = lessonById(id);
    if (!lesson) return null;
    return {
      id: lesson.id,
      phase: lesson.phase,
      title: lesson.title,
      summary: lesson.summary,
      minutes: lesson.minutes,
      sections: lesson.sections.map((s) =>
        s.kind === 'text'
          ? { kind: 'text', title: s.title ?? null, body: s.body }
          : {
              kind: 'example',
              fen: s.fen,
              caption: s.caption,
              arrows: (s.arrows ?? []).map(([from, to]) => ({
                from: square(from),
                to: square(to),
              })),
              marks: (s.marks ?? []).map(square),
            },
      ),
      exercises: lesson.exercises.map((e) => {
        const chess = new Chess(e.fen);
        return { fen: e.fen, prompt: e.prompt, color: chess.turn(), legalMoves: legalMoves(chess) };
      }),
      passRatio: PASS_RATIO,
      ...this.#progress(userId, lesson),
    };
  }

  /** Coup du joueur dans l'exercice `index`, à l'étape `step`. `null` : exercice inconnu. */
  async move(
    id: string,
    index: number,
    step: number,
    uci: string,
  ): Promise<LessonMoveResponse | null> {
    const exercise = lessonById(id)?.exercises[index];
    if (!exercise) return null;
    const exact = exercise.mode === 'exact';
    // Position courante : la solution jouée jusqu'à l'étape (toujours 0 hors mode exact).
    if (step % 2 !== 0 || step >= exercise.solution.length || (!exact && step !== 0)) return null;
    const chess = new Chess(exercise.fen);
    for (const done of exercise.solution.slice(0, step)) playStep(chess, done);
    const fen = chess.fen();
    const color = chess.turn();
    const probe = new Chess(fen);
    const played = playStep(probe, uci);
    const illegal: LessonMoveResponse = {
      status: 'illegal',
      steps: [],
      legalMoves: legalMoves(chess),
      solution: null,
      explanation: null,
    };
    if (!played) return illegal;

    let correct: boolean;
    if (exercise.mode === 'choice') correct = (exercise.accepted ?? []).includes(played.uci);
    else if (exact) correct = played.uci === exercise.solution[step] || probe.isCheckmate();
    else {
      const [before, after] = [await this.#evaluate(fen), await this.#evaluate(played.fen)];
      correct =
        before !== null &&
        after !== null &&
        winChance(before, color) - winChance(after, color) <= (exercise.tolerance ?? 5);
    }
    if (!correct) {
      const remaining: PuzzleStep[] = playLine(
        fen,
        exact ? exercise.solution.slice(step) : [exercise.solution[0] ?? ''],
      );
      return {
        status: 'failed',
        steps: [],
        legalMoves: [],
        solution: remaining,
        explanation: exercise.explanation,
      };
    }
    const steps = [played];
    const reply =
      exact && played.uci === exercise.solution[step] ? exercise.solution[step + 1] : undefined;
    if (reply) {
      const replied = playStep(probe, reply);
      if (replied) steps.push(replied);
    }
    const solved = !reply;
    return {
      status: solved ? 'solved' : 'continue',
      steps,
      legalMoves: solved ? [] : legalMoves(probe),
      solution: null,
      explanation: solved ? exercise.explanation : null,
    };
  }

  /** Fin de leçon : garde le meilleur score. */
  result(userId: string, id: string, correct: number): LessonSummary | null {
    const lesson = lessonById(id);
    if (!lesson) return null;
    this.#store.saveLessonResult(userId, id, Math.min(correct, lesson.exercises.length));
    return this.list(userId).find((l) => l.id === id) ?? null;
  }
}
