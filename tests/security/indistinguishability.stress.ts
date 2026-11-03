import { describe, it } from 'vitest';
import { assertIndistinguishable } from './harness.js';

/*
 * Version longue de l'indistinguabilité (`pnpm test:stress`) : 10 000 paires de mondes en
 * 20 lots de 500 (un délai par lot), suites communes jusqu'à 80 demi-coups, invariants de
 * projection vérifiés à chaque coup. Compter ~0,1 s par paire.
 */
const BATCHES = 20;
const PAIRS_PER_BATCH = 500;
const BATCH_TIMEOUT_MS = 15 * 60_000;

describe('indistinguabilité (stress) : 10 000 paires de mondes', () => {
  for (let batch = 1; batch <= BATCHES; batch++) {
    it(
      `lot ${batch}/${BATCHES} (${PAIRS_PER_BATCH} paires)`,
      () => assertIndistinguishable(PAIRS_PER_BATCH, 80, 280),
      BATCH_TIMEOUT_MS,
    );
  }
});
