import { useSettings } from './settings';

/** Lettres des pièces : notation anglaise (SAN) → notation française. */
const FRENCH: Record<string, string> = { K: 'R', Q: 'D', R: 'T', B: 'F', N: 'C' };

/**
 * Affichage d'un coup en notation algébrique. En SAN, les seules majuscules sont les lettres de
 * pièces (colonnes en minuscules, roques en « O ») : il suffit de les traduire une à une.
 * Fonction d'affichage unique pour tout le SAN de l'interface.
 */
export function formatSan(san: string, french: boolean): string {
  return french ? san.replace(/[KQRBN]/g, (c) => FRENCH[c] ?? c) : san;
}

/** Formateur de SAN selon le réglage « Notation française » (anglais par défaut). */
export function useSan(): (san: string) => string {
  const french = useSettings((s) => s.frenchNotation);
  return (san) => formatSan(san, french);
}
