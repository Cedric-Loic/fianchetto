import { describe, expect, it } from 'vitest';
import { CoachDashboardSchema, PUZZLE_THEMES } from '@sq/shared';
import {
  PHASE_THEMES,
  buildDashboard,
  eloTarget,
  guardActive,
  guardPolicy,
  monthVerdict,
  suggestBotLevel,
  themeOfDay,
  type DashboardInput,
} from '../src/index.js';

/** Mercredi 14 octobre 2026, midi (heure locale). */
const NOW = new Date(2026, 9, 14, 12);
const at = (day: number, hour = 10) => new Date(2026, 9, day, hour).getTime();

function input(extra: Partial<DashboardInput> = {}): DashboardInput {
  return {
    now: NOW,
    games: [],
    puzzleAttempts: [],
    puzzleRating: 1500,
    lessons: [],
    classicRatings: [],
    duePuzzles: 0,
    ownPuzzles: 0,
    ...extra,
  };
}

const puzzles = (day: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({
    at: at(day) + i * 60_000,
    success: true,
    ratingAfter: null,
    themes: '',
  }));

describe('thème du jour', () => {
  it('thèmes de phase connus de la base de puzzles', () => {
    for (const themes of Object.values(PHASE_THEMES)) {
      for (const t of themes) expect(PUZZLE_THEMES[t], t).toBeDefined();
    }
  });

  it('déterministe, rotation complète sur la phase', () => {
    const days = Array.from({ length: 8 }, (_, i) =>
      themeOfDay({ phase: 1, weakThemes: [], date: new Date(2026, 9, 1 + i, 9) }),
    );
    expect(new Set(days)).toEqual(new Set(PHASE_THEMES[1]));
    // Même jour, autre heure : même thème.
    expect(themeOfDay({ phase: 1, weakThemes: [], date: new Date(2026, 9, 1, 23) })).toBe(days[0]);
    expect(PHASE_THEMES[2]).toContain(
      themeOfDay({ phase: 2, weakThemes: [], date: NOW.getTime() }),
    );
  });

  it('pondéré vers les thèmes faibles, même hors de la phase', () => {
    const weak = [{ theme: 'fork', rate: 10 }];
    const count = (phase: number, theme: string) =>
      Array.from({ length: 60 }, (_, i) =>
        themeOfDay({ phase, weakThemes: weak, date: new Date(2026, 0, 1 + i) }),
      ).filter((t) => t === theme).length;
    // Poids 5 sur 12 en phase 1 (contre 1 sur 8 sans faiblesse).
    expect(count(1, 'fork')).toBe(25);
    expect(count(1, 'pin')).toBe(5);
    expect(count(2, 'fork')).toBeGreaterThan(0);
    // Un thème réussi (≥ 70 %) n'est pas renforcé.
    const strong = Array.from({ length: 8 }, (_, i) =>
      themeOfDay({ phase: 1, weakThemes: [{ theme: 'fork', rate: 80 }], date: at(1 + i) }),
    );
    expect(strong.filter((t) => t === 'fork')).toHaveLength(1);
  });
});

describe('garde-fou, niveau de bot, objectif Elo', () => {
  it('garde-fou dégressif', () => {
    expect([1, 2, 3, 4].map(guardPolicy)).toEqual(['always', 'alternate', 'off', 'off']);
    expect([0, 1, 2, 3].map((i) => guardActive(1, i))).toEqual([true, true, true, true]);
    expect([0, 1, 2, 3].map((i) => guardActive(2, i))).toEqual([true, false, true, false]);
    expect(guardActive(3, 0)).toBe(false);
  });

  it('niveau de bot : score glissant entre 40 et 60 %', () => {
    const games = (level: number, scores: number[], from = 0) =>
      scores.map((score, i) => ({ level, score, at: from + i }));
    expect(suggestBotLevel([])).toBeNull();
    expect(suggestBotLevel(games(2, [1, 1]))).toBe(2); // pas assez de parties
    expect(suggestBotLevel(games(2, [1, 1, 0.5, 1]))).toBe(3);
    expect(suggestBotLevel(games(2, [0, 0, 0.5, 0]))).toBe(1);
    expect(suggestBotLevel(games(2, [1, 0, 0.5, 1, 0]))).toBe(2);
    expect(suggestBotLevel(games(5, [1, 1, 1]))).toBe(5);
    expect(suggestBotLevel(games(1, [0, 0, 0]))).toBe(1);
    // Le niveau de référence est celui de la dernière partie.
    expect(suggestBotLevel([...games(2, [1, 1, 1]), ...games(3, [0], 10)])).toBe(3);
    // Fenêtre glissante : seules les 10 dernières parties comptent.
    expect(
      suggestBotLevel(games(3, [...Array<number>(10).fill(0), ...Array<number>(10).fill(0.5)])),
    ).toBe(3);
  });

  it('objectif interpolé et verdict', () => {
    expect(eloTarget('rapid', 0)).toBe(950);
    expect(eloTarget('rapid', 3)).toBe(1125);
    expect(eloTarget('rapid', 6)).toBe(1300);
    expect(eloTarget('blitz', 0)).toBe(1000);
    expect(eloTarget('rapid', 9)).toBe(1450);
    expect(eloTarget('rapid', 20)).toBe(1600);
    expect(monthVerdict(1180, 1125)).toBe('ahead');
    expect(monthVerdict(1100, 1125)).toBe('on-track');
    expect(monthVerdict(1000, 1125)).toBe('behind');
    expect(monthVerdict(null, 1125)).toBeNull();
    expect(monthVerdict(1000, null)).toBeNull();
  });
});

describe('régularité dans le tableau de bord', () => {
  it('sans données : rien de validé, blitz verrouillé, champs valides', () => {
    const d = buildDashboard(input());
    expect(CoachDashboardSchema.parse(d)).toBeTruthy();
    expect(d.streak).toEqual({
      current: 0,
      best: 0,
      todayDone: false,
      todayPuzzles: 0,
      todayMinutes: 0,
    });
    expect(d.minutes).toEqual({ week: 0, target: 180 });
    expect(d.blitzLocked).toBe(true);
    expect(d.blitzLockReason).toContain('0 / 10');
    expect(d.guard).toBe('always');
    expect(d.suggestedBotLevel).toBeNull();
    expect(PHASE_THEMES[1]).toContain(d.themeOfDay);
    expect(d.months.every((m) => m.verdict === null && m.advice === null)).toBe(true);
  });

  it('série : 10 puzzles ou 15 min par jour ; aujourd’hui pas encore fait', () => {
    const d = buildDashboard(
      input({
        // 9, 10 (série de 2) ; 11 : 9 puzzles seulement (13,5 min) ; 12, 13 validés ; 14 : 3 puzzles.
        puzzleAttempts: [
          ...puzzles(9, 10),
          ...puzzles(10, 12),
          ...puzzles(11, 9),
          ...puzzles(12, 10),
          ...puzzles(14, 3),
        ],
        // Le 13 : une leçon (20 min) suffit.
        lessonSessions: [at(13)],
      }),
    );
    expect(d.streak).toEqual({
      current: 2,
      best: 2,
      todayDone: false,
      todayPuzzles: 3,
      todayMinutes: 5,
    });
    expect(d.blitzLocked).toBe(true);
    // Semaine du 12 : 10 × 1,5 + 20 + 3 × 1,5 = 39,5 → 40.
    expect(d.minutes.week).toBe(40);
  });

  it('journée validée : série prolongée, blitz déverrouillé, durées réelles', () => {
    const d = buildDashboard(
      input({
        puzzleAttempts: [
          ...puzzles(12, 10),
          ...puzzles(13, 10),
          ...puzzles(14, 4).map((p) => ({ ...p, durationMs: 4 * 60_000 })),
        ],
        games: [
          {
            id: 'b',
            date: '2026-10-14',
            color: 'w',
            review: null,
            reviewedAt: null,
            slow: false,
            source: 'chesscom',
            timeClass: 'blitz',
            userElo: 1000,
          },
        ],
      }),
    );
    expect(d.streak).toMatchObject({ current: 3, best: 3, todayDone: true, todayMinutes: 16 });
    expect(d.blitzLocked).toBe(false);
    expect(d.blitzLockReason).toBeNull();
    // Le blitz ne compte pas dans les minutes.
    expect(d.minutes.week).toBe(46);
  });

  it('analyses : au plus 2 par jour comptées quand seule la date de revue est connue', () => {
    const games = Array.from({ length: 5 }, (_, i) => ({
      id: `g${i}`,
      date: '2026-09-01',
      color: 'w' as const,
      review: null,
      reviewedAt: at(14),
      slow: false,
      source: 'pgn' as const,
      timeClass: 'blitz' as const,
      userElo: null,
    }));
    expect(buildDashboard(input({ games })).streak.todayMinutes).toBe(20);
    expect(buildDashboard(input({ games, analysisSessions: [at(14)] })).streak.todayMinutes).toBe(
      10,
    );
  });

  it('verdict mensuel et ajustement du plan', () => {
    const rapid = (date: string, userElo: number, durationMs?: number) => ({
      id: date,
      date,
      color: 'w' as const,
      review: null,
      reviewedAt: null,
      slow: true,
      source: 'chesscom' as const,
      timeClass: 'rapid' as const,
      userElo,
      durationMs,
    });
    const d = buildDashboard(
      input({
        games: [
          rapid('2026-07-03', 950),
          rapid('2026-08-05', 1000),
          rapid('2026-09-10', 1200),
          rapid('2026-10-01', 1000),
        ],
        // Beaucoup de volume en septembre (30 jours à 30 min), peu ailleurs.
        puzzleAttempts: Array.from({ length: 30 }, (_, i) => ({
          at: new Date(2026, 8, 1 + i, 9).getTime(),
          success: true,
          ratingAfter: null,
          themes: '',
          durationMs: 10 * 60_000,
        })),
        lessonSessions: Array.from({ length: 30 }, (_, i) =>
          new Date(2026, 8, 1 + i, 18).getTime(),
        ),
        botResults: [
          { level: 2, score: 1, at: 1 },
          { level: 2, score: 1, at: 2 },
          { level: 2, score: 0.5, at: 3 },
        ],
      }),
    );
    const byMonth = Object.fromEntries(d.months.map((m) => [m.month, m]));
    expect(byMonth['2026-06']).toMatchObject({ targetElo: null, verdict: null, advice: null });
    // Juillet = mois 0 (950), août = 1 (1008), septembre = 2 (1067), octobre = 3 (1125).
    expect(byMonth['2026-07']).toMatchObject({ targetElo: 950, verdict: 'on-track' });
    expect(byMonth['2026-08']).toMatchObject({ targetElo: 1008, verdict: 'on-track' });
    expect(byMonth['2026-09']).toMatchObject({ targetElo: 1067, verdict: 'ahead', minutes: 930 });
    expect(byMonth['2026-09']?.advice).toContain('En avance');
    expect(byMonth['2026-10']).toMatchObject({ targetElo: 1125, verdict: 'behind' });
    // Octobre : une seule partie lente en 14 jours → volume insuffisant, plan minimal.
    expect(byMonth['2026-10']?.advice).toContain('plan minimal');
    expect(d.suggestedBotLevel).toBe(3);
    expect(CoachDashboardSchema.parse(d)).toBeTruthy();
  });
});
