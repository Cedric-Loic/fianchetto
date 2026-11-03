import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ViewerGameState } from '@sq/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EndDialog } from '../src/game/EndDialog';
import { GameActions } from '../src/game/GameActions';
import { moveAnnouncement, outcomeFor } from '../src/game/outcome';
import { summarizePgn } from '../src/lib/api';
import { formatSan } from '../src/lib/notation';
import { nextStreak, useStreak } from '../src/lib/streak';
import { Dialog } from '../src/ui/Dialog';
import { StreakBadge } from '../src/ui/StreakBadge';

vi.mock('../src/lib/net', () => ({ send: vi.fn() }));

afterEach(cleanup);

describe('notation française', () => {
  it('traduit les lettres de pièces, garde colonnes, roques, prises et promotions', () => {
    expect(formatSan('Nf3', true)).toBe('Cf3');
    expect(formatSan('Bxe5+', true)).toBe('Fxe5+');
    expect(formatSan('Qh5#', true)).toBe('Dh5#');
    expect(formatSan('Rad1', true)).toBe('Tad1');
    expect(formatSan('Kxb8', true)).toBe('Rxb8');
    expect(formatSan('exd8=Q+', true)).toBe('exd8=D+');
    expect(formatSan('b8=N', true)).toBe('b8=C');
    expect(formatSan('O-O-O', true)).toBe('O-O-O');
    // Notation publique Secret Queen (coordonnées) : inchangée.
    expect(formatSan('e2-h5#', true)).toBe('e2-h5#');
  });

  it('anglais par défaut : rien ne change', () => {
    expect(formatSan('Nf3', false)).toBe('Nf3');
    expect(formatSan('exd8=Q+', false)).toBe('exd8=Q+');
  });
});

describe('Dialog', () => {
  it('rôle dialog, aria-modal, titre relié, focus initial, piège du focus et Échap', () => {
    const onClose = vi.fn();
    render(
      <>
        <button>Dehors</button>
        <Dialog title="Titre" onClose={onClose}>
          <button>Un</button>
          <button>Deux</button>
        </Dialog>
      </>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Titre' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const [one, two] = [screen.getByText('Un'), screen.getByText('Deux')];
    expect(document.activeElement).toBe(one);
    // Tab sur le dernier : retour au premier ; Maj+Tab sur le premier : le dernier.
    two.focus();
    fireEvent.keyDown(two, { key: 'Tab' });
    expect(document.activeElement).toBe(one);
    fireEvent.keyDown(one, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(two);
    fireEvent.keyDown(two, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Échap ne remonte pas jusqu’à la fenêtre (le mode concentration reste ouvert)', () => {
    const onWindowKey = vi.fn();
    window.addEventListener('keydown', onWindowKey);
    render(
      <Dialog title="Titre" onClose={() => undefined}>
        <button>Ok</button>
      </Dialog>,
    );
    fireEvent.keyDown(screen.getByText('Ok'), { key: 'Escape' });
    window.removeEventListener('keydown', onWindowKey);
    expect(onWindowKey).not.toHaveBeenCalled();
  });

  it('rend le focus à l’élément d’origine à la fermeture', () => {
    function Harness({ open }: { open: boolean }) {
      return (
        <>
          <button>Origine</button>
          {open && (
            <Dialog title="T" onClose={() => undefined}>
              <button>Dedans</button>
            </Dialog>
          )}
        </>
      );
    }
    const { rerender } = render(<Harness open={false} />);
    screen.getByText('Origine').focus();
    rerender(<Harness open />);
    expect(document.activeElement?.textContent).toBe('Dedans');
    rerender(<Harness open={false} />);
    expect(document.activeElement?.textContent).toBe('Origine');
  });
});

function endedState(over: Partial<ViewerGameState> = {}): ViewerGameState {
  return {
    gameId: 'g1',
    variant: 'classic',
    mode: 'bot',
    viewer: 'w',
    phase: 'ended',
    rated: true,
    training: false,
    initialFen: null,
    timeControl: 'blitz-5+0',
    players: {
      w: { name: 'moi', rating: 1200, isBot: false, botLevel: null },
      b: { name: 'Bot', rating: 1000, isBot: true, botLevel: 1 },
    },
    selection: null,
    board: {
      viewer: 'w',
      pieces: [],
      turn: 'b',
      fullmoveNumber: 1,
      inCheck: false,
      moves: [],
      captured: { w: [], b: [] },
      ownSecret: null,
      result: { winner: 'w', reason: 'resignation' },
      reveal: null,
      legalMoves: null,
    },
    clock: null,
    drawOffer: null,
    rematch: { offeredBy: null, nextGameId: null },
    ...over,
  };
}

describe('fin de partie', () => {
  afterEach(() => vi.useRealTimers());

  it('issue vue par le spectateur', () => {
    expect(outcomeFor({ winner: 'w', reason: 'checkmate' }, 'w')).toBe('win');
    expect(outcomeFor({ winner: 'w', reason: 'checkmate' }, 'b')).toBe('loss');
    expect(outcomeFor({ winner: null, reason: 'stalemate' }, 'b')).toBe('draw');
    expect(outcomeFor({ winner: 'b', reason: 'timeout' }, 'public')).toBe('win');
  });

  it('dialog accessible : bandeau, revue guidée focalisée, Échap ferme, Elo animé jusqu’au nouveau', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const state = endedState();
    render(
      <EndDialog
        state={state}
        result={{ winner: 'w', reason: 'resignation' }}
        ratingAfter={1210}
        justEnded={false}
        onClose={onClose}
        onLeave={() => undefined}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: /moi \(Blancs\) gagne par abandon/ });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByTestId('end-banner').textContent).toContain('Victoire');
    const guided = screen.getByTestId('guided-review-link');
    expect(guided.getAttribute('href')).toBe('#/review/g1/guided');
    expect(document.activeElement).toBe(guided);
    expect(screen.getByRole('link', { name: /Revue de la partie/ })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('elo-change').textContent).toContain('1200 → 1210');
    expect(screen.getByTestId('elo-delta').textContent).toBe('+10');
    fireEvent.keyDown(guided, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('défaite : bandeau « Défaite », pas de célébration', () => {
    render(
      <EndDialog
        state={endedState({ viewer: 'b' })}
        result={{ winner: 'w', reason: 'resignation' }}
        ratingAfter={null}
        justEnded
        onClose={() => undefined}
        onLeave={() => undefined}
      />,
    );
    expect(screen.getByTestId('end-banner').textContent).toContain('Défaite');
    expect(screen.queryByTestId('celebration')).toBeNull();
  });

  it('victoire qui vient d’avoir lieu : célébration, retirée après environ 2 s', () => {
    vi.useFakeTimers();
    render(
      <EndDialog
        state={endedState()}
        result={{ winner: 'w', reason: 'checkmate' }}
        ratingAfter={null}
        justEnded
        onClose={() => undefined}
        onLeave={() => undefined}
      />,
    );
    expect(screen.getByTestId('celebration')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(screen.queryByTestId('celebration')).toBeNull();
  });
});

describe('actions de partie', () => {
  it('proposer nulle et abandonner (le parent ouvre la confirmation)', () => {
    const onResign = vi.fn();
    render(
      <GameActions
        state={endedState({ phase: 'playing' })}
        actor="w"
        onResign={onResign}
        compact
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Abandonner' }));
    expect(onResign).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Proposer nulle' })).toBeTruthy();
  });

  it('annonce du dernier coup (notation choisie)', () => {
    const move = { color: 'b', san: 'Nf6' } as Parameters<typeof moveAnnouncement>[0];
    expect(moveAnnouncement(move, 2, (s) => formatSan(s, true))).toBe('Coup 1, Noirs : Cf6');
  });
});

describe('série de réussites', () => {
  it('+1 sur une réussite, zéro sur un échec, meilleure série conservée', () => {
    let s = { current: 0, best: 0 };
    s = nextStreak(s, true);
    s = nextStreak(s, true);
    expect(s).toEqual({ current: 2, best: 2 });
    s = nextStreak(s, false);
    expect(s).toEqual({ current: 0, best: 2 });
    s = nextStreak(s, true);
    expect(s).toEqual({ current: 1, best: 2 });
  });

  it('pastille de série mise à jour par le store de session', () => {
    useStreak.setState({ current: 0, best: 0 });
    render(<StreakBadge />);
    expect(screen.getByTestId('streak').textContent).toContain('Série : 0');
    act(() => {
      useStreak.getState().record(true);
      useStreak.getState().record(true);
    });
    expect(screen.getByTestId('streak').textContent).toContain('Série : 2');
    act(() => useStreak.getState().record(false));
    expect(screen.getByTestId('streak').textContent).toContain('Série : 0');
  });
});

describe('carte « Partie en cours »', () => {
  it('lit joueurs, variante et nombre de demi-coups dans le PGN public', () => {
    const pgn = `[Event "Fianchetto, Secret Queen (notation publique)"]
[White "alice"]
[Black "Bot niveau 1"]
[Result "*"]

1. e4 e5 2. Nf3 e7-e6 *
`;
    expect(summarizePgn(pgn)).toEqual({
      white: 'alice',
      black: 'Bot niveau 1',
      variant: 'secret-queen',
      plies: 4,
    });
  });
});
