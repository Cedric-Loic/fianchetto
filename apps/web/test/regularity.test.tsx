import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoachDashboard, UserPublic } from '@sq/shared';
import { api } from '../src/lib/api';
import {
  blitzLockApplies,
  dailyGoal,
  formatMinutes,
  isFastTimeControl,
} from '../src/lib/regularity';
import { useSession } from '../src/lib/session';
import { DEFAULT_LAST_PLAY, loadSettings, useSettings } from '../src/lib/settings';
import { Coach } from '../src/screens/Coach';
import { Home } from '../src/screens/Home';

vi.mock('../src/lib/api', () => ({
  api: {
    dashboard: vi.fn(),
    botLevels: vi.fn(),
    activeGame: vi.fn(),
    createGame: vi.fn(),
  },
  summarizePgn: vi.fn(),
}));

const USER = {
  id: 'u1',
  username: 'moi',
  ratings: { classic: { rating: 1200 }, 'secret-queen': { rating: 1200 } },
} as unknown as UserPublic;

function dashboard(over: Partial<CoachDashboard> = {}): CoachDashboard {
  return {
    phase: { current: 1, title: 'Ne plus rien donner', focus: 'Tactique', criteria: [] },
    week: { start: '2026-10-12', tasks: [] },
    weaknesses: {
      games: 0,
      perGame: null,
      accuracy: null,
      kinds: [],
      phases: { opening: 0, middlegame: 0, endgame: 0 },
      clock: null,
      weakThemes: [],
    },
    curves: [],
    months: [
      {
        month: '2026-10',
        games: 3,
        accuracy: null,
        blunders: null,
        puzzleRating: null,
        puzzles: 40,
        lessons: 1,
        chessComRapid: 900,
        chessComBlitz: null,
        minutes: 125,
        targetElo: 1000,
        verdict: 'behind',
        advice: 'Moins de 2 h par semaine : reviens au plan minimal.',
      },
    ],
    targets: [],
    recommendations: [],
    themeOfDay: 'fork',
    streak: { current: 4, best: 9, todayDone: false, todayPuzzles: 3, todayMinutes: 5 },
    minutes: { week: 90, target: 180 },
    blitzLocked: true,
    blitzLockReason: 'Pas de blitz avant les puzzles du jour.',
    guard: 'always',
    suggestedBotLevel: 2,
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  useSettings.setState(loadSettings());
  useSession.setState({ user: USER, loaded: true });
  vi.mocked(api.botLevels).mockResolvedValue([
    { level: 1, name: 'Débutant', elo: 600 },
    { level: 2, name: 'Novice', elo: 900 },
    { level: 3, name: 'Amateur', elo: 1200 },
  ]);
  vi.mocked(api.activeGame).mockResolvedValue({ gameId: null });
  vi.mocked(api.createGame).mockResolvedValue({ gameId: 'g1' });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSession.setState({ user: null });
});

describe('régularité : fonctions pures', () => {
  it('blitz et bullet seulement ; verrou appliqué si la journée n’est pas validée', () => {
    expect(isFastTimeControl('bullet-1+0')).toBe(true);
    expect(isFastTimeControl('blitz-3+2')).toBe(true);
    expect(isFastTimeControl('rapid-10+0')).toBe(false);
    expect(isFastTimeControl('untimed')).toBe(false);
    expect(blitzLockApplies(null, 'blitz-5+0')).toBe(false);
    expect(blitzLockApplies(dashboard(), 'blitz-5+0')).toBe(true);
    expect(blitzLockApplies(dashboard({ blitzLocked: false }), 'blitz-5+0')).toBe(false);
  });

  it('objectif du jour : meilleur des deux critères ; minutes lisibles', () => {
    const s = dashboard().streak;
    expect(dailyGoal(s).ratio).toBeCloseTo(1 / 3);
    expect(dailyGoal({ ...s, todayPuzzles: 8 }).ratio).toBeCloseTo(0.8);
    expect(dailyGoal({ ...s, todayDone: true })).toEqual({ ratio: 1, text: 'Journée validée' });
    expect(formatMinutes(45)).toBe('45 min');
    expect(formatMinutes(125)).toBe('2 h 05');
    expect(formatMinutes(180)).toBe('3 h');
  });
});

describe('Coach : régularité et bilan mensuel', () => {
  it('série, record, objectif du jour, minutes de la semaine, verdict et conseil', async () => {
    vi.mocked(api.dashboard).mockResolvedValue(dashboard());
    render(<Coach />);
    expect((await screen.findByTestId('day-streak')).textContent).toContain('4 jours');
    expect(screen.getByTestId('day-streak').textContent).toContain('record : 9 jours');
    expect(screen.getByTestId('daily-goal').textContent).toContain('3 / 10 puzzles ou 5 / 15 min');
    expect(screen.getByTestId('week-minutes').textContent).toContain('1 h 30 / 3 h');
    expect(screen.getByRole('meter').getAttribute('aria-valuenow')).toBe('90');
    expect(screen.getByTestId('coach-theme-of-day').getAttribute('href')).toBe(
      '#/puzzles/theme/fork',
    );
    const verdict = screen.getByTestId('month-verdict');
    expect(verdict.textContent).toContain('En retard');
    expect(verdict.querySelector('.verdict-behind')).not.toBeNull();
    expect(screen.getByTestId('month-advice').textContent).toContain('plan minimal');
    expect(verdict.textContent).toContain('Elo visé : 1000');
    expect(verdict.textContent).toContain("2 h 05 d'entraînement");
  });
});

describe('Coach : profil (lot 4d)', () => {
  it('nouveaux types d’erreurs et répartition zeitnot / avec du temps', async () => {
    const base = dashboard().weaknesses;
    vi.mocked(api.dashboard).mockResolvedValue(
      dashboard({
        weaknesses: {
          ...base,
          games: 3,
          kinds: [
            { kind: 'allowed-pin', count: 2 },
            { kind: 'endgame-conversion', count: 1 },
          ],
          clock: { games: 2, lowTime: 3, withTime: 1 },
        },
      }),
    );
    render(<Coach />);
    const profile = await screen.findByTestId('coach-weaknesses');
    expect(profile.textContent).toContain('Clouage permis');
    expect(profile.textContent).toContain('Finale mal convertie');
    const clock = screen.getByTestId('coach-clock');
    expect(clock.textContent).toContain('En zeitnot (moins de 10 % du temps)3');
    expect(clock.textContent).toContain('Avec du temps1');
    expect(clock.textContent).toContain('2 parties avec pendule');
  });

  it('sans pendule : pas de répartition', async () => {
    vi.mocked(api.dashboard).mockResolvedValue(
      dashboard({ weaknesses: { ...dashboard().weaknesses, games: 1 } }),
    );
    render(<Coach />);
    await screen.findByTestId('coach-weaknesses');
    expect(screen.queryByTestId('coach-clock')).toBeNull();
  });
});

describe('Accueil : verrou souple du blitz et niveau conseillé', () => {
  it('cadenas, bandeau, confirmation « Jouer quand même » puis partie lancée', async () => {
    vi.mocked(api.dashboard).mockResolvedValue(dashboard());
    render(<Home onStart={vi.fn()} />);
    const banner = await screen.findByTestId('blitz-lock');
    expect(banner.textContent).toContain("Fais d'abord tes puzzles du jour");
    expect(banner.querySelector('a')?.getAttribute('href')).toBe('#/puzzles');
    expect(screen.getByTestId('tc-blitz-3+2').querySelector('svg')).not.toBeNull();
    expect(screen.getByTestId('tc-rapid-10+0').querySelector('svg')).toBeNull();
    expect(screen.getByTestId('home-streak').textContent).toContain('Série : 4 jours');

    // Cadence rapide : aucun rappel.
    fireEvent.click(screen.getByTestId('tc-rapid-10+0'));
    expect(screen.queryByTestId('blitz-lock-dialog')).toBeNull();
    // Blitz : rappel, annulable, puis « Jouer quand même ».
    fireEvent.click(screen.getByTestId('tc-bullet-1+0'));
    expect(screen.getByTestId('blitz-lock-dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Jouer quand même' }));
    expect(screen.queryByTestId('blitz-lock-dialog')).toBeNull();
    expect(screen.getByTestId('tc-bullet-1+0').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Jouer contre le bot' }));
    await waitFor(() =>
      expect(api.createGame).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'bot', timeControl: 'bullet-1+0' }),
      ),
    );
  });

  it('sans dernière configuration : niveau conseillé badgé et présélectionné', async () => {
    vi.mocked(api.dashboard).mockResolvedValue(dashboard({ blitzLocked: false }));
    render(<Home onStart={vi.fn()} />);
    const badge = await screen.findByTestId('level-suggested');
    expect(badge.textContent).toBe('conseillé');
    expect(screen.getByTestId('level-2').contains(badge)).toBe(true);
    expect(screen.getByTestId('level-2').getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByTestId('blitz-lock')).toBeNull();
  });

  it('avec une dernière configuration : badge sans présélection', async () => {
    useSettings.setState({ lastPlay: { ...DEFAULT_LAST_PLAY, level: 3 } });
    vi.mocked(api.dashboard).mockResolvedValue(dashboard());
    render(<Home onStart={vi.fn()} />);
    await screen.findByTestId('level-suggested');
    expect(screen.getByTestId('level-3').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('level-2').getAttribute('aria-pressed')).toBe('false');
  });
});
