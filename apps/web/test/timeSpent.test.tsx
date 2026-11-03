import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { MoveClass, ReviewMove } from '@sq/shared';
import {
  formatDuration,
  inferIncrementMs,
  timeSpentSummary,
  type TimeSpentSummary,
} from '../src/review/timeSpent';
import { TimeSpentCard } from '../src/review/TimeSpentCard';

afterEach(cleanup);

function mv(ply: number, classification: MoveClass): ReviewMove {
  return {
    ply,
    color: ply % 2 === 1 ? 'w' : 'b',
    san: `m${ply}`,
    uci: 'e2e4',
    classification,
    winBefore: 50,
    winAfter: 50,
    accuracy: 50,
    explanation: null,
  };
}

/**
 * Partie 15+10 : les Blancs et les Noirs jouent à tour de rôle ; `spentSec[i]` est le temps (s)
 * passé sur le demi-coup i + 1. Renvoie les pendules après chaque demi-coup.
 */
function clocksOf(spentSec: number[], initialSec = 900, incSec = 10): number[] {
  const left = { w: initialSec * 1000, b: initialSec * 1000 };
  return spentSec.map((s, i) => {
    const color = i % 2 === 0 ? 'w' : 'b';
    left[color] += incSec * 1000 - s * 1000;
    return left[color];
  });
}

/** Blancs : 5 coups (plies 1, 3, 5, 7, 9) ; l'adversaire joue vite et bien. */
const CLASSES: MoveClass[] = [
  'best', // 1
  'good', // 2 (noir)
  'good', // 3
  'best', // 4
  'blunder', // 5
  'good', // 6
  'good', // 7
  'best', // 8
  'mistake', // 9
  'good', // 10
];
const MOVES = CLASSES.map((c, i) => mv(i + 1, c));

describe('timeSpentSummary', () => {
  it('mesure le temps de chaque coup en tenant compte de l’incrément', () => {
    // Blancs : 20 s, 40 s, 4 s, 40 s, 6 s (le 1er coup n’est pas mesurable sans temps initial).
    const clocks = clocksOf([20, 3, 40, 3, 4, 3, 40, 3, 6, 3]);
    const res = timeSpentSummary(MOVES, clocks, 'w', { incrementMs: 10_000 });
    expect(res?.perMove.map((m) => [m.ply, m.ms / 1000])).toEqual([
      [3, 40],
      [5, 4],
      [7, 40],
      [9, 6],
    ]);
    // Avec le temps initial, le premier coup est aussi mesuré.
    const full = timeSpentSummary(MOVES, clocks, 'w', { incrementMs: 10_000, initialMs: 900_000 });
    expect(full?.perMove[0]).toMatchObject({ ply: 1, ms: 20_000 });
    expect(full?.perMove).toHaveLength(5);
  });

  it('déduit l’incrément des pendules quand il n’est pas fourni', () => {
    const clocks = clocksOf([20, 3, 40, 3, 4, 3, 40, 3, 6, 3]);
    const white = [0, 2, 4, 6, 8].map((i) => clocks[i] ?? null);
    // Gain maximal entre deux coups blancs : 10 s - 4 s = 6 s -> arrondi à 6 s... soit au moins 6 s.
    expect(inferIncrementMs(white)).toBe(6000);
    // Un coup instantané donne l'incrément exact.
    expect(inferIncrementMs([900_000, 909_900, 900_000])).toBe(10_000);
    expect(inferIncrementMs([])).toBe(0);
  });

  it('compare les erreurs aux autres coups : erreurs jouées trop vite', () => {
    const clocks = clocksOf([20, 3, 40, 3, 4, 3, 40, 3, 6, 3]);
    const res = timeSpentSummary(MOVES, clocks, 'w', { incrementMs: 10_000 });
    expect(res?.errors).toEqual({ count: 2, averageMs: 5000 });
    expect(res?.others).toEqual({ count: 2, averageMs: 40_000 });
    expect(res?.ratio).toBe(8);
    expect(res?.verdict).toBe('rushed');
    expect(res?.message).toBe(
      'Tu as joué tes erreurs 8× plus vite que le reste : ralentis dans les positions tendues.',
    );
  });

  it('écrit un rapport non rond avec une virgule', () => {
    // Erreurs 20 s en moyenne, autres 36 s : 1,8×.
    const clocks = clocksOf([20, 3, 36, 3, 20, 3, 36, 3, 20, 3]);
    const res = timeSpentSummary(MOVES, clocks, 'w', { incrementMs: 10_000 });
    expect(res?.message).toContain('1,8×');
  });

  it('reconnaît un bon usage du temps sur les moments critiques', () => {
    const clocks = clocksOf([20, 3, 10, 3, 60, 3, 12, 3, 50, 3]);
    const res = timeSpentSummary(MOVES, clocks, 'w', { incrementMs: 10_000 });
    expect(res?.verdict).toBe('careful');
    expect(res?.message).toContain('bien pris ton temps sur les moments critiques');
  });

  it('reste neutre quand le rythme est le même', () => {
    const clocks = clocksOf([20, 3, 30, 3, 28, 3, 32, 3, 30, 3]);
    expect(timeSpentSummary(MOVES, clocks, 'w', { incrementMs: 10_000 })?.verdict).toBe('even');
  });

  it('ne compare pas sans erreur ou sans assez d’autres coups', () => {
    const clean = CLASSES.map((c, i) => mv(i + 1, c === 'best' || c === 'good' ? c : 'good'));
    const clocks = clocksOf([20, 3, 30, 3, 28, 3, 32, 3, 30, 3]);
    const res = timeSpentSummary(clean, clocks, 'w', { incrementMs: 10_000 }) as TimeSpentSummary;
    expect(res.verdict).toBe('no-comparison');
    expect(res.errors).toBeNull();
    expect(res.message).toContain('Aucune erreur à comparer');
  });

  it('ne produit rien sans pendules ou sans camp connu', () => {
    const clocks = clocksOf([20, 3, 40, 3, 4, 3, 40, 3, 6, 3]);
    expect(timeSpentSummary(MOVES, null, 'w')).toBeNull();
    expect(timeSpentSummary(MOVES, undefined, 'w')).toBeNull();
    expect(timeSpentSummary(MOVES, [], 'w')).toBeNull();
    expect(timeSpentSummary(MOVES, clocks, null)).toBeNull();
    // Pendules inconnues (null) : rien de mesurable.
    expect(
      timeSpentSummary(
        MOVES,
        clocks.map(() => null),
        'w',
      ),
    ).toBeNull();
  });

  it('suit le camp du joueur (Noirs)', () => {
    const clocks = clocksOf([3, 20, 3, 40, 3, 4, 3, 40, 3, 6]);
    const moves = CLASSES.map((c, i) => mv(i + 1, i % 2 === 1 ? c : 'good'));
    const res = timeSpentSummary(moves, clocks, 'b', { incrementMs: 10_000 });
    expect(res?.perMove.every((m) => m.ply % 2 === 0)).toBe(true);
  });
});

describe('formatDuration', () => {
  it('formate en secondes puis en minutes', () => {
    expect(formatDuration(4_400)).toBe('4 s');
    expect(formatDuration(65_000)).toBe('1 min 05 s');
    expect(formatDuration(-5)).toBe('0 s');
  });
});

describe('TimeSpentCard', () => {
  it('affiche la carte avec le message', () => {
    const clocks = clocksOf([20, 3, 40, 3, 4, 3, 40, 3, 6, 3]);
    render(
      <TimeSpentCard
        moves={MOVES}
        clocks={clocks}
        userColor="w"
        options={{ incrementMs: 10_000 }}
      />,
    );
    expect(screen.getByTestId('time-spent')).toBeTruthy();
    expect(screen.getByTestId('time-message').textContent).toContain('8× plus vite');
    expect(screen.getByTestId('time-errors').textContent).toBe('5 s');
  });

  it('n’affiche rien sans pendules ni camp', () => {
    const { container, rerender } = render(
      <TimeSpentCard moves={MOVES} clocks={undefined} userColor="w" />,
    );
    expect(container.innerHTML).toBe('');
    rerender(
      <TimeSpentCard moves={MOVES} clocks={clocksOf([1, 1, 1, 1, 1, 1])} userColor={null} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
