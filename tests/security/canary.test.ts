import { describe, expect, it } from 'vitest';
import { findLeaks, makeCanary } from './canary.js';

describe('banc de fuite (squelette)', () => {
  it('détecte un canari dans un payload', () => {
    const c = makeCanary('test');
    expect(findLeaks({ a: { b: [c] } }, [c])).toEqual([c]);
    expect(findLeaks({ a: 'rien' }, [c])).toEqual([]);
  });
});
