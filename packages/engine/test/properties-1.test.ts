import { describe, it } from 'vitest';
import { assertRandomGames } from './helpers/random-game.js';

/*
 * Tests de propriétés : 1 000 parties aléatoires dans `pnpm check`, réparties sur deux fichiers
 * (properties-1 et properties-2) pour profiter des workers parallèles de Vitest. Invariants
 * vérifiés à chaque demi-coup : voir helpers/random-game.ts. Version longue (10 000 parties
 * complètes) : random-games.stress.ts.
 */
describe('propriétés — parties aléatoires (1/2)', () => {
  it('500 parties de 60 demi-coups au plus', { timeout: 300_000 }, () => {
    assertRandomGames(500, 60, 20261017);
  });
});
