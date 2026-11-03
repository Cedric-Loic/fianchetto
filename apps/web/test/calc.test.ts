import { describe, expect, it } from 'vitest';
import { looksLikePromotion, parseUci } from '../src/lib/calc';

describe('saisie des coups de calcul', () => {
  it('accepte e2e4, e2-e4, majuscules, espaces et promotion', () => {
    expect(parseUci('e2e4')).toBe('e2e4');
    expect(parseUci(' E2-E4 ')).toBe('e2e4');
    expect(parseUci('e7e8q')).toBe('e7e8q');
  });
  it('refuse le reste', () => {
    for (const bad of ['', 'e4', 'Nf3', 'e2e9', 'i2e4', 'e2e4e5']) expect(parseUci(bad)).toBeNull();
  });
  it('reconnaît la forme d’une promotion', () => {
    expect(looksLikePromotion('e7', 'e8')).toBe(true);
    expect(looksLikePromotion('b7', 'a8')).toBe(true);
    expect(looksLikePromotion('d2', 'd1')).toBe(true);
    expect(looksLikePromotion('e6', 'e7')).toBe(false);
    expect(looksLikePromotion('a7', 'e8')).toBe(false);
  });
});
