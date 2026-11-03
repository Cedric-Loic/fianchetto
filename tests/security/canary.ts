import { inspect } from 'node:util';
import { FILES, type Color, type Square } from '@sq/shared';

/**
 * Utilitaires du banc de fuite. Un « canari » est une valeur unique injectée dans un secret ;
 * aucune sortie observable par l'adversaire (payload, store, stockage, log) ne doit la contenir.
 *
 * Au niveau du moteur, le secret est une case de départ de pion (« e2 ») : on ne peut pas y
 * injecter une chaîne arbitraire. Les canaris du moteur sont donc des JETONS qui n'apparaissent
 * que si l'état réel fuit : rangée FEN réelle contenant la dame secrète (« PPPPQPPP »),
 * identifiant naïf construit sur le type réel (« wqe2 »), FEN réelle complète.
 */

/** Marqueur des valeurs masquées (`Secret<T>`, objet partie). */
export const REDACTED = '[REDACTED]';

export function makeCanary(label: string): string {
  return `CANARY-${label}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Sérialise une valeur sans jamais lever d'exception (cycles, BigInt, getters qui lèvent). */
export function safeStringify(output: unknown): string {
  if (typeof output === 'string') return output;
  try {
    const json = JSON.stringify(output);
    if (json !== undefined) return json;
  } catch {
    // On retombe sur util.inspect, qui supporte les cycles.
  }
  return inspect(output, { depth: Infinity, showHidden: true, breakLength: Infinity });
}

/** Renvoie les canaris présents dans la valeur (recherche dans sa sérialisation complète). */
export function findLeaks(output: unknown, canaries: readonly string[]): string[] {
  const text = safeStringify(output);
  return canaries.filter((c) => c.length > 0 && text.includes(c));
}

export interface SecretPair {
  w: Square;
  b: Square;
}

/**
 * Rangée FEN réelle des pions d'un camp dont le pion `square` est une dame
 * (ex. blanc, e2 → « PPPPQPPP » ; noir, c7 → « ppqppppp »).
 */
export function realPawnRankToken(color: Color, square: Square): string {
  const pawn = color === 'w' ? 'P' : 'p';
  const queen = color === 'w' ? 'Q' : 'q';
  return FILES.map((file) => (square.startsWith(file) ? queen : pawn)).join('');
}

/** FEN réelle de la position initiale (référence pour les canaris et le contrôle positif). */
export function realInitialFen(secrets: SecretPair): string {
  return [
    'rnbqkbnr',
    realPawnRankToken('b', secrets.b),
    '8',
    '8',
    '8',
    '8',
    realPawnRankToken('w', secrets.w),
    'RNBQKBNR',
  ].join('/');
}

/**
 * Jetons qui trahiraient le secret d'un camp s'ils apparaissaient avant la fin :
 * - la rangée FEN réelle de ses pions (position initiale) ;
 * - l'identifiant « naïf » couleur + type RÉEL + case initiale (« wqe2 ») : jamais légitime,
 *   car les seuls identifiants de dame sont `wqd1` et `bqd8` et une pièce promue garde
 *   l'identifiant de son pion.
 */
export function secretCanaryTokens(color: Color, square: Square): string[] {
  return [realPawnRankToken(color, square), `${color}q${square}`];
}

/** Toutes les sérialisations qu'un log ou un développeur pressé pourrait produire. */
export function observableSerializations(value: unknown): Record<string, string> {
  const attempt = (fn: () => string): string => {
    try {
      return fn();
    } catch (error) {
      // Le message d'erreur lui-même pourrait fuir : on le garde pour qu'il soit analysé.
      return `<exception: ${error instanceof Error ? error.message : 'inconnue'}>`;
    }
  };
  return {
    json: attempt(() => JSON.stringify(value) ?? 'undefined'),
    string: attempt(() => String(value)),
    template: attempt(() => `${value as string}`),
    inspect: attempt(() => inspect(value)),
    inspectDeep: attempt(() => inspect(value, { depth: Infinity, showHidden: true })),
    inspectRaw: attempt(() =>
      inspect(value, { depth: Infinity, showHidden: true, customInspect: false }),
    ),
    inspectWrapped: attempt(() => inspect({ wrapped: value }, { depth: Infinity })),
    jsonWrapped: attempt(() => JSON.stringify({ wrapped: value })),
  };
}
