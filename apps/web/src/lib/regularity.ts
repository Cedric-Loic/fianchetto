import {
  DAILY_MINUTES_GOAL,
  DAILY_PUZZLE_GOAL,
  TIME_CONTROLS,
  type CoachDashboard,
  type MonthVerdict,
  type TimeControlId,
} from '@sq/shared';

/** Partie lente (15 | 10, 30 min) : contre le bot seulement, jamais classée. */
export function isSlowTimeControl(id: TimeControlId): boolean {
  return TIME_CONTROLS[id].slow;
}

/**
 * Cadences concernées par le verrou souple « pas de blitz avant les puzzles du jour » : le blitz
 * et le bullet, jamais les parties lentes (qui sont justement un travail de fond).
 */
export function isFastTimeControl(id: TimeControlId): boolean {
  if (isSlowTimeControl(id)) return false;
  const category = TIME_CONTROLS[id].category;
  return category === 'blitz' || category === 'bullet';
}

/** `#/?slow=1` (lien de la séance du jour) : l'accueil présélectionne une partie lente. */
export function wantsSlowGame(hash: string): boolean {
  const query = /^#\/?\?(.*)$/.exec(hash)?.[1];
  return query !== undefined && query.split('&').includes('slow=1');
}

/** Le verrou s'applique-t-il à cette cadence (tableau de bord chargé, journée non validée) ? */
export function blitzLockApplies(data: CoachDashboard | null, id: TimeControlId): boolean {
  return Boolean(data?.blitzLocked) && isFastTimeControl(id);
}

export const VERDICT_LABEL: Record<MonthVerdict, string> = {
  ahead: 'En avance',
  'on-track': 'Dans les temps',
  behind: 'En retard',
};

/** « 1 jour », « 3 jours ». */
export const days = (n: number) => `${n} jour${n > 1 ? 's' : ''}`;

/** « 1 h 05 », « 3 h », « 45 min ». */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  if (min % 60 === 0) return `${min / 60} h`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

/**
 * Objectif du jour : avancement (0 à 1) sur le meilleur des deux critères (puzzles ou minutes),
 * et résumé lisible.
 */
export function dailyGoal(streak: CoachDashboard['streak']): { ratio: number; text: string } {
  const ratio = streak.todayDone
    ? 1
    : Math.min(
        1,
        Math.max(streak.todayPuzzles / DAILY_PUZZLE_GOAL, streak.todayMinutes / DAILY_MINUTES_GOAL),
      );
  const text = streak.todayDone
    ? 'Journée validée'
    : `${streak.todayPuzzles} / ${DAILY_PUZZLE_GOAL} puzzles ou ${streak.todayMinutes} / ${DAILY_MINUTES_GOAL} min`;
  return { ratio, text };
}
