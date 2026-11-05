import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import type { DisplayedPiece } from '@sq/shared';
import { useBoardHistory, useNavKeys } from '../src/lib/navKeys';
import { piecesFromFen } from '../src/lib/fen';

const FENS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
];

/** Plateau factice : affiche l'indice de la position montrée et l'état « au présent ». */
function Harness() {
  const [step, setStep] = useState(0);
  const [exercise, setExercise] = useState('a');
  const [pieces, setPieces] = useState<DisplayedPiece[]>(() => piecesFromFen(FENS[0] ?? ''));
  const history = useBoardHistory({ pieces, lastMove: null }, exercise);
  useNavKeys(history.nav);
  const shown = FENS.findIndex(
    (f) => JSON.stringify(piecesFromFen(f)) === JSON.stringify(history.frame.pieces),
  );
  const play = () => {
    const next = step + 1;
    setStep(next);
    setPieces(piecesFromFen(FENS[next] ?? ''));
  };
  return (
    <>
      <p data-testid="shown">{shown}</p>
      <p data-testid="live">{String(history.isLive)}</p>
      <button onClick={play}>jouer</button>
      <button
        onClick={() => {
          setExercise('b');
          setStep(0);
          setPieces(piecesFromFen(FENS[0] ?? ''));
        }}
      >
        nouvel exercice
      </button>
      <input aria-label="saisie" />
    </>
  );
}

const key = (k: string, target: Element | Window = window) =>
  act(() => {
    fireEvent.keyDown(target, { key: k });
  });

describe('raccourcis de navigation des plateaux', () => {
  afterEach(cleanup);

  it('← → coup précédent / suivant, ↓ début, ↑ fin ; jouable seulement au présent', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('jouer'));
    fireEvent.click(screen.getByText('jouer'));
    expect(screen.getByTestId('shown').textContent).toBe('2');
    key('ArrowLeft');
    expect(screen.getByTestId('shown').textContent).toBe('1');
    expect(screen.getByTestId('live').textContent).toBe('false');
    key('ArrowDown');
    expect(screen.getByTestId('shown').textContent).toBe('0');
    key('ArrowLeft'); // déjà au début : rien ne change
    expect(screen.getByTestId('shown').textContent).toBe('0');
    key('ArrowRight');
    expect(screen.getByTestId('shown').textContent).toBe('1');
    key('ArrowUp');
    expect(screen.getByTestId('shown').textContent).toBe('2');
    expect(screen.getByTestId('live').textContent).toBe('true');
  });

  it('une nouvelle position ramène au présent ; un nouvel exercice vide l’historique', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('jouer'));
    key('ArrowLeft');
    expect(screen.getByTestId('live').textContent).toBe('false');
    fireEvent.click(screen.getByText('jouer'));
    expect(screen.getByTestId('shown').textContent).toBe('2');
    expect(screen.getByTestId('live').textContent).toBe('true');
    fireEvent.click(screen.getByText('nouvel exercice'));
    key('ArrowDown');
    expect(screen.getByTestId('shown').textContent).toBe('0');
    expect(screen.getByTestId('live').textContent).toBe('true');
  });

  it('les flèches tapées dans un champ de saisie ne naviguent pas', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('jouer'));
    key('ArrowLeft', screen.getByLabelText('saisie'));
    expect(screen.getByTestId('live').textContent).toBe('true');
  });
});
