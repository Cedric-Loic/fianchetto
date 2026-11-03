import { create } from 'zustand';

/**
 * Série de réussites consécutives (puzzles et exercices des leçons) pour la session en cours :
 * gardée en mémoire seulement, remise à zéro au rechargement de la page.
 */
export interface Streak {
  current: number;
  best: number;
}

/** Série après un résultat : +1 sur une réussite, retour à zéro sur un échec. */
export function nextStreak(streak: Streak, solved: boolean): Streak {
  const current = solved ? streak.current + 1 : 0;
  return { current, best: Math.max(streak.best, current) };
}

export const useStreak = create<Streak & { record: (solved: boolean) => void }>((set, get) => ({
  current: 0,
  best: 0,
  record(solved) {
    set(nextStreak(get(), solved));
  },
}));
