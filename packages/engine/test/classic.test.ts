import { describe, expect, it } from 'vitest';
import { ViewerBoardStateSchema, type Viewer } from '@sq/shared';
import { Secret } from '@sq/shared/secret';
import {
  ClassicGame,
  SecretQueenGame,
  projectClassic,
  type PersistedClassicGame,
  type PersistedGame,
} from '../src/index.js';
import { classicCoreOf } from '../src/internal/classic.js';
import { uci } from './helpers/moves.js';

/*
 * Variante classique : même noyau que Secret Queen, sans dame secrète. La vue est la position
 * réelle, la notation est la SAN standard, les coups légaux du camp au trait sont fournis.
 * Couverture exigée : 100 % de projection-classic.ts (seuil dans vitest.config.ts).
 */

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function play(game: ClassicGame, line: string): string[] {
  return line
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => {
      const outcome = game.play(game.turn, uci(text));
      if (!outcome.ok) throw new Error(`Coup refusé dans le test : ${text}`);
      return outcome.move.san;
    });
}

describe('ClassicGame — position initiale', () => {
  const game = ClassicGame.create();

  it('vue complète et valide : vraies pièces, 20 coups légaux, aucun secret', () => {
    const view = projectClassic(game, 'w');
    expect(ViewerBoardStateSchema.parse(view)).toEqual(view);
    expect(view.pieces).toHaveLength(32);
    expect(view.pieces.find((p) => p.square === 'd1')).toEqual({
      id: 'wqd1',
      color: 'w',
      type: 'q',
      square: 'd1',
    });
    expect(view.legalMoves).toHaveLength(20);
    expect(view.ownSecret).toBeNull();
    expect(view.reveal).toBeNull();
    expect(view.result).toBeNull();
    expect(view.turn).toBe('w');
    expect(view.fullmoveNumber).toBe(1);
  });

  it('même vue pour tous les spectateurs (seul `viewer` change)', () => {
    const strip = (viewer: Viewer) => ({ ...projectClassic(game, viewer), viewer: null });
    expect(strip('b')).toEqual(strip('w'));
    expect(strip('public')).toEqual(strip('w'));
  });

  it('spectateur invalide refusé', () => {
    expect(() => projectClassic(game, 'x' as Viewer)).toThrow('Spectateur invalide.');
  });

  it("le noyau n'est accessible qu'à partir d'une vraie partie", () => {
    expect(() => classicCoreOf({} as ClassicGame)).toThrow('Partie invalide.');
  });
});

describe('ClassicGame — coups et notation standard', () => {
  it('SAN standard, roque, échec et mat du berger', () => {
    const game = ClassicGame.create();
    expect(play(game, 'e2e4 e7e5 f1c4 b8c6 d1h5 g8f6 h5f7')).toEqual([
      'e4',
      'e5',
      'Bc4',
      'Nc6',
      'Qh5',
      'Nf6',
      'Qxf7#',
    ]);
    expect(game.result).toEqual({ winner: 'w', reason: 'checkmate' });
    expect(game.isOver).toBe(true);
    const view = projectClassic(game, 'public');
    expect(view.legalMoves).toBeNull();
    expect(view.reveal).toBeNull();
    expect(view.captured.b).toEqual(['p']);
  });

  it('désambiguïsation standard (un cavalier cloué ne compte pas)', () => {
    const game = ClassicGame.create();
    // Le cavalier c3 est cloué par le fou b4 : Ne2 ne demande pas de désambiguïsation.
    const sans = play(game, 'd2d4 e7e5 b1c3 f8b4 g1f3 a7a6 f3d2 a6a5 d2b3 a5a4 b3d2 g8f6');
    expect(sans.at(-1)).toBe('Nf6');
    const [knight] = play(game, 'd2e4');
    expect(knight).toBe('Nde4');
  });

  it('promotions : une seule entrée par coup dans les coups légaux, notation =Q', () => {
    const game = ClassicGame.create();
    play(game, 'e2e4 d7d5 e4d5 c7c6 d5c6 g8f6 c6b7 b8d7');
    const legal = projectClassic(game, 'w').legalMoves ?? [];
    // 3 coups (b8, xa8, xc8), et non 12 (4 promotions chacun).
    expect(legal.filter((m) => m.from === 'b7')).toEqual([
      { from: 'b7', to: 'b8' },
      { from: 'b7', to: 'a8' },
      { from: 'b7', to: 'c8' },
    ]);
    expect(play(game, 'b7a8q')).toEqual(['bxa8=Q']);
  });

  it('refus sans motif : coup illégal, mauvais camp, partie finie', () => {
    const game = ClassicGame.create();
    expect(game.play('w', uci('e2e5'))).toEqual({ ok: false });
    expect(game.play('b', uci('e7e5'))).toEqual({ ok: false });
    game.resign('w');
    expect(game.play('w', uci('e2e4'))).toEqual({ ok: false });
  });

  it('positions : FEN initiale puis une par demi-coup', () => {
    const game = ClassicGame.create();
    play(game, 'e2e4 e7e5');
    const fens = game.positions();
    expect(fens).toHaveLength(3);
    expect(fens[0]).toBe(START);
    expect(fens[2]?.startsWith('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w')).toBe(true);
  });
});

describe('ClassicGame — fins externes', () => {
  it('abandon, nulle par accord, chute du drapeau', () => {
    const resign = ClassicGame.create();
    expect(resign.resign('b')).toEqual({ winner: 'w', reason: 'resignation' });
    const draw = ClassicGame.create();
    expect(draw.agreeDraw()).toEqual({ winner: null, reason: 'agreement' });
    const flag = ClassicGame.create();
    expect(flag.flagFall('w')).toEqual({ winner: 'b', reason: 'timeout' });
  });

  it('camp invalide refusé', () => {
    const game = ClassicGame.create();
    expect(() => game.resign('x' as 'w')).toThrow('Camp invalide.');
    expect(() => game.flagFall('x' as 'w')).toThrow('Camp invalide.');
  });
});

describe('ClassicGame — persistance', () => {
  it('aller-retour : coups, fin externe, vue identique', () => {
    const game = ClassicGame.create();
    play(game, 'e2e4 e7e5 g1f3');
    game.agreeDraw();
    const restored = ClassicGame.restore(game.toPersisted());
    expect(projectClassic(restored, 'w')).toEqual(projectClassic(game, 'w'));
    expect(restored.toPersisted().expose()).toEqual(game.toPersisted().expose());
  });

  it('données incohérentes refusées sans détail', () => {
    const bad = (data: unknown) => () =>
      ClassicGame.restore(new Secret(data as PersistedClassicGame));
    const base = { version: 1, variant: 'classic', moves: [], externalResult: null };
    expect(bad(null)).toThrow('Partie persistée invalide.');
    expect(bad({ ...base, variant: 'secret-queen' })).toThrow('Partie persistée invalide.');
    expect(bad({ ...base, moves: [{ from: 'e2', to: 'e5' }] })).toThrow(
      'Partie persistée invalide.',
    );
    expect(() => ClassicGame.restore(base as unknown as Secret<PersistedClassicGame>)).toThrow(
      'Partie persistée invalide.',
    );
  });

  it('une partie classique persistée ne devient jamais une partie Secret Queen', () => {
    const persisted = ClassicGame.create().toPersisted();
    expect(() => SecretQueenGame.restore(persisted as unknown as Secret<PersistedGame>)).toThrow();
  });
});

describe('ClassicGame — position de départ quelconque et reprise de coups', () => {
  const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

  it('partie depuis une FEN : trait, numéro de coup, coups légaux, persistance', () => {
    const game = ClassicGame.create(FEN);
    const view = projectClassic(game, 'w');
    expect(view.turn).toBe('w');
    expect(view.fullmoveNumber).toBe(3);
    expect(view.pieces.find((p) => p.square === 'c6')).toMatchObject({ id: 'bnc6', type: 'n' });
    expect(game.positions()[0]).toBe(FEN);
    expect(play(game, 'f1b5 a7a6')).toEqual(['Bb5', 'a6']);
    const restored = ClassicGame.restore(game.toPersisted());
    expect(projectClassic(restored, 'b')).toEqual(projectClassic(game, 'b'));
    expect(restored.toPersisted().expose().initialFen).toBe(FEN);
    // La position initiale standard n'est pas enregistrée comme FEN particulière.
    expect(ClassicGame.create(START).toPersisted().expose().initialFen).toBeUndefined();
  });

  it('FEN invalide, ou partie déjà finie, refusée', () => {
    expect(() => ClassicGame.create('pas une fen')).toThrow();
    // Mat du lion : les Blancs sont matés, rien à jouer.
    expect(() =>
      ClassicGame.create('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'),
    ).toThrow('Position de départ invalide.');
    const bad = (initialFen: unknown) => () =>
      ClassicGame.restore(
        new Secret({
          version: 1,
          variant: 'classic',
          initialFen,
          moves: [],
          externalResult: null,
        } as unknown as PersistedClassicGame),
      );
    expect(bad(12)).toThrow('Partie persistée invalide.');
    expect(bad('pas une fen')).toThrow('Partie persistée invalide.');
  });

  it('reprise de coups : position antérieure, fin de partie annulée', () => {
    const game = ClassicGame.create(FEN);
    play(game, 'f1b5 a7a6 b5c6');
    game.resign('b');
    const back = game.withoutLastMoves(2);
    expect(back.result).toBeNull();
    expect(back.plyCount).toBe(1);
    expect(projectClassic(back, 'w').turn).toBe('b');
    expect(back.positions()[0]).toBe(FEN);
    expect(game.withoutLastMoves(10).plyCount).toBe(0);
  });
});
