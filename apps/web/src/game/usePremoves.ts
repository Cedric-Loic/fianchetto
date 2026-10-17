import { useCallback, useState } from 'react';
import type { LocalMove } from '../lib/virtual';

export interface PremoveQueue {
  /** File des premoves, dans l'ordre où ils ont été préparés. */
  premoves: readonly LocalMove[];
  /** Premier premove de la file (celui qui partira au prochain tour). */
  next: LocalMove | undefined;
  add: (move: LocalMove) => void;
  /** Retire le premier premove (il vient d'être envoyé). */
  shift: () => void;
  clear: () => void;
}

interface QueueState {
  list: LocalMove[];
  /** Clé de refus en vigueur quand la file a été modifiée pour la dernière fois. */
  key: unknown;
}

const listFor = (s: QueueState, key: unknown) => (Object.is(s.key, key) ? s.list : []);

/**
 * File de premoves (coups préparés pendant le tour adverse), sans aucune règle : le serveur juge
 * chaque coup quand il part. La file est vidée dès que `resetKey` change (par exemple le compteur
 * de coups refusés : un premove refusé annule les suivants), et tant que `enabled` est faux
 * (réglage « coups anticipés » désactivé).
 */
export function usePremoves(resetKey: unknown, enabled = true): PremoveQueue {
  const [state, setState] = useState<QueueState>({ list: [], key: resetKey });
  // Réglage désactivé : la file est oubliée (ajustement d'état pendant le rendu, motif React).
  if (!enabled && state.list.length > 0) setState({ list: [], key: resetKey });
  const premoves = enabled ? listFor(state, resetKey) : [];

  // Les mises à jour repartent d'une file vide si la clé a changé depuis.
  const add = useCallback(
    (move: LocalMove) =>
      setState((s) => ({ list: [...listFor(s, resetKey), move], key: resetKey })),
    [resetKey],
  );
  const shift = useCallback(
    () => setState((s) => ({ list: listFor(s, resetKey).slice(1), key: resetKey })),
    [resetKey],
  );
  const clear = useCallback(() => setState({ list: [], key: resetKey }), [resetKey]);

  return { premoves, next: premoves[0], add, shift, clear };
}
