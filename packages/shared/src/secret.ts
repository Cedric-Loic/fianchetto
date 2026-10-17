/**
 * Enveloppe pour toute donnée qui ne doit jamais sortir du serveur avant la fin de partie :
 * identité d'une dame secrète, position réelle, FEN réelle, notation réelle...
 *
 * Garanties (vérifiées par packages/shared/test/secret.test.ts) :
 * - la valeur vit dans un champ privé `#value` : invisible pour JSON.stringify, Object.keys,
 *   le spread `{...s}`, structuredClone et postMessage (worker du bot) ;
 * - toJSON / toString / Symbol.toPrimitive / util.inspect renvoient « [REDACTED] » :
 *   un log accidentel (console, pino) ou une sérialisation accidentelle ne fuit rien ;
 * - la seule lecture possible passe par `expose()`, dont l'usage est restreint par la règle
 *   ESLint `secret/no-expose` à une liste blanche de fichiers (voir eslint.config.js).
 *
 * Ce module n'est importable que côté Node (`@sq/shared/secret`) : le lint interdit
 * son import dans apps/web.
 */

export const REDACTED = '[REDACTED]';

const INSPECT = Symbol.for('nodejs.util.inspect.custom');

export class Secret<T> {
  readonly #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  /** Lecture explicite de la valeur. Usage limité par la règle de lint `secret/no-expose`. */
  expose(): T {
    return this.#value;
  }

  toJSON(): string {
    return REDACTED;
  }

  toString(): string {
    return REDACTED;
  }

  [Symbol.toPrimitive](): string {
    return REDACTED;
  }

  [INSPECT](): string {
    return REDACTED;
  }

  get [Symbol.toStringTag](): string {
    return 'Secret';
  }

  static isSecret(value: unknown): value is Secret<unknown> {
    return value instanceof Secret;
  }
}
