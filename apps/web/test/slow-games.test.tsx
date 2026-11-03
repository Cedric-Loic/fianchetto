import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailySession, UserPublic } from '@sq/shared';
import { api } from '../src/lib/api';
import { ThinkingRoutine } from '../src/game/ThinkingRoutine';
import { useRoutineShortcut } from '../src/game/routine';
import { isFastTimeControl, isSlowTimeControl, wantsSlowGame } from '../src/lib/regularity';
import { useSession } from '../src/lib/session';
import { loadSettings, parseLastPlay, useSettings } from '../src/lib/settings';
import { Home } from '../src/screens/Home';
import { SessionCard } from '../src/screens/CoachPlan';

vi.mock('../src/lib/api', () => ({
  api: {
    dashboard: vi.fn(),
    botLevels: vi.fn(),
    activeGame: vi.fn(),
    createGame: vi.fn(),
    coachProgress: vi.fn().mockResolvedValue(null),
  },
  summarizePgn: vi.fn(),
}));

const USER = {
  id: 'u1',
  username: 'moi',
  ratings: { classic: { rating: 1200 }, 'secret-queen': { rating: 1200 } },
} as unknown as UserPublic;

beforeEach(() => {
  localStorage.clear();
  location.hash = '';
  useSettings.setState(loadSettings());
  useSession.setState({ user: USER, loaded: true });
  vi.mocked(api.botLevels).mockResolvedValue([{ level: 1, name: 'Débutant', elo: 600 }]);
  vi.mocked(api.activeGame).mockResolvedValue({ gameId: null });
  vi.mocked(api.dashboard).mockResolvedValue(null);
  vi.mocked(api.createGame).mockResolvedValue({ gameId: 'g1' });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  location.hash = '';
  useSession.setState({ user: null });
});

describe('cadences lentes : fonctions pures', () => {
  it('ne concernent pas le verrou du blitz', () => {
    expect(isSlowTimeControl('rapid-15+10')).toBe(true);
    expect(isSlowTimeControl('classical-30+0')).toBe(true);
    expect(isSlowTimeControl('rapid-10+0')).toBe(false);
    expect(isFastTimeControl('rapid-15+10')).toBe(false);
    expect(isFastTimeControl('classical-30+0')).toBe(false);
  });

  it('lit #/?slow=1', () => {
    expect(wantsSlowGame('#/?slow=1')).toBe(true);
    expect(wantsSlowGame('#?slow=1')).toBe(true);
    expect(wantsSlowGame('#/?a=2&slow=1')).toBe(true);
    expect(wantsSlowGame('#/')).toBe(false);
    expect(wantsSlowGame('#/?slow=10')).toBe(false);
    expect(wantsSlowGame('#/today?slow=1')).toBe(false);
  });

  it('une cadence lente enregistrée pour deux joueurs redevient la cadence par défaut', () => {
    const base = { variant: 'classic', level: 3, color: 'w', training: false };
    expect(parseLastPlay({ ...base, mode: 'bot', timeControl: 'rapid-15+10' })?.timeControl).toBe(
      'rapid-15+10',
    );
    expect(
      parseLastPlay({ ...base, mode: 'hotseat', timeControl: 'classical-30+0' }),
    ).toMatchObject({ timeControl: 'blitz-5+0' });
  });
});

describe('Accueil : parties lentes', () => {
  it('groupe « Parties lentes » contre le bot seulement, avec le badge non classée', async () => {
    render(<Home onStart={vi.fn()} />);
    const group = await screen.findByRole('group', { name: 'Parties lentes' });
    expect(group.textContent).toContain('non classée');
    expect(screen.getByTestId('tc-rapid-15+10').textContent).toBe('15 | 10');
    expect(screen.getByTestId('tc-classical-30+0').textContent).toBe('30 min');
    // Pas de cadence lente à deux sur l'écran.
    expect(screen.queryByTestId('seat-tc-rapid-15+10')).toBeNull();
    expect(screen.queryByTestId('seat-tc-classical-30+0')).toBeNull();
    expect(screen.getByTestId('seat-tc-rapid-10+0')).toBeTruthy();

    fireEvent.click(screen.getByTestId('tc-classical-30+0'));
    expect(screen.getByTestId('slow-note').textContent).toContain('non classée');
    fireEvent.click(screen.getByTestId('play-bot'));
    await waitFor(() =>
      expect(api.createGame).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'bot', timeControl: 'classical-30+0' }),
      ),
    );
  });

  it('#/?slow=1 présélectionne 15 | 10 contre le bot', async () => {
    location.hash = '#/?slow=1';
    render(<Home onStart={vi.fn()} />);
    await screen.findByTestId('tc-rapid-15+10');
    expect(screen.getByTestId('tc-rapid-15+10').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('slow-note')).toBeTruthy();
  });

  it('le verrou du blitz ne s’applique pas aux parties lentes', async () => {
    vi.mocked(api.dashboard).mockResolvedValue({
      blitzLocked: true,
      blitzLockReason: 'Pas de blitz avant les puzzles du jour.',
      streak: { current: 0, best: 0, todayDone: false, todayPuzzles: 0, todayMinutes: 0 },
      week: { start: '2026-10-12', tasks: [] },
      recommendations: [],
      suggestedBotLevel: 1,
    } as never);
    render(<Home onStart={vi.fn()} />);
    await screen.findByTestId('blitz-lock');
    expect(screen.getByTestId('tc-rapid-15+10').querySelector('svg')).toBeNull();
    fireEvent.click(screen.getByTestId('tc-rapid-15+10'));
    fireEvent.click(screen.getByTestId('play-bot'));
    await waitFor(() => expect(api.createGame).toHaveBeenCalled());
    expect(screen.queryByTestId('blitz-lock-dialog')).toBeNull();
  });
});

function Harness() {
  useRoutineShortcut(true);
  return (
    <>
      <ThinkingRoutine />
      <input aria-label="champ" />
    </>
  );
}

describe('Routine de réflexion', () => {
  it('bouton : ouvre les 3 questions et la vérification anti-gaffe, état mémorisé', () => {
    render(<ThinkingRoutine />);
    const button = screen.getByTestId('routine-button');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('routine-panel')).toBeNull();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const questions = screen.getAllByTestId('routine-question');
    expect(questions).toHaveLength(3);
    expect(questions[0]?.textContent).toContain('Que menace son dernier coup ?');
    expect(questions[1]?.textContent).toContain('Échecs, prises, attaques');
    expect(questions[2]?.textContent).toContain('Mes coups candidats');
    expect(screen.getByTestId('routine-check').textContent).toContain(
      'Si je joue ça, que peut-il répondre ?',
    );
    const saved = JSON.parse(localStorage.getItem('sq-settings') ?? '{}') as {
      routineOpen?: boolean;
    };
    expect(saved.routineOpen).toBe(true);
    fireEvent.click(button);
    expect(screen.queryByTestId('routine-panel')).toBeNull();
  });

  it('touche r : bascule la routine, sauf pendant une saisie ou avec un modificateur', () => {
    render(<Harness />);
    fireEvent.keyDown(window, { key: 'r' });
    expect(screen.getByTestId('routine-panel')).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText('champ'), { key: 'r' });
    expect(screen.getByTestId('routine-panel')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'r', ctrlKey: true });
    expect(screen.getByTestId('routine-panel')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'r' });
    expect(screen.queryByTestId('routine-panel')).toBeNull();
  });
});

describe('Séance du jour : lien vers la partie lente', () => {
  it('le suivi mène à l’accueil présélectionné', () => {
    const session: DailySession = {
      date: '2026-10-12',
      minutes: 28,
      focus: null,
      steps: [],
      followUp: { label: 'une partie lente avec la routine', href: '#/?slow=1' },
    } as unknown as DailySession;
    render(<SessionCard session={session} onChange={vi.fn()} />);
    expect(screen.getByTestId('session-followup').getAttribute('href')).toBe('#/?slow=1');
  });
});
