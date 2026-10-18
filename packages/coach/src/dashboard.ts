import { Chess } from 'chess.js';
import {
  DAILY_MINUTES_GOAL,
  DAILY_PUZZLE_GOAL,
  PUZZLE_THEME_FOR_KIND,
  WEEKLY_MINUTES_TARGET,
  PUZZLE_THEME_LABELS,
  type CoachDashboard,
  type Color,
  type GameReview,
  type MonthStats,
  type Point,
  type Recommendation,
  type Series,
  type Target,
  type WeeklyTask,
} from '@sq/shared';
import {
  eloTarget,
  guardPolicy,
  monthVerdict,
  suggestBotLevel,
  themeOfDay,
  type BotResult,
} from './regularity.js';

/*
 * Tableau de bord du coach (étape 11), calculé à partir de données déjà agrégées : logique pure,
 * testable sans serveur. Les règles (objectifs, critères de phase) suivent docs/PLAN-COACH.md.
 */

export type TimeClass = 'bullet' | 'blitz' | 'rapid' | 'daily';

export interface DashboardGame {
  id: string;
  /** Date de la partie, « AAAA-MM-JJ ». */
  date: string;
  color: Color;
  review: GameReview | null;
  /** Instant de la revue (ms), `null` si la partie n'est pas analysée. */
  reviewedAt: number | null;
  /** Partie lente (10 min ou plus, ou sans pendule). */
  slow: boolean;
  source: 'local' | 'pgn' | 'chesscom';
  timeClass: TimeClass | null;
  /** Elo du joueur au moment de la partie (en-têtes PGN), si connu. */
  userElo: number | null;
  /** Durée réelle de la partie (ms), si connue (étape 13, optionnel). */
  durationMs?: number | null;
}

export interface DashboardInput {
  now: Date;
  games: DashboardGame[];
  puzzleAttempts: {
    at: number;
    success: boolean;
    ratingAfter: number | null;
    themes: string;
    /** Temps passé sur le puzzle (ms), si connu (étape 13, optionnel). */
    durationMs?: number | null;
  }[];
  puzzleRating: number;
  lessons: {
    id: string;
    phase: number;
    title: string;
    passed: boolean;
    updatedAt: number | null;
  }[];
  classicRatings: { date: string; rating: number }[];
  duePuzzles: number;
  ownPuzzles: number;
  /*
   * Étape 13 — entrées optionnelles (repli documenté sur `estimateActivity` si absentes).
   */
  /** Instants (ms) de chaque séance de leçon ; à défaut, `lessons[].updatedAt`. */
  lessonSessions?: number[];
  /** Instants (ms) où le joueur a ouvert une revue ou une analyse ; à défaut, `reviewedAt`. */
  analysisSessions?: number[];
  /** Résultats des parties classiques contre le bot (niveau suggéré). */
  botResults?: BotResult[];
  /** Finales contre le bot (lot 4b), dans l'ordre de la bibliothèque. */
  endgames?: { id: string; title: string; passed: boolean }[];
}

/** Minutes estimées par activité quand la durée réelle n'est pas connue. */
export const ACTIVITY_MINUTES = {
  puzzle: 1.5,
  /** Partie lente sans durée connue (15+10 ou sans pendule) ; correspondance : 10. */
  slowGame: 30,
  dailyGame: 10,
  analysis: 10,
  lesson: 20,
} as const;
/** Analyses comptées au plus par jour quand seule la date de revue est connue (analyses en lot). */
const MAX_FALLBACK_ANALYSES_PER_DAY = 2;

/**
 * Activité d'entraînement par jour (clé « AAAA-MM-JJ », heure locale) : minutes estimées et
 * nombre de puzzles. Estimation :
 * - puzzle : durée réelle (plafonnée à 10 min) sinon 1,5 min ;
 * - partie lente (`slow`) : durée réelle (plafonnée à 2 h) sinon 30 min (10 min en correspondance) ;
 *   le blitz et le bullet ne comptent pas (facultatifs dans le plan) ;
 * - analyse : 10 min par séance (`analysisSessions`) ; à défaut, 10 min par revue terminée, au
 *   plus 2 par jour (une analyse en lot ne vaut pas des heures d'étude) ;
 * - leçon : 20 min par séance (`lessonSessions`) ; à défaut, à la date de dernière mise à jour.
 */
export function estimateActivity(
  input: DashboardInput,
): Map<string, { minutes: number; puzzles: number }> {
  const days = new Map<string, { minutes: number; puzzles: number }>();
  const add = (day: string, minutes: number, puzzles = 0) => {
    const d = days.get(day) ?? { minutes: 0, puzzles: 0 };
    d.minutes += minutes;
    d.puzzles += puzzles;
    days.set(day, d);
  };
  const real = (ms: number | null | undefined, capMinutes: number) =>
    ms != null && ms > 0 ? Math.min(capMinutes, ms / 60_000) : null;
  for (const a of input.puzzleAttempts) {
    add(iso(new Date(a.at)), real(a.durationMs, 10) ?? ACTIVITY_MINUTES.puzzle, 1);
  }
  for (const g of input.games) {
    if (!g.slow) continue;
    const fallback =
      g.timeClass === 'daily' ? ACTIVITY_MINUTES.dailyGame : ACTIVITY_MINUTES.slowGame;
    add(g.date, real(g.durationMs, 120) ?? fallback);
  }
  if (input.analysisSessions) {
    for (const at of input.analysisSessions) add(iso(new Date(at)), ACTIVITY_MINUTES.analysis);
  } else {
    const perDay = new Map<string, number>();
    for (const g of input.games) {
      if (g.reviewedAt === null) continue;
      const day = iso(new Date(g.reviewedAt));
      const n = perDay.get(day) ?? 0;
      if (n >= MAX_FALLBACK_ANALYSES_PER_DAY) continue;
      perDay.set(day, n + 1);
      add(day, ACTIVITY_MINUTES.analysis);
    }
  }
  const lessonTimes =
    input.lessonSessions ??
    input.lessons.flatMap((l) => (l.updatedAt === null ? [] : [l.updatedAt]));
  for (const at of lessonTimes) add(iso(new Date(at)), ACTIVITY_MINUTES.lesson);
  return days;
}

/** Jour validé : assez de puzzles, ou assez de minutes d'entraînement. */
const dayDone = (d: { minutes: number; puzzles: number } | undefined) =>
  !!d && (d.puzzles >= DAILY_PUZZLE_GOAL || d.minutes >= DAILY_MINUTES_GOAL);

/** Numéro de jour d'une date « AAAA-MM-JJ » (pour compter des jours consécutifs). */
const dayNumber = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Math.round(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / 86_400_000);
};

/** Série en cours (aujourd'hui compris s'il est validé, sinon jusqu'à hier) et meilleure série. */
export function computeStreak(
  activity: Map<string, { minutes: number; puzzles: number }>,
  now: Date,
): { current: number; best: number; todayDone: boolean } {
  const done = new Set(
    [...activity.entries()].filter(([, d]) => dayDone(d)).map(([day]) => dayNumber(day)),
  );
  const today = dayNumber(iso(now));
  const todayDone = done.has(today);
  let current = 0;
  for (let day = todayDone ? today : today - 1; done.has(day); day--) current++;
  let best = 0;
  let run = 0;
  let previous = Number.NaN;
  for (const day of [...done].filter((d) => d <= today).sort((a, b) => a - b)) {
    run = day === previous + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return { current, best: Math.max(best, current), todayDone };
}

const PHASES = [
  { title: 'Ne plus rien donner', focus: 'Routine anti-gaffe, tactiques de base, mats de base.' },
  {
    title: 'Calculer et punir',
    focus: 'Tactiques en 2-3 coups, répertoire simple, finales de pions.',
  },
  { title: 'Jouer avec un plan', focus: 'Activité des pièces, structures, finales de tours.' },
  { title: 'Programme personnalisé', focus: 'Tes faiblesses mesurées, en priorité.' },
] as const;

/** Thème de puzzle à travailler pour chaque type d'erreur. */
const THEME_FOR_KIND: Record<string, string | undefined> = PUZZLE_THEME_FOR_KIND;

/** Thèmes de puzzles suivis pour repérer les faiblesses tactiques. */
const TRACKED_THEMES = new Set([
  'hangingPiece',
  'fork',
  'pin',
  'skewer',
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'discoveredAttack',
  'backRankMate',
  'deflection',
  'attraction',
  'trappedPiece',
]);

const KIND_LABEL: Record<string, string> = {
  'hanging-piece': 'pièces laissées en prise',
  'missed-material': 'gains de matériel manqués',
  'allowed-fork': 'fourchettes permises',
  'missed-fork': 'fourchettes manquées',
  'allowed-mate': 'mats permis',
  'missed-mate': 'mats manqués',
  'material-loss': 'pertes de matériel',
  generic: 'mauvais choix de plan',
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmt = (x: number, digits = 1) => x.toFixed(digits).replace('.', ',');
const average = (xs: readonly number[]) =>
  xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;

/** Lundi 0 h (heure locale) de la semaine de `now`. */
export function weekStart(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Cadence chess.com d'après l'en-tête PGN TimeControl (« 180+2 », « 600 », « 1/86400 »). */
export function timeClassOf(timeControl: string | null): TimeClass | null {
  if (!timeControl) return null;
  if (timeControl.includes('/')) return 'daily';
  const base = Number(timeControl.split('+')[0]);
  const increment = Number(timeControl.split('+')[1] ?? 0);
  if (!Number.isFinite(base)) return null;
  const estimate = base + 40 * (Number.isFinite(increment) ? increment : 0);
  return estimate < 180 ? 'bullet' : estimate < 600 ? 'blitz' : 'rapid';
}

/** Statistiques du joueur dans une partie analysée. */
function userStats(game: DashboardGame) {
  const review = game.review as GameReview;
  const counts = review.counts[game.color];
  return {
    accuracy: review.accuracy[game.color],
    blunder: counts.blunder,
    mistake: counts.mistake,
    inaccuracy: counts.inaccuracy,
  };
}

/** Phase de jeu d'une position : ouverture (10 premiers coups), finale (peu de pièces), sinon milieu. */
function gamePhase(fen: string, ply: number): 'opening' | 'middlegame' | 'endgame' {
  if (ply <= 20) return 'opening';
  const value: Record<string, number> = { n: 3, b: 3, r: 5, q: 9 };
  let material = 0;
  for (const row of new Chess(fen).board()) {
    for (const p of row) if (p) material += value[p.type] ?? 0;
  }
  return material <= 26 ? 'endgame' : 'middlegame';
}

export function buildDashboard(input: DashboardInput): CoachDashboard {
  const { now } = input;
  const start = weekStart(now);
  const startMs = start.getTime();
  const startIso = iso(start);

  // Parties analysées du joueur, les plus récentes d'abord.
  const analysed = input.games
    .filter((g) => g.review !== null)
    .sort((a, b) => b.date.localeCompare(a.date));
  const recent = analysed.slice(0, 20);
  const last10 = analysed.slice(0, 10);
  const first10 = analysed.slice(-10);
  const perGame = (games: DashboardGame[]) => {
    if (games.length === 0) return null;
    const stats = games.map(userStats);
    return {
      blunder: average(stats.map((s) => s.blunder)) ?? 0,
      mistake: average(stats.map((s) => s.mistake)) ?? 0,
      inaccuracy: average(stats.map((s) => s.inaccuracy)) ?? 0,
      accuracy: average(stats.flatMap((s) => (s.accuracy === null ? [] : [s.accuracy]))),
    };
  };
  const recentStats = perGame(recent);
  const last10Stats = perGame(last10);

  // Profil de faiblesses : types d'erreurs et phases de jeu.
  const kinds = new Map<string, number>();
  const phases = { opening: 0, middlegame: 0, endgame: 0 };
  for (const g of recent) {
    const review = g.review as GameReview;
    for (const m of review.moves) {
      if (
        m.color !== g.color ||
        (m.classification !== 'mistake' && m.classification !== 'blunder')
      ) {
        continue;
      }
      if (m.explanation) kinds.set(m.explanation.kind, (kinds.get(m.explanation.kind) ?? 0) + 1);
      phases[gamePhase(review.positions[m.ply - 1] ?? '', m.ply)]++;
    }
  }
  const sortedKinds = [...kinds.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);

  const themeStats = new Map<string, { attempts: number; solved: number }>();
  for (const a of input.puzzleAttempts) {
    for (const theme of a.themes.trim().split(/\s+/).filter(Boolean)) {
      const t = themeStats.get(theme) ?? { attempts: 0, solved: 0 };
      t.attempts++;
      if (a.success) t.solved++;
      themeStats.set(theme, t);
    }
  }
  const weakThemes = [...themeStats.entries()]
    .filter(([theme, t]) => t.attempts >= 5 && TRACKED_THEMES.has(theme))
    .map(([theme, t]) => ({
      theme,
      rate: Math.round((100 * t.solved) / t.attempts),
      attempts: t.attempts,
    }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 3);

  // Phase du programme : la première dont les critères de sortie ne sont pas tous remplis.
  const solvedPuzzles = input.puzzleAttempts.filter((a) => a.success).length;
  const phase1Lessons = input.lessons.filter((l) => l.phase === 1);
  const passed1 = phase1Lessons.filter((l) => l.passed).length;
  const enoughGames = last10.length >= 5;
  const criteriaByPhase = [
    [
      {
        label: 'Gaffes par partie (10 dernières parties analysées)',
        value: enoughGames && last10Stats ? fmt(last10Stats.blunder) : null,
        target: 'moins de 1',
        met: enoughGames && (last10Stats?.blunder ?? 9) < 1,
      },
      {
        label: 'Leçons de la phase 1 validées',
        value: `${passed1} / ${phase1Lessons.length}`,
        target: 'au moins 8',
        met: passed1 >= 8,
      },
      {
        label: 'Puzzles réussis',
        value: String(solvedPuzzles),
        target: 'au moins 150',
        met: solvedPuzzles >= 150,
      },
    ],
    [
      {
        label: 'Gaffes par partie (10 dernières)',
        value: enoughGames && last10Stats ? fmt(last10Stats.blunder) : null,
        target: 'moins de 0,5',
        met: enoughGames && (last10Stats?.blunder ?? 9) < 0.5,
      },
      {
        label: 'Erreurs par partie (10 dernières)',
        value: enoughGames && last10Stats ? fmt(last10Stats.mistake) : null,
        target: 'moins de 1',
        met: enoughGames && (last10Stats?.mistake ?? 9) < 1,
      },
      {
        label: 'Classement puzzle',
        value: String(Math.round(input.puzzleRating)),
        target: 'au moins 1700',
        met: input.puzzleRating >= 1700,
      },
    ],
    [
      {
        label: 'Précision moyenne (10 dernières)',
        value: last10Stats?.accuracy != null ? `${fmt(last10Stats.accuracy)} %` : null,
        target: 'au moins 80 %',
        met: enoughGames && (last10Stats?.accuracy ?? 0) >= 80,
      },
      {
        label: 'Classement puzzle',
        value: String(Math.round(input.puzzleRating)),
        target: 'au moins 1900',
        met: input.puzzleRating >= 1900,
      },
    ],
  ];
  let current = criteriaByPhase.findIndex((criteria) => criteria.some((c) => !c.met)) + 1;
  if (current === 0) current = 4;
  const phaseInfo = PHASES[current - 1] ?? PHASES[0];

  // Plan de la semaine.
  const nextLesson =
    input.lessons.find((l) => !l.passed && l.phase <= current) ??
    input.lessons.find((l) => !l.passed);
  const tasks: WeeklyTask[] = [
    {
      id: 'puzzles',
      label: 'Puzzles (5 séances de 15 min)',
      done: input.puzzleAttempts.filter((a) => a.at >= startMs).length,
      target: 50,
      href: '#/puzzles',
    },
    {
      id: 'slow-games',
      label: 'Parties lentes (15+10, ou entraînement)',
      done: input.games.filter((g) => g.slow && g.date >= startIso).length,
      target: 2,
      href: '#/',
    },
    {
      id: 'reviews',
      label: 'Parties analysées',
      done: input.games.filter((g) => g.reviewedAt !== null && g.reviewedAt >= startMs).length,
      target: 2,
      href: '#/analyse',
    },
    {
      id: 'lesson',
      label: 'Leçon de la semaine',
      done: input.lessons.filter((l) => l.updatedAt !== null && l.updatedAt >= startMs).length,
      target: 1,
      href: nextLesson ? `#/lessons/${nextLesson.id}` : '#/lessons',
    },
  ];

  // Courbes.
  const byDate = (points: Point[]) => [...points].sort((a, b) => a.date.localeCompare(b.date));
  const eloSeries = (tc: TimeClass, label: string): Series => ({
    id: `chesscom-${tc}`,
    label,
    points: byDate(
      input.games
        .filter((g) => g.source !== 'local' && g.timeClass === tc && g.userElo !== null)
        .map((g) => ({ date: g.date, value: g.userElo as number })),
    ),
  });
  const puzzleByDay = new Map<string, number>();
  for (const a of [...input.puzzleAttempts].sort((x, y) => x.at - y.at)) {
    if (a.ratingAfter !== null) puzzleByDay.set(iso(new Date(a.at)), Math.round(a.ratingAfter));
  }
  const curves: Series[] = [
    eloSeries('rapid', 'chess.com Rapide'),
    eloSeries('blitz', 'chess.com Blitz'),
    {
      id: 'puzzle',
      label: 'Classement puzzle',
      points: [...puzzleByDay.entries()].map(([date, value]) => ({ date, value })),
    },
    {
      id: 'accuracy',
      label: 'Précision (parties analysées)',
      points: byDate(
        analysed.flatMap((g) => {
          const a = userStats(g).accuracy;
          return a === null ? [] : [{ date: g.date, value: a }];
        }),
      ),
    },
    {
      id: 'classic',
      label: 'Elo classique (ici)',
      points: byDate(input.classicRatings.map((r) => ({ date: r.date, value: r.rating }))),
    },
  ];

  // Régularité (étape 13) : activité par jour, cadence chess.com suivie pour l'objectif Elo.
  const activity = estimateActivity(input);
  const firstActiveDay = [...activity.keys()].sort()[0] ?? null;
  const cadence: 'rapid' | 'blitz' = input.games.some(
    (g) => g.timeClass === 'rapid' && g.userElo !== null,
  )
    ? 'rapid'
    : 'blitz';
  const firstMeasured = input.games
    .filter((g) => g.timeClass === cadence && g.userElo !== null)
    .map((g) => g.date.slice(0, 7))
    .sort()[0];
  const monthIndex = (key: string) => Number(key.slice(0, 4)) * 12 + Number(key.slice(5, 7));
  const todayIso = iso(now);

  // Bilan des 6 derniers mois.
  const months: MonthStats[] = [];
  for (let k = 5; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const endMs = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
    const inMonth = analysed.filter((g) => g.date.startsWith(key));
    const stats = perGame(inMonth);
    const puzzles = input.puzzleAttempts.filter((a) => iso(new Date(a.at)).startsWith(key));
    const lastRating = [...input.puzzleAttempts]
      .filter((a) => a.ratingAfter !== null && a.at < endMs)
      .sort((x, y) => x.at - y.at)
      .at(-1)?.ratingAfter;
    const lastElo = (tc: TimeClass) =>
      [...input.games]
        .filter((g) => g.timeClass === tc && g.userElo !== null && g.date.startsWith(key))
        .sort((x, y) => x.date.localeCompare(y.date))
        .at(-1)?.userElo ?? null;
    const minutes = [...activity.entries()]
      .filter(([day]) => day.startsWith(key))
      .reduce((sum, [, a]) => sum + a.minutes, 0);
    const targetElo =
      firstMeasured && key >= firstMeasured
        ? eloTarget(cadence, monthIndex(key) - monthIndex(firstMeasured))
        : null;
    const verdict = monthVerdict(lastElo(cadence), targetElo);
    // Volume hebdomadaire moyen sur les jours écoulés du mois (depuis la première activité).
    const firstDay = firstActiveDay && firstActiveDay > `${key}-01` ? firstActiveDay : `${key}-01`;
    const lastDay = todayIso < iso(new Date(endMs - 1)) ? todayIso : iso(new Date(endMs - 1));
    const elapsed = dayNumber(lastDay) - dayNumber(firstDay) + 1;
    let advice: string | null = null;
    if (firstActiveDay && firstActiveDay <= lastDay) {
      if (elapsed >= 7 && (minutes * 7) / elapsed < 120) {
        advice =
          'Moins de 2 h par semaine : passe au plan minimal (puzzles du jour et une partie lente analysée par semaine).';
      } else if (verdict === 'behind') {
        advice =
          'En retard sur l’objectif : priorité aux puzzles de tes thèmes faibles et à l’analyse de chaque partie lente.';
      } else if (verdict === 'ahead') {
        advice =
          'En avance sur l’objectif : joue tes parties lentes contre un bot d’un cran plus fort.';
      } else if (verdict === 'on-track') {
        advice = 'Dans les temps : garde ce rythme.';
      }
    }
    months.push({
      month: key,
      games: inMonth.length,
      accuracy: stats?.accuracy != null ? Math.round(stats.accuracy * 10) / 10 : null,
      blunders: stats ? Math.round(stats.blunder * 10) / 10 : null,
      puzzleRating: lastRating == null ? null : Math.round(lastRating),
      puzzles: puzzles.length,
      lessons: input.lessons.filter(
        (l) => l.passed && l.updatedAt !== null && iso(new Date(l.updatedAt)).startsWith(key),
      ).length,
      chessComRapid: lastElo('rapid'),
      chessComBlitz: lastElo('blitz'),
      minutes: Math.round(minutes),
      targetElo,
      verdict,
      advice,
    });
  }

  // Objectifs du plan (section 5) : départ = 10 premières parties analysées / premier classement.
  const startStats = analysed.length >= 10 ? perGame(first10) : null;
  const firstPuzzle = [...input.puzzleAttempts]
    .filter((a) => a.ratingAfter !== null)
    .sort((x, y) => x.at - y.at)[0]?.ratingAfter;
  const rapid = curves[0]?.points ?? [];
  const blitz = curves[1]?.points ?? [];
  const targets: Target[] = [
    {
      label: 'Gaffes par partie',
      start: startStats ? fmt(startStats.blunder) : null,
      current: last10Stats ? fmt(last10Stats.blunder) : null,
      target: 'moins de 0,5',
      met: !!last10Stats && enoughGames && last10Stats.blunder < 0.5,
    },
    {
      label: 'Précision moyenne',
      start: startStats?.accuracy != null ? `${fmt(startStats.accuracy)} %` : null,
      current: last10Stats?.accuracy != null ? `${fmt(last10Stats.accuracy)} %` : null,
      target: startStats?.accuracy != null ? `${fmt(startStats.accuracy + 10)} %` : '+10 points',
      met:
        startStats?.accuracy != null &&
        last10Stats?.accuracy != null &&
        last10Stats.accuracy >= startStats.accuracy + 10,
    },
    {
      label: 'Classement puzzle',
      start: firstPuzzle != null ? String(Math.round(firstPuzzle)) : null,
      current: String(Math.round(input.puzzleRating)),
      target: firstPuzzle != null ? String(Math.round(firstPuzzle) + 400) : '+400',
      met: firstPuzzle != null && input.puzzleRating >= firstPuzzle + 400,
    },
    {
      label: 'chess.com Rapide',
      start: rapid[0] ? String(rapid[0].value) : null,
      current: rapid.at(-1) ? String(rapid.at(-1)?.value) : null,
      target: '1300 (6 mois), 1600 (objectif)',
      met: (rapid.at(-1)?.value ?? 0) >= 1300,
    },
    {
      label: 'chess.com Blitz',
      start: blitz[0] ? String(blitz[0].value) : null,
      current: blitz.at(-1) ? String(blitz.at(-1)?.value) : null,
      target: '1300 (6 mois), 1600 (objectif)',
      met: (blitz.at(-1)?.value ?? 0) >= 1300,
    },
  ];

  // Recommandations, de la plus utile à la moins urgente.
  const recommendations: Recommendation[] = [];
  if (analysed.length < 5) {
    recommendations.push({
      text: 'Importe et analyse tes dernières parties chess.com pour mesurer ton niveau réel.',
      href: '#/analyse',
    });
  }
  const mainKind = sortedKinds[0];
  if (mainKind) {
    const theme = THEME_FOR_KIND[mainKind.kind];
    recommendations.push({
      text: `Ton erreur la plus fréquente : ${KIND_LABEL[mainKind.kind] ?? mainKind.kind} (${mainKind.count} sur tes dernières parties). ${theme ? 'Fais des puzzles sur ce thème.' : 'Applique la routine « échecs, prises, menaces » avant chaque coup.'}`,
      href: theme ? `#/puzzles/theme/${theme}` : '#/lessons/routine',
    });
  }
  if (input.ownPuzzles > 0) {
    recommendations.push({
      text:
        input.ownPuzzles === 1
          ? 'Refais la position où tu t’es trompé dans ta partie.'
          : `Refais les ${input.ownPuzzles} positions où tu t’es trompé dans tes parties.`,
      href: '#/puzzles/mine',
    });
  }
  if (input.duePuzzles > 0) {
    recommendations.push({
      text: `${input.duePuzzles} puzzle${input.duePuzzles > 1 ? 's' : ''} à réviser aujourd’hui.`,
      href: '#/puzzles/review',
    });
  }
  if (nextLesson && (tasks[3]?.done ?? 0) < 1) {
    recommendations.push({
      text: `Leçon de la semaine : ${nextLesson.title}.`,
      href: `#/lessons/${nextLesson.id}`,
    });
  }
  // Phase 2 et suivantes : première finale pas encore réussie.
  const nextEndgame = current >= 2 ? input.endgames?.find((e) => !e.passed) : undefined;
  if (nextEndgame) {
    recommendations.push({
      text: `Finale à travailler contre le bot : ${nextEndgame.title}.`,
      href: '#/endgames',
    });
  }
  if ((tasks[1]?.done ?? 0) < 2) {
    recommendations.push({
      text: 'Joue une partie lente (15+10) et analyse-la : c’est là que tu progresses le plus.',
      href: '#/',
    });
  }
  const weakest = weakThemes[0];
  if (weakest && weakest.rate < 60) {
    recommendations.push({
      text: `Thème de puzzles le moins réussi : ${PUZZLE_THEME_LABELS[weakest.theme] ?? weakest.theme} (${weakest.rate} %).`,
      href: `#/puzzles/theme/${weakest.theme}`,
    });
  }

  // Série de jours, minutes de la semaine, verrou du blitz.
  const today = activity.get(todayIso) ?? { minutes: 0, puzzles: 0 };
  const streak = computeStreak(activity, now);
  const weekMinutes = [...activity.entries()]
    .filter(([day]) => day >= startIso && day <= todayIso)
    .reduce((sum, [, a]) => sum + a.minutes, 0);

  return {
    phase: {
      current,
      title: phaseInfo.title,
      focus: phaseInfo.focus,
      criteria: criteriaByPhase[current - 1] ?? [],
    },
    week: { start: startIso, tasks },
    weaknesses: {
      games: recent.length,
      perGame: recentStats
        ? {
            blunder: Math.round(recentStats.blunder * 10) / 10,
            mistake: Math.round(recentStats.mistake * 10) / 10,
            inaccuracy: Math.round(recentStats.inaccuracy * 10) / 10,
          }
        : null,
      accuracy: recentStats?.accuracy != null ? Math.round(recentStats.accuracy * 10) / 10 : null,
      kinds: sortedKinds,
      phases,
      weakThemes,
    },
    curves,
    months,
    targets,
    recommendations: recommendations.slice(0, 5),
    themeOfDay: themeOfDay({ phase: current, weakThemes, date: now }),
    streak: {
      ...streak,
      todayPuzzles: today.puzzles,
      todayMinutes: Math.round(today.minutes),
    },
    minutes: { week: Math.round(weekMinutes), target: WEEKLY_MINUTES_TARGET },
    blitzLocked: !streak.todayDone,
    blitzLockReason: streak.todayDone
      ? null
      : `Pas de blitz avant les puzzles du jour : ${Math.min(today.puzzles, DAILY_PUZZLE_GOAL)} / ${DAILY_PUZZLE_GOAL} puzzles (ou ${DAILY_MINUTES_GOAL} min d’entraînement).`,
    guard: guardPolicy(current),
    suggestedBotLevel: suggestBotLevel(input.botResults ?? []),
  };
}
