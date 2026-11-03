import { describe, expect, it } from 'vitest';
import { projectForViewer, SecretQueenGame } from '../src/index.js';
import { expectRefused, gameAfter, playAll, uci } from './helpers/moves.js';

/*
 * Cas limites de docs/SPEC.md §3.8, au moins un test chacun, joués par l'API publique.
 * Chaque suite de coups a été vérifiée avec chess.js sur la position réelle.
 */

describe('§3.8 roque', () => {
  // Dame secrète noire b7 → a6 : elle attaque f1 (a6-b5-c4-d3-e2-f1) une fois e2 libéré.
  const LINE = 'g2g3 b7a6 f1g2 g8f6 g1f3 h7h6 e2e4 h6h5';

  it('refusé (sans motif) si une case traversée est attaquée par une dame secrète', () => {
    const game = gameAfter({ w: 'a2', b: 'b7' }, LINE);
    expect(projectForViewer(game, 'w').moves[1]?.san).toBe('b7-a6');
    expectRefused(game, 'e1g1');
  });

  it('accepté quand la diagonale est fermée, avec le déplacement de la tour', () => {
    const game = gameAfter({ w: 'a2', b: 'b7' }, `${LINE} d2d3 h5h4`);
    const [castle] = playAll(game, 'e1g1');
    expect(castle?.san).toBe('O-O');
    expect(castle?.castle).toEqual({ rookId: 'wrh1', rookFrom: 'h1', rookTo: 'f1' });
  });

  it('témoin : même position avec un vrai pion en b7, le roque est légal', () => {
    // Dans ce monde, b7-a6 n'est pas jouable (un pion ne va pas en diagonale sur une case vide).
    const game = gameAfter({ w: 'a2', b: 'a7' }, 'g2g3 b7b6 f1g2 g8f6 g1f3 h7h6 e2e4 h6h5');
    expect(playAll(game, 'e1g1')[0]?.san).toBe('O-O');
  });
});

describe('§3.8 prise en passant (jamais pour la dame secrète, H2)', () => {
  it('la dame secrète qui avance de deux cases ne peut pas être prise en passant', () => {
    const game = gameAfter({ w: 'e2', b: 'h7' }, 'a2a3 d7d5 a3a4 d5d4');
    expect(playAll(game, 'e2e4')[0]?.san).toBe('e4'); // notée comme un double pas de pion
    expectRefused(game, 'd4e3');
  });

  it('témoin : un vrai pion qui avance de deux cases est pris en passant (« dxe3 »)', () => {
    const game = gameAfter({ w: 'a2', b: 'h7' }, 'h2h3 d7d5 h3h4 d5d4 e2e4');
    const [move] = playAll(game, 'd4e3');
    expect(move?.san).toBe('dxe3');
    expect(move?.capture).toEqual({ pieceId: 'wpe2', displayedType: 'p', square: 'e4' });
    expect(projectForViewer(game, 'w').pieces.some((p) => p.square === 'e4')).toBe(false);
  });

  it('la dame secrète ne prend pas en passant : la diagonale est un simple coup de dame', () => {
    const game = gameAfter({ w: 'a2', b: 'd7' }, 'h2h3 d7d5 h3h4 d5d4 e2e4');
    const [move] = playAll(game, 'd4e3');
    expect(move?.san).toBe('d4-e3+'); // coordonnées ; échec au roi e1 par la colonne e
    expect(move?.capture).toBeNull();
    const view = projectForViewer(game, 'b');
    expect(view.pieces.find((p) => p.square === 'e4')?.id).toBe('wpe2'); // le pion reste
    expect(view.captured).toEqual({ w: [], b: [] });
  });
});

describe('§3.8 promotion d’un pion ordinaire', () => {
  const LINE = 'a2a4 b7b5 a4b5 a7a6 b5a6 c8b7 a6b7 b8c6';

  it('refusée sans pièce de promotion, acceptée avec le choix du joueur', () => {
    const game = gameAfter({ w: 'h2', b: 'h7' }, LINE);
    expectRefused(game, 'b7a8');
    const [move] = playAll(game, 'b7a8n');
    expect(move).toMatchObject({
      san: 'bxa8=N',
      pieceId: 'wpa2',
      displayedType: 'p',
      promotion: 'n',
      capture: { pieceId: 'bra8', displayedType: 'r', square: 'a8' },
    });
    const piece = projectForViewer(game, 'b').pieces.find((p) => p.square === 'a8');
    expect(piece).toEqual({ id: 'wpa2', color: 'w', type: 'n', square: 'a8' });
    // La pièce promue est bien un cavalier dans la position réelle.
    expect(game.play('b', uci('h7h6')).ok).toBe(true);
    expect(playAll(game, 'a8c7')[0]?.san).toBe('Nxc7+');
  });

  it('promotion en dame : « =Q » et type affiché « q »', () => {
    const game = gameAfter({ w: 'h2', b: 'h7' }, LINE);
    expect(playAll(game, 'b7a8q')[0]?.san).toBe('bxa8=Q');
    expect(projectForViewer(game, 'public').pieces.find((p) => p.square === 'a8')?.type).toBe('q');
  });
});

describe('§3.8 dame secrète en dernière rangée', () => {
  it('reste une dame, sans promotion, toujours affichée pion ; la promotion demandée est ignorée', () => {
    const game = gameAfter({ w: 'a2', b: 'h7' }, 'a2a4 b7b5 a4b5 a7a6 b5a6 c8b7 a6b7 b8c6');
    const [move] = playAll(game, 'b7a8q');
    expect(move).toMatchObject({ san: 'b7xa8', displayedType: 'p', promotion: null });
    const view = projectForViewer(game, 'w');
    expect(view.pieces.find((p) => p.square === 'a8')).toEqual({
      id: 'wpa2',
      color: 'w',
      type: 'p',
      square: 'a8',
    });
    expect(view.ownSecret).toEqual({ pieceId: 'wpa2', square: 'a8' });
    // Elle continue de jouer comme une dame (recul en colonne a), notée en coordonnées.
    expect(playAll(game, 'g8f6 a8a3')[1]?.san).toBe('a8-a3');
    expect(game.toPersisted().expose().moves[8]).toEqual({ from: 'b7', to: 'a8' });
  });
});

describe('§3.8 pat et mat impliquant une dame secrète', () => {
  it('mat donné par une dame secrète', () => {
    const game = gameAfter({ w: 'e2', b: 'a7' }, 'e2h5 e7e5 f1c4 b8c6');
    const [move] = playAll(game, 'h5f7');
    expect(move).toMatchObject({ san: 'h5xf7#', check: true, checkmate: true });
    expect(game.result).toEqual({ winner: 'w', reason: 'checkmate' });
    expect(game.isOver).toBe(true);
    expect(projectForViewer(game, 'b').inCheck).toBe(true);
  });

  it('pat donné par une dame secrète (pat de Loyd adapté, 10 coups)', () => {
    const line =
      'b1c3 a7a5 e2h5 a8a6 h5a5 h7h5 h2h4 a6h6 a5c7 f7f6 c7d7 e8f7 d7b7 d8d3 b7b8 d3h7 b8c8 f7g6';
    const game = gameAfter({ w: 'e2', b: 'c7' }, line);
    const [move] = playAll(game, 'c8e6');
    expect(move).toMatchObject({ san: 'c8-e6', check: false, checkmate: false });
    expect(game.result).toEqual({ winner: null, reason: 'stalemate' });
    // La dame secrète noire (c7) a été prise par la dame secrète blanche, affichée « p ».
    expect(projectForViewer(game, 'b').ownSecret).toEqual({ pieceId: 'bpc7', square: null });
    expect(projectForViewer(game, 'w').captured.b).toContain('p');
  });
});

/*
 * Parties trouvées par recherche aléatoire (prises favorisées), vérifiées avec chess.js.
 * Position finale indiquée en FEN réelle.
 */
// → 8/8/8/6K1/8/N2k4/8/8 b : roi + cavalier contre roi.
const INSUFFICIENT =
  'f2a7 b7g2 f1g2 a8a7 g2a8 a7a8 b2b4 a8a2 a1a2 g8f6 a2a6 c8a6 g1f3 a6e2 e1e2 b8a6 h1e1 a6b4 ' +
  'd2d4 b4c2 d1c2 h7h6 c1h6 h8h6 c2c7 h6h2 f3h2 d8c7 e2f2 c7h2 f2f3 h2h5 f3g2 e7e5 d4e5 h5e5 ' +
  'e1e5 f8e7 e5e7 e8e7 g2f3 e7e6 f3e3 f6d5 e3d4 e6f5 d4d5 f7f6 b1a3 d7d6 d5d6 f5e4 d6e7 g7g5 ' +
  'e7f6 e4d3 f6g5';
// → 8/K7/8/8/4Q2k/8/8/8 b : roi + dame secrète blanche (c2) contre roi seul.
const K_VS_SECRET =
  'c2a4 f7a2 d1b3 a2b2 b3g8 b2c1 a4d1 h8g8 a1a7 c1d2 e1d2 a8a7 e2e4 b7b6 f1a6 c8a6 g1e2 a6e2 ' +
  'd1e2 a7a8 b1a3 b8c6 d2c3 a8a3 c3c4 a3f3 g2f3 d8c8 e2e3 c6d4 e3d4 e7e5 d4b6 g8h8 b6c7 g7g6 ' +
  'c7c8 e8e7 c8d7 e7f6 d7h7 f8c5 c4c5 f6g5 h7g6 g5f4 c5b6 h8h3 g6h7 f4f3 h7h3 f3e4 h3d7 e4f4 ' +
  'h2h4 f4f3 b6a7 e5e4 d7d8 f3f2 h1d1 f2e3 d1g1 e3f3 d8b6 f3f4 g1g3 f4g3 b6d4 g3h4 d4e4';
// → 8/8/8/6k1/8/8/3K3q/1N6 w : roi + cavalier contre roi + dame secrète noire (f7) en h2.
const N_VS_SECRET =
  'f2a7 f7f6 a7a8 f6b2 a8b8 b2a1 b8c7 a1a2 c7b7 a2c2 b7d7 e8f7 d7e7 f7g6 e7a7 c2c1 a7g7 g6h5 ' +
  'g7h7 g8h6 h7h6 h5g4 h6f8 c1d1 e1f2 h8h5 f8d8 d1d2 d8c8 g4h4 f2f3 d2e2 f3f4 e2f1 f4e4 f1g1 ' +
  'c8c5 g1g2 e4e3 g2h1 c5h5 h4h5 e3d3 h5g5 d3d2 h1h2';
// → 8/8/pk3K2/8/8/8/8/1N6 b : roi + cavalier contre roi + vrai pion a6.
const N_VS_PAWN =
  'h2c7 d8c7 h1h7 c7c2 h7g7 c2b2 c1b2 f8g7 b2g7 f7f5 g7h8 d7d5 a2a3 b7b5 f2f4 c8a6 e2e4 d5e4 ' +
  'f1b5 a6b5 g2g4 f5g4 d1g4 e8d8 g4g8 b5e8 g8e8 d8e8 e1e2 e8d7 h8f6 e7f6 f4f5 d7d8 g1f3 e4f3 ' +
  'e2f3 d8c8 f3g3 c8d7 d2d3 b8c6 g3g4 d7e8 a1a2 c6d4 g4h4 d4f5 h4g4 f5e7 g4f4 e7g6 f4e3 e8e7 ' +
  'b1d2 g6f8 e3e4 f6f5 e4f5 e7d6 a2b2 a8c8 f5g5 c8d8 g5h5 d6d7 h5g4 d7c6 d2f1 d8d3 b2b6 c6b6 ' +
  'g4h5 d3a3 f1d2 a3g3 d2b1 g3g2 h5h6 g2g7 h6g7 f8d7 b1a3 d7f6 a3b1 a7a6 g7f6';
// → 5Q2/8/6k1/5b2/8/8/6K1/8 b : roi + fou contre roi + dame secrète blanche (e2) en f8.
const B_VS_SECRET =
  'f2f4 d7d6 b2b3 e7e6 e2e5 f7f6 e5e2 e6e3 b1c3 b7b6 g1f3 b8c6 f3d4 c6d4 g2g3 d4c2 d1c2 e8f7 ' +
  'c2h7 e3f4 c3b1 f4d2 e1f2 d2a2 h7g7 f7g7 c1h6 g8h6 e2d2 a2a1 d2d6 c7c6 d6f6 g7g8 f6h8 g8f7 ' +
  'h8h6 a1b1 h6c6 b1b3 c6a8 b3g3 f2e2 g3h2 e2e1 h2h1 e1e2 h1f1 e2e3 c8e6 a8a7 f7e8 a7a5 e6f5 ' +
  'a5b6 f1f2 e3f2 e8e7 b6d8 e7f7 f2g2 f7g6 d8f8';

describe('§3.8 matériel insuffisant (calculé sur les pièces réelles)', () => {
  it('nulle automatique quand aucun camp ne peut mater (roi + cavalier contre roi)', () => {
    const moves = INSUFFICIENT.split(' ');
    const game = gameAfter({ w: 'f2', b: 'b7' }, moves.slice(0, -1).join(' '));
    expect(game.isOver).toBe(false);
    playAll(game, moves.at(-1) as string);
    expect(game.result).toEqual({ winner: null, reason: 'insufficient-material' });
    const pieces = projectForViewer(game, 'public').pieces.map((p) => `${p.color}${p.type}`);
    expect(pieces.sort()).toEqual(['bk', 'wk', 'wn']);
  });

  it('pas de nulle avec roi + « pion » contre roi quand le « pion » est la dame secrète', () => {
    const game = gameAfter({ w: 'c2', b: 'f7' }, K_VS_SECRET);
    expect(game.isOver).toBe(false);
    const view = projectForViewer(game, 'b');
    expect(view.pieces.map((p) => `${p.color}${p.type}${p.square}`)).toEqual([
      'wka7',
      'wpe4',
      'bkh4',
    ]);
  });
});

describe('§3.8 règle des 50 coups (un coup de dame secrète ne remet pas le compteur à zéro)', () => {
  // 100 demi-coups sans prise ni coup de vrai pion, dont 58 coups des dames secrètes (e2 et d7),
  // sans triple répétition (suite trouvée par recherche aléatoire, vérifiée avec chess.js).
  // Le dernier coup donne échec sans mat : la nulle s'applique.
  const FIFTY = [
    'e2d3 b8a6 d3e2 g8f6 e2e5 d7e6 d1h5 f6g8 e5e2 e6d5 b1a3 a8b8 h5e5 d5d3 e2e4 d3d6 e5e6 d6d4',
    'e4e3 d4h4 e3h6 h4g3 f1d3 a6b4 h6f6 g3h3 f6h6 h3f5 g1h3 f5d5 h1f1 c8d7 h6f4 d7a4 e6b6 d5e4',
    'f4e3 d8d4 d3e2 e4e5 e3h6 e5e3 h6c6 d4d7 f1h1 e3d3 e2f1 d3e3 f1e2 e3h6 c6f3 d7f5 b6d6 g8f6',
    'a1b1 h6e3 f3c6 f5d7 c6c4 e3b6 a3b5 f6h5 d6f4 b6d6 h3g5 d6b6 c4b3 b6a6 b3c3 d7d4 f4g4 b8c8',
    'e2f3 a6e6 c3e3 e6f6 e3e5 d4d7 e5c5 f6e5 c5e3 e5f4 e3d4 h5f6 d4c4 f4e3 c4e2 e3b6 b5d6 e8d8',
    'e2d1 b6e3 d1e2 c8b8 h1f1 e3d4 e2e3 d4e4 g4g3 b4d3',
  ].join(' ');

  it('nulle automatique au 100e demi-coup, coups de dames secrètes compris', () => {
    const moves = FIFTY.split(' ');
    const game = gameAfter({ w: 'e2', b: 'd7' }, moves.slice(0, 99).join(' '));
    const played = projectForViewer(game, 'public').moves;
    expect(played.filter((m) => m.pieceId === 'wpe2' || m.pieceId === 'bpd7').length).toBe(58);
    expect(played.every((m) => m.capture === null)).toBe(true);
    expect(game.isOver).toBe(false);
    const [last] = playAll(game, moves[99] as string);
    expect(last?.check).toBe(true);
    expect(game.result).toEqual({ winner: null, reason: 'fifty-move-rule' });
    const fen = projectForViewer(game, 'w').reveal?.plies.at(-1)?.realFenAfter;
    expect(fen?.split(' ')[4]).toBe('100');
  });

  it('un coup de vrai pion remet le compteur à zéro', () => {
    const moves = FIFTY.split(' ');
    const game = gameAfter({ w: 'e2', b: 'd7' }, moves.slice(0, 98).join(' '));
    playAll(game, 'a2a3 b7b6'); // deux coups de vrais pions au lieu des deux derniers coups
    expect(game.isOver).toBe(false);
    game.agreeDraw();
    const fen = projectForViewer(game, 'w').reveal?.plies.at(-1)?.realFenAfter;
    expect(fen?.split(' ')[4]).toBe('0');
  });
});

describe('§3.8 triple répétition (sur la position réelle)', () => {
  it('trois fois la même position réelle → nulle automatique', () => {
    const game = gameAfter({ w: 'a2', b: 'a7' }, 'g1f3 g8f6 f3g1 f6g8 g1f3 g8f6 f3g1');
    expect(game.isOver).toBe(false);
    playAll(game, 'f6g8');
    expect(game.result).toEqual({ winner: null, reason: 'threefold-repetition' });
  });

  it('position publique répétée 3 fois mais pas la position réelle → pas de nulle (§9)', () => {
    // La dame secrète d2 passe en e3, puis échange sa case avec le vrai pion e2 :
    // l'échiquier public (pions en e2 et e3) se répète, la position réelle non.
    const game = gameAfter({ w: 'd2', b: 'a7' }, 'd2e3 g8f6');
    const publicKey = () =>
      JSON.stringify(
        projectForViewer(game, 'public').pieces.map((p) => [p.type, p.square, p.color]),
      );
    const first = publicKey();
    playAll(game, 'g1f3 f6g8 f3g1 g8f6');
    expect(publicKey()).toBe(first); // 2e occurrence (réelle et publique)
    playAll(game, 'e3d4 f6g8 d4d3 g8f6 e2e3 b8c6 d3e2 c6b8');
    expect(publicKey()).toBe(first); // 3e occurrence publique, 1re de la nouvelle position réelle
    expect(game.isOver).toBe(false);
    playAll(game, 'g1f3 f6g8 f3g1 g8f6 g1f3 f6g8 f3g1');
    expect(game.isOver).toBe(false);
    playAll(game, 'g8f6'); // 3e occurrence de la nouvelle position réelle
    expect(game.result).toEqual({ winner: null, reason: 'threefold-repetition' });
  });
});

describe('§3.8 chute du drapeau, abandon, nulle par accord', () => {
  it('abandon : défaite du camp qui abandonne, à tout moment', () => {
    const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });
    expect(game.resign('w')).toEqual({ winner: 'b', reason: 'resignation' });
    expect(game.result).toEqual({ winner: 'b', reason: 'resignation' });
    expectRefused(game, 'd2d4');
  });

  it('nulle par accord', () => {
    const game = gameAfter({ w: 'e2', b: 'd7' }, 'e2e4');
    expect(game.agreeDraw()).toEqual({ winner: null, reason: 'agreement' });
    expect(game.isOver).toBe(true);
  });

  it('chute du drapeau : défaite si l’adversaire peut mater', () => {
    const game = gameAfter({ w: 'e2', b: 'd7' }, 'e2e4');
    expect(game.flagFall('b')).toEqual({ winner: 'w', reason: 'timeout' });
  });

  it('chute du drapeau : nulle si l’adversaire n’a que son roi', () => {
    // Blancs : Ka7 + dame secrète c2 (affichée pion, en e4) ; Noirs : roi h4 seul.
    const game = gameAfter({ w: 'c2', b: 'f7' }, K_VS_SECRET);
    expect(game.isOver).toBe(false);
    expect(game.flagFall('w')).toEqual({
      winner: null,
      reason: 'timeout-vs-insufficient-material',
    });
    const other = gameAfter({ w: 'c2', b: 'f7' }, K_VS_SECRET);
    expect(other.flagFall('b')).toEqual({ winner: 'w', reason: 'timeout' });
  });

  it('chute du drapeau : jugée sur les pièces réelles (la dame secrète n’est pas un pion)', () => {
    // Même matériel affiché (R+C contre R+« pion ») : le cavalier ne peut mater que si le
    // « pion » est un vrai pion (il peut bloquer son roi), pas une dame (règle de lichess).
    const queen = gameAfter({ w: 'f2', b: 'f7' }, N_VS_SECRET);
    expect(queen.flagFall('b')).toEqual({
      winner: null,
      reason: 'timeout-vs-insufficient-material',
    });
    const pawn = gameAfter({ w: 'h2', b: 'c7' }, N_VS_PAWN);
    expect(pawn.flagFall('b')).toEqual({ winner: 'w', reason: 'timeout' });
    // Fou contre dame secrète seule (affichée pion en f8) : le fou ne peut pas mater.
    const bishop = gameAfter({ w: 'e2', b: 'e7' }, B_VS_SECRET);
    expect(bishop.flagFall('w')).toEqual({
      winner: null,
      reason: 'timeout-vs-insufficient-material',
    });
    const queenSide = gameAfter({ w: 'e2', b: 'e7' }, B_VS_SECRET);
    expect(queenSide.flagFall('b')).toEqual({ winner: 'w', reason: 'timeout' });
  });

  it('fins externes impossibles sur une partie terminée', () => {
    const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });
    game.agreeDraw();
    expect(() => game.resign('b')).toThrow();
    expect(() => game.agreeDraw()).toThrow();
    expect(() => game.flagFall('w')).toThrow();
    expect(game.result).toEqual({ winner: null, reason: 'agreement' });
  });
});
