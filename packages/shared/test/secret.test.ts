import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { REDACTED, Secret } from '../src/secret.js';

/**
 * Un Secret ne doit jamais pouvoir être sérialisé, loggé ou cloné avec sa valeur.
 * On utilise une valeur « canari » facile à rechercher dans les sorties.
 */
const CANARY = 'CANARY-e2-QUEEN-7f3a';

function makeSecret() {
  return new Secret({ square: CANARY, nested: [CANARY] });
}

describe('Secret<T>', () => {
  it('expose() renvoie la valeur', () => {
    expect(makeSecret().expose().square).toBe(CANARY);
  });

  it('JSON.stringify ne révèle rien, même imbriqué', () => {
    const payload = { a: makeSecret(), list: [makeSecret()], deep: { s: makeSecret() } };
    const json = JSON.stringify(payload);
    expect(json).not.toContain(CANARY);
    expect(json).toContain(REDACTED);
  });

  it('String(), template literal et concaténation ne révèlent rien', () => {
    const s = makeSecret();
    expect(String(s)).toBe(REDACTED);
    // Usages volontairement « interdits » par le lint : on prouve qu'ils ne fuient rien.
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    expect(`${s}`).toBe(REDACTED);
    // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
    expect('x' + s).toBe(`x${REDACTED}`);
  });

  it('util.inspect (console.log côté Node) ne révèle rien', () => {
    const out = inspect({ s: makeSecret() }, { depth: 10, showHidden: true });
    expect(out).not.toContain(CANARY);
    expect(out).toContain(REDACTED);
  });

  it('Object.keys, entries et spread ne voient pas la valeur', () => {
    const s = makeSecret();
    expect(Object.keys(s)).toEqual([]);
    expect(Object.entries(s)).toEqual([]);
    expect(JSON.stringify({ ...s })).toBe('{}');
  });

  it('structuredClone (postMessage vers un worker) perd la valeur', () => {
    const cloned: unknown = structuredClone(makeSecret());
    expect(cloned instanceof Secret).toBe(false);
    expect(JSON.stringify(cloned)).not.toContain(CANARY);
  });

  it('Secret.isSecret reconnaît une enveloppe', () => {
    expect(Secret.isSecret(makeSecret())).toBe(true);
    expect(Secret.isSecret({ square: CANARY })).toBe(false);
  });
});
