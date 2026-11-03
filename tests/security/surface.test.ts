import { describe, expect, it } from 'vitest';
import * as engine from '@sq/engine';
import {
  ClassicGame,
  SecretQueenGame,
  projectClassic,
  projectForViewer,
  type SecretChoice,
} from '@sq/engine';
import { persistedOf, playLine, snapshotAll } from './harness.js';

/*
 * Surface du moteur : seule l'API contractuelle est exportée (aucun accès à l'état réel par un
 * autre chemin), et les objets renvoyés sont des copies (les modifier ne modifie pas l'état).
 */

describe('surface exportée par @sq/engine', () => {
  it("n'exporte que l'API contractuelle (valeurs à l'exécution)", () => {
    expect(Object.keys(engine).sort()).toEqual([
      'ClassicGame',
      'SecretQueenGame',
      'projectClassic',
      'projectForViewer',
    ]);
  });

  it('la projection classique refuse une partie Secret Queen (et inversement)', () => {
    // projectClassic ne montre que la position réelle : appliquée à une partie Secret Queen,
    // elle révélerait les dames secrètes. Elle doit donc la refuser.
    const game = SecretQueenGame.create({ w: 'e2', b: 'd7' });
    expect(() => projectClassic(game as unknown as ClassicGame, 'w')).toThrow('Partie invalide.');
    const classic = ClassicGame.create();
    expect(() => projectForViewer(classic as unknown as SecretQueenGame, 'w')).toThrow(
      'Partie invalide.',
    );
    const fake = Object.create(ClassicGame.prototype) as ClassicGame;
    expect(() => projectClassic(fake, 'w')).toThrow('Partie invalide.');
  });

  it('les modules internes ne sont pas importables par le nom du paquet', async () => {
    // Contrôle positif : le même mécanisme d'import dynamique résout bien le point d'entrée.
    const root: string = '@sq/engine';
    await expect(import(/* @vite-ignore */ root)).resolves.toHaveProperty('projectForViewer');
    for (const specifier of [
      '@sq/engine/src/internal/game.js',
      '@sq/engine/src/internal/core.js',
      '@sq/engine/src/projection.js',
    ]) {
      await expect(import(/* @vite-ignore */ specifier), specifier).rejects.toThrow();
    }
  });

  it("un objet qui imite une partie n'ouvre aucun accès à l'état réel", () => {
    const fake = Object.create(SecretQueenGame.prototype) as SecretQueenGame;
    expect(() => projectForViewer(fake, 'w')).toThrow();
    expect(() => projectForViewer({} as SecretQueenGame, 'public')).toThrow();
  });
});

describe('les objets renvoyés sont des copies', () => {
  const SECRETS: SecretChoice = { w: 'e2', b: 'd7' };
  const LINE = ['e2e4', 'd7d5', 'e4d5', 'g8f6'];

  it('modifier une projection, un coup ou un résultat ne modifie pas la partie', () => {
    const { game, moves } = playLine(SECRETS, LINE);
    const before = JSON.stringify(snapshotAll(game));
    const view = projectForViewer(game, 'w');
    view.pieces.pop();
    view.moves[0] = { ...view.moves[0], san: 'X' } as (typeof view.moves)[number];
    if (view.moves[1]) view.moves[1].san = 'Y';
    view.captured.b.push('q');
    if (view.ownSecret) view.ownSecret.square = null;
    const firstMove = moves[0];
    if (firstMove) {
      firstMove.san = 'Z';
      Object.assign(firstMove, { leaked: true });
    }
    expect(JSON.stringify(snapshotAll(game))).toBe(before);
  });

  it('modifier la révélation ou la forme persistée ne modifie pas la partie', () => {
    const { game } = playLine(SECRETS, LINE);
    const result = game.resign('b');
    const before = JSON.stringify(snapshotAll(game));
    const reveal = projectForViewer(game, 'public').reveal;
    if (reveal) {
      reveal.secrets.w.finalSquare = 'a1';
      reveal.plies.pop();
    }
    Object.assign(result, { winner: 'b' });
    const persisted = persistedOf(game);
    persisted.moves.pop();
    persisted.secrets.w = 'a2';
    expect(JSON.stringify(snapshotAll(game))).toBe(before);
    expect(persistedOf(game).moves).toHaveLength(LINE.length);
  });
});
