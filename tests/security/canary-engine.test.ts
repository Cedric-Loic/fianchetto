import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { opposite } from '@sq/shared';
import { projectForViewer, type SecretChoice, type SecretQueenGame } from '@sq/engine';
import {
  REDACTED,
  observableSerializations,
  realPawnRankToken,
  safeStringify,
  secretCanaryTokens,
} from './canary.js';
import { applyEnding, playRandomGame } from './harness.js';
import { findForbidden, findRealStateByReflection, formatFindings } from './scan.js';
import { arbEnding, arbSecrets } from './world-pairs.js';

/*
 * Canari (§10) : les jetons propres au secret d'un camp (rangée FEN réelle « PPPPQPPP »,
 * identifiant naïf « wqe2 ») et toute FEN réelle ne doivent apparaître dans AUCUNE sortie
 * observable par l'adversaire ou le public avant la fin, ni dans aucune sérialisation de
 * l'objet partie (logs).
 */

function allTokens(secrets: SecretChoice): string[] {
  return [...secretCanaryTokens('w', secrets.w), ...secretCanaryTokens('b', secrets.b)];
}

/** L'objet partie ne laisse rien passer, quelle que soit la façon de le sérialiser. */
function expectGameMasked(game: SecretQueenGame, secrets: SecretChoice, label: string) {
  const tokens = allTokens(secrets);
  const serializations = observableSerializations(game);
  expect(serializations.json, label).toBe(JSON.stringify(REDACTED));
  expect(serializations.string, label).toBe(REDACTED);
  expect(serializations.template, label).toBe(REDACTED);
  expect(serializations.inspect, label).toBe(REDACTED);
  for (const [how, text] of Object.entries(serializations)) {
    const findings = findForbidden(text, { tokens, forbidRedactedMarker: false });
    expect(findings, `${label} — ${how}\n${formatFindings(findings)}`).toEqual([]);
  }
  // Copies superficielles et clonage (postMessage vers un worker) : rien d'exploitable.
  const copies: Record<string, () => unknown> = {
    spread: () => ({ ...game }),
    assign: () => Object.assign({}, game),
    structuredClone: () => structuredClone(game),
    entries: () => Object.entries(game),
  };
  for (const [how, copy] of Object.entries(copies)) {
    let text: string;
    try {
      text = safeStringify(copy());
    } catch (error) {
      // Un clonage impossible (DataCloneError) ne fuit rien, sauf par son message.
      text = error instanceof Error ? error.message : 'exception';
    }
    const findings = findForbidden(text, { tokens, forbidRedactedMarker: false });
    expect(findings, `${label} — ${how}\n${formatFindings(findings)}`).toEqual([]);
  }
  // Réflexion : aucun moteur réel ni FEN hors champs privés (`#`) ou `Secret`.
  const reflected = findRealStateByReflection(game, tokens);
  expect(reflected, `${label} — réflexion\n${formatFindings(reflected)}`).toEqual([]);
}

describe('canari : sérialisations de la partie', () => {
  it('[REDACTED] partout, partie neuve, en cours et terminée', () => {
    fc.assert(
      fc.property(
        arbSecrets,
        fc.array(fc.nat(), { maxLength: 80 }),
        arbEnding,
        (secrets, seeds, ending) => {
          let checked = 0;
          const { game } = playRandomGame(secrets, seeds, {
            maxPlies: 40,
            onAttempt: (g, attempt) => {
              // Toutes les tentatives au début, puis une sur cinq (coût).
              if (attempt.ply < 6 || checked++ % 5 === 0) {
                expectGameMasked(g, secrets, `demi-coup ${attempt.ply}`);
              }
            },
          });
          expectGameMasked(game, secrets, 'fin de la suite');
          if (ending !== 'none' && !game.isOver) applyEnding(game, ending, 'w', 'b');
          // Même après la fin, l'objet partie ne se sérialise pas (la révélation passe par
          // la projection, jamais par un log).
          expectGameMasked(game, secrets, 'après la fin');
        },
      ),
      { numRuns: 30 },
    );
  });
});

describe("canari : sorties destinées à l'adversaire et au public", () => {
  it('aucune projection, aucun coup public, aucun refus ne contient un jeton du secret adverse', () => {
    fc.assert(
      fc.property(arbSecrets, fc.array(fc.nat(), { maxLength: 200 }), (secrets, seeds) => {
        playRandomGame(secrets, seeds, {
          maxPlies: 100,
          onAttempt: (game, attempt) => {
            for (const color of ['w', 'b'] as const) {
              const tokens = secretCanaryTokens(color, secrets[color]);
              const outputs: Record<string, unknown> = {
                [`projection ${opposite(color)}`]: projectForViewer(game, opposite(color)),
                'projection public': projectForViewer(game, 'public'),
                // Le coup public est diffusé à tous ; un refus n'est vu que par son auteur.
                'résultat de play': attempt.result,
              };
              for (const [label, output] of Object.entries(outputs)) {
                const findings = findForbidden(output, { tokens, allowReveal: game.isOver });
                expect(findings, `${label} (secret ${color})\n${formatFindings(findings)}`).toEqual(
                  [],
                );
              }
            }
          },
        });
      }),
      { numRuns: 60 },
    );
  });

  it('contrôle positif : après la fin, la révélation contient bien les jetons des deux secrets', () => {
    fc.assert(
      fc.property(arbSecrets, fc.array(fc.nat(), { maxLength: 60 }), (secrets, seeds) => {
        const { game } = playRandomGame(secrets, seeds, { maxPlies: 30 });
        if (!game.isOver) game.agreeDraw();
        const view = projectForViewer(game, 'public');
        expect(view.reveal?.realInitialFen).toContain(realPawnRankToken('w', secrets.w));
        expect(view.reveal?.realInitialFen).toContain(realPawnRankToken('b', secrets.b));
        // Sans l'exception « après la fin », le scan signale bien la révélation.
        const rules = findForbidden(view, { tokens: allTokens(secrets) }).map((f) => f.rule);
        expect(rules).toContain('canari');
        expect(rules).toContain('fen');
      }),
      { numRuns: 20 },
    );
  });
});
