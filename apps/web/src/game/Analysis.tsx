import type { MoveClass, PositionEval } from '@sq/shared';
import type { CSSProperties } from 'react';
import { classCss } from '../lib/classes';
import { evalValue } from '../lib/eval';

/**
 * Barre d'évaluation verticale (blanc en bas). `label` : valeur chiffrée (« +1.2 », « #3 »),
 * écrite du côté du camp qui a l'avantage.
 */
export function EvalBar({ value, label }: { value: number; label?: string }) {
  const white = 50 + 50 * Math.tanh(value / 400);
  return (
    <div className={`eval-bar${label ? ' labelled' : ''}`} data-testid="eval-bar">
      {label && (
        <span className={`eval-label ${value >= 0 ? 'white' : 'black'}`} data-testid="eval-label">
          {/^[01]-[01]$/.test(label) ? label : label.replace(/[+-]/, '')}
        </span>
      )}
      {/* Part des Blancs dans une variable : hauteur (barre verticale) ou largeur (écran étroit). */}
      <div className="white-part" style={{ '--white': `${white}%` } as CSSProperties} />
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
      <polygon className="eval-area" points={`0,100 ${points.join(' ')} 100,100`} />
      <line className="eval-axis" x1="0" y1="50" x2="100" y2="50" strokeWidth={0.5} />
      <line
        x1={(props.cursor / n) * 100}
        x2={(props.cursor / n) * 100}
        y1="0"
        y2="100"
        className="eval-cursor"
        strokeWidth={1}
      />
      {props.marks?.map((m) => (
        <ellipse
          key={m.ply}
          cx={(m.ply / n) * 100}
          cy={yOf(props.evals[m.ply])}
          rx={1.2}
          ry={3}
          className={`chart-mark ${classCss(m.cls)}`}
        />
      ))}
    </svg>
  );
}
