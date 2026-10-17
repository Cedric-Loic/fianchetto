import { inspect } from 'node:util';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Secret } from '@sq/shared/secret';
import {
  SecretQueenGame,
  projectForViewer,
  type PersistedGame,
  type SecretChoice,
} from '@sq/engine';
import { REDACTED, secretCanaryTokens } from './canary.js';
import {
  applyEnding,
  persistedOf,
  playLine,
  playRandomGame,
  snapshotAll,
  wrapPersisted,
} from './harness.js';
import { compareObservations, describeDifference } from './normalize.js';
import { intentKey, pickIntent } from './public-board.js';
import { findForbidden, formatFindings } from './scan.js';
import { arbEnding, arbSecrets, arbSeeds } from './world-pairs.js';

/*
 * Forme persistée (reprise après redémarrage) : enveloppée dans `Secret<T>`, illisible par
 * sérialisation, fidèle à la restauration ; une forme corrompue échoue sans rien révéler.
 */

function expectMasked(persisted: Secret<PersistedGame>, secrets: SecretChoice) {
  expect(Secret.isSecret(persisted)).toBe(true);
  expect(JSON.stringify(persisted)).toBe(JSON.stringify(REDACTED));
  expect(JSON.stringify({ game: persisted })).toBe(`{"game":${JSON.stringify(REDACTED)}}`);
  expect(String(persisted)).toBe(REDACTED);
  expect(inspect(persisted)).toBe(REDACTED);
  expect(inspect({ persisted }, { depth: Infinity })).not.toContain(`'${secrets.w}'`);
  expect(JSON.stringify({ ...persisted })).toBe('{}');
  expect(JSON.stringify(structuredClone(persisted))).toBe('{}');
}

describe('toPersisted() masqué', () => {
  it('JSON, String, inspect, spread, structuredClone : aucune valeur, à toute étape', () => {
    fc.assert(
      fc.property(arbSecrets, arbSeeds(100), arbEnding, (secrets, seeds, ending) => {
        const { game } = playRandomGame(secrets, seeds, { maxPlies: 50 });
        expectMasked(game.toPersisted(), secrets);
        if (ending !== 'none' && !game.isOver) applyEnding(game, ending, 'w', 'b');
        expectMasked(game.toPersisted(), secrets);
      }),
      { numRuns: 30 },
    );
  });

  it('contenu : version 1, secrets, intentions ACCEPTÉES seulement, fin externe', () => {
    const secrets: SecretChoice = { w: 'e2', b: 'd7' };
    const game = SecretQueenGame.create(secrets);
    expect(game.play('w', { from: 'e2', to: 'e5' }).ok).toBe(true); // coup de dame secrète
    expect(game.play('w', { from: 'd2', to: 'd4' }).ok).toBe(false); // pas son tour
    expect(game.play('b', { from: 'e7', to: 'e5' }).ok).toBe(false); // case occupée
    expect(game.play('b', { from: 'g8', to: 'f6' }).ok).toBe(true);
    const persisted = persistedOf(game);
    expect(persisted.version).toBe(1);
    expect(persisted.secrets).toEqual(secrets);
    expect(persisted.moves.map(intentKey)).toEqual(['e2e5', 'g8f6']);
    expect(persisted.externalResult).toBeNull();
    const result = game.resign('b');
    expect(persistedOf(game).externalResult).toEqual(result);
  });

  it('restauration fidèle : mêmes projections, mêmes getters, même suite de partie', () => {
    fc.assert(
      fc.property(
        arbSecrets,
        arbSeeds(150),
        arbSeeds(40),
        arbEnding,
        (secrets, seeds, continuation, ending) => {
          const { game } = playRandomGame(secrets, seeds, { maxPlies: 70 });
          if (ending !== 'none' && !game.isOver) applyEnding(game, ending, 'w', 'b');
          const restored = SecretQueenGame.restore(game.toPersisted());
          const cmp = compareObservations(snapshotAll(game), snapshotAll(restored));
          expect(cmp.identical, describeDifference(cmp.difference)).toBe(true);
          for (const seed of continuation) {
            if (game.isOver) break;
            const intent = pickIntent(projectForViewer(game, 'public'), seed);
            const color = game.turn;
            expect(JSON.stringify(restored.play(color, intent))).toBe(
              JSON.stringify(game.play(color, intent)),
            );
          }
          const after = compareObservations(snapshotAll(game), snapshotAll(restored));
          expect(after.identical, describeDifference(after.difference)).toBe(true);
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe('entrées invalides', () => {
  const VALID: SecretChoice = { w: 'h2', b: 'a7' };

  /** La fonction doit lever, sans FEN ni secret dans le message. */
  function expectSilentFailure(fn: () => unknown, secrets: SecretChoice) {
    let caught: unknown = null;
    try {
      fn();
    } catch (error) {
      caught = error;
    }
    expect(caught, 'une exception était attendue').toBeInstanceOf(Error);
    const message = caught instanceof Error ? caught.message : '';
    const tokens = [
      ...secretCanaryTokens('w', secrets.w),
      ...secretCanaryTokens('b', secrets.b),
      JSON.stringify(secrets),
    ];
    const findings = findForbidden(message, { tokens });
    expect(findings, formatFindings(findings)).toEqual([]);
  }

  it.each<[string, SecretChoice]>([
    ['secret blanc sur une case noire', { w: 'e7', b: 'a7' }],
    ['secret hors rangée des pions', { w: 'e4', b: 'a7' }],
    ['secret sur le roi', { w: 'e1', b: 'a7' }],
    ['secret noir sur une case blanche', { w: 'h2', b: 'a2' }],
  ])('create refuse un secret invalide (H1 : un des 8 pions du camp) — %s', (_label, secrets) => {
    expectSilentFailure(() => SecretQueenGame.create(secrets), secrets);
  });

  it('restore refuse une suite contenant un coup illégal', () => {
    const { game } = playLine(VALID, ['e2e4', 'e7e5']);
    const persisted = persistedOf(game);
    const corrupted: PersistedGame = {
      ...persisted,
      moves: [...persisted.moves, { from: 'd2', to: 'd5' }],
    };
    expectSilentFailure(() => SecretQueenGame.restore(wrapPersisted(corrupted)), VALID);
  });

  it('restore refuse une version inconnue et des secrets invalides', () => {
    const base = persistedOf(SecretQueenGame.create(VALID));
    expectSilentFailure(
      () =>
        SecretQueenGame.restore(wrapPersisted({ ...base, version: 2 } as unknown as PersistedGame)),
      VALID,
    );
    expectSilentFailure(
      () => SecretQueenGame.restore(wrapPersisted({ ...base, secrets: { w: 'e4', b: 'a7' } })),
      VALID,
    );
  });
});
