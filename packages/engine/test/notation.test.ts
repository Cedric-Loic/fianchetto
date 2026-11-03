import { describe, expect, it } from 'vitest';
import type { Color, PieceType, Square } from '@sq/shared';
import type { PublicBoard, PublicPiece } from '../src/internal/board.js';
import {
  canReach,
  isPawnGeometry,
  publicSan,
  type PublicSanInput,
} from '../src/internal/notation.js';
import { projectForViewer } from '../src/index.js';
import { gameAfter, sans } from './helpers/moves.js';

/*
 * Notation publique (docs/RULES.md §3). Deux niveaux :
 * - fonctions pures sur un échiquier public construit à la main ;
 * - parties réelles, avec comparaison à la SAN réelle de la révélation.
 */

/** Échiquier public à partir d'une description compacte : { e2: 'wp', d1: 'wq' }. */
function board(pieces: Partial<Record<Square, `${Color}${PieceType}`>>): PublicBoard {
  const map = new Map<Square, PublicPiece>();
  for (const [square, code] of Object.entries(pieces)) {
    map.set(square as Square, { color: code[0] as Color, type: code[1] as PieceType });
  }
  return map;
}

function san(input: Partial<PublicSanInput> & Pick<PublicSanInput, 'board' | 'from' | 'to'>) {
  const piece = input.board.get(input.from);
  return publicSan({
    color: piece?.color ?? 'w',
    displayedType: piece?.type ?? 'p',
    isSecretQueen: false,
    enPassant: false,
    promotion: null,
    castle: null,
    check: false,
    mate: false,
    ...input,
  });
}

describe('notation publique — vrai pion (§3.1, cas 1)', () => {
  it('avance, prise, prise en passant, promotion', () => {
    expect(san({ board: board({ e2: 'wp' }), from: 'e2', to: 'e4' })).toBe('e4');
    expect(san({ board: board({ e4: 'wp', d5: 'bp' }), from: 'e4', to: 'd5' })).toBe('exd5');
    expect(
      san({ board: board({ e5: 'wp', d5: 'bp' }), from: 'e5', to: 'd6', enPassant: true }),
    ).toBe('exd6');
    expect(san({ board: board({ e7: 'wp' }), from: 'e7', to: 'e8', promotion: 'q' })).toBe('e8=Q');
    expect(
      san({ board: board({ d7: 'wp', e8: 'br' }), from: 'd7', to: 'e8', promotion: 'n' }),
    ).toBe('dxe8=N');
    expect(san({ board: board({ d2: 'bp' }), from: 'd2', to: 'd1', promotion: 'r' })).toBe('d1=R');
  });
});

describe('notation publique — dame secrète (§3.1, cas 2)', () => {
  const secret = (b: PublicBoard, from: Square, to: Square) =>
    san({ board: b, from, to, isSecretQueen: true });

  it('géométrie de pion sans promotion → notation de pion', () => {
    expect(secret(board({ e2: 'wp' }), 'e2', 'e3')).toBe('e3');
    expect(secret(board({ e2: 'wp' }), 'e2', 'e4')).toBe('e4');
    expect(secret(board({ e4: 'wp', d5: 'bn' }), 'e4', 'd5')).toBe('exd5');
    expect(secret(board({ d7: 'bp' }), 'd7', 'd5')).toBe('d5');
    expect(secret(board({ d4: 'bp', e3: 'wb' }), 'd4', 'e3')).toBe('dxe3');
  });

  it('diagonale vers une case vide (même la case de prise en passant) → coordonnées', () => {
    expect(secret(board({ e5: 'wp', d5: 'bp' }), 'e5', 'd6')).toBe('e5-d6');
    expect(secret(board({ e4: 'wp' }), 'e4', 'f5')).toBe('e4-f5');
  });

  it('double pas hors de la rangée de départ, recul, côté, long trajet → coordonnées', () => {
    expect(secret(board({ e3: 'wp' }), 'e3', 'e5')).toBe('e3-e5');
    expect(secret(board({ e4: 'wp' }), 'e4', 'e3')).toBe('e4-e3');
    expect(secret(board({ e4: 'wp' }), 'e4', 'f4')).toBe('e4-f4');
    expect(secret(board({ a2: 'wp' }), 'a2', 'd5')).toBe('a2-d5');
    expect(secret(board({ a2: 'wp', d5: 'bp' }), 'a2', 'd5')).toBe('a2xd5');
    expect(secret(board({ d7: 'bp' }), 'd7', 'd8')).toBe('d7-d8');
  });

  it('arrivée en dernière rangée (un vrai pion devrait se promouvoir) → coordonnées', () => {
    expect(secret(board({ e7: 'wp' }), 'e7', 'e8')).toBe('e7-e8');
    expect(secret(board({ e7: 'wp', d8: 'br' }), 'e7', 'd8')).toBe('e7xd8');
    expect(secret(board({ d2: 'bp' }), 'd2', 'd1')).toBe('d2-d1');
  });

  it('départ d’une rangée qu’un pion ne peut pas occuper (1re ou 8e) → coordonnées', () => {
    expect(secret(board({ e1: 'wp' }), 'e1', 'e2')).toBe('e1-e2');
    expect(secret(board({ a8: 'wp', b7: 'bp' }), 'a8', 'b7')).toBe('a8xb7');
    expect(secret(board({ h1: 'bp' }), 'h1', 'h2')).toBe('h1-h2');
  });

  it('suffixes d’échec et de mat', () => {
    expect(
      san({
        board: board({ h5: 'wp' }),
        from: 'h5',
        to: 'f7',
        isSecretQueen: true,
        check: true,
        mate: true,
      }),
    ).toBe('h5-f7#');
    expect(
      san({ board: board({ e2: 'wp' }), from: 'e2', to: 'e3', isSecretQueen: true, check: true }),
    ).toBe('e3+');
  });

  it('isPawnGeometry : cas limites', () => {
    // Double pas bloqué sur la case intermédiaire ou sur la case d'arrivée.
    expect(isPawnGeometry(board({ e2: 'wp', e3: 'bn' }), 'w', 'e2', 'e4')).toBe(false);
    expect(isPawnGeometry(board({ e2: 'wp', e4: 'bn' }), 'w', 'e2', 'e4')).toBe(false);
    // Avance d'une case vers une case occupée : ce n'est pas un coup de pion.
    expect(isPawnGeometry(board({ e2: 'wp', e3: 'bn' }), 'w', 'e2', 'e3')).toBe(false);
    // Trois cases, recul en diagonale, diagonale sur une pièce amie (impossible en jeu).
    expect(isPawnGeometry(board({ e2: 'wp' }), 'w', 'e2', 'e5')).toBe(false);
    expect(isPawnGeometry(board({ e4: 'wp', d3: 'bp' }), 'w', 'e4', 'd3')).toBe(false);
    expect(isPawnGeometry(board({ e4: 'wp', d5: 'wn' }), 'w', 'e4', 'd5')).toBe(false);
    expect(isPawnGeometry(board({ e4: 'wp', c5: 'bn' }), 'w', 'e4', 'c5')).toBe(false);
  });
});

describe('notation publique — pièces affichées N, B, R, Q, K (§3.2)', () => {
  it('SAN standard, prises et roques', () => {
    expect(san({ board: board({ g1: 'wn' }), from: 'g1', to: 'f3' })).toBe('Nf3');
    expect(san({ board: board({ g3: 'wb', e5: 'bp' }), from: 'g3', to: 'e5' })).toBe('Bxe5');
    expect(san({ board: board({ e1: 'wk', e2: 'bq' }), from: 'e1', to: 'e2' })).toBe('Kxe2');
    expect(
      san({ board: board({ e1: 'wk', h1: 'wr' }), from: 'e1', to: 'g1', castle: 'king' }),
    ).toBe('O-O');
    expect(
      san({
        board: board({ e8: 'bk', a8: 'br' }),
        from: 'e8',
        to: 'c8',
        castle: 'queen',
        check: true,
      }),
    ).toBe('O-O-O+');
  });

  it('désambiguïsation par colonne, par rangée, par case complète', () => {
    expect(san({ board: board({ b1: 'wn', f3: 'wn' }), from: 'b1', to: 'd2' })).toBe('Nbd2');
    expect(san({ board: board({ a1: 'wr', a5: 'wr' }), from: 'a1', to: 'a3' })).toBe('R1a3');
    expect(san({ board: board({ h4: 'wq', e4: 'wq', h1: 'wq' }), from: 'h4', to: 'e1' })).toBe(
      'Qh4e1',
    );
  });

  it('pas de désambiguïsation si la pièce rivale est bloquée ou d’un autre type affiché', () => {
    expect(san({ board: board({ a1: 'wr', h1: 'wr', e1: 'wk' }), from: 'a1', to: 'd1' })).toBe(
      'Rd1',
    );
    expect(san({ board: board({ d1: 'wq', c2: 'wp' }), from: 'd1', to: 'd3' })).toBe('Qd3');
    expect(san({ board: board({ c1: 'wb', d2: 'wb' }), from: 'd2', to: 'e3' })).toBe('Be3');
  });

  it('une dame secrète (affichée pion) ne provoque jamais de désambiguïsation entre dames', () => {
    // Raison 1 du §3.2 : la SAN réelle serait « Q1d3 ».
    expect(san({ board: board({ d1: 'wq', d5: 'wp' }), from: 'd1', to: 'd3' })).toBe('Qd3');
  });

  it('les clouages ne sont pas pris en compte (raison 2 du §3.2)', () => {
    // Le cavalier c3 est cloué par une dame en a5 (affichée pion) : la SAN réelle serait « Ne2 ».
    const b = board({ c3: 'wn', g1: 'wn', e1: 'wk', a5: 'bp' });
    expect(san({ board: b, from: 'g1', to: 'e2' })).toBe('Nge2');
  });

  it('canReach : mouvements géométriques', () => {
    const empty = board({});
    expect(canReach(empty, 'n', 'g1', 'f3')).toBe(true);
    expect(canReach(empty, 'n', 'g1', 'g3')).toBe(false);
    expect(canReach(empty, 'b', 'c1', 'h6')).toBe(true);
    expect(canReach(empty, 'b', 'c1', 'c4')).toBe(false);
    expect(canReach(empty, 'r', 'a1', 'a8')).toBe(true);
    expect(canReach(empty, 'r', 'a1', 'b2')).toBe(false);
    expect(canReach(empty, 'q', 'd1', 'h5')).toBe(true);
    expect(canReach(empty, 'q', 'd1', 'e3')).toBe(false);
    expect(canReach(empty, 'q', 'd1', 'd1')).toBe(false);
    expect(canReach(board({ d2: 'wp', h5: 'bp' }), 'q', 'd1', 'h5')).toBe(true);
    expect(canReach(board({ f3: 'bp' }), 'q', 'd1', 'h5')).toBe(false);
    expect(canReach(board({ a4: 'wp' }), 'r', 'a1', 'a8')).toBe(false);
  });
});

describe('notation publique — parties réelles', () => {
  it('exemple du §3.2 : « Qd3 » en public, « Q1d3 » en notation réelle', () => {
    const game = gameAfter({ w: 'd2', b: 'h7' });
    expect(sans(game, 'd2d4 a7a6 d4d5 a6a5 d1d3')).toEqual(['d4', 'a6', 'd5', 'a5', 'Qd3']);
    game.resign('b');
    const reveal = projectForViewer(game, 'public').reveal;
    expect(reveal?.plies.map((p) => p.realSan)).toEqual(['Qd4', 'a6', 'Qd5', 'a5', 'Q1d3']);
  });

  it('clouage par la dame secrète adverse : « Nge2 » en public, « Ne2 » en notation réelle', () => {
    const game = gameAfter({ w: 'h2', b: 'c7' });
    expect(sans(game, 'd2d4 c7a5 b1c3 h7h6 e2e4 h6h5 g1e2')).toEqual([
      'd4',
      'c7-a5+',
      'Nc3',
      'h6',
      'e4',
      'h5',
      'Nge2',
    ]);
    game.agreeDraw();
    expect(projectForViewer(game, 'public').reveal?.plies.at(-1)?.realSan).toBe('Ne2');
  });

  it('prise en passant d’un vrai pion : « exd6 »', () => {
    const game = gameAfter({ w: 'h2', b: 'a7' });
    const moves = sans(game, 'e2e4 a7a6 e4e5 d7d5 e5d6');
    expect(moves).toEqual(['e4', 'a6', 'e5', 'd5', 'exd6']);
  });

  it('coups de dame secrète notés en coordonnées, coups de pion notés en pion', () => {
    const game = gameAfter({ w: 'd2', b: 'a7' });
    expect(sans(game, 'd2e3 g8f6 e3d4 f6g8 d4d3 g8f6 e2e3 b8c6 d3e2')).toEqual([
      'd2-e3',
      'Nf6',
      'e3-d4',
      'Ng8',
      'd4-d3',
      'Nf6',
      'e3',
      'Nc6',
      'd3-e2',
    ]);
  });

  it('roque côté dame : « O-O-O » et déplacement de la tour', () => {
    const game = gameAfter({ w: 'h2', b: 'h7' });
    const moves = sans(game, 'd2d4 a7a6 c1f4 b7b6 b1c3 c7c6 d1d2 d7d6 e1c1');
    expect(moves.at(-1)).toBe('O-O-O');
    const view = projectForViewer(game, 'w');
    expect(view.moves.at(-1)?.castle).toEqual({ rookId: 'wra1', rookFrom: 'a1', rookTo: 'd1' });
    expect(view.pieces.find((p) => p.square === 'd1')?.id).toBe('wra1');
    expect(view.pieces.find((p) => p.square === 'c1')?.id).toBe('wke1');
  });
});
