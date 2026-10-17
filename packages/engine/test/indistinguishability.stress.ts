import { describe, it } from 'vitest';
import { assertTwinWorlds } from './helpers/random-game.js';

/* Indistinguabilité, version longue : 2 000 paires de mondes jumeaux, 150 demi-coups au plus. */
describe('stress — indistinguabilité', () => {
  it('2 000 paires de mondes', () => {
    assertTwinWorlds(2_000, 150, 2_000);
  });
});
