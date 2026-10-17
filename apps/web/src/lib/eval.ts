import type { AnalysisResponse } from '@sq/shared';

/** Évaluation affichable (centipions, point de vue des Blancs), bornée pour les graphiques. */
export function evalValue(p: AnalysisResponse['plies'][number] | undefined): number {
  if (!p) return 0;
  if (p.mate !== null) return p.mate >= 0 ? 1000 : -1000;
  return Math.max(-1000, Math.min(1000, p.evalCp ?? 0));
}

export function evalLabel(p: AnalysisResponse['plies'][number] | undefined): string {
  if (!p) return '';
  if (p.mate !== null) return `#${p.mate}`;
  const v = (p.evalCp ?? 0) / 100;
  if (Math.abs(v) >= 100) return v > 0 ? '1-0' : '0-1';
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
}
