import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameReview, ReviewMove, RetryMoveResponse } from '@sq/shared';
import { api } from '../src/lib/api';
import {
  LearnMistakes,
  REFUTATION_PAUSE_MS,
  REFUTATION_STEP_MS,
} from '../src/review/LearnMistakes';

vi.mock('../src/lib/api', () => ({ api: { retryMove: vi.fn() } }));
vi.mock('../src/lib/sound', () => ({ playSound: vi.fn() }));

const retry = vi.mocked(api.retryMove);

// Plateau de 400 px (cases de 50 px) vu des Blancs ; capture du pointeur simulée.
const SIZE = 50;
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: 8 * SIZE,
    height: 8 * SIZE,
    right: 8 * SIZE,
    bottom: 8 * SIZE,
    toJSON: () => ({}),
  });
  const captured = new Set<number>();
  Element.prototype.setPointerCapture = (id: number) => void captured.add(id);
  Element.prototype.releasePointerCapture = (id: number) => void captured.delete(id);
  Element.prototype.hasPointerCapture = (id: number) => captured.has(id);
});
afterEach(() => {
  cleanup();
  retry.mockReset();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Clic-clic d'une case à l'autre. */
function play(from: string, to: string) {
  const board = screen.getByTestId('board');
  for (const square of [from, to]) {
    const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
    const y = 8 - Number(square[1]);
    const at = { clientX: (x + 0.5) * SIZE, clientY: (y + 0.5) * SIZE, pointerId: 1 };
    fireEvent.pointerDown(board, { ...at, button: 0, buttons: 1 });
    fireEvent.pointerUp(board, { ...at, button: 0, buttons: 0 });
  }
}
const flush = () => act(() => vi.advanceTimersByTimeAsync(0));

// 1. e4 e5 2. Nf3 Nc6 3. Nxe5 ?? (meilleur : 3. Bb5), puis 3… Nxe5 4. a3 ? (exercice 2).
const P2 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
const P3 = 'r1bqkbnr/pppp1ppp/2n5/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3';
const P4 = 'r1bqkbnr/pppp1ppp/8/4n3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4';
const P5 = 'r1bqkbnr/pppp1ppp/8/4n3/4P3/P7/1PPP1PPP/RNBQKB1R b KQkq - 0 4';

const move = (ply: number, san: string, uci: string): ReviewMove => ({
  ply,
  color: ply % 2 === 1 ? 'w' : 'b',
  san,
  uci,
  classification: ply === 5 ? 'blunder' : 'mistake',
  winBefore: 55,
  winAfter: 20,
  accuracy: 20,
  explanation: null,
});
const NXE5 = move(5, 'Nxe5', 'f3e5');
const A3 = move(7, 'a3', 'a2a3');

const evalOf = (best: string | null, san: string | null, pv?: string[]) => ({
  evalCp: 30,
  mate: null,
  bestMoveUci: best,
  bestMoveSan: san,
  ...(pv ? { pv } : {}),
});
const evals = Array.from({ length: 9 }, () => evalOf(null, null));
evals[4] = evalOf('f1b5', 'Bb5', ['f1b5', 'a7a6', 'b5a4']);
evals[6] = evalOf('d2d4', 'd4', ['d2d4']);
const positions = Array.from({ length: 9 }, () => P2);
positions[4] = P2;
positions[5] = P3;
positions[6] = P4;
positions[7] = P5;
const REVIEW: GameReview = {
  positions,
  evals,
  moves: [],
  accuracy: { w: 50, b: 50 },
  counts: {
    w: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 1, blunder: 1 },
    b: { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 },
  },
};

const answer = (r: Partial<RetryMoveResponse>): RetryMoveResponse => ({
  verdict: 'wrong',
  san: '?',
  fen: P2,
  line: [],
  ...r,
});

function setup(moves = [NXE5, A3]) {
  const onExit = vi.fn();
  render(
    <LearnMistakes reviewId="g1" review={REVIEW} moves={moves} orientation="w" onExit={onExit} />,
  );
  return { onExit };
}

describe('Apprends de tes erreurs', () => {
  it('coup faux : réfutation animée, retour ; indice, solution, coup correct, score', async () => {
    setup();
    expect(screen.getByTestId('learn-prompt').textContent).toContain(
      'Trouve un meilleur coup que Nxe5',
    );
    expect(screen.getByTestId('mode-progress').textContent).toBe('1 / 2');
    // Position AVANT le coup : cavalier encore en f3.
    expect(document.querySelector('img[data-square="f3"]')?.getAttribute('alt')).toBe('wn');

    // 3. Ba6 ?, refusé : 3… bxa6 4. d3 Nf6.
    retry.mockResolvedValueOnce(
      answer({
        verdict: 'wrong',
        san: 'Ba6',
        fen: 'r1bqkbnr/pppp1ppp/B1n5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
        line: ['b7a6', 'd2d3', 'g8f6', 'c2c3'],
      }),
    );
    play('f1', 'a6');
    expect(retry).toHaveBeenCalledWith('g1', 5, 'f1a6');
    await flush();
    expect(screen.getByTestId('learn-feedback').textContent).toContain('✗ Pas mieux : Ba6');
    // Réfutation : 3 demi-coups au plus, puis retour à la position.
    await act(() => vi.advanceTimersByTimeAsync(REFUTATION_STEP_MS));
    expect(document.querySelector('img[data-square="a6"]')?.getAttribute('alt')).toBe('bp');
    await act(() => vi.advanceTimersByTimeAsync(REFUTATION_STEP_MS * 2));
    expect(document.querySelector('img[data-square="f6"]')?.getAttribute('alt')).toBe('bn');
    expect(document.querySelector('img[data-square="c3"]')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(REFUTATION_PAUSE_MS));
    expect(document.querySelector('img[data-square="f1"]')?.getAttribute('alt')).toBe('wb');
    expect(document.querySelector('img[data-square="f6"]')).toBeNull();

    // Indice : la pièce du meilleur coup (f1), sans flèche.
    fireEvent.click(screen.getByTestId('learn-hint-button'));
    const mark = screen.getByTestId('square-mark');
    expect(mark.getAttribute('data-square')).toBe('f1');
    expect(screen.queryByTestId('arrows')).toBeNull();
    // Solution : flèche du meilleur coup et suite.
    fireEvent.click(screen.getByTestId('learn-solution-button'));
    expect(screen.getByTestId('learn-solution').textContent).toBe('Solution : Bb5 puis a6 Ba4');
    expect(document.querySelector('[data-testid="arrows"] g[data-kind="best"]')).not.toBeNull();

    // 3. Bc4 : bon coup (le moteur préférait Bb5), la position avance d'un coup.
    retry.mockResolvedValueOnce(
      answer({
        verdict: 'good',
        san: 'Bc4',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
      }),
    );
    play('f1', 'c4');
    await flush();
    expect(screen.getByTestId('learn-feedback').textContent).toBe(
      '✓ Bien joué : Bc4. Le moteur préférait Bb5.',
    );
    expect(document.querySelector('img[data-square="c4"]')?.getAttribute('alt')).toBe('wb');

    // Exercice suivant, passé : score final 0 / 2 (le premier a demandé plusieurs essais).
    fireEvent.click(screen.getByTestId('learn-next'));
    expect(screen.getByTestId('mode-progress').textContent).toBe('2 / 2');
    expect(screen.getByTestId('learn-prompt').textContent).toContain('meilleur coup que a3');
    fireEvent.click(screen.getByTestId('learn-skip'));
    expect(screen.getByTestId('learn-score').textContent).toBe('0');
    expect(screen.getByTestId('learn-summary').textContent).toContain('Mes erreurs');
  });

  it('trouvé du premier coup : compté dans le score ; coup illégal : aucun appel', async () => {
    const { onExit } = setup([NXE5]);
    play('f1', 'f5');
    expect(retry).not.toHaveBeenCalled();
    retry.mockResolvedValueOnce(answer({ verdict: 'best', san: 'Bb5', fen: P2 }));
    play('f1', 'b5');
    await flush();
    expect(screen.getByTestId('learn-feedback').textContent).toBe('✓ Bien joué : Bb5.');
    fireEvent.click(screen.getByTestId('learn-next'));
    expect(screen.getByTestId('learn-score').textContent).toBe('1');
    // Échap : retour à la revue.
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onExit).toHaveBeenCalled();
  });

  it('moteur indisponible : message et retour à la position', async () => {
    setup([NXE5]);
    retry.mockResolvedValueOnce(null);
    play('f1', 'b5');
    await flush();
    expect(screen.getByTestId('learn-feedback').textContent).toContain('Le moteur ne répond pas');
    expect(document.querySelector('img[data-square="f1"]')?.getAttribute('alt')).toBe('wb');
  });
});
