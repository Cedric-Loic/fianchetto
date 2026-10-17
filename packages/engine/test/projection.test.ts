import { describe, expect, it } from 'vitest';
import { SQUARES, ViewerBoardStateSchema, type Viewer } from '@sq/shared';
import { SecretQueenGame, projectForViewer } from '../src/index.js';
import { gameAfter, playAll } from './helpers/moves.js';

/*
 * projectForViewer (docs/RULES.md §2) : seule source de ce que voit un spectateur.
 * Couverture exigée : 100 % (seuil dans vitest.config.ts à la racine).
 */

const KEYS = [
  'viewer',
  'pieces',
  'turn',
  'fullmoveNumber',
  'inCheck',
  'moves',
  'captured',
  'ownSecret',
  'result',
  'reveal',
  'legalMoves',
];

describe('projectForViewer — position initiale', () => {
  const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });

  it('32 pièces triées par case, types affichés (les dames secrètes sont des pions)', () => {
    const view = projectForViewer(game, 'w');
    expect(view.pieces).toHaveLength(32);
    expect(view.pieces.map((p) => SQUARES.indexOf(p.square))).toEqual(
      [...view.pieces.map((p) => SQUARES.indexOf(p.square))].sort((a, b) => a - b),
    );
    expect(view.pieces.find((p) => p.square === 'e2')).toEqual({
      id: 'wpe2',
      color: 'w',
      type: 'p',
      square: 'e2',
    });
    expect(view.pieces.find((p) => p.square === 'd7')).toEqual({
      id: 'bpd7',
      color: 'b',
      type: 'p',
      square: 'd7',
    });
    expect(view.pieces.filter((p) => p.type === 'q').map((p) => p.id)).toEqual(['wqd1', 'bqd8']);
    expect(view.pieces[0]).toEqual({ id: 'wra1', color: 'w', type: 'r', square: 'a1' });
  });

  it('champs de la vue initiale', () => {
    expect(projectForViewer(game, 'w')).toMatchObject({
      viewer: 'w',
      turn: 'w',
      fullmoveNumber: 1,
      inCheck: false,
      moves: [],
      captured: { w: [], b: [] },
      ownSecret: { pieceId: 'wpe2', square: 'e2' },
      result: null,
      reveal: null,
    });
    expect(projectForViewer(game, 'b').ownSecret).toEqual({ pieceId: 'bpd7', square: 'd7' });
    expect(projectForViewer(game, 'public').ownSecret).toBeNull();
  });

  it('exactement les clés du contrat, valides pour le schéma partagé', () => {
    for (const viewer of ['w', 'b', 'public'] as const) {
      const view = projectForViewer(game, viewer);
      expect(Object.keys(view)).toEqual(KEYS);
      expect(ViewerBoardStateSchema.parse(view)).toEqual(view);
    }
  });

  it('refuse un spectateur inconnu', () => {
    expect(() => projectForViewer(game, 'x' as Viewer)).toThrow('Spectateur invalide.');
    expect(() => projectForViewer(game, undefined as unknown as Viewer)).toThrow();
  });

  it('refuse un objet qui n’est pas une partie', () => {
    expect(() => projectForViewer({} as SecretQueenGame, 'public')).toThrow('Partie invalide.');
  });
});

describe('projectForViewer — ce qui ne fuit pas', () => {
  it('aucun type réel, aucune case de prise en passant, aucun compteur, aucun roque', () => {
    // Double pas d'un vrai pion à côté d'un pion adverse : la prise en passant existe.
    const game = gameAfter({ w: 'a2', b: 'd7' }, 'e2e4 h7h6 e4e5 f7f5');
    for (const viewer of ['w', 'b', 'public'] as const) {
      // Seule la clé `legalMoves` (toujours nulle en Secret Queen) peut contenir « legal ».
      const { legalMoves, ...rest } = projectForViewer(game, viewer);
      expect(legalMoves).toBeNull();
      const json = JSON.stringify(rest);
      expect(json).not.toMatch(/fen|castling|passant|halfmove|clock|repetition|legal|f6/i);
      expect(Object.keys(projectForViewer(game, viewer))).toEqual(KEYS);
    }
    // La dame secrète noire d7 reste affichée « p » pour tous.
    for (const viewer of ['w', 'b', 'public'] as const) {
      const piece = projectForViewer(game, viewer).pieces.find((p) => p.id === 'bpd7');
      expect(piece?.type).toBe('p');
    }
  });

  it('les vues des deux camps ne diffèrent de la vue publique que par ownSecret', () => {
    const game = gameAfter({ w: 'c2', b: 'f7' }, 'c2a4 f7h5 e2e4 h5e2');
    const pub = projectForViewer(game, 'public');
    for (const viewer of ['w', 'b'] as const) {
      expect({ ...projectForViewer(game, viewer), viewer: 'public', ownSecret: null }).toEqual(pub);
    }
  });

  it('la vue est une copie : la modifier ne change ni la partie ni les vues suivantes', () => {
    const game = gameAfter({ w: 'e2', b: 'd7' }, 'e2e4 d7d5 e4d5');
    const view = projectForViewer(game, 'w');
    const snapshot = JSON.stringify(view);
    view.pieces.pop();
    view.moves[0]!.san = 'altéré';
    view.moves[2]!.capture!.square = 'a1';
    view.captured.b.push('q');
    expect(JSON.stringify(projectForViewer(game, 'w'))).toBe(snapshot);
  });
});

describe('projectForViewer — déroulement', () => {
  it('numéro de coup, trait, historique, annonce d’échec', () => {
    const game = gameAfter({ w: 'a2', b: 'h7' }, 'e2e4 f7f6');
    let view = projectForViewer(game, 'public');
    expect(view).toMatchObject({ turn: 'w', fullmoveNumber: 2, inCheck: false });
    expect(view.moves.map((m) => m.san)).toEqual(['e4', 'f6']);
    playAll(game, 'd1h5');
    view = projectForViewer(game, 'public');
    expect(view).toMatchObject({ turn: 'b', fullmoveNumber: 2, inCheck: true });
    expect(view.moves.at(-1)).toMatchObject({ san: 'Qh5+', check: true, checkmate: false });
  });

  it('dame secrète du spectateur capturée : ownSecret.square = null, capture affichée « p »', () => {
    const game = gameAfter({ w: 'e2', b: 'd7' }, 'e2e4 d7d5 e4d5');
    expect(projectForViewer(game, 'w').ownSecret).toEqual({ pieceId: 'wpe2', square: 'd5' });
    expect(projectForViewer(game, 'b').ownSecret).toEqual({ pieceId: 'bpd7', square: null });
    expect(projectForViewer(game, 'w').captured).toEqual({ w: [], b: ['p'] });
  });

  it('captures dans l’ordre chronologique, par couleur, types affichés', () => {
    const game = gameAfter({ w: 'h2', b: 'h7' }, 'e2e4 d7d5 e4d5 d8d5 b1c3 d5a2 a1a2');
    expect(projectForViewer(game, 'b').captured).toEqual({ w: ['p', 'p'], b: ['p', 'q'] });
  });
});

describe('projectForViewer — fin de partie', () => {
  it('result et reveal présents si et seulement si la partie est terminée', () => {
    const game = gameAfter({ w: 'e2', b: 'a7' }, 'e2h5 e7e5 f1c4 b8c6');
    expect(projectForViewer(game, 'b')).toMatchObject({ result: null, reveal: null });
    playAll(game, 'h5f7');
    const view = projectForViewer(game, 'b');
    expect(view.result).toEqual({ winner: 'w', reason: 'checkmate' });
    expect(view.reveal).toEqual({
      secrets: {
        w: { pieceId: 'wpe2', initialSquare: 'e2', finalSquare: 'f7' },
        b: { pieceId: 'bpa7', initialSquare: 'a7', finalSquare: 'a7' },
      },
      realInitialFen: 'rnbqkbnr/qppppppp/8/8/8/8/PPPPQPPP/RNBQKBNR w KQkq - 0 1',
      plies: [
        {
          realSan: 'Qh5',
          realFenAfter: 'rnbqkbnr/qppppppp/8/7Q/8/8/PPPP1PPP/RNBQKBNR b KQkq - 1 1',
        },
        {
          realSan: 'e5',
          realFenAfter: 'rnbqkbnr/qppp1ppp/8/4p2Q/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        },
        {
          realSan: 'Bc4',
          realFenAfter: 'rnbqkbnr/qppp1ppp/8/4p2Q/2B5/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2',
        },
        {
          realSan: 'Nc6',
          realFenAfter: 'r1bqkbnr/qppp1ppp/2n5/4p2Q/2B5/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3',
        },
        {
          realSan: 'Qxf7#',
          realFenAfter: 'r1bqkbnr/qppp1Qpp/2n5/4p3/2B5/8/PPPP1PPP/RNBQK1NR b KQkq - 0 3',
        },
      ],
    });
    expect(projectForViewer(game, 'public').reveal).toEqual(view.reveal);
    expect(ViewerBoardStateSchema.parse(view)).toEqual(view);
  });

  it('révélation après une fin externe, dame capturée : finalSquare = null', () => {
    const game = gameAfter({ w: 'e2', b: 'd7' }, 'e2e4 d7d5 e4d5');
    game.resign('b');
    const reveal = projectForViewer(game, 'public').reveal;
    expect(reveal?.secrets).toEqual({
      w: { pieceId: 'wpe2', initialSquare: 'e2', finalSquare: 'd5' },
      b: { pieceId: 'bpd7', initialSquare: 'd7', finalSquare: null },
    });
    expect(reveal?.plies.map((p) => p.realSan)).toEqual(['Qe4', 'Qd5', 'Qxd5']);
  });
});
