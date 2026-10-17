import type { MoveClass, PositionEval } from '@sq/shared';
import { CLASS_COLOR } from '../lib/classes';
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

/**
 * Courbe d'évaluation de la partie ; clic = aller à la position. `marks` : erreurs à signaler
 * par un point (demi-coup → classe).
 */
export function EvalChart(props: {
  evals: readonly PositionEval[];
  cursor: number;
  onSelect: (ply: number) => void;
  marks?: readonly { ply: number; cls: MoveClass }[];
}) {
  const n = Math.max(1, props.evals.length - 1);
  const yOf = (p: PositionEval | undefined) => 50 - 45 * Math.tanh(evalValue(p) / 400);
  const points = props.evals.map((p, i) => {
    return `${(i / n) * 100},${yOf(p)}`;
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
      {props.marks?.map((m) => (
        <ellipse
          key={m.ply}
          cx={(m.ply / n) * 100}
          cy={yOf(props.evals[m.ply])}
          rx={1.2}
          ry={3}
          fill={CLASS_COLOR[m.cls]}
        />
      ))}
    </svg>
  );
}
