/**
 * Utilitaires du banc de fuite. Un « canari » est une valeur unique injectée dans un secret ;
 * aucune sortie observable par l'adversaire (payload, store, stockage, log) ne doit la contenir.
 */
export function makeCanary(label: string): string {
  return `CANARY-${label}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Vérifie récursivement qu'une valeur sérialisée ne contient aucun des canaris. */
export function findLeaks(output: unknown, canaries: readonly string[]): string[] {
  const text = typeof output === 'string' ? output : JSON.stringify(output);
  return canaries.filter((c) => text.includes(c));
}
