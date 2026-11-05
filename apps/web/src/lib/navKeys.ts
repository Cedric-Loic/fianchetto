import { useEffect, useEffectEvent, useState } from 'react';
import type { DisplayedPiece, Square } from '@sq/shared';

/** Déplacements dans l'historique d'un plateau. */
export interface NavHandlers {
  prev: () => void;
  next: () => void;
  start: () => void;
  end: () => void;
}

/**
 * Cibles qui gardent les flèches pour elles : saisie de texte, listes, onglets, et le plateau
 * quand il a le focus clavier (il y déplace le curseur de case en case).
 */
function navIgnored(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement && ['checkbox', 'radio'].includes(target.type)) {
    return false;
  }
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.isContentEditable ||
    target.closest('[role="tablist"], [role="grid"], [role="listbox"], [role="slider"]') !== null
  );
}

/**
 * Raccourcis communs à tous les plateaux : ← coup précédent, → coup suivant, ↑ position actuelle
 * (fin), ↓ position de départ (début). `null` : raccourcis inactifs.
 */
export function useNavKeys(nav: NavHandlers | null): void {
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (!nav || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (navIgnored(e.target)) return;
    const actions: Record<string, () => void> = {
      ArrowLeft: nav.prev,
      ArrowRight: nav.next,
      ArrowUp: nav.end,
      ArrowDown: nav.start,
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey(e);
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

/** Une position affichée : pièces et dernier coup. */
export interface BoardFrame {
  pieces: DisplayedPiece[];
  lastMove: { from: Square; to: Square } | null;
}

/**
 * Historique des positions affichées sur un plateau d'exercice (puzzle, leçon, ouverture…) :
 * chaque nouvelle position (nouvelle liste de pièces ou nouveau dernier coup) est mémorisée, et
 * les flèches permettent de revoir les précédentes. `key` change à chaque nouvel exercice : on
 * repart d'un historique vide. Une nouvelle position ramène au présent.
 */
export function useBoardHistory(live: BoardFrame, key: string) {
  const [hist, setHist] = useState<{ key: string; frames: BoardFrame[] }>({
    key,
    frames: [live],
  });
  const [view, setView] = useState<{ key: string; base: number; index: number } | null>(null);

  // Mise à jour pendant le rendu (et non dans un effet) : l'historique suit l'affichage sans
  // rendu intermédiaire.
  let frames = hist.frames;
  const last = frames[frames.length - 1];
  if (hist.key !== key) {
    frames = [live];
    setHist({ key, frames });
  } else if (!last || last.pieces !== live.pieces || last.lastMove !== live.lastMove) {
    frames = [...frames, live];
    setHist({ key, frames });
  }

  const end = frames.length - 1;
  const index = view && view.key === key && view.base === frames.length ? view.index : end;
  const isLive = index >= end;
  const go = (i: number) =>
    setView({ key, base: frames.length, index: Math.max(0, Math.min(end, i)) });
  const nav: NavHandlers = {
    prev: () => go(index - 1),
    next: () => go(index + 1),
    start: () => go(0),
    end: () => go(end),
  };
  return { frame: isLive ? live : (frames[index] ?? live), isLive, nav };
}
