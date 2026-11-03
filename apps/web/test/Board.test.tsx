import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DisplayedPiece } from '@sq/shared';
import { Board } from '../src/game/Board';

// jsdom ne calcule aucune mise en page : plateau de 400 px (cases de 50 px) en haut à gauche, et
// capture du pointeur simulée.
const SIZE = 50;
beforeEach(() => {
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
  vi.restoreAllMocks();
});

/** Centre d'une case (plateau vu des Blancs). */
function at(square: string) {
  const x = 'abcdefgh'.indexOf(square[0] ?? 'a');
  const y = 8 - Number(square[1]);
  return { clientX: (x + 0.5) * SIZE, clientY: (y + 0.5) * SIZE, pointerId: 1 };
}

const PIECES: DisplayedPiece[] = [
  { id: 'wn1', color: 'w', type: 'n', square: 'g1' },
  { id: 'wk', color: 'w', type: 'k', square: 'e1' },
  { id: 'bk', color: 'b', type: 'k', square: 'e8' },
];

function setup() {
  const onMove = vi.fn();
  render(<Board pieces={PIECES} orientation="w" movable="w" onMove={onMove} />);
  const board = screen.getByTestId('board');
  const knight = () => screen.getByAltText('wn');
  return { onMove, board, knight };
}

describe('Board : boutons autres que le gauche', () => {
  it('clic droit après un clic de sélection : sélection annulée, rien n’est joué', () => {
    const { onMove, board, knight } = setup();
    fireEvent.pointerDown(board, { ...at('g1'), button: 0, buttons: 1 });
    fireEvent.pointerUp(board, { ...at('g1'), button: 0, buttons: 0 });
    expect(board.querySelector('.sq.selected')).not.toBeNull();

    fireEvent.pointerDown(board, { ...at('f3'), button: 2, buttons: 2 });
    fireEvent.pointerUp(board, { ...at('f3'), button: 2, buttons: 0 });
    expect(board.querySelector('.sq.selected')).toBeNull();
    // Pas de surlignage ni de flèche démarrés par ce clic droit.
    expect(board.querySelector('.sq.marked')).toBeNull();
    // Le clic gauche suivant sur f3 ne joue pas le coup : plus rien n'est sélectionné.
    fireEvent.pointerDown(board, { ...at('f3'), button: 0, buttons: 1 });
    fireEvent.pointerUp(board, { ...at('f3'), button: 0, buttons: 0 });
    expect(onMove).not.toHaveBeenCalled();
    expect(knight().dataset.square).toBe('g1');
  });

  it('clic du milieu pendant une sélection : même annulation', () => {
    const { onMove, board } = setup();
    fireEvent.pointerDown(board, { ...at('g1'), button: 0, buttons: 1 });
    fireEvent.pointerUp(board, { ...at('g1'), button: 0, buttons: 0 });
    fireEvent.pointerDown(board, { ...at('f3'), button: 1, buttons: 4 });
    fireEvent.pointerUp(board, { ...at('f3'), button: 1, buttons: 0 });
    expect(board.querySelector('.sq.selected')).toBeNull();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('clic droit pendant un glisser (pointermove avec boutons combinés) : la pièce revient', () => {
    const { onMove, board, knight } = setup();
    fireEvent.pointerDown(board, { ...at('g1'), button: 0, buttons: 1 });
    fireEvent.pointerMove(board, { ...at('f3'), button: -1, buttons: 1 });
    expect(knight().classList.contains('dragging')).toBe(true);
    expect(board.hasPointerCapture(1)).toBe(true);

    // Second bouton pressé pendant le glisser : pas de pointerdown, un pointermove (button 2).
    fireEvent.pointerMove(board, { ...at('f3'), button: 2, buttons: 3 });
    expect(knight().classList.contains('dragging')).toBe(false);
    expect(board.hasPointerCapture(1)).toBe(false);
    expect(board.querySelector('.sq.selected')).toBeNull();

    // Relâchements : rien n'est joué, aucune flèche ni marque.
    fireEvent.pointerUp(board, { ...at('f3'), button: 0, buttons: 2 });
    fireEvent.pointerUp(board, { ...at('f3'), button: 2, buttons: 0 });
    expect(onMove).not.toHaveBeenCalled();
    expect(knight().dataset.square).toBe('g1');
    expect(board.querySelector('.sq.marked')).toBeNull();
    expect(screen.queryByTestId('arrows')).toBeNull();
  });

  it('pointercancel pendant un glisser : la pièce revient sur sa case', () => {
    const { onMove, board, knight } = setup();
    fireEvent.pointerDown(board, { ...at('g1'), button: 0, buttons: 1 });
    fireEvent.pointerMove(board, { ...at('f3'), button: -1, buttons: 1 });
    fireEvent.pointerCancel(board, { ...at('f3') });
    expect(knight().classList.contains('dragging')).toBe(false);
    fireEvent.pointerUp(board, { ...at('f3'), button: 0, buttons: 0 });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('sans sélection, le clic droit dessine toujours flèches et marques', () => {
    const { board } = setup();
    fireEvent.pointerDown(board, { ...at('d4'), button: 2, buttons: 2 });
    fireEvent.pointerUp(board, { ...at('d4'), button: 2, buttons: 0 });
    expect(board.querySelector('.sq.marked')).not.toBeNull();
    fireEvent.pointerDown(board, { ...at('d2'), button: 2, buttons: 2 });
    fireEvent.pointerUp(board, { ...at('d5'), button: 2, buttons: 0 });
    expect(screen.getByTestId('arrows')).toBeTruthy();
  });

  it('un glisser normal joue le coup', () => {
    const { onMove, board } = setup();
    fireEvent.pointerDown(board, { ...at('g1'), button: 0, buttons: 1 });
    fireEvent.pointerMove(board, { ...at('f3'), button: -1, buttons: 1 });
    fireEvent.pointerUp(board, { ...at('f3'), button: 0, buttons: 0 });
    expect(onMove).toHaveBeenCalledWith('g1', 'f3');
  });

  it('clic droit avec des premoves : ils sont annulés', () => {
    const onCancelPremove = vi.fn();
    render(
      <Board
        pieces={PIECES}
        orientation="w"
        movable={null}
        premoveColor="w"
        premoves={[{ from: 'g1', to: 'f3' }]}
        onCancelPremove={onCancelPremove}
      />,
    );
    const board = screen.getByTestId('board');
    fireEvent.pointerDown(board, { ...at('a1'), button: 2, buttons: 2 });
    expect(onCancelPremove).toHaveBeenCalled();
  });
});
