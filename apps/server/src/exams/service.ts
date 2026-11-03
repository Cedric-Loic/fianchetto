import { randomInt } from 'node:crypto';
import { LESSONS, type Lesson } from '@sq/coach';
import {
  EXAM_MINI_SIZE,
  EXAM_PASS_RATIO,
  EXAM_SIZE,
  EXAM_STAGES,
  type ExamKind,
  type ExamQuestion,
  type ExamResultResponse,
  type ExamStartResponse,
  type ExamSummary,
  type SkillId,
} from '@sq/shared';
import { skillOfLesson } from '../coach/learning.js';
import type { LessonService } from '../lessons/service.js';
import type { GameStore } from '../persistence/db.js';

/** Au plus 3 exercices d'une même leçon dans un examen (mélange des contenus). */
const MAX_PER_LESSON = 3;

/** Seuils de réussite (80 %) : 16/20 pour l'examen, 4/5 pour le mini-test. */
const PASS_SCORE = {
  stage: Math.ceil(EXAM_PASS_RATIO * EXAM_SIZE),
  mini: Math.ceil(EXAM_PASS_RATIO * EXAM_MINI_SIZE),
};
const SIZE = { stage: EXAM_SIZE, mini: EXAM_MINI_SIZE };

/** Nombre pseudo-aléatoire dans [0, 1[ ; injectable pour des tests déterministes. */
export type Random = () => number;
const secureRandom: Random = () => randomInt(0, 2 ** 30) / 2 ** 30;

function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Leçons éligibles : même palier, hors parties classiques ; mini-test : finales `fin-*` du palier 1. */
function eligible(lessons: readonly Lesson[], stage: number, kind: ExamKind): Lesson[] {
  return lessons.filter(
    (l) =>
      l.phase === stage &&
      !l.id.startsWith('classique-') &&
      (kind === 'stage' || (stage === 1 && l.id.startsWith('fin-'))) &&
      l.exercises.length > 0,
  );
}

/** Exercices utilisables au plus : `MAX_PER_LESSON` par leçon. */
function capacity(lessons: readonly Lesson[]): number {
  return lessons.reduce((n, l) => n + Math.min(MAX_PER_LESSON, l.exercises.length), 0);
}

/**
 * Examens de palier : composition aléatoire à partir des exercices des leçons (la correction reste
 * celle des routes des leçons), meilleur score par palier. Les solutions ne sont jamais renvoyées.
 */
export class ExamService {
  readonly #store: GameStore;
  readonly #lessons: LessonService;
  readonly #catalog: readonly Lesson[];
  readonly #random: Random;
  readonly #skillOf: (lessonId: string) => SkillId;

  constructor(
    store: GameStore,
    lessons: LessonService,
    options: {
      catalog?: readonly Lesson[];
      random?: Random;
      skillOf?: (lessonId: string) => SkillId;
    } = {},
  ) {
    this.#store = store;
    this.#lessons = lessons;
    this.#catalog = options.catalog ?? LESSONS;
    this.#random = options.random ?? secureRandom;
    this.#skillOf = options.skillOf ?? skillOfLesson;
  }

  static validStage(stage: number): boolean {
    return (EXAM_STAGES as readonly number[]).includes(stage);
  }

  #summary(userId: string, stage: number): ExamSummary {
    const best = this.#store.examBest(userId, stage, 'stage');
    const mini = this.#store.examBest(userId, stage, 'mini');
    return {
      stage,
      best,
      total: EXAM_SIZE,
      passed: best !== null && best >= PASS_SCORE.stage,
      available: capacity(eligible(this.#catalog, stage, 'stage')) >= EXAM_SIZE,
      miniPassed: mini !== null && mini >= PASS_SCORE.mini,
    };
  }

  list(userId: string): ExamSummary[] {
    return EXAM_STAGES.map((stage) => this.#summary(userId, stage));
  }

  /** Tire les questions ; `null` si le palier est invalide ou trop pauvre en exercices. */
  start(stage: number, kind: ExamKind): ExamStartResponse | null {
    if (!ExamService.validStage(stage)) return null;
    const size = SIZE[kind];
    const lessons = eligible(this.#catalog, stage, kind);
    if (capacity(lessons) < size) return null;

    // Compétence -> leçons (chacune avec ses exercices mélangés et son compteur de tirages).
    const bySkill = new Map<SkillId, { lesson: Lesson; queue: number[]; taken: number }[]>();
    for (const lesson of shuffle(lessons, this.#random)) {
      const skill = this.#skillOf(lesson.id);
      const queue = shuffle(
        lesson.exercises.map((_, i) => i),
        this.#random,
      ).slice(0, MAX_PER_LESSON);
      bySkill.set(skill, [...(bySkill.get(skill) ?? []), { lesson, queue, taken: 0 }]);
    }

    // Tour de rôle entre compétences ; dans une compétence, la leçon la moins tirée d'abord.
    const picked: ExamQuestion[] = [];
    const skills = shuffle([...bySkill.keys()], this.#random);
    while (picked.length < size) {
      let progressed = false;
      for (const skill of skills) {
        if (picked.length >= size) break;
        const open = (bySkill.get(skill) ?? []).filter((e) => e.queue.length > 0);
        const least = Math.min(...open.map((e) => e.taken));
        const entry = open.find((e) => e.taken === least);
        const index = entry?.queue.shift();
        if (!entry || index === undefined) continue;
        entry.taken++;
        const exercise = this.#lessons.exerciseView(entry.lesson.id, index);
        if (!exercise) continue;
        picked.push({ lesson: entry.lesson.id, index, skill, exercise });
        progressed = true;
      }
      if (!progressed) return null;
    }
    return { stage, kind, questions: shuffle(picked, this.#random) };
  }

  /** Fin d'examen : garde le meilleur score (borné à la taille de l'examen). */
  result(
    userId: string,
    stage: number,
    kind: ExamKind,
    correct: number,
  ): ExamResultResponse | null {
    if (!ExamService.validStage(stage) || (kind === 'mini' && stage !== 1)) return null;
    const wasPassed = this.#passed(userId, stage, kind);
    this.#store.saveExamResult(userId, stage, kind, Math.max(0, Math.min(correct, SIZE[kind])));
    return {
      exam: this.#summary(userId, stage),
      passedNow: !wasPassed && this.#passed(userId, stage, kind),
    };
  }

  #passed(userId: string, stage: number, kind: ExamKind): boolean {
    const best = this.#store.examBest(userId, stage, kind);
    return best !== null && best >= PASS_SCORE[kind];
  }
}
