import type { AnalysisResponse } from '@sq/shared';
import { evalValue } from '../lib/eval';

/** Barre d'évaluation verticale (blanc en bas). */
export function EvalBar({ value }: { value: number }) {
  const white = 50 + 50 * Math.tanh(value / 400);
  return (
    <div className="eval-bar" data-testid="eval-bar">
      <div className="white-part" style={{ height: `${white}%` }} />
    </div>
  );
}

/** Courbe d'évaluation de la partie ; clic = aller à la position. */
export function EvalChart(props: {
  analysis: AnalysisResponse;
  cursor: number;
  onSelect: (ply: number) => void;
}) {
  const n = Math.max(1, props.analysis.plies.length - 1);
  const points = props.analysis.plies.map((p, i) => {
    const y = 50 - 45 * Math.tanh(evalValue(p) / 400);
    return `${(i / n) * 100},${y}`;
  });
  return (
    <svg
      className="eval-chart"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      data-testid="eval-chart"
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        props.onSelect(Math.round(((e.clientX - rect.left) / rect.width) * n));
      }}
    >
      <polygon points={`0,100 ${points.join(' ')} 100,100`} fill="#f0f0f0" opacity={0.85} />
      <line x1="0" y1="50" x2="100" y2="50" stroke="#888" strokeWidth={0.5} />
      <line
        x1={(props.cursor / n) * 100}
        x2={(props.cursor / n) * 100}
        y1="0"
        y2="100"
        stroke="#4a9eea"
        strokeWidth={1}
      />
    </svg>
  );
}
