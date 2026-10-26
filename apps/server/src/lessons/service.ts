import { Chess } from 'chess.js';
import { LESSONS, PASS_RATIO, lessonById, winChance, type Lesson } from '@sq/coach';
import type {
  LessonMoveResponse,
  LessonSquaresResponse,
  LessonSummary,
  LessonView,
  PuzzleStep,
  Square,
} from '@sq/shared';
import type { PositionAnalysis } from '@sq/bot';
import { EngineUnavailableError } from '../engine-unavailable.js';
import { legalMoves, playLine, playStep } from '../chess-utils.js';
import type { GameStore } from '../persistence/db.js';

const square = (s: string) => s as Square;

/** Jugement d'un exercice ; `hints` : indices consultés avant la réponse. */
type JudgedHook = (
  userId: string,
  id: string,
  index: number,
  solved: boolean,
  hints: number,
) => void;

/**
 * Leçons : contenu (sans les solutions), validation des coups des exercices, progression. La
 * validation est sans état : la position courante se déduit de l'exercice et de l'étape.
 */
export class LessonService {
  readonly #store: GameStore;
  readonly #evaluate: (fen: string) => Promise<PositionAnalysis | null>;

  /** Coach pédagogique : alimenté par le jugement des exercices (étape 14). */
  readonly #onJudged: JudgedHook | null;
  /** Recherche d'une leçon (injectable pour les tests). */
  readonly #lesson: (id: string) => Lesson | undefined;

  constructor(
    store: GameStore,
    evaluate: (fen: string) => Promise<PositionAnalysis | null>,
    onJudged?: JudgedHook,
    lookup: (id: string) => Lesson | undefined = lessonById,
  ) {
    this.#lesson = lookup;
    this.#store = store;
    this.#evaluate = evaluate;
    this.#onJudged = onJudged ?? null;
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
    const lesson = this.#lesson(id);
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
          : s.kind === 'walkthrough'
            ? this.#walkthrough(s)
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
        const squares = e.mode === 'squares';
        return {
          fen: e.fen,
          prompt: e.prompt,
          color: chess.turn(),
          legalMoves: squares ? [] : legalMoves(chess),
          kind: squares ? ('squares' as const) : ('move' as const),
          hints: Math.min(3, e.hints?.length ?? 0),
        };
      }),
      passRatio: PASS_RATIO,
      ...this.#progress(userId, lesson),
    };
  }

  #walkthrough(s: Extract<Lesson['sections'][number], { kind: 'walkthrough' }>) {
    const chess = new Chess(s.fen);
    const steps = [];
    for (const m of s.moves) {
      const played = chess.move({
        from: m.uci.slice(0, 2),
        to: m.uci.slice(2, 4),
        ...(m.uci.length > 4 ? { promotion: m.uci[4] } : {}),
      });
      steps.push({
        from: square(played.from),
        to: square(played.to),
        san: played.san,
        fen: chess.fen(),
        comment: m.comment,
      });
    }
    return { kind: 'walkthrough' as const, title: s.title ?? null, fen: s.fen, steps };
  }

  /** Coup du joueur dans l'exercice `index`, à l'étape `step`. `null` : exercice inconnu. */
  async move(
    id: string,
    index: number,
    step: number,
    uci: string,
    userId?: string,
    hints = 0,
  ): Promise<LessonMoveResponse | null> {
    const exercise = this.#lesson(id)?.exercises[index];
    if (!exercise || exercise.mode === 'squares') return null;
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
      if (!before || !after) throw new EngineUnavailableError();
      correct = winChance(before, color) - winChance(after, color) <= (exercise.tolerance ?? 5);
    }
    if (!correct) {
      const remaining: PuzzleStep[] = playLine(
        fen,
        exact ? exercise.solution.slice(step) : [exercise.solution[0] ?? ''],
      );
      if (userId) this.#onJudged?.(userId, id, index, false, hints);
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
    if (solved && userId) this.#onJudged?.(userId, id, index, true, hints);
    return {
      status: solved ? 'solved' : 'continue',
      steps,
      legalMoves: solved ? [] : legalMoves(probe),
      solution: null,
      explanation: solved ? exercise.explanation : null,
    };
  }

  /** Exercice `squares` : succès si l'ensemble de cases désigné est exactement l'attendu. */
  squares(
    id: string,
    index: number,
    given: readonly string[],
    hints: number,
    userId: string,
  ): LessonSquaresResponse | null {
    const exercise = this.#lesson(id)?.exercises[index];
    if (exercise?.mode !== 'squares') return null;
    const expected = new Set(exercise.squares ?? []);
    const got = new Set(given);
    const solved = got.size === expected.size && [...got].every((q) => expected.has(q));
    this.#onJudged?.(userId, id, index, solved, hints);
    return solved
      ? { status: 'solved', correct: null, explanation: exercise.explanation }
      : {
          status: 'failed',
          correct: [...expected].map(square),
          explanation: exercise.explanation,
        };
  }

  /** Texte de l'indice `level` (1 à 3), `null` s'il n'existe pas. */
  hint(id: string, index: number, level: number): string | null {
    return this.#lesson(id)?.exercises[index]?.hints?.[level - 1] ?? null;
  }

  /** Fin de leçon : garde le meilleur score. */
  result(userId: string, id: string, correct: number): LessonSummary | null {
    const lesson = this.#lesson(id);
    if (!lesson) return null;
    this.#store.saveLessonResult(userId, id, Math.min(correct, lesson.exercises.length));
    return this.list(userId).find((l) => l.id === id) ?? null;
  }
}
