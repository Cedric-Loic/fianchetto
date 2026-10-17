import { isDeepStrictEqual } from 'node:util';

/**
 * Normalisation des sorties pour le test d'indistinguabilité (`docs/SPEC.md` §10) : deux
 * mondes ne diffèrent légitimement que par les pendules, les horodatages et les identifiants
 * (de partie, de coup client, de session). Tout le reste doit être STRICTEMENT identique,
 * y compris l'ordre des clés (les octets envoyés sur le WebSocket).
 */

/**
 * Clés dont la valeur est volatile d'un monde à l'autre. Les identifiants de PIÈCE (`id`,
 * `pieceId`, `rookId`) n'en font pas partie : ils sont publics et doivent être identiques.
 */
export const VOLATILE_KEYS: ReadonlySet<string> = new Set([
  'gameId',
  'nextGameId',
  'clientMoveId',
  'userId',
  'sessionId',
  'token',
  'startedAt',
  'endedAt',
  'createdAt',
  'updatedAt',
  'timestamp',
  'serverTime',
  'sentAt',
  'ts',
  'remainingMs',
  'elapsedMs',
  'thinkTimeMs',
  'lastMoveAt',
]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface NormalizeOptions {
  /** Clés volatiles supplémentaires. */
  extraKeys?: Iterable<string>;
  /** Clés supprimées purement et simplement (ex. `reveal` après la fin). */
  dropKeys?: Iterable<string>;
}

/**
 * Copie normalisée d'une valeur de données :
 * - valeur d'une clé volatile : nombre → « <ms> » ; chaîne → jeton stable par valeur
 *   (« <gameId#1> ») pour conserver les relations d'égalité ; `null` reste `null` (la présence
 *   d'une valeur peut elle-même être une information) ; objet → normalisé récursivement ;
 * - date ISO → « <date> » ; UUID → jeton stable ;
 * - l'ordre des clés est conservé.
 */
export function normalizeVolatile(value: unknown, options: NormalizeOptions = {}): unknown {
  const volatile = new Set([...VOLATILE_KEYS, ...(options.extraKeys ?? [])]);
  const dropped = new Set(options.dropKeys ?? []);
  const tokens = new Map<string, string>();
  const counters = new Map<string, number>();

  const tokenFor = (space: string, raw: string): string => {
    const mapKey = `${space}\u0000${raw}`;
    const existing = tokens.get(mapKey);
    if (existing) return existing;
    const next = (counters.get(space) ?? 0) + 1;
    counters.set(space, next);
    const token = `<${space}#${next}>`;
    tokens.set(mapKey, token);
    return token;
  };

  const walk = (node: unknown, volatileKey: string | null): unknown => {
    if (node === null || node === undefined || typeof node === 'boolean') return node;
    if (typeof node === 'number') return volatileKey ? '<ms>' : node;
    if (typeof node === 'string') {
      if (volatileKey) return tokenFor(volatileKey, node);
      if (ISO_DATE_RE.test(node)) return '<date>';
      if (UUID_RE.test(node)) return tokenFor('uuid', node);
      return node;
    }
    if (Array.isArray(node)) return node.map((item) => walk(item, volatileKey));
    if (typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(node)) {
        if (dropped.has(key)) continue;
        out[key] = walk(child, volatile.has(key) ? key : volatileKey);
      }
      return out;
    }
    return node;
  };

  return walk(value, null);
}

/** Copie profonde sans les clés indiquées (à tout niveau), sans autre transformation. */
export function omitKeysDeep(value: unknown, keys: Iterable<string>): unknown {
  const dropped = new Set(keys);
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node === null || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(node)) {
      if (!dropped.has(key)) out[key] = walk(child);
    }
    return out;
  };
  return walk(value);
}

export interface Difference {
  path: string;
  a: unknown;
  b: unknown;
}

/** Première différence structurelle entre deux valeurs (ordre des clés compris), ou `null`. */
export function firstDifference(a: unknown, b: unknown, path = '$'): Difference | null {
  if (Object.is(a, b)) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    return { path, a, b };
  }
  if (Array.isArray(a) !== Array.isArray(b)) return { path, a, b };
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return { path: `${path}.length`, a: a.length, b: b.length };
    for (let i = 0; i < a.length; i++) {
      const diff = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (diff) return diff;
    }
    return null;
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b as object);
  if (keysA.join('\u0000') !== keysB.join('\u0000')) {
    return { path: `${path} (clés)`, a: keysA, b: keysB };
  }
  for (const key of keysA) {
    const diff = firstDifference(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
    if (diff) return diff;
  }
  return null;
}

export interface Comparison {
  identical: boolean;
  /** Égalité profonde (types et prototypes compris), indépendamment de l'ordre des clés. */
  deepEqual: boolean;
  /** Égalité des sérialisations JSON (ordre des clés compris). */
  sameBytes: boolean;
  difference: Difference | null;
}

/**
 * Compare deux observations APRÈS normalisation. « Identiques » = même structure, mêmes
 * valeurs et même sérialisation (un ordre de clés différent est une fuite : les octets
 * envoyés diffèrent).
 */
export function compareObservations(
  a: unknown,
  b: unknown,
  options: NormalizeOptions = {},
): Comparison {
  const na = normalizeVolatile(a, options);
  const nb = normalizeVolatile(b, options);
  const deepEqual = isDeepStrictEqual(na, nb);
  const sameBytes = JSON.stringify(na) === JSON.stringify(nb);
  return {
    identical: deepEqual && sameBytes,
    deepEqual,
    sameBytes,
    difference: deepEqual && sameBytes ? null : firstDifference(na, nb),
  };
}

/** Description courte d'une différence (messages d'échec). */
export function describeDifference(diff: Difference | null): string {
  if (!diff) return 'aucune différence';
  const show = (v: unknown) => {
    const text = JSON.stringify(v);
    return text && text.length > 300 ? `${text.slice(0, 300)}…` : String(text);
  };
  return `${diff.path} : ${show(diff.a)} ≠ ${show(diff.b)}`;
}
