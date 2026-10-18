import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisplayedPiece } from '@sq/shared';
import { Board } from '../src/game/Board';
import { squareLabel } from '../src/lib/a11y';
import { ONBOARDING_FORCE_KEY, ONBOARDING_SKIP_KEY, onboardingWanted } from '../src/lib/onboarding';
import { loadSettings, parseLastPlay, useSettings } from '../src/lib/settings';
import { Onboarding } from '../src/screens/Onboarding';

const PIECES: DisplayedPiece[] = [
  { id: 'wn1', color: 'w', type: 'n', square: 'g1' },
  { id: 'wr1', color: 'w', type: 'r', square: 'a1' },
  { id: 'wk', color: 'w', type: 'k', square: 'e1' },
  { id: 'bq', color: 'b', type: 'q', square: 'd8' },
  { id: 'bk', color: 'b', type: 'k', square: 'e8' },
];

beforeEach(() => {
  localStorage.clear();
  useSettings.setState(loadSettings());
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const key = (k: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key: k });

describe('Board : accessibilité et clavier', () => {
  it('nomme chaque case (« e4, vide », « g1, cavalier blanc », « d8, dame noire »)', () => {
    render(<Board pieces={PIECES} orientation="w" movable="w" />);
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
    expect(screen.getAllByRole('row')).toHaveLength(8);
    expect(screen.getByRole('gridcell', { name: 'e4, vide' })).toBeTruthy();
    expect(screen.getByRole('gridcell', { name: 'g1, cavalier blanc' })).toBeTruthy();
    expect(screen.getByRole('gridcell', { name: 'a1, tour blanche' })).toBeTruthy();
    expect(screen.getByRole('gridcell', { name: 'd8, dame noire' })).toBeTruthy();
    expect(squareLabel('c4', { id: 'x', color: 'w', type: 'p', square: 'c4' }, true)).toBe(
      'c4, pion blanc, dame secrète',
    );
  });

  it('tabindex itinérant : une seule case tabulable, le coin en bas à gauche', () => {
    const { rerender } = render(<Board pieces={PIECES} orientation="w" movable="w" />);
    const tabbable = () => screen.getAllByRole('gridcell').filter((c) => c.tabIndex === 0);
    expect(tabbable().map((c) => c.dataset.cell)).toEqual(['a1']);
    rerender(<Board pieces={PIECES} orientation="b" movable="w" />);
    expect(tabbable().map((c) => c.dataset.cell)).toEqual(['h8']);
  });

  it('flèches, Entrée pour prendre puis poser : le coup est proposé', () => {
    const onMove = vi.fn();
    render(<Board pieces={PIECES} orientation="w" movable="w" onMove={onMove} />);
    screen.getByRole('gridcell', { name: 'a1, tour blanche' }).focus();
    for (let i = 0; i < 6; i++) key('ArrowRight');
    expect(document.activeElement?.getAttribute('data-cell')).toBe('g1');
    expect((document.activeElement as HTMLElement).tabIndex).toBe(0);
    key('Enter');
    expect(screen.getByRole('gridcell', { name: 'g1, cavalier blanc' }).ariaSelected).toBe('true');
    expect(screen.getByTestId('board-announce').textContent).toContain('cavalier blanc en g1');
    key('ArrowUp');
    key('ArrowUp');
    key('ArrowLeft');
    expect(document.activeElement?.getAttribute('data-cell')).toBe('f3');
    key(' ');
    expect(onMove).toHaveBeenCalledWith('g1', 'f3');
    // Aucun coup légal marqué, ni annoncé.
    expect(screen.queryAllByTestId('legal-hint')).toHaveLength(0);
  });

  it('Échap annule la sélection ; bords du plateau : le focus ne sort pas', () => {
    const onMove = vi.fn();
    render(<Board pieces={PIECES} orientation="w" movable="w" onMove={onMove} />);
    screen.getByRole('gridcell', { name: 'a1, tour blanche' }).focus();
    key('ArrowLeft');
    key('ArrowDown');
    expect(document.activeElement?.getAttribute('data-cell')).toBe('a1');
    key('Enter');
    expect(document.querySelector('.sq.selected')).not.toBeNull();
    key('Escape');
    expect(document.querySelector('.sq.selected')).toBeNull();
    expect(screen.getByTestId('board-announce').textContent).toBe('Sélection annulée.');
    key('ArrowUp');
    key('Enter');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('plateau vu des Noirs : la flèche haut va vers la 1re rangée', () => {
    render(<Board pieces={PIECES} orientation="b" movable="b" />);
    screen.getByRole('gridcell', { name: 'e8, roi noir' }).focus();
    key('ArrowUp');
    expect(document.activeElement?.getAttribute('data-cell')).toBe('e7');
    key('ArrowRight');
    expect(document.activeElement?.getAttribute('data-cell')).toBe('d7');
  });

  it('une pièce adverse ne se prend pas ; lecture seule : rien ne se sélectionne', () => {
    render(<Board pieces={PIECES} orientation="w" movable={null} />);
    screen.getByRole('gridcell', { name: 'a1, tour blanche' }).focus();
    key('Enter');
    expect(document.querySelector('.sq.selected')).toBeNull();
  });
});

describe('premier lancement guidé', () => {
  it('trois étapes : niveau, cadence, pseudo chess.com ; tout est enregistré', () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    expect(screen.getByTestId('onboarding-step').textContent).toContain('1 sur 3');
    fireEvent.click(screen.getByTestId('felt-1'));
    expect(screen.getByTestId('onboarding-step').textContent).toContain('2 sur 3');
    fireEvent.click(screen.getByTestId('onboarding-tc-rapid-10+0'));
    expect(screen.getByTestId('onboarding-step').textContent).toContain('3 sur 3');
    fireEvent.change(screen.getByTestId('onboarding-username'), { target: { value: ' magnus ' } });
    expect(screen.getByTestId('onboarding-import').getAttribute('href')).toBe('#/analyse');
    fireEvent.click(screen.getByTestId('onboarding-finish'));
    expect(onDone).toHaveBeenCalledOnce();
    const saved = loadSettings();
    expect(saved.onboarded).toBe(true);
    expect(saved.chessComUsername).toBe('magnus');
    expect(saved.lastPlay).toMatchObject({ level: 1, timeControl: 'rapid-10+0', mode: 'bot' });
  });

  it('« Passer » termine tout de suite et garde les choix déjà faits', () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    fireEvent.click(screen.getByTestId('felt-5'));
    fireEvent.click(screen.getByTestId('onboarding-skip'));
    expect(onDone).toHaveBeenCalledOnce();
    expect(loadSettings()).toMatchObject({ onboarded: true, lastPlay: { level: 5 } });
  });

  it('proposé une seule fois ; jamais avec le marqueur ou dans un navigateur piloté', () => {
    let driven = false;
    Object.defineProperty(navigator, 'webdriver', { configurable: true, get: () => driven });
    expect(onboardingWanted(false)).toBe(true);
    expect(onboardingWanted(true)).toBe(false);
    localStorage.setItem(ONBOARDING_SKIP_KEY, '1');
    expect(onboardingWanted(false)).toBe(false);
    localStorage.clear();
    driven = true;
    expect(onboardingWanted(false)).toBe(false);
    localStorage.setItem(ONBOARDING_FORCE_KEY, '1');
    expect(onboardingWanted(false)).toBe(true);
    expect(onboardingWanted(true)).toBe(false);
    Reflect.deleteProperty(navigator, 'webdriver');
  });

  it('dernière partie : valeurs invalides rejetées, entraînement réservé au classique', () => {
    expect(parseLastPlay({ mode: 'bot', variant: 'classic', level: 2 })).toBeNull();
    expect(
      parseLastPlay({
        mode: 'bot',
        variant: 'secret-queen',
        training: true,
        level: 2,
        color: 'w',
        timeControl: 'blitz-3+2',
      }),
    ).toMatchObject({ training: false, level: 2 });
    expect(
      parseLastPlay({
        mode: 'hotseat',
        variant: 'classic',
        level: 2,
        color: 'w',
        timeControl: '1h',
      }),
    ).toBeNull();
  });
});
