import type { Color, MoveClass, ReviewMove } from '@sq/shared';

/*
 * Temps de réflexion d'une partie (parties lentes, revue étape 2). Calcul pur à partir des
 * pendules relevées après chaque demi-coup (`ReviewInfo.clocks`) : aucun appel serveur.
 */

/** Coups « critiques » : ceux que la revue classe ?! (imprécision), ? (erreur) ou ?? (gaffe). */
const ERROR_CLASSES: readonly MoveClass[] = ['inaccuracy', 'mistake', 'blunder'];

/** Erreurs jouées au moins 1,5 fois plus vite que le reste : précipitation. */
export const RUSHED_RATIO = 1.5;
/** Erreurs ayant demandé au moins 1,2 fois le temps des autres coups : le temps a été pris. */
export const CAREFUL_RATIO = 1.2;
/** Nombre minimal de coups « autres » pour comparer (et d'erreurs : 1). */
const MIN_OTHERS = 2;
/** Plancher de la durée moyenne des erreurs, pour éviter un rapport démesuré (coups instantanés). */
const MIN_ERROR_MS = 500;

export type TimeVerdict = 'rushed' | 'careful' | 'even' | 'no-comparison';

export interface GroupTime {
  count: number;
  averageMs: number;
}

export interface TimeSpentSummary {
  /** Temps passé (ms) sur chacun de mes coups mesurables : demi-coup → durée. */
  perMove: { ply: number; ms: number; isError: boolean }[];
  totalMs: number;
  averageMs: number;
  errors: GroupTime | null;
  others: GroupTime | null;
  /** Temps moyen des autres coups divisé par celui des erreurs ; `null` sans comparaison. */
  ratio: number | null;
  verdict: TimeVerdict;
  message: string;
  /** Incrément utilisé pour le calcul (donné, sinon déduit des pendules). */
  incrementMs: number;
}

export interface TimeSpentOptions {
  /** Incrément de la cadence (ms) ; déduit des pendules s'il n'est pas fourni. */
  incrementMs?: number;
  /** Temps initial (ms) : permet de mesurer aussi le premier coup de chaque camp. */
  initialMs?: number;
}

const average = (values: readonly number[]): number =>
  values.reduce((a, b) => a + b, 0) / values.length;

/**
 * Incrément déduit des pendules d'un camp : la pendule ne remonte jamais de plus que l'incrément
 * (gain = incrément - temps passé), et un coup quasi instantané l'approche à la seconde près.
 */
export function inferIncrementMs(own: readonly (number | null)[]): number {
  let best = 0;
  for (let i = 1; i < own.length; i++) {
    const before = own[i - 1];
    const after = own[i];
    if (before != null && after != null) best = Math.max(best, after - before);
  }
  return Math.round(best / 1000) * 1000;
}

/** « 12 s », « 1 min 05 s » ; le dixième de seconde n'apporte rien à l'écran. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  if (total < 60) return `${total} s`;
  return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} s`;
}

/** « 2× », « 1,8× » : un chiffre après la virgule seulement s'il n'est pas rond. */
function times(ratio: number): string {
  const rounded = Math.round(ratio * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : String(rounded).replace('.', ',')}×`;
}

function messageFor(verdict: TimeVerdict, ratio: number | null, hasErrors: boolean): string {
  switch (verdict) {
    case 'rushed':
      return `Tu as joué tes erreurs ${times(ratio ?? RUSHED_RATIO)} plus vite que le reste : ralentis dans les positions tendues.`;
    case 'careful':
      return 'Tu as bien pris ton temps sur les moments critiques : tes erreurs ne viennent pas de la précipitation.';
    case 'even':
      return 'Ton rythme est le même sur tes erreurs et sur le reste : garde-le, et cherche plutôt ce que tu as oublié de regarder.';
    case 'no-comparison':
      return hasErrors
        ? 'Pas assez de coups pour comparer tes erreurs au reste de la partie.'
        : 'Aucune erreur à comparer : ton temps de réflexion est resté régulier.';
  }
}

/**
 * Temps passé sur chacun de mes coups, et comparaison entre mes erreurs (?!, ?, ??) et mes autres
 * coups. Le temps d'un coup est la pendule avant (après mon coup précédent) plus l'incrément
 * moins la pendule après. `null` si les pendules sont absentes, mon camp inconnu ou aucun coup
 * mesurable (le premier coup de chaque camp n'a pas de pendule « avant » sans `initialMs`).
 */
export function timeSpentSummary(
  moves: readonly ReviewMove[],
  clocks: readonly (number | null)[] | null | undefined,
  userColor: Color | null,
  options: TimeSpentOptions = {},
): TimeSpentSummary | null {
  if (!clocks || clocks.length === 0 || userColor === null) return null;
  const own = moves.filter((m) => m.color === userColor);
  const incrementMs =
    options.incrementMs ?? inferIncrementMs(own.map((m) => clocks[m.ply - 1] ?? null));

  const perMove: TimeSpentSummary['perMove'] = [];
  for (const move of own) {
    const after = clocks[move.ply - 1] ?? null;
    // Pendule du même camp avant son coup : son coup précédent, sinon le temps initial.
    const before = move.ply >= 3 ? (clocks[move.ply - 3] ?? null) : (options.initialMs ?? null);
    if (before === null || after === null) continue;
    perMove.push({
      ply: move.ply,
      ms: Math.max(0, before + incrementMs - after),
      isError: ERROR_CLASSES.includes(move.classification),
    });
  }
  if (perMove.length === 0) return null;

  const group = (list: readonly number[]): GroupTime | null =>
    list.length === 0 ? null : { count: list.length, averageMs: average(list) };
  const errors = group(perMove.filter((m) => m.isError).map((m) => m.ms));
  const others = group(perMove.filter((m) => !m.isError).map((m) => m.ms));

  let ratio: number | null = null;
  let verdict: TimeVerdict = 'no-comparison';
  if (errors && others && others.count >= MIN_OTHERS) {
    const errorMs = Math.max(errors.averageMs, MIN_ERROR_MS);
    ratio = others.averageMs / errorMs;
    if (ratio >= RUSHED_RATIO) verdict = 'rushed';
    else if (errorMs >= others.averageMs * CAREFUL_RATIO) verdict = 'careful';
    else verdict = 'even';
  }

  const totalMs = perMove.reduce((sum, m) => sum + m.ms, 0);
  return {
    perMove,
    totalMs,
    averageMs: totalMs / perMove.length,
    errors,
    others,
    ratio,
    verdict,
    message: messageFor(verdict, ratio, errors !== null),
    incrementMs,
  };
}
