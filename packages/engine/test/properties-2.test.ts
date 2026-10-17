import { describe, it } from 'vitest';
import { assertRandomGames, assertTwinWorlds } from './helpers/random-game.js';

/* Suite de properties-1.test.ts (deuxième moitié des 1 000 parties) et indistinguabilité. */
describe('propriétés — parties aléatoires (2/2)', () => {
  it('500 parties de 60 demi-coups au plus', { timeout: 300_000 }, () => {
    assertRandomGames(500, 60, 20261018);
  });

  it('indistinguabilité : deux secrets, mêmes coups publics → même projection adverse', { timeout: 300_000 }, () => {
    assertTwinWorlds(100, 60, 20261019);
  });
});
