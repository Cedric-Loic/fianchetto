import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import type { MoveIntent } from '@sq/shared';
import { REDACTED, Secret } from '@sq/shared/secret';
import { SecretQueenGame, projectForViewer, type PersistedGame } from '../src/index.js';
import { expectRefused, gameAfter, playAll, uci } from './helpers/moves.js';

describe('SecretQueenGame.create', () => {
  it('crée une partie à partir des cases de départ des deux pions secrets', () => {
    const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });
    expect(game.turn).toBe('w');
    expect(game.plyCount).toBe(0);
    expect(game.isOver).toBe(false);
    expect(game.result).toBeNull();
  });

  it.each([
    { w: 'e7', b: 'd7' },
    { w: 'e2', b: 'd2' },
    { w: 'e1', b: 'd7' },
    { w: 'e2', b: 'd8' },
    { w: 'z2', b: 'd7' },
    { w: 'e2' },
    null,
    'e2',
  ])('refuse un choix invalide (%j), sans le répéter dans le message', (secrets) => {
    expect(() => SecretQueenGame.create(secrets as never)).toThrow(
      'Choix de dame secrète invalide.',
    );
  });

  it('le constructeur est privé (pas de partie sans secrets validés)', () => {
    const Ctor = SecretQueenGame as unknown as new () => unknown;
    expect(() => new Ctor()).toThrow('Partie invalide.');
  });
});

describe('play', () => {
  it('renvoie le coup public complet', () => {
    const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });
    expect(game.play('w', uci('d2d4'))).toEqual({
      ok: true,
      move: {
        ply: 1,
        color: 'w',
        pieceId: 'wpd2',
        displayedType: 'p',
        from: 'd2',
        to: 'd4',
        san: 'd4',
        capture: null,
        promotion: null,
        castle: null,
        check: false,
        checkmate: false,
      },
      result: null,
    });
    expect(game.turn).toBe('b');
    expect(game.plyCount).toBe(1);
  });

  it('décrit la prise avec le type affiché de la pièce prise', () => {
    // La dame secrète noire d7 est prise : elle apparaît comme un pion.
    const game = gameAfter({ w: 'a2', b: 'd7' }, 'e2e4 d7d5');
    const [move] = playAll(game, 'e4d5');
    expect(move?.capture).toEqual({ pieceId: 'bpd7', displayedType: 'p', square: 'd5' });
    expect(projectForViewer(game, 'w').captured).toEqual({ w: [], b: ['p'] });
  });

  it('refuse sans motif : mauvais camp, coup illégal, pièce adverse, case vide', () => {
    const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });
    expect(game.play('b', uci('d7d5'))).toEqual({ ok: false }); // pas son tour
    expectRefused(game, 'd2d5'); // vrai pion : trois cases
    expectRefused(game, 'a1a3'); // tour bloquée par le pion a2
    expectRefused(game, 'd7d5'); // pièce adverse
    expectRefused(game, 'e4e5'); // case vide
    expectRefused(game, 'e2e2'); // coup nul
    expectRefused(game, 'e1g1'); // roque impossible (cases occupées)
  });

  it('accepte un coup de dame pour la dame secrète, et le refuse pour un vrai pion', () => {
    expect(SecretQueenGame.create({ w: 'e2', b: 'd7' }).play('w', uci('e2e5')).ok).toBe(true);
    expectRefused(SecretQueenGame.create({ w: 'a2', b: 'd7' }), 'e2e5');
  });

  it('refuse les intentions mal formées', () => {
    const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });
    const malformed: unknown[] = [
      null,
      'e2e4',
      {},
      { from: 'e2' },
      { from: 'z9', to: 'e4' },
      { from: 'e2', to: 'e4', promotion: 'k' },
      { from: 'e2', to: 'e4', promotion: 'Q' },
      { from: 2, to: 4 },
    ];
    for (const intent of malformed) {
      expect(game.play('w', intent as MoveIntent)).toEqual({ ok: false });
    }
    expect(game.play('x' as never, uci('d2d4'))).toEqual({ ok: false });
    expect(game.plyCount).toBe(0);
  });

  it('ignore la promotion demandée pour un coup qui n’est pas une promotion', () => {
    const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });
    const outcome = game.play('w', { from: 'd2', to: 'd4', promotion: 'q' });
    expect(outcome.ok && outcome.move.promotion).toBe(null);
    expect(game.toPersisted().expose().moves).toEqual([{ from: 'd2', to: 'd4' }]);
  });

  it('le coup renvoyé est une copie : le modifier ne change pas la partie', () => {
    const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });
    const outcome = game.play('w', uci('g1f3'));
    if (!outcome.ok) throw new Error('coup refusé');
    outcome.move.san = 'altéré';
    expect(projectForViewer(game, 'public').moves[0]?.san).toBe('Nf3');
  });

  it('refuse tout coup une fois la partie terminée', () => {
    const game = gameAfter({ w: 'e2', b: 'a7' }, 'e2h5 e7e5 f1c4 b8c6 h5f7');
    expect(game.isOver).toBe(true);
    expect(game.play('b', uci('e8e7'))).toEqual({ ok: false });
  });
});

describe('fins externes', () => {
  it('abandon, nulle, chute du drapeau ; camp invalide refusé', () => {
    expect(SecretQueenGame.create({ w: 'e2', b: 'd7' }).resign('b')).toEqual({
      winner: 'w',
      reason: 'resignation',
    });
    expect(SecretQueenGame.create({ w: 'e2', b: 'd7' }).flagFall('w')).toEqual({
      winner: 'b',
      reason: 'timeout',
    });
    const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });
    expect(() => game.resign('x' as never)).toThrow('Camp invalide.');
    expect(() => game.flagFall('public' as never)).toThrow('Camp invalide.');
    expect(game.isOver).toBe(false);
  });

  it('result renvoie une copie', () => {
    const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });
    game.resign('w');
    const result = game.result;
    if (result === null) throw new Error('partie non terminée');
    result.winner = 'w';
    expect(game.result).toEqual({ winner: 'b', reason: 'resignation' });
  });
});

describe('confidentialité de l’objet partie', () => {
  const game = gameAfter({ w: 'e2', b: 'd7' }, 'e2e4 d7d5');

  it('toJSON, toString, util.inspect renvoient « [REDACTED] »', () => {
    expect(JSON.stringify(game)).toBe(JSON.stringify(REDACTED));
    expect(JSON.stringify({ nested: { game } })).toBe(`{"nested":{"game":"${REDACTED}"}}`);
    expect(String(game)).toBe(REDACTED);
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    expect(`${game}`).toBe(REDACTED);
    expect(inspect(game, { depth: 10, showHidden: true })).toBe(REDACTED);
    expect(inspect({ game }, { depth: 10 })).not.toMatch(/fen|chess|secret|wpe2/i);
    expect(Object.prototype.toString.call(game)).toBe('[object SecretQueenGame]');
  });

  it('aucune propriété énumérable ; structuredClone ne copie rien', () => {
    expect(Object.keys(game)).toEqual([]);
    expect(Object.getOwnPropertyNames(game)).toEqual([]);
    expect(JSON.stringify({ ...game })).toBe('{}');
    expect(JSON.stringify(structuredClone(game))).toBe('{}');
  });
});

describe('persistance', () => {
  it('toPersisted renvoie un Secret contenant secrets, coups et fin externe', () => {
    const game = gameAfter({ w: 'e2', b: 'd7' }, 'e2e4 d7d5');
    const persisted = game.toPersisted();
    expect(Secret.isSecret(persisted)).toBe(true);
    expect(JSON.stringify(persisted)).toBe(JSON.stringify(REDACTED));
    expect(persisted.expose()).toEqual({
      version: 1,
      secrets: { w: 'e2', b: 'd7' },
      moves: [
        { from: 'e2', to: 'e4' },
        { from: 'd7', to: 'd5' },
      ],
      externalResult: null,
    });
    game.resign('b');
    expect(game.toPersisted().expose().externalResult).toEqual({
      winner: 'w',
      reason: 'resignation',
    });
  });

  it('la forme persistée est une copie', () => {
    const game = gameAfter({ w: 'e2', b: 'd7' }, 'e2e4');
    const data = game.toPersisted().expose();
    data.moves.push({ from: 'a7', to: 'a6' });
    data.secrets.w = 'a2';
    expect(game.toPersisted().expose().moves).toHaveLength(1);
    expect(game.toPersisted().expose().secrets.w).toBe('e2');
  });

  it('restore rejoue la partie à l’identique, fin externe comprise', () => {
    const game = gameAfter({ w: 'a2', b: 'h7' }, 'a2a4 b7b5 a4b5 a7a6 b5a6 c8b7 a6b7 b8c6 b7a8q');
    const restored = SecretQueenGame.restore(game.toPersisted());
    for (const viewer of ['w', 'b', 'public'] as const) {
      expect(projectForViewer(restored, viewer)).toEqual(projectForViewer(game, viewer));
    }
    game.flagFall('b');
    const ended = SecretQueenGame.restore(game.toPersisted());
    expect(ended.result).toEqual({ winner: 'w', reason: 'timeout' });
    expect(projectForViewer(ended, 'b')).toEqual(projectForViewer(game, 'b'));
  });

  it('restore d’une partie terminée par mat', () => {
    const game = gameAfter({ w: 'e2', b: 'a7' }, 'e2h5 e7e5 f1c4 b8c6 h5f7');
    const restored = SecretQueenGame.restore(game.toPersisted());
    expect(restored.result).toEqual({ winner: 'w', reason: 'checkmate' });
  });

  const valid: PersistedGame = {
    version: 1,
    secrets: { w: 'e2', b: 'd7' },
    moves: [{ from: 'e2', to: 'e4' }],
    externalResult: null,
  };
  const invalid: [string, unknown][] = [
    ['pas un Secret', valid],
    ['valeur nulle', new Secret(null)],
    ['mauvaise version', new Secret({ ...valid, version: 2 })],
    ['coups absents', new Secret({ ...valid, moves: undefined })],
    ['coup mal formé', new Secret({ ...valid, moves: [{ from: 'e2' }] })],
    ['coup illégal', new Secret({ ...valid, moves: [{ from: 'd2', to: 'd5' }] })],
    [
      'coup hors tour',
      new Secret({
        ...valid,
        moves: [
          { from: 'e2', to: 'e4' },
          { from: 'd2', to: 'd4' },
        ],
      }),
    ],
    ['secrets invalides', new Secret({ ...valid, secrets: { w: 'e7', b: 'd7' } })],
    ['résultat mal formé', new Secret({ ...valid, externalResult: { winner: 'x' } })],
    [
      'motif non externe',
      new Secret({ ...valid, externalResult: { winner: 'w', reason: 'checkmate' } }),
    ],
    [
      'abandon sans vainqueur',
      new Secret({ ...valid, externalResult: { winner: null, reason: 'resignation' } }),
    ],
    [
      'nulle avec vainqueur',
      new Secret({ ...valid, externalResult: { winner: 'w', reason: 'agreement' } }),
    ],
    [
      'fin externe après un mat',
      new Secret({
        ...valid,
        secrets: { w: 'e2', b: 'a7' },
        moves: ['e2h5', 'e7e5', 'f1c4', 'b8c6', 'h5f7'].map(uci),
        externalResult: { winner: null, reason: 'agreement' },
      }),
    ],
  ];

  it.each(invalid)('restore refuse une forme incohérente : %s', (_label, persisted) => {
    expect(() => SecretQueenGame.restore(persisted as Secret<PersistedGame>)).toThrow();
  });

  it('les erreurs de restauration ne contiennent aucun détail', () => {
    const persisted = new Secret<PersistedGame>({ ...valid, moves: [{ from: 'd2', to: 'd5' }] });
    expect(() => SecretQueenGame.restore(persisted)).toThrow(/^Partie persistée invalide\.$/);
  });

  it('accepte les fins externes cohérentes', () => {
    for (const externalResult of [
      { winner: 'b', reason: 'resignation' },
      { winner: null, reason: 'agreement' },
      { winner: 'w', reason: 'timeout' },
      { winner: null, reason: 'timeout-vs-insufficient-material' },
    ] as const) {
      const game = SecretQueenGame.restore(new Secret({ ...valid, externalResult }));
      expect(game.result).toEqual(externalResult);
    }
  });
});
