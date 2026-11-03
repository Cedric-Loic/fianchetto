import { describe, expect, it } from 'vitest';
import { opposite, type Color } from '@sq/shared';
import { projectForViewer, type SecretChoice, type SecretQueenGame } from '@sq/engine';
import { VIEWERS, playLine, snapshotAll, type PlayedLine } from './harness.js';
import { bareRefusalViolations, projectionViolations } from './invariants.js';
import { compareObservations, describeDifference } from './normalize.js';
import { uci } from './public-board.js';

/*
 * Attaques de notation (`docs/RULES.md` §3) : la notation publique ne doit jamais trahir la
 * dame secrète adverse (désambiguïsation, clouage, prise en passant, dernière rangée, roque).
 * Chaque scénario est joué dans deux mondes qui ne diffèrent que par le secret d'un camp.
 */

/** L'observateur (et le public) ne distinguent pas les deux mondes. */
function expectIndistinguishable(a: PlayedLine, b: PlayedLine, observer: Color): void {
  const viewsA = snapshotAll(a.game);
  const viewsB = snapshotAll(b.game);
  for (const viewer of [observer, 'public'] as const) {
    const cmp = compareObservations(viewsA[viewer], viewsB[viewer]);
    expect(cmp.identical, `projection ${viewer} : ${describeDifference(cmp.difference)}`).toBe(
      true,
    );
  }
  const hidden = opposite(observer);
  const own = compareObservations(viewsA[hidden], viewsB[hidden], { dropKeys: ['ownSecret'] });
  expect(own.identical, `projection ${hidden} : ${describeDifference(own.difference)}`).toBe(true);
  const moves = compareObservations(a.moves, b.moves);
  expect(moves.identical, `coups publics : ${describeDifference(moves.difference)}`).toBe(true);
}

/** Les trois projections respectent tous les invariants. */
function expectConformingViews(game: SecretQueenGame, secrets: SecretChoice): void {
  for (const viewer of VIEWERS) {
    const violations = projectionViolations(projectForViewer(game, viewer), {
      viewer,
      over: game.isOver,
      ...(viewer === 'public' ? {} : { ownSecretStart: secrets[viewer] }),
    });
    expect(violations, `projection ${viewer}`).toEqual([]);
  }
}

function sans(line: PlayedLine): string[] {
  return line.moves.map((move) => move.san);
}

describe('notation publique : désambiguïsation (§3.2)', () => {
  // 1. d4 a6 2. Qd3. Monde A : le « pion » d4 est la dame secrète → SAN réelle « Q1d3 ».
  const LINE = ['d2d4', 'a7a6', 'd1d3'];
  const SECRET_ON_D_FILE: SecretChoice = { w: 'd2', b: 'h7' };
  const CONTROL: SecretChoice = { w: 'a2', b: 'h7' };

  it('la dame secrète ne provoque jamais « Q1d3 » (même colonne)', () => {
    const a = playLine(SECRET_ON_D_FILE, LINE);
    const b = playLine(CONTROL, LINE);
    expect(sans(a)).toEqual(['d4', 'a6', 'Qd3']);
    expect(sans(b)).toEqual(['d4', 'a6', 'Qd3']);
    expectIndistinguishable(a, b, 'b');
    expectConformingViews(a.game, SECRET_ON_D_FILE);
  });

  it('la dame secrète ne provoque jamais « Qdd3 » (colonnes différentes)', () => {
    // Monde A : dame secrète en c2, qui atteint aussi d3 → SAN réelle « Qdd3 ».
    const secrets: SecretChoice = { w: 'c2', b: 'h7' };
    const a = playLine(secrets, LINE);
    const b = playLine({ w: 'h2', b: 'h7' }, LINE);
    expect(sans(a)).toEqual(['d4', 'a6', 'Qd3']);
    expect(sans(b)).toEqual(['d4', 'a6', 'Qd3']);
    expectIndistinguishable(a, b, 'b');
    expectConformingViews(a.game, secrets);
  });

  describe('clouage par la dame secrète adverse', () => {
    // 1. d4 b5 2. Nc3 b4 3. e4 a6 4. Nge2. Monde A : le « pion » b4 est la dame secrète noire
    // et cloue le cavalier c3 sur le roi e1 (b4-c3-d2-e1) → SAN réelle « Ne2 ».
    const SETUP = ['d2d4', 'b7b5', 'b1c3', 'b5b4', 'e2e4', 'a7a6'];
    const PINNING: SecretChoice = { w: 'h2', b: 'b7' };
    const FREE: SecretChoice = { w: 'h2', b: 'h7' };

    it('ne supprime jamais une désambiguïsation (« Nge2 » dans les deux mondes)', () => {
      const a = playLine(PINNING, [...SETUP, 'g1e2']);
      const b = playLine(FREE, [...SETUP, 'g1e2']);
      expect(sans(a).at(-1)).toBe('Nge2');
      expect(sans(b).at(-1)).toBe('Nge2');
      expectIndistinguishable(a, b, 'w');
      expectConformingViews(a.game, PINNING);
    });

    it('avant le coup, les Blancs ne voient pas le clouage', () => {
      expectIndistinguishable(playLine(PINNING, SETUP), playLine(FREE, SETUP), 'w');
    });

    it('le cavalier cloué est refusé sans motif ; libre, il est noté « Nce2 »', () => {
      const pinned = playLine(PINNING, SETUP).game.play('w', uci('c3e2'));
      expect(bareRefusalViolations(pinned)).toEqual([]);
      const free = playLine(FREE, SETUP).game.play('w', uci('c3e2'));
      expect(free.ok && free.move.san).toBe('Nce2');
    });
  });
});

describe('notation publique : prise en passant (§3.1, H2)', () => {
  it("le double pas d'une dame secrète ne crée aucune prise en passant visible", () => {
    // 1. Nf3 d5 2. Ng1 d4 3. e4 : monde A, le « pion » e2 est la dame secrète.
    const setup = ['g1f3', 'd7d5', 'f3g1', 'd5d4', 'e2e4'];
    const queenWorld: SecretChoice = { w: 'e2', b: 'a7' };
    const pawnWorld: SecretChoice = { w: 'a2', b: 'a7' };
    const a = playLine(queenWorld, setup);
    const b = playLine(pawnWorld, setup);
    expect(sans(a)).toEqual(['Nf3', 'd5', 'Ng1', 'd4', 'e4']);
    expectIndistinguishable(a, b, 'b');
    expectConformingViews(a.game, queenWorld);

    // La prise en passant est refusée (sans motif) contre la dame, acceptée contre le pion.
    expect(bareRefusalViolations(a.game.play('b', uci('d4e3')))).toEqual([]);
    const ep = b.game.play('b', uci('d4e3'));
    expect(ep.ok).toBe(true);
    if (!ep.ok) return;
    expect(ep.move.san).toBe('dxe3');
    expect(ep.move.capture).toEqual({ pieceId: 'wpe2', displayedType: 'p', square: 'e4' });
  });

  it('une dame secrète ne prend jamais en passant : diagonale vers la case vide = coordonnées', () => {
    // 1. e4 a6 2. e5 d5 3. ? : le pion noir d7 vient de faire un double pas à côté de e5.
    const setup = ['e2e4', 'a7a6', 'e4e5', 'd7d5'];
    const queenWorld: SecretChoice = { w: 'e2', b: 'h7' };
    const a = playLine(queenWorld, setup);
    const b = playLine({ w: 'a2', b: 'h7' }, setup);
    expectIndistinguishable(a, b, 'b');

    const queenMove = a.game.play('w', uci('e5d6'));
    expect(queenMove.ok).toBe(true);
    if (!queenMove.ok) return;
    expect(queenMove.move.san).toBe('e5-d6');
    expect(queenMove.move.capture).toBeNull();
    const after = projectForViewer(a.game, 'b');
    expect(after.pieces.find((p) => p.square === 'd5')?.id).toBe('bpd7');
    expect(after.captured).toEqual({ w: [], b: [] });
    expect(projectForViewer(a.game, 'w').ownSecret).toEqual({ pieceId: 'wpe2', square: 'd6' });
    expectConformingViews(a.game, queenWorld);

    const realEp = b.game.play('w', uci('e5d6'));
    expect(realEp.ok && realEp.move.san).toBe('exd6');
    expect(realEp.ok && realEp.move.capture).toEqual({
      pieceId: 'bpd7',
      displayedType: 'p',
      square: 'd5',
    });
  });

  it("le double pas d'une dame secrète noire n'ouvre pas de prise en passant aux Blancs", () => {
    const setup = ['e2e4', 'a7a6', 'e4e5', 'd7d5'];
    const queenWorld: SecretChoice = { w: 'a2', b: 'd7' };
    const a = playLine(queenWorld, setup);
    const b = playLine({ w: 'a2', b: 'h7' }, setup);
    expectIndistinguishable(a, b, 'w');
    expect(bareRefusalViolations(a.game.play('w', uci('e5d6')))).toEqual([]);
    const ep = b.game.play('w', uci('e5d6'));
    expect(ep.ok && ep.move.san).toBe('exd6');
  });
});

describe('notation publique : dernière rangée (§3.1)', () => {
  // 1. a4 h6 2. a5 h5 3. a6 h4 4. axb7 h3 5. ? — monde A : le « pion » a2 est la dame secrète.
  const SETUP = ['a2a4', 'h7h6', 'a4a5', 'h6h5', 'a5a6', 'h5h4', 'a6b7', 'h4h3'];
  const QUEEN_WORLD: SecretChoice = { w: 'a2', b: 'e7' };
  const PAWN_WORLD: SecretChoice = { w: 'c2', b: 'e7' };

  it('les coups de pion de la dame secrète sont notés comme ceux d’un pion', () => {
    const a = playLine(QUEEN_WORLD, SETUP);
    const b = playLine(PAWN_WORLD, SETUP);
    expect(sans(a)).toEqual(['a4', 'h6', 'a5', 'h5', 'a6', 'h4', 'axb7', 'h3']);
    expectIndistinguishable(a, b, 'b');
  });

  it('dame secrète en dernière rangée : coordonnées, pas de promotion, toujours affichée pion', () => {
    const a = playLine(QUEEN_WORLD, [...SETUP, 'b7a8']);
    const last = a.moves.at(-1);
    expect(last?.san).toBe('b7xa8');
    expect(last?.promotion).toBeNull();
    expect(last?.displayedType).toBe('p');
    expect(last?.capture).toEqual({ pieceId: 'bra8', displayedType: 'r', square: 'a8' });
    const view = projectForViewer(a.game, 'b');
    expect(view.pieces.find((p) => p.square === 'a8')).toEqual({
      id: 'wpa2',
      color: 'w',
      type: 'p',
      square: 'a8',
    });
    expect(view.captured.b).toEqual(['p', 'r']);
    expect(projectForViewer(a.game, 'w').ownSecret).toEqual({ pieceId: 'wpa2', square: 'a8' });
    expectConformingViews(a.game, QUEEN_WORLD);
  });

  it('une promotion demandée pour la dame secrète est ignorée (même sortie que sans)', () => {
    const plain = playLine(QUEEN_WORLD, [...SETUP, 'b7a8']);
    const withPromotion = playLine(QUEEN_WORLD, [...SETUP, 'b7a8n']);
    const cmp = compareObservations(snapshotAll(plain.game), snapshotAll(withPromotion.game));
    expect(cmp.identical, describeDifference(cmp.difference)).toBe(true);
    expect(withPromotion.moves.at(-1)).toStrictEqual(plain.moves.at(-1));
  });

  it('un vrai pion se promeut : notation de pion « bxa8=Q »', () => {
    const b = playLine(PAWN_WORLD, [...SETUP, 'b7a8q']);
    const last = b.moves.at(-1);
    expect(last?.san).toBe('bxa8=Q');
    expect(last?.promotion).toBe('q');
    expect(projectForViewer(b.game, 'b').pieces.find((p) => p.square === 'a8')).toEqual({
      id: 'wpa2',
      color: 'w',
      type: 'q',
      square: 'a8',
    });
    expectConformingViews(b.game, PAWN_WORLD);
  });
});

describe('roque à travers une case attaquée par la dame secrète (§3.8)', () => {
  // 1. g3 a6 2. Bg2 h6 3. Nf3 h5 4. e3 h4 5. O-O ? — monde A : le « pion » a6 est la dame
  // secrète noire ; la diagonale a6-f1 est ouverte, la case traversée f1 est attaquée.
  const SETUP = ['g2g3', 'a7a6', 'f1g2', 'h7h6', 'g1f3', 'h6h5', 'e2e3', 'h5h4'];
  const ATTACKING: SecretChoice = { w: 'a2', b: 'a7' };
  const QUIET: SecretChoice = { w: 'a2', b: 'd7' };

  it('avant le roque, les Blancs ne distinguent pas les deux mondes', () => {
    expectIndistinguishable(playLine(ATTACKING, SETUP), playLine(QUIET, SETUP), 'w');
  });

  it('roque refusé sans motif dans le monde attaqué, « O-O » sinon', () => {
    const attacked = playLine(ATTACKING, SETUP);
    const before = JSON.stringify(snapshotAll(attacked.game));
    expect(bareRefusalViolations(attacked.game.play('w', uci('e1g1')))).toEqual([]);
    expect(JSON.stringify(snapshotAll(attacked.game))).toBe(before);

    const quiet = playLine(QUIET, SETUP).game.play('w', uci('e1g1'));
    expect(quiet.ok).toBe(true);
    if (!quiet.ok) return;
    expect(quiet.move.san).toBe('O-O');
    expect(quiet.move.castle).toEqual({ rookId: 'wrh1', rookFrom: 'h1', rookTo: 'f1' });
  });
});

describe('suffixes donnés par la dame secrète (§3.3)', () => {
  it('échec par la dame secrète : « + » annoncé, sans case ni pièce attaquante', () => {
    const secrets: SecretChoice = { w: 'e2', b: 'a7' };
    const line = playLine(secrets, ['e2e4', 'f7f6', 'e4g6']);
    const last = line.moves.at(-1);
    expect(last?.san).toBe('e4-g6+');
    expect(last?.check).toBe(true);
    expect(projectForViewer(line.game, 'b').inCheck).toBe(true);
    expectConformingViews(line.game, secrets);
  });

  it('mat par la dame secrète : « # », partie terminée, révélation pour tous', () => {
    const secrets: SecretChoice = { w: 'a2', b: 'e7' };
    const line = playLine(secrets, ['f2f3', 'a7a6', 'g2g4', 'e7h4']);
    expect(line.moves.at(-1)?.san).toBe('e7-h4#');
    expect(line.game.isOver).toBe(true);
    expect(line.game.result).toEqual({ winner: 'b', reason: 'checkmate' });
    for (const viewer of VIEWERS) {
      const view = projectForViewer(line.game, viewer);
      expect(view.result).toEqual({ winner: 'b', reason: 'checkmate' });
      expect(view.reveal?.secrets.b.pieceId).toBe('bpe7');
    }
    expectConformingViews(line.game, secrets);
  });
});
