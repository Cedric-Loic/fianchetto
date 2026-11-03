import { useEffect } from 'react';
import { useSettings } from '../lib/settings';

/** Les trois questions de la routine de réflexion (texte statique, identique dans toutes les variantes). */
export const ROUTINE_QUESTIONS = [
  {
    title: 'Que menace son dernier coup ?',
    text: 'Regarde la pièce qui vient de bouger : qu’attaque-t-elle, que défend-elle, que libère-t-elle ?',
  },
  {
    title: 'Échecs, prises, attaques : pour moi et pour lui ?',
    text: 'Passe en revue tous les échecs, toutes les prises et toutes les menaces, les miens d’abord, puis les siens.',
  },
  {
    title: 'Mes coups candidats',
    text: 'Retiens deux ou trois coups, sans te jeter sur le premier qui plaît, et compare-les.',
  },
] as const;

/** Vérification anti-gaffe, à faire sur le coup choisi avant de le jouer. */
export const BLUNDER_CHECK =
  'Si je joue ça, que peut-il répondre ? Ma pièce est-elle protégée, et est-ce que je laisse quelque chose en prise ?';

/** La cible d'un raccourci clavier est-elle un champ de saisie ? */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName.toUpperCase())
  );
}

/**
 * Raccourci « r » : ouvre ou ferme la routine (parties lentes). Ignoré pendant une saisie, avec
 * un modificateur, ou quand une fenêtre de dialogue est ouverte.
 */
export function useRoutineShortcut(enabled: boolean) {
  const toggle = useSettings((s) => s.update);
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'r' || e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      if (isTyping(e.target) || document.querySelector('[role="dialog"]')) return;
      toggle({ routineOpen: !useSettings.getState().routineOpen });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, toggle]);
}
