import { describe, it } from 'vitest';
import { assertIndistinguishable } from './harness.js';

/*
 * Version longue de l'indistinguabilité (`pnpm test:stress`) : 10 000 paires de mondes,
 * suites communes jusqu'à 100 demi-coups, invariants de projection vérifiés à chaque coup.
 */
describe('indistinguabilité (stress)', () => {
  it('10 000 paires de mondes', () => {
    assertIndistinguishable(10_000, 100, 320);
  });
});
