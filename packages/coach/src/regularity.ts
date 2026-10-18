import type { GuardPolicy, MonthVerdict } from '@sq/shared';

/*
 * Étape 13 — Régularité : thème du jour, garde-fou dégressif, niveau de bot conseillé, objectif
 * Elo interpolé. Fonctions pures, déterministes, sans I/O. Seuils tracés dans docs/DECISIONS.md.
 */

/** Thèmes de puzzles travaillés à chaque phase du plan (docs/PLAN-COACH.md, §3). */
export const PHASE_THEMES: Readonly<Record<1 | 2 | 3 | 4, readonly string[]>> = {
  1: [
    'hangingPiece',
    'fork',
    'pin',
    'mateIn1',
    'skewer',
    'mateIn2',
    'backRankMate',
    'trappedPiece',
  ],
  2: [
    'discoveredAttack',
    'deflection',
    'attraction',
    'capturingDefender',
    'intermezzo',
    'mateIn3',
    'long',
    'pawnEndgame',
  ],
  3: [
    'rookEndgame',
    'endgame',
    'exposedKing',
    'kingsideAttack',
    'advancedPawn',
    'quietMove',
    'defensiveMove',
  ],
  // Phase 4 : programme personnalisé, on puise dans tous les thèmes, les faibles en priorité.
  4: [
    'fork',
    'pin',
    'skewer',
    'discoveredAttack',
    'deflection',
    'intermezzo',
    'mateIn3',
    'endgame',
    'rookEndgame',
    'exposedKing',
  ],
};

export interface ThemeOfDayInput {
  phase: number;
  /** Thèmes les moins réussis, avec leur taux de réussite en % (tableau de bord). */
  weakThemes: readonly { theme: string; rate: number }[];
  /** Jour concerné (heure locale) : `Date` ou instant en ms. */
  date: Date | number;
}

/** Numéro de jour (jours depuis le 1er janvier 1970) de la date locale. */
function localDayNumber(date: Date | number): number {
  const d = new Date(date);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

/**
 * Thème du jour : rotation sur les thèmes de la phase courante, avec un poids supplémentaire pour
 * les thèmes faibles (taux de réussite < 70 %) : poids = 1 + arrondi((70 − taux) / 15), donc 4 à
 * 0 % de réussite. Les thèmes faibles d'une autre phase entrent aussi dans la rotation (révision).
 * Tourniquet pondéré « lisse » : un thème de poids 3 revient 3 fois par cycle, sans s'enchaîner.
 * Déterministe : même date, même phase et mêmes faiblesses → même thème.
 */
export function themeOfDay({ phase, weakThemes, date }: ThemeOfDayInput): string {
  const key = (Math.min(4, Math.max(1, Math.round(phase))) || 1) as 1 | 2 | 3 | 4;
  const weights = new Map<string, number>(PHASE_THEMES[key].map((t) => [t, 1]));
  for (const { theme, rate } of weakThemes) {
    if (rate >= 70) continue;
    weights.set(theme, 1 + Math.round((70 - Math.max(0, rate)) / 15));
  }
  const entries = [...weights.entries()];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  // Tourniquet pondéré lisse (celui de nginx) : on rejoue le cycle jusqu'au jour voulu.
  const step = ((localDayNumber(date) % total) + total) % total;
  const current = entries.map(() => 0);
  let pick = 0;
  for (let i = 0; i <= step; i++) {
    pick = 0;
    entries.forEach(([, w], j) => {
      current[j] = (current[j] ?? 0) + w;
      if ((current[j] ?? 0) > (current[pick] ?? 0)) pick = j;
    });
    current[pick] = (current[pick] ?? 0) - total;
  }
  return entries[pick]?.[0] ?? 'fork';
}

/** Politique du garde-fou selon la phase : toujours, une partie sur deux, puis coupé. */
export function guardPolicy(phase: number): GuardPolicy {
  if (phase <= 1) return 'always';
  if (phase === 2) return 'alternate';
  return 'off';
}

/**
 * Garde-fou actif pour la partie n° `gameIndex` (0 = première partie d'entraînement classique) ?
 * En phase 2, actif sur les parties d'indice pair.
 */
export function guardActive(phase: number, gameIndex: number): boolean {
  const policy = guardPolicy(phase);
  return policy === 'always' || (policy === 'alternate' && gameIndex % 2 === 0);
}

export interface BotResult {
  /** Niveau du bot classique (1 à 5). */
  level: number;
  /** Score du joueur : 1 victoire, 0,5 nulle, 0 défaite. */
  score: number;
  /** Instant de fin de partie (ms). */
  at: number;
}

/** Fenêtre du score glissant et nombre minimal de parties avant de changer de niveau. */
export const BOT_WINDOW = 10;
export const BOT_MIN_GAMES = 3;

/**
 * Niveau de bot conseillé : on part du niveau de la partie la plus récente et on calcule le score
 * sur ses `BOT_WINDOW` dernières parties à ce niveau. Plus de 60 % : un cran au-dessus ; moins de
 * 40 % : un cran en dessous ; sinon on reste (moins de `BOT_MIN_GAMES` parties : on reste aussi).
 * `null` sans aucune partie.
 */
export function suggestBotLevel(results: readonly BotResult[]): number | null {
  const sorted = [...results].sort((a, b) => a.at - b.at);
  const last = sorted.at(-1);
  if (!last) return null;
  const level = Math.min(5, Math.max(1, Math.round(last.level)));
  const window = sorted.filter((r) => Math.round(r.level) === level).slice(-BOT_WINDOW);
  if (window.length < BOT_MIN_GAMES) return level;
  const rate = (100 * window.reduce((sum, r) => sum + r.score, 0)) / window.length;
  if (rate > 60) return Math.min(5, level + 1);
  if (rate < 40) return Math.max(1, level - 1);
  return level;
}

/** Elo de départ du plan par cadence chess.com, et paliers visés. */
export const ELO_START = { rapid: 950, blitz: 1000 } as const;
export const ELO_AT_6_MONTHS = 1300;
export const ELO_AT_12_MONTHS = 1600;
/** Écart toléré autour de l'objectif pour « dans les temps ». */
export const VERDICT_MARGIN = 50;

/**
 * Elo visé `months` mois après le premier mois mesuré : interpolation linéaire du départ du plan
 * à 1300 au 6e mois, puis de 1300 à 1600 au 12e mois, 1600 ensuite.
 */
export function eloTarget(cadence: 'rapid' | 'blitz', months: number): number {
  const start = ELO_START[cadence];
  const m = Math.max(0, months);
  if (m <= 6) return Math.round(start + ((ELO_AT_6_MONTHS - start) * m) / 6);
  if (m <= 12)
    return Math.round(ELO_AT_6_MONTHS + ((ELO_AT_12_MONTHS - ELO_AT_6_MONTHS) * (m - 6)) / 6);
  return ELO_AT_12_MONTHS;
}

/** En avance (≥ objectif + 50), dans les temps (à 50 points près), sinon en retard. */
export function monthVerdict(elo: number | null, target: number | null): MonthVerdict | null {
  if (elo === null || target === null) return null;
  if (elo >= target + VERDICT_MARGIN) return 'ahead';
  if (elo >= target - VERDICT_MARGIN) return 'on-track';
  return 'behind';
}
