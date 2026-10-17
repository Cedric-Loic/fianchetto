import { describe, it } from 'vitest';
import { assertRandomGames } from './helpers/random-game.js';

/*
 * Porte de l'étape 1 : 10 000 parties aléatoires sans violation d'invariant (`pnpm test:stress`),
 * en quatre fichiers de 2 500 parties exécutés en parallèle. Parties jouées jusqu'à leur fin
 * (ou 300 demi-coups au plus).
 */
describe('stress — parties aléatoires (lot 2/4)', () => {
  it('2 500 parties complètes', () => {
    assertRandomGames(2_500, 300, 1002);
  });
});
