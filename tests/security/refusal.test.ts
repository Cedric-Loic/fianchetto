import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Color, MoveIntent } from '@sq/shared';
import { SecretQueenGame, projectForViewer, type SecretChoice } from '@sq/engine';
import { secretCanaryTokens } from './canary.js';
import { playLine, snapshotAll } from './harness.js';
import { bareRefusalViolations } from './invariants.js';
import { pickIntent, uci } from './public-board.js';
import { findForbidden, formatFindings } from './scan.js';
import { arbSecrets } from './world-pairs.js';

/*
 * Refus sans motif (§3.5, `RULES.md` §4) : quel que soit le motif, `play` renvoie exactement
 * `{ ok: false }` et l'état observable ne change pas.
 */

interface RefusalCase {
  label: string;
  secrets: SecretChoice;
  setup: string[];
  /** Camp qui tente le coup (par défaut : le camp au trait). */
  color?: Color;
  intent: string;
}

const CASES: RefusalCase[] = [
  { label: "pas le tour de ce camp", secrets: { w: 'e2', b: 'd7' }, setup: [], color: 'b', intent: 'e7e5' },
  { label: 'case de départ vide', secrets: { w: 'e2', b: 'd7' }, setup: [], intent: 'e3e4' },
  { label: 'pièce adverse', secrets: { w: 'e2', b: 'd7' }, setup: [], intent: 'e7e5' },
  { label: 'géométrie impossible', secrets: { w: 'e2', b: 'd7' }, setup: [], intent: 'b1b3' },
  { label: 'trajet bloqué', secrets: { w: 'e2', b: 'd7' }, setup: [], intent: 'a1a3' },
  { label: 'départ = arrivée', secrets: { w: 'e2', b: 'd7' }, setup: [], intent: 'g1g1' },
  { label: 'prise de sa propre pièce', secrets: { w: 'e2', b: 'd7' }, setup: [], intent: 'd1d2' },
  { label: 'vrai pion joué comme une dame', secrets: { w: 'a2', b: 'd7' }, setup: [], intent: 'e2e5' },
  { label: 'dame secrète bloquée', secrets: { w: 'e2', b: 'd7' }, setup: [], intent: 'e2e8' },
  {
    label: 'pièce clouée par une vraie pièce',
    secrets: { w: 'h2', b: 'h7' },
    setup: ['d2d4', 'e7e5', 'b1c3', 'f8b4'],
    intent: 'c3e4',
  },
  {
    label: 'échec non paré',
    secrets: { w: 'a2', b: 'c7' },
    setup: ['e2e4', 'f7f6', 'd1h5'],
    intent: 'a7a6',
  },
  {
    label: 'pièce clouée par la dame secrète adverse',
    secrets: { w: 'h2', b: 'b7' },
    setup: ['d2d4', 'b7b5', 'b1c3', 'b5b4', 'e2e4', 'a7a6'],
    intent: 'c3e2',
  },
  {
    label: 'roque à travers une case attaquée par la dame secrète',
    secrets: { w: 'a2', b: 'a7' },
    setup: ['g2g3', 'a7a6', 'f1g2', 'h7h6', 'g1f3', 'h6h5', 'e2e3', 'h5h4'],
    intent: 'e1g1',
  },
  {
    label: 'roque après un déplacement du roi',
    secrets: { w: 'a2', b: 'a7' },
    setup: ['e2e4', 'e7e5', 'e1e2', 'e8e7', 'e2e1', 'e7e8', 'g1f3', 'g8f6', 'f1e2', 'f8e7'],
    intent: 'e1g1',
  },
  {
    label: 'prise en passant contre une dame secrète',
    secrets: { w: 'e2', b: 'a7' },
    setup: ['g1f3', 'd7d5', 'f3g1', 'd5d4', 'e2e4'],
    intent: 'd4e3',
  },
  {
    label: 'prise en passant hors délai',
    secrets: { w: 'a2', b: 'a7' },
    setup: ['g1f3', 'd7d5', 'f3g1', 'd5d4', 'e2e4', 'h7h6', 'g1f3'],
    intent: 'd4e3',
  },
];

describe('refus sans motif', () => {
  it.each(CASES)('$label → exactement { ok: false }, état inchangé', (c) => {
    const { game } = playLine(c.secrets, c.setup);
    const before = JSON.stringify(snapshotAll(game));
    const result = game.play(c.color ?? game.turn, uci(c.intent));
    expect(bareRefusalViolations(result)).toEqual([]);
    expect(JSON.stringify(snapshotAll(game))).toBe(before);
  });

  it('tous les refus sont identiques octet pour octet, quel que soit le motif', () => {
    const outputs = new Set(
      CASES.map((c) => {
        const { game } = playLine(c.secrets, c.setup);
        return JSON.stringify(game.play(c.color ?? game.turn, uci(c.intent)));
      }),
    );
    expect([...outputs]).toEqual(['{"ok":false}']);
  });

  it('coup après la fin de partie (abandon, nulle, drapeau) : refus nu', () => {
    for (const end of [
      (g: SecretQueenGame) => g.resign('w'),
      (g: SecretQueenGame) => g.agreeDraw(),
      (g: SecretQueenGame) => g.flagFall('b'),
    ]) {
      const { game } = playLine({ w: 'e2', b: 'e7' }, ['d2d4']);
      end(game);
      const before = JSON.stringify(snapshotAll(game));
      expect(bareRefusalViolations(game.play(game.turn, uci('d7d5')))).toEqual([]);
      expect(bareRefusalViolations(game.play('w', uci('e2e4')))).toEqual([]);
      expect(JSON.stringify(snapshotAll(game))).toBe(before);
    }
  });

  it('entrée malformée : refus nu, ou exception sans état réel, et état inchangé', () => {
    const secrets: SecretChoice = { w: 'e2', b: 'e7' };
    const tokens = [...secretCanaryTokens('w', secrets.w), ...secretCanaryTokens('b', secrets.b)];
    const malformed: Array<[Color, unknown]> = [
      ['w', { from: 'z9', to: 'e4' }],
      ['w', { from: 'e2' }],
      ['w', { from: 'e2', to: 'e4', extra: 'x' }],
      ['w', null],
      ['x' as Color, { from: 'e2', to: 'e4' }],
    ];
    for (const [color, intent] of malformed) {
      const game = SecretQueenGame.create(secrets);
      const before = JSON.stringify(snapshotAll(game));
      let outcome: unknown;
      try {
        outcome = game.play(color, intent as MoveIntent);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const findings = findForbidden(message, { tokens });
        expect(findings, formatFindings(findings)).toEqual([]);
        outcome = { ok: false };
      }
      // `{ from: 'e2', to: 'e4', extra }` peut légitimement être accepté (champ ignoré).
      const accepted = (outcome as { ok?: unknown }).ok === true;
      if (!accepted) {
        expect(bareRefusalViolations(outcome), JSON.stringify(intent)).toEqual([]);
        expect(JSON.stringify(snapshotAll(game))).toBe(before);
      }
    }
  });

  it('parties aléatoires : chaque refus est nu et ne modifie aucune projection', () => {
    fc.assert(
      fc.property(arbSecrets, fc.array(fc.nat(), { maxLength: 150 }), (secrets, seeds) => {
        const game = SecretQueenGame.create(secrets);
        for (const seed of seeds) {
          if (game.isOver || game.plyCount >= 80) break;
          const intent = pickIntent(projectForViewer(game, 'public'), seed);
          // Une fois sur cinq, le mauvais camp tente le coup.
          const turn = game.turn;
          const color: Color = seed % 5 === 0 ? (turn === 'w' ? 'b' : 'w') : turn;
          const before = JSON.stringify(snapshotAll(game));
          const result = game.play(color, intent);
          if (color !== turn) expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(bareRefusalViolations(result)).toEqual([]);
            expect(JSON.stringify(snapshotAll(game))).toBe(before);
          }
        }
      }),
      { numRuns: 60 },
    );
  });

  it('un camp qui n’est pas au trait est toujours refusé', () => {
    fc.assert(
      fc.property(arbSecrets, fc.array(fc.nat(), { maxLength: 40 }), (secrets, seeds) => {
        const game = SecretQueenGame.create(secrets);
        for (const seed of seeds) {
          if (game.isOver) break;
          const other: Color = game.turn === 'w' ? 'b' : 'w';
          // Coup candidat du camp qui n'a pas le trait, calculé comme si c'était son tour.
          const view = projectForViewer(game, 'public');
          const intent = pickIntent({ pieces: view.pieces, turn: other }, seed);
          expect(bareRefusalViolations(game.play(other, intent))).toEqual([]);
          game.play(game.turn, pickIntent(view, seed));
        }
      }),
      { numRuns: 40 },
    );
  });
});
