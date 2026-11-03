import { CARD_INTERVALS_DAYS, CARD_MASTERED_STEP } from '@sq/shared';

/*
 * Répétition espacée des cartes de révision : un succès avance d'un cran (1, 3, 7, 21, 60 jours),
 * un échec renvoie au premier cran (demain). La carte est maîtrisée après CARD_MASTERED_STEP
 * succès d'affilée ; elle revient alors rarement (cran suivant) sans disparaître.
 */

const DAY_MS = 86_400_000;

export interface CardSchedule {
  step: number;
  dueAt: number;
  mastered: boolean;
}

export function nextCardSchedule(step: number, success: boolean, now: number): CardSchedule {
  const next = success ? Math.min(step + 1, CARD_INTERVALS_DAYS.length) : 0;
  const days = CARD_INTERVALS_DAYS[Math.min(next, CARD_INTERVALS_DAYS.length - 1)]!;
  return { step: next, dueAt: now + days * DAY_MS, mastered: next >= CARD_MASTERED_STEP };
}

/** Nouvelle carte : à revoir dès demain. */
export function newCardSchedule(now: number): CardSchedule {
  return { step: 0, dueAt: now + CARD_INTERVALS_DAYS[0] * DAY_MS, mastered: false };
}
