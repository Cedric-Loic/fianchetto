import fc from 'fast-check';
import { opposite, pawnStartSquares, type Color, type Square } from '@sq/shared';

/**
 * Générateurs fast-check de « paires de mondes » (`docs/SPEC.md` §10) : deux choix de secrets
 * qui ne diffèrent QUE par le secret d'un camp (le camp « caché »). L'autre camp (« l'observateur »)
 * et le spectateur `public` ne doivent pas pouvoir distinguer les deux mondes tant que la même
 * suite de coups est acceptée dans les deux et produit les mêmes annonces.
 *
 * Les coups ne sont pas générés ici (ils dépendent de la position) : on génère des graines
 * entières que le banc (`harness.ts`) transforme en intentions à partir de la vue PUBLIQUE.
 * Tout est donc rejouable et réductible par fast-check.
 */

/** Même forme que `SecretChoice` du moteur (cases de départ des pions choisis). */
export interface WorldSecrets {
  w: Square;
  b: Square;
}

export interface WorldPair {
  /** Camp dont le secret diffère entre les deux mondes. */
  hidden: Color;
  /** Camp adverse : ne doit rien apprendre. */
  observer: Color;
  a: WorldSecrets;
  b: WorldSecrets;
}

/** Fin appliquée de l'extérieur après la suite de coups, pour comparer aussi l'après-fin. */
export type ExternalEnding = 'none' | 'resign-hidden' | 'resign-observer' | 'draw' | 'flag-hidden' | 'flag-observer';

export interface WorldPairScenario {
  pair: WorldPair;
  /** Graines de choix d'intention (une par tentative). */
  seeds: number[];
  ending: ExternalEnding;
}

export const arbColor: fc.Arbitrary<Color> = fc.constantFrom<Color>('w', 'b');

export function arbPawnStart(color: Color): fc.Arbitrary<Square> {
  return fc.constantFrom(...pawnStartSquares(color));
}

export const arbSecrets: fc.Arbitrary<WorldSecrets> = fc.record({
  w: arbPawnStart('w'),
  b: arbPawnStart('b'),
});

export const arbWorldPair: fc.Arbitrary<WorldPair> = arbColor.chain((hidden) =>
  fc
    .tuple(
      arbSecrets,
      fc.uniqueArray(arbPawnStart(hidden), { minLength: 2, maxLength: 2 }),
    )
    .map(([base, [first, second]]): WorldPair => {
      const a = { ...base, [hidden]: first } as WorldSecrets;
      const b = { ...base, [hidden]: second } as WorldSecrets;
      return { hidden, observer: opposite(hidden), a, b };
    }),
);

export const arbEnding: fc.Arbitrary<ExternalEnding> = fc.constantFrom<ExternalEnding>(
  'none',
  'resign-hidden',
  'resign-observer',
  'draw',
  'flag-hidden',
  'flag-observer',
);

export function arbWorldPairScenario(maxAttempts: number): fc.Arbitrary<WorldPairScenario> {
  return fc.record({
    pair: arbWorldPair,
    seeds: fc.array(fc.nat(), { minLength: 0, maxLength: maxAttempts }),
    ending: arbEnding,
  });
}

/** Toutes les paires ordonnées (camp caché, secret A ≠ secret B) avec un secret observateur fixé. */
export function allWorldPairs(observerSecret: Record<Color, Square>): WorldPair[] {
  const out: WorldPair[] = [];
  for (const hidden of ['w', 'b'] as const) {
    const observer = opposite(hidden);
    for (const first of pawnStartSquares(hidden)) {
      for (const second of pawnStartSquares(hidden)) {
        if (first === second) continue;
        const base = { [observer]: observerSecret[observer] } as Partial<WorldSecrets>;
        out.push({
          hidden,
          observer,
          a: { ...base, [hidden]: first } as WorldSecrets,
          b: { ...base, [hidden]: second } as WorldSecrets,
        });
      }
    }
  }
  return out;
}
