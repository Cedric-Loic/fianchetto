/** Marqueur (localStorage) qui désactive le guide, par exemple pour des tests automatisés. */
export const ONBOARDING_SKIP_KEY = 'fianchetto-skip-onboarding';
/** Marqueur qui force le guide même dans un navigateur piloté (test du guide lui-même). */
export const ONBOARDING_FORCE_KEY = 'fianchetto-force-onboarding';

/**
 * Faut-il proposer le premier lancement guidé ? Non s'il a déjà été fait ou passé, ni si le
 * marqueur de désactivation est posé, ni dans un navigateur piloté (`navigator.webdriver` :
 * tests de bout en bout), sauf marqueur explicite pour le forcer.
 */
export function onboardingWanted(onboarded: boolean): boolean {
  if (onboarded) return false;
  try {
    if (localStorage.getItem(ONBOARDING_FORCE_KEY) !== null) return true;
    if (localStorage.getItem(ONBOARDING_SKIP_KEY) !== null) return false;
  } catch {
    return false;
  }
  return !navigator.webdriver;
}

/** Niveau ressenti → niveau du bot présélectionné. */
export const FELT_LEVELS = [
  { level: 1, title: 'Je débute', text: 'Je connais à peine la marche des pièces.' },
  { level: 2, title: 'Je connais les règles', text: 'Je joue de temps en temps, pour le plaisir.' },
  { level: 3, title: 'Je joue régulièrement', text: 'Quelques ouvertures, des tactiques simples.' },
  { level: 4, title: 'Je suis confirmé', text: 'Joueur de club, Elo 1400 et plus.' },
  { level: 5, title: 'Je suis fort', text: 'Elo 1700 et plus : sors le grand jeu.' },
] as const;
