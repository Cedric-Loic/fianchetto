import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';

/*
 * Validation de chess.js (docs/SPEC.md §3.2) : perft depuis la position initiale.
 * Valeurs de référence : https://www.chessprogramming.org/Perft_Results
 * La profondeur 5 (4 865 609 nœuds) prend environ 10 s ; elle reste dans `pnpm check`.
 */
const EXPECTED = [20, 400, 8_902, 197_281, 4_865_609];

describe('perft — position initiale', () => {
  EXPECTED.forEach((nodes, index) => {
    const depth = index + 1;
    it(`profondeur ${depth} : ${nodes} nœuds`, { timeout: 120_000 }, () => {
      expect(new Chess().perft(depth)).toBe(nodes);
    });
  });
});
