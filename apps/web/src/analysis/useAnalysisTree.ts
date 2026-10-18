import { useState } from 'react';
import { AnalysisTree, type LineMove } from './tree';

/** Arbre de coups et nœud courant, avec les opérations de l'échiquier d'analyse. */
export interface TreeController {
  tree: AnalysisTree;
  current: string;
  /** Incrémenté à chaque modification de l'arbre (l'arbre lui-même est mutable). */
  version: number;
  select: (id: string) => void;
  /** Joue un coup depuis le nœud courant et s'y place ; `null` si illégal. */
  play: (uci: string) => string | null;
  /** Joue un coup depuis un nœud donné, sans changer le nœud courant. */
  playFrom: (fromId: string, uci: string) => string | null;
  /** Joue une suite de coups depuis le nœud courant et se place sur le dernier. */
  playLine: (ucis: readonly string[]) => void;
  promote: (id: string) => void;
  remove: (id: string) => void;
  /** Remplace tout l'arbre (chargement d'une FEN ou d'un PGN). */
  load: (fen: string, line?: readonly (LineMove | string)[]) => void;
}

export function useAnalysisTree(
  fen: string,
  line: readonly (LineMove | string)[] = [],
): TreeController {
  const [state, setState] = useState(() => {
    const tree = new AnalysisTree(fen, line);
    return { tree, current: tree.rootId, version: 0 };
  });
  const { tree, current } = state;

  // Les mutations de l'arbre ont lieu dans les gestionnaires d'événements, jamais pendant le
  // rendu ; `version` force le nouveau rendu.
  const bump = (next: string) =>
    setState((s) => ({ tree: s.tree, current: next, version: s.version + 1 }));

  return {
    tree,
    current,
    version: state.version,
    select: (id) => {
      if (tree.has(id)) bump(id);
    },
    play: (uci) => {
      const id = tree.play(current, uci);
      if (id) bump(id);
      return id;
    },
    playFrom: (fromId, uci) => {
      const id = tree.play(fromId, uci);
      if (id) setState((s) => ({ ...s, version: s.version + 1 }));
      return id;
    },
    playLine: (ucis) => {
      const ids = tree.playLine(current, ucis);
      const last = ids[ids.length - 1];
      if (last) bump(last);
    },
    promote: (id) => {
      if (tree.promote(id)) bump(current);
    },
    remove: (id) => {
      const parent = tree.remove(id);
      if (parent === null) return;
      // Le nœud courant a disparu avec la variante : on revient au parent.
      bump(tree.has(current) ? current : parent);
    },
    load: (newFen, newLine = []) => {
      const next = new AnalysisTree(newFen, newLine);
      setState((s) => ({ tree: next, current: next.rootId, version: s.version + 1 }));
    },
  };
}
