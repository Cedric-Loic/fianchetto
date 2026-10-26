import {
  CURRICULUM,
  ENDGAMES,
  OPENING_LINES,
  PASS_RATIO,
  computeSkills,
  lessonById,
  newCardSchedule,
  nextCardSchedule,
  nextStep,
  openingLearned,
  planToday,
  skillForKind,
  skillForTheme,
  stepDone,
  weakestSkill,
  type CurriculumProgress,
  type SkillEvidence,
  type StepRef,
} from '@sq/coach';
import {
  DAILY_PUZZLE_GOAL,
  SKILL_FOR_THEME,
  type CardsResponse,
  type CurriculumResponse,
  type CurriculumStep,
  type DailySession,
  type ReviewCard,
  type SessionStep,
  type SkillId,
  type SkillLevel,
} from '@sq/shared';
import type { GameStore } from '../persistence/db.js';
import { REVIEW_INTERVALS_DAYS } from '../persistence/puzzles.js';

/** Parties revues prises en compte pour les erreurs de la compétence. */
const REVIEWED_GAMES = 20;

/** Au-delà, une réussite compte de nouveau comme un essai « du premier coup ». */
const RETRY_WINDOW_MS = 30 * 60_000;

/** Jour local « 2026-10-26 ». */
export function dayOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Adresse web d'une étape du parcours (mêmes conventions que `stepHref` du coach). */
function hrefOf(step: StepRef): string {
  if (step.type === 'lesson') return `#/lessons/${step.id}`;
  return step.type === 'endgame' ? '#/endgames' : '#/openings';
}

/** Compétence d'une leçon : celle du module du parcours qui la contient ('method' sinon). */
export function skillOfLesson(lessonId: string): SkillId {
  return (
    CURRICULUM.find((m) => m.steps.some((s) => s.type === 'lesson' && s.id === lessonId))?.skill ??
    'method'
  );
}

/**
 * Coach pédagogique (étape 14) : compétences, parcours, cartes de révision et séance du jour.
 * Tout est alimenté côté serveur (jugement des exercices et des puzzles « mes erreurs ») ; rien
 * ici ne touche une partie en cours.
 */
export class LearningService {
  readonly #store: GameStore;
  readonly #phaseOf: (userId: string) => number;
  readonly #now: () => number;
  readonly #lesson: typeof lessonById;
  /** Exercices échoués pendant l'essai en cours (« du premier coup » = sans échec préalable). */
  readonly #failed = new Map<string, number>();

  constructor(
    store: GameStore,
    options: {
      phaseOf: (userId: string) => number;
      now?: () => number;
      /** Recherche d'une leçon (injectable pour les tests). */
      lesson?: typeof lessonById;
    },
  ) {
    this.#store = store;
    this.#phaseOf = options.phaseOf;
    this.#now = options.now ?? Date.now;
    this.#lesson = options.lesson ?? lessonById;
  }

  // --- Alimentation ----------------------------------------------------------------------------

  /** Planification d'une carte après un jugement ; une réussite n'avance que si elle est due. */
  #schedule(
    userId: string,
    source: 'exercise' | 'mistake',
    ref: string,
    skill: SkillId,
    ok: boolean,
    hinted = false,
  ) {
    const now = this.#now();
    const card = this.#store.getCard(userId, source, ref);
    if (!card) {
      this.#store.saveCard(userId, { source, ref, skill, ...newCardSchedule(now) }, now, false);
    } else if (!ok) {
      this.#store.saveCard(userId, { source, ref, skill, ...newCardSchedule(now) }, now, true);
    } else if (card.dueAt <= now) {
      // Réussite avec indice : la carte repart de l'étape 0 (revient demain).
      const next = hinted ? newCardSchedule(now) : nextCardSchedule(card.step, true, now);
      this.#store.saveCard(userId, { source, ref, skill, ...next }, now, true);
    }
  }

  /** Exercice de leçon jugé (`solved` ou `failed`). */
  recordExercise(
    userId: string,
    lessonId: string,
    index: number,
    solved: boolean,
    hints = 0,
  ): void {
    const key = `${userId}|${lessonId}|${index}`;
    const failedAt = this.#failed.get(key);
    const retry = failedAt !== undefined && this.#now() - failedAt < RETRY_WINDOW_MS;
    if (!solved) this.#failed.set(key, this.#now());
    else {
      this.#failed.delete(key);
      if (retry) return; // l'échec préalable est déjà enregistré
    }
    this.#store.recordExerciseAttempt({
      userId,
      lessonId,
      index,
      success: solved,
      hints,
      at: this.#now(),
    });
    this.#schedule(
      userId,
      'exercise',
      `${lessonId}:${index}`,
      skillOfLesson(lessonId),
      solved,
      hints > 0,
    );
  }

  /** Question de partie coachée : preuve de compétence seulement, aucune carte de révision. */
  recordCoachPrompt(
    userId: string,
    gameId: string,
    ply: number,
    kind: 'threat' | 'chance',
    correct: boolean,
  ): void {
    this.#store.recordCoachPrompt({ userId, gameId, ply, kind, correct, at: this.#now() });
  }

  /** Puzzle « mes erreurs » jugé. */
  recordOwnPuzzle(userId: string, puzzleId: string, success: boolean): void {
    const own = this.#store.puzzles.getOwn(puzzleId);
    if (!own || own.userId !== userId) return;
    const skill = own.kind ? skillForKind(own.kind) : 'method';
    this.#schedule(userId, 'mistake', puzzleId, skill, success);
  }

  // --- Compétences -----------------------------------------------------------------------------

  skills(userId: string): SkillLevel[] {
    const evidence: SkillEvidence[] = [];
    for (const a of this.#store.puzzles.attempts(userId)) {
      const success = a.success === 1;
      const words = a.themes.trim().split(/\s+/).filter(Boolean);
      const skills = new Set<SkillId>(
        a.source === 'mine'
          ? words.map(skillForKind)
          : words.filter((t) => t in SKILL_FOR_THEME).map(skillForTheme),
      );
      if (skills.size === 0 && a.source !== 'mine') skills.add('calculation');
      for (const skill of skills) evidence.push({ skill, success, at: a.at });
    }
    for (const a of this.#store.exerciseAttempts(userId)) {
      evidence.push({ skill: skillOfLesson(a.lessonId), success: a.success, at: a.at });
    }
    for (const p of this.#store.coachPrompts(userId)) {
      const skill: SkillId = p.kind === 'threat' ? 'threats' : 'piece-safety';
      evidence.push({ skill, success: p.correct, at: p.at });
    }
    evidence.push(...this.#reviewEvidence(userId));
    return computeSkills(evidence, this.#now());
  }

  /** Erreurs (échecs) des 20 dernières parties revues, par type d'erreur du joueur. */
  #reviewEvidence(userId: string): SkillEvidence[] {
    const games: { id: string; color: 'w' | 'b'; at: number }[] = [];
    for (const row of this.#store.listImported(userId)) {
      if (row.userColor) games.push({ id: row.id, color: row.userColor, at: 0 });
    }
    for (const g of this.#store.history(userId)) {
      if (g.mode === 'bot') games.push({ id: g.gameId, color: g.color, at: 0 });
    }
    const reviewed = games.flatMap((g) => {
      const at = this.#store.reviewDate(g.id);
      return at === null ? [] : [{ ...g, at }];
    });
    reviewed.sort((a, b) => b.at - a.at);
    const out: SkillEvidence[] = [];
    for (const g of reviewed.slice(0, REVIEWED_GAMES)) {
      const review = this.#store.getReview(g.id);
      for (const m of review?.moves ?? []) {
        if (m.color === g.color && m.explanation) {
          out.push({ skill: skillForKind(m.explanation.kind), success: false, at: g.at });
        }
      }
    }
    return out;
  }

  // --- Parcours --------------------------------------------------------------------------------

  #progress(userId: string): CurriculumProgress {
    const lessons = new Set(
      this.#store
        .lessonProgress(userId)
        .filter((p) => {
          const l = lessonById(p.lessonId);
          return l && p.best >= Math.ceil(PASS_RATIO * l.exercises.length);
        })
        .map((p) => p.lessonId),
    );
    const endgames = new Set(
      this.#store
        .endgameProgress(userId)
        .filter((p) => p.successes > 0)
        .map((p) => p.endgameId),
    );
    const openings = new Set(
      this.#store
        .openingProgress(userId)
        .filter((r) => openingLearned(r, REVIEW_INTERVALS_DAYS))
        .map((r) => r.lineId),
    );
    return { lessons, endgames, openings };
  }

  #titleOf(step: StepRef): string {
    if (step.type === 'lesson') return lessonById(step.id)?.title ?? step.id;
    if (step.type === 'endgame') return ENDGAMES.find((e) => e.id === step.id)?.title ?? step.id;
    return OPENING_LINES.find((o) => o.id === step.id)?.title ?? step.id;
  }

  #view(step: StepRef, progress: CurriculumProgress): CurriculumStep {
    return {
      type: step.type,
      id: step.id,
      title: this.#titleOf(step),
      href: hrefOf(step),
      done: stepDone(step, progress),
    };
  }

  curriculum(userId: string): CurriculumResponse {
    const progress = this.#progress(userId);
    const phase = this.#phaseOf(userId);
    const next = nextStep(progress, this.skills(userId), phase);
    return {
      phase,
      modules: CURRICULUM.map((m) => ({
        id: m.id,
        phase: m.phase,
        title: m.title,
        skill: m.skill,
        steps: m.steps.map((s) => this.#view(s, progress)),
      })),
      next: next && { moduleId: next.module.id, step: this.#view(next.step, progress) },
    };
  }

  // --- Cartes ----------------------------------------------------------------------------------

  cards(userId: string): CardsResponse {
    const now = this.#now();
    const all = this.#store.cards(userId);
    const due: ReviewCard[] = [];
    for (const c of all) {
      if (c.dueAt > now) continue;
      const resolved = this.#resolve(userId, c.source, c.ref);
      if (!resolved) continue; // la source a disparu
      due.push({
        id: c.id,
        ref: c.ref,
        source: c.source as ReviewCard['source'],
        skill: c.skill as SkillId,
        ...resolved,
        step: c.step,
        dueAt: c.dueAt,
        mastered: c.mastered,
      });
    }
    return { due, total: all.length, mastered: all.filter((c) => c.mastered).length };
  }

  #resolve(userId: string, source: string, ref: string): { fen: string; prompt: string } | null {
    if (source === 'exercise') {
      const [lessonId = '', index = ''] = ref.split(':');
      const exercise = this.#lesson(lessonId)?.exercises[Number(index)];
      return exercise ? { fen: exercise.fen, prompt: exercise.prompt } : null;
    }
    if (source === 'mistake') {
      const own = this.#store.puzzles.getOwn(ref);
      return own && own.userId === userId ? { fen: own.fen, prompt: own.label } : null;
    }
    return null;
  }

  dueCount(userId: string): number {
    return this.cards(userId).due.length;
  }

  // --- Séance du jour --------------------------------------------------------------------------

  session(userId: string): DailySession {
    const now = this.#now();
    const day = dayOf(now);
    const phase = this.#phaseOf(userId);
    const skills = this.skills(userId);
    const progress = this.#progress(userId);
    const next = nextStep(progress, skills, phase);
    const open = CURRICULUM.filter(
      (m) => m.phase <= phase && m.steps.some((s) => !stepDone(s, progress)),
    ).map((m) => m.skill);
    const focus = weakestSkill(skills, open);

    const done = new Set(this.#store.sessionStepsDone(userId, day) as SessionStep['kind'][]);
    const today = (at: number) => dayOf(at) === day;
    const puzzlesToday = this.#store.puzzles.attempts(userId).filter((a) => today(a.at)).length;
    if (puzzlesToday >= DAILY_PUZZLE_GOAL) done.add('puzzles');
    if (this.#store.cards(userId).some((c) => c.reviewedAt !== null && today(c.reviewedAt))) {
      done.add('reviews');
    }
    if (this.#store.exerciseAttempts(userId).some((a) => today(a.at))) done.add('curriculum');

    const endgame = CURRICULUM.filter((m) => m.phase <= phase)
      .flatMap((m) => m.steps)
      .find((s) => s.type === 'endgame' && !stepDone(s, progress));
    return planToday({
      day,
      dueCards: this.dueCount(userId),
      next,
      focus,
      done,
      followUp: endgame
        ? { label: `Finale : ${this.#titleOf(endgame)}`, href: hrefOf(endgame) }
        : null,
    });
  }

  markStep(userId: string, kind: string): DailySession {
    this.#store.markSessionStep(userId, dayOf(this.#now()), kind);
    return this.session(userId);
  }
}
