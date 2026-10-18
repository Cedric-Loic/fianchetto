import { describe, expect, it } from 'vitest';
import type { GameReview, ReviewMove } from '@sq/shared';
import {
  buildDashboard,
  timeClassOf,
  weekStart,
  type DashboardGame,
  type DashboardInput,
} from '../src/index.js';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** Mercredi 14 octobre 2026, midi (heure locale). */
const NOW = new Date(2026, 9, 14, 12);

/** Revue factice : `blunders` gaffes « pièce en prise » du camp blanc au coup `ply`. */
function review(blunders: number, accuracy: number, ply = 30): GameReview {
  const moves: ReviewMove[] = Array.from({ length: blunders }, (_, i) => ({
    ply: ply + 2 * i,
    color: 'w',
    san: 'x',
    uci: 'a2a3',
    classification: 'blunder',
    winBefore: 50,
    winAfter: 10,
    accuracy: 0,
    explanation: { kind: 'hanging-piece', text: '' },
  }));
  const counts = { best: 0, excellent: 0, good: 0, inaccuracy: 1, mistake: 0, blunder: blunders };
  return {
    positions: Array.from({ length: ply + 2 * blunders + 1 }, () => START),
    evals: [],
    moves,
    accuracy: { w: accuracy, b: null },
    counts: { w: counts, b: counts },
  };
}

function game(i: number, extra: Partial<DashboardGame> = {}): DashboardGame {
  return {
    id: `g${i}`,
    date: `2026-10-${String(1 + i).padStart(2, '0')}`,
    color: 'w',
    review: review(2, 70),
    reviewedAt: new Date(2026, 9, 1 + i).getTime(),
    slow: true,
    source: 'chesscom',
    timeClass: 'rapid',
    userElo: 950 + 10 * i,
    ...extra,
  };
}

function input(extra: Partial<DashboardInput> = {}): DashboardInput {
  return {
    now: NOW,
    games: [],
    puzzleAttempts: [],
    puzzleRating: 1500,
    lessons: Array.from({ length: 10 }, (_, i) => ({
      id: `l${i}`,
      phase: 1,
      title: `Leçon ${i}`,
      passed: false,
      updatedAt: null,
    })),
    classicRatings: [],
    duePuzzles: 0,
    ownPuzzles: 0,
    ...extra,
  };
}

describe('outils', () => {
  it('lundi de la semaine, cadence chess.com', () => {
    expect(weekStart(NOW).getDay()).toBe(1);
    expect(weekStart(NOW).getDate()).toBe(12);
    expect(timeClassOf('60')).toBe('bullet');
    expect(timeClassOf('180+2')).toBe('blitz');
    expect(timeClassOf('600')).toBe('rapid');
    expect(timeClassOf('900+10')).toBe('rapid');
    expect(timeClassOf('1/86400')).toBe('daily');
    expect(timeClassOf(null)).toBeNull();
  });
});

describe('tableau de bord', () => {
  it('débutant sans données : phase 1, recommandation d’import en premier', () => {
    const d = buildDashboard(input());
    expect(d.phase.current).toBe(1);
    expect(d.phase.criteria[0]?.value).toBeNull();
    expect(d.recommendations[0]?.href).toBe('#/analyse');
    expect(d.weaknesses.perGame).toBeNull();
    expect(d.week.tasks.map((t) => t.done)).toEqual([0, 0, 0, 0]);
    expect(d.months).toHaveLength(6);
    expect(d.months.at(-1)?.month).toBe('2026-10');
  });

  it('profil de faiblesses, courbes, objectifs et recommandations', () => {
    const games = Array.from({ length: 12 }, (_, i) => game(i));
    // Gaffe en ouverture dans une partie, de type « pièce en prise ».
    games[11] = game(11, { review: review(1, 75, 10), timeClass: 'blitz', userElo: 1010 });
    const d = buildDashboard(
      input({
        games,
        puzzleAttempts: [
          {
            at: new Date(2026, 9, 2).getTime(),
            success: false,
            ratingAfter: 1400,
            themes: ' fork ',
          },
          { at: NOW.getTime() - 3600_000, success: true, ratingAfter: 1450, themes: ' fork ' },
        ],
        puzzleRating: 1450,
        ownPuzzles: 4,
      }),
    );
    expect(d.weaknesses.games).toBe(12);
    expect(d.weaknesses.kinds[0]).toEqual({ kind: 'hanging-piece', count: 23 });
    expect(d.weaknesses.phases).toEqual({ opening: 1, middlegame: 22, endgame: 0 });
    expect(d.curves.find((c) => c.id === 'chesscom-rapid')?.points).toHaveLength(11);
    expect(d.curves.find((c) => c.id === 'chesscom-blitz')?.points).toEqual([
      { date: '2026-10-12', value: 1010 },
    ]);
    expect(d.curves.find((c) => c.id === 'puzzle')?.points).toHaveLength(2);
    // Semaine du 12 octobre : 1 puzzle, 1 partie lente (le 12).
    expect(d.week.tasks.find((t) => t.id === 'puzzles')?.done).toBe(1);
    expect(d.week.tasks.find((t) => t.id === 'slow-games')?.done).toBe(1);
    const blunders = d.targets.find((t) => t.label === 'Gaffes par partie');
    expect(blunders).toMatchObject({ start: '2,0', met: false });
    expect(d.targets.find((t) => t.label === 'Classement puzzle')).toMatchObject({
      start: '1400',
      current: '1450',
      target: '1800',
    });
    expect(d.recommendations[0]?.href).toBe('#/puzzles/theme/hangingPiece');
    expect(d.recommendations.some((r) => r.href === '#/puzzles/mine')).toBe(true);
    expect(d.months.at(-1)).toMatchObject({ games: 12, chessComRapid: 1050, puzzles: 2 });
  });

  it('passage en phase 2 quand les critères de la phase 1 sont remplis', () => {
    const clean = Array.from({ length: 10 }, (_, i) => game(i, { review: review(0, 85) }));
    const lessons = input().lessons.map((l, i) => ({ ...l, passed: i < 8 }));
    const solved = Array.from({ length: 150 }, (_, i) => ({
      at: i,
      success: true,
      ratingAfter: null,
      themes: '',
    }));
    const d = buildDashboard(input({ games: clean, lessons, puzzleAttempts: solved }));
    expect(d.phase.current).toBe(2);
    expect(d.phase.title).toBe('Calculer et punir');
    // Il manque une leçon : retour en phase 1.
    const d1 = buildDashboard(
      input({
        games: clean,
        lessons: lessons.map((l, i) => ({ ...l, passed: i < 7 })),
        puzzleAttempts: solved,
      }),
    );
    expect(d1.phase.current).toBe(1);
    expect(d1.phase.criteria.find((c) => c.label.startsWith('Leçons'))?.met).toBe(false);
  });

  it('phase 2 : recommande la première finale pas encore réussie', () => {
    const clean = Array.from({ length: 10 }, (_, i) => game(i, { review: review(0, 85) }));
    const solved = Array.from({ length: 150 }, (_, i) => ({
      at: i,
      success: true,
      ratingAfter: null,
      themes: '',
    }));
    const endgames = [
      { id: 'dame-roi', title: 'Roi et dame contre roi', passed: true },
      { id: 'lucena', title: 'Position de Lucena', passed: false },
    ];
    const phase2 = input({
      games: clean,
      lessons: input().lessons.map((l) => ({ ...l, passed: true })),
      puzzleAttempts: solved,
      endgames,
    });
    const d = buildDashboard(phase2);
    expect(d.phase.current).toBeGreaterThanOrEqual(2);
    expect(d.recommendations).toContainEqual({
      text: 'Finale à travailler contre le bot : Position de Lucena.',
      href: '#/endgames',
    });
    // Phase 1 : pas encore de finale.
    const d1 = buildDashboard(input({ endgames }));
    expect(d1.recommendations.some((r) => r.href === '#/endgames')).toBe(false);
  });

  it('profil pendule : gaffes en zeitnot ou avec du temps', () => {
    // Gaffes aux demi-coups 30 et 32 (review(2, 70)) ; 10 min au départ.
    const clocks: (number | null)[] = Array.from({ length: 40 }, () => 300_000);
    clocks[29] = 40_000; // après le coup 30 : sert au coup 32 (moins de 60 s : zeitnot).
    const d = buildDashboard(
      input({
        games: [
          game(0, { clocks, initialClockMs: 600_000 }),
          // Sans pendule : ignorée dans la répartition.
          game(1),
        ],
      }),
    );
    expect(d.weaknesses.clock).toEqual({ games: 1, lowTime: 1, withTime: 1 });
    expect(buildDashboard(input({ games: [game(0)] })).weaknesses.clock).toBeNull();
  });

  it('phase 2 : les leçons de la phase 2 comptent pour passer en phase 3', () => {
    const clean = Array.from({ length: 10 }, (_, i) => game(i, { review: review(0, 85) }));
    const solved = Array.from({ length: 150 }, (_, i) => ({
      at: i,
      success: true,
      ratingAfter: null,
      themes: '',
    }));
    const lessons = [
      ...input().lessons.map((l) => ({ ...l, passed: true })),
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `p2-${i}`,
        phase: 2,
        title: `Leçon P2 ${i}`,
        passed: i < 7,
        updatedAt: null,
      })),
    ];
    const d = buildDashboard(
      input({ games: clean, lessons, puzzleAttempts: solved, puzzleRating: 1800 }),
    );
    expect(d.phase.current).toBe(2);
    expect(d.phase.criteria.find((c) => c.label === 'Leçons de la phase 2 validées')).toEqual({
      label: 'Leçons de la phase 2 validées',
      value: '7 / 10',
      target: 'au moins 8',
      met: false,
    });
    const d3 = buildDashboard(
      input({
        games: clean,
        lessons: lessons.map((l) => ({ ...l, passed: true })),
        puzzleAttempts: solved,
        puzzleRating: 1800,
      }),
    );
    expect(d3.phase.current).toBe(3);
  });
});
