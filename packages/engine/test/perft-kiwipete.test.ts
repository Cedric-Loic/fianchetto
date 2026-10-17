import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';

/*
 * Validation de chess.js : perft sur « Kiwipete » (roques, prises en passant, promotions, clouages).
 * Valeurs de référence : https://www.chessprogramming.org/Perft_Results (position 2).
 * La profondeur 4 (4 085 603 nœuds) prend environ 9 s.
 */
const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const EXPECTED = [48, 2_039, 97_862, 4_085_603];

describe('perft — Kiwipete', () => {
  EXPECTED.forEach((nodes, index) => {
    const depth = index + 1;
    it(`profondeur ${depth} : ${nodes} nœuds`, { timeout: 120_000 }, () => {
      expect(new Chess(KIWIPETE).perft(depth)).toBe(nodes);
    });
  });
});
