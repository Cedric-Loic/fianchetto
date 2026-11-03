/** Premier intervalle d'un suivi par interrogation régulière (ms). */
export const POLL_MIN_MS = 700;
/** Intervalle maximal (ms). */
export const POLL_MAX_MS = 2000;

/**
 * Espacement progressif des interrogations : 700 ms, puis ×1,3 à chaque tour, jusqu'à 2 s.
 * `round` commence à 0.
 */
export function pollDelay(round: number): number {
  return Math.min(POLL_MAX_MS, Math.round(POLL_MIN_MS * 1.3 ** Math.max(0, round)));
}

/** Attente interrompue par `signal` (résout `false` si annulée). */
export function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve(false);
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}
