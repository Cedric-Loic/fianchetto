import {
  SESSION_MINUTES,
  SKILL_LABELS,
  type DailySession,
  type SessionStep,
  type SkillId,
} from '@sq/shared';
import type { NextStep } from './curriculum.js';

/*
 * Séance du jour (~28 min) : révisions dues (8) → étape du parcours (10) → puzzles sur la
 * compétence la plus faible (8) → bilan (2). Les étapes sans objet (aucune carte due, parcours
 * terminé) sont retirées et leur temps est reversé aux puzzles.
 */

export interface PlanInput {
  day: string;
  dueCards: number;
  next: NextStep | null;
  /** Compétence la plus faible (thème des puzzles du jour). */
  focus: SkillId | null;
  /** Étapes déjà faites aujourd'hui. */
  done: ReadonlySet<SessionStep['kind']>;
  /** Finale ou entraînement à proposer à la suite. */
  followUp: { label: string; href: string } | null;
}

const REVIEW_MIN = 8;
const STEP_MIN = 10;
const SUMMARY_MIN = 2;

export function stepHref(next: NextStep): string {
  const { step } = next;
  if (step.type === 'lesson') return `#/lessons/${step.id}`;
  if (step.type === 'endgame') return '#/endgames';
  return '#/openings';
}

export function planToday(input: PlanInput): DailySession {
  const steps: SessionStep[] = [];
  let budget = SESSION_MINUTES - SUMMARY_MIN;
  if (input.dueCards > 0) {
    steps.push({
      kind: 'reviews',
      label: `Réviser ${input.dueCards} carte${input.dueCards > 1 ? 's' : ''} (tes erreurs et exercices)`,
      minutes: REVIEW_MIN,
      href: '#/reviews',
      done: input.done.has('reviews'),
    });
    budget -= REVIEW_MIN;
  }
  if (input.next) {
    steps.push({
      kind: 'curriculum',
      label: `Parcours : ${input.next.module.title}`,
      minutes: STEP_MIN,
      href: stepHref(input.next),
      done: input.done.has('curriculum'),
    });
    budget -= STEP_MIN;
  }
  steps.push({
    kind: 'puzzles',
    label: input.focus ? `Puzzles : ${SKILL_LABELS[input.focus]}` : 'Puzzles du jour',
    minutes: Math.max(budget, 5),
    href: '#/puzzles',
    done: input.done.has('puzzles'),
  });
  steps.push({
    kind: 'summary',
    label: 'Bilan de la séance',
    minutes: SUMMARY_MIN,
    href: '#/coach',
    done: input.done.has('summary'),
  });
  return {
    day: input.day,
    minutes: steps.reduce((sum, s) => sum + s.minutes, 0),
    steps,
    focus: input.focus,
    followUp: input.followUp,
  };
}
