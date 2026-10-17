import type { MoveClass } from '@sq/shared';

/* Présentation des classes de coups (revue de partie), dans l'esprit de chess.com. */

/** Couleur de chaque classe de coup (points de la courbe, liste des coups). */
export const CLASS_COLOR: Record<MoveClass, string> = {
  best: '#81b64c',
  excellent: '#96bc4b',
  good: '#97af8b',
  inaccuracy: '#f7c631',
  mistake: '#ffa459',
  blunder: '#fa412d',
};

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
