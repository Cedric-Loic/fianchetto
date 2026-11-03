import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LessonView, UserPublic } from '@sq/shared';
import { api } from '../src/lib/api';
import { useSession } from '../src/lib/session';
import { LessonPage } from '../src/screens/Lessons';

vi.mock('../src/lib/api', () => ({ api: { lesson: vi.fn() } }));

const USER = { id: 'u1', username: 'moi' } as unknown as UserPublic;

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_E5 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const EXAMPLE = '2b3k1/5ppp/8/3n4/8/8/5PPP/3R2K1 w - - 0 1';

/** Leçon à trois sections : texte, exemple, partie commentée de deux coups. */
const LESSON: LessonView = {
  id: 'demo',
  phase: 1,
  title: 'Leçon de démonstration',
  summary: 'Résumé',
  minutes: 5,
  sections: [
    { kind: 'text', title: 'Introduction', body: 'Premier **paragraphe**.' },
    {
      kind: 'example',
      fen: EXAMPLE,
      caption: 'Le cavalier d5 est en prise.',
      arrows: [{ from: 'd1', to: 'd5' }],
      marks: [],
    },
    {
      kind: 'walkthrough',
      title: 'Partie commentée',
      fen: START,
      steps: [
        { from: 'e2', to: 'e4', san: 'e4', fen: AFTER_E4, comment: 'Coup central.' },
        { from: 'e7', to: 'e5', san: 'e5', fen: AFTER_E5, comment: 'Réponse symétrique.' },
      ],
    },
  ],
  exercises: [
    {
      fen: EXAMPLE,
      prompt: 'Trouve le coup.',
      color: 'w',
      legalMoves: [],
      kind: 'move',
      hints: 0,
    },
  ],
  passRatio: 1,
  best: null,
  passed: false,
};

beforeEach(() => {
  useSession.setState({ user: USER, loaded: true });
  vi.mocked(api.lesson).mockResolvedValue(LESSON);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  useSession.setState({ user: null });
});

describe('lecture d’une leçon : plateau fixe, texte dans le panneau', () => {
  it('un seul plateau, avec tout le texte dans le panneau latéral', async () => {
    render(<LessonPage id="demo" />);
    await screen.findByTestId('lesson-reader');
    expect(screen.getAllByTestId('board')).toHaveLength(1);
    const panel = screen.getByTestId('lesson-reader').querySelector('.side-panel');
    expect(panel?.textContent).toContain('Leçon de démonstration');
    expect(panel?.textContent).toContain('Premier paragraphe.');
    expect(panel?.textContent).toContain('Le cavalier d5 est en prise.');
    expect(screen.getByTestId('exercises').closest('.side-panel')).toBe(panel);
    // Panneau élargi pour le texte.
    expect(screen.getByTestId('lesson-reader').className).toContain('wide');
  });

  it('affiche d’abord le premier exemple ; la partie commentée s’ouvre à la demande', async () => {
    render(<LessonPage id="demo" />);
    await screen.findByTestId('lesson-reader');
    // Exemple actif : pas de commandes de partie, bouton d'ouverture présent.
    expect(screen.queryByTestId('walkthrough')).toBeNull();
    fireEvent.click(await screen.findByTestId('walkthrough-open-2'));
    expect(screen.getByTestId('walkthrough')).toBeTruthy();
    expect(screen.getByTestId('walkthrough').textContent).toContain('Coup 0 / 2');
    // L'exemple, devenu inactif, propose de le revoir.
    expect(screen.getByTestId('section-show-1')).toBeTruthy();
    expect(screen.getAllByTestId('board')).toHaveLength(1);
  });

  it('Suivant, Précédent et les flèches du clavier font avancer la partie active', async () => {
    render(<LessonPage id="demo" />);
    fireEvent.click(await screen.findByTestId('walkthrough-open-2'));
    const walk = screen.getByTestId('walkthrough');

    fireEvent.click(screen.getByTestId('walkthrough-next'));
    expect(walk.textContent).toContain('Coup 1 / 2');
    expect(screen.getByTestId('walkthrough-comment').textContent).toContain('Coup central.');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(walk.textContent).toContain('Coup 2 / 2');
    expect(screen.getByTestId<HTMLButtonElement>('walkthrough-next').disabled).toBe(true);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(walk.textContent).toContain('Coup 1 / 2');
    fireEvent.click(screen.getByTestId('walkthrough-prev'));
    expect(walk.textContent).toContain('Coup 0 / 2');
  });

  it('retrouve sa place dans la partie après un détour par l’exemple', async () => {
    render(<LessonPage id="demo" />);
    fireEvent.click(await screen.findByTestId('walkthrough-open-2'));
    fireEvent.click(screen.getByTestId('walkthrough-next'));
    fireEvent.click(screen.getByTestId('section-show-1'));
    expect(screen.queryByTestId('walkthrough')).toBeNull();
    // Les flèches ne touchent plus la partie tant que l'exemple est actif.
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    fireEvent.click(screen.getByTestId('walkthrough-open-2'));
    await waitFor(() =>
      expect(screen.getByTestId('walkthrough').textContent).toContain('Coup 1 / 2'),
    );
  });

  it('Commencer les exercices quitte la lecture pour le lecteur d’exercices', async () => {
    render(<LessonPage id="demo" />);
    fireEvent.click(await screen.findByTestId('start-exercises'));
    expect(screen.queryByTestId('lesson-reader')).toBeNull();
    expect(screen.getByTestId('exercises')).toBeTruthy();
  });
});
