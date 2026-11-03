import type { Color, MoveClass } from '@sq/shared';

/** Évaluation brute d'une position, du point de vue des Blancs. */
export interface EvalLike {
  evalCp: number | null;
  mate: number | null;
}

/**
 * Probabilité de gain (0 à 100) du camp `pov`, formule de Lichess sur les centipions bornés
 * à ±1000. Un mat forcé compte comme ±1000.
 */
export function winChance(e: EvalLike, pov: Color): number {
  const cp = e.mate !== null ? (e.mate > 0 ? 1000 : -1000) : (e.evalCp ?? 0);
  const bounded = Math.max(-1000, Math.min(1000, pov === 'w' ? cp : -cp));
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * bounded)) - 1);
}

/** Précision d'un coup selon la perte de probabilité de gain (formule de Lichess). */
export function moveAccuracy(loss: number): number {
  const value = 103.1668 * Math.exp(-0.04354 * Math.max(0, loss)) - 3.1669;
  return Math.max(0, Math.min(100, value));
}

/**
 * Précision d'une partie : moyenne de la moyenne arithmétique et de la moyenne harmonique des
 * précisions des coups (l'harmonique punit davantage les grosses erreurs).
 */
export function gameAccuracy(accuracies: readonly number[]): number | null {
  if (accuracies.length === 0) return null;
  const mean = accuracies.reduce((a, b) => a + b, 0) / accuracies.length;
  const harmonic = accuracies.length / accuracies.reduce((a, b) => a + 1 / Math.max(1, b), 0);
  return Math.round(((mean + harmonic) / 2) * 10) / 10;
}

/**
 * Classe d'un coup selon la perte de probabilité de gain, en points de % (seuils de Lichess :
 * 5, 10 et 15 points pour imprécision, erreur et gaffe).
 */
export function classify(isBest: boolean, loss: number): MoveClass {
  if (isBest) return 'best';
  if (loss < 2) return 'excellent';
  if (loss < 5) return 'good';
  if (loss < 10) return 'inaccuracy';
  if (loss < 15) return 'mistake';
  return 'blunder';
}

/** Évaluation lisible, du point de vue des Blancs : « +1,2 », « −0,5 », « #3 », « #−2 ». */
export function formatEval(e: EvalLike): string {
  if (e.mate !== null) return `#${e.mate}`;
  const v = (e.evalCp ?? 0) / 100;
  if (Math.abs(v) >= 100) return v > 0 ? '+∞' : '−∞';
  const text = Math.abs(v).toFixed(1).replace('.', ',');
  return v > 0 ? `+${text}` : v < 0 ? `−${text}` : '0,0';
}
