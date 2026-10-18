import type { MoveClass } from '@sq/shared';

/* Présentation des classes de coups (revue de partie), dans l'esprit de chess.com. */

/** Classe CSS d'une classe de coup : couleur lue dans les jetons `--class-*` (styles.css). */
export const classCss = (cls: MoveClass) => `cls-${cls}`;

export const CLASS_LABEL: Record<MoveClass, string> = {
  best: 'Meilleur coup',
  excellent: 'Excellent',
  good: 'Bon coup',
  inaccuracy: 'Imprécision',
  mistake: 'Erreur',
  blunder: 'Gaffe',
};

export const CLASS_SYMBOL: Record<MoveClass, string> = {
  best: '★',
  excellent: '!',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
};
