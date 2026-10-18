import { useSyncExternalStore } from 'react';

/** Largeur sous laquelle l'écran de partie passe en disposition téléphone (styles.css). */
export const MOBILE_QUERY = '(max-width: 899px)';

/** Vrai si la requête média correspond (faux sans `matchMedia`, comme dans jsdom). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;
      const list = window.matchMedia(query);
      list.addEventListener('change', notify);
      return () => list.removeEventListener('change', notify);
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  );
}
