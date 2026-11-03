import { useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Point } from '@sq/shared';

const W = 480;
const H = 170;
const PAD = { left: 40, right: 46, top: 14, bottom: 24 };

const dayOf = (date: string) => new Date(`${date}T12:00:00`).getTime();
const short = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

/** Graduations « rondes » couvrant [min, max]. */
function ticks(lo: number, hi: number): number[] {
  // Un seul point, ou une série plate : on élargit pour garder une vraie hauteur de graphique.
  const pad = hi - lo < 1 ? Math.max(5, Math.abs(hi) * 0.02) : 0;
  const min = lo - pad;
  const max = hi + pad;
  const span = Math.max(1, max - min);
  const raw = span / 4;
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500].find((s) => s >= raw) ?? 1000;
  const out: number[] = [];
  for (let v = Math.floor(min / step) * step; v <= max + step / 2; v += step) out.push(v);
  return out;
}

/**
 * Courbe d'une seule série (pas de légende : le titre la nomme). Ligne de 2 px, voile léger,
 * point final étiqueté, réticule et infobulle au survol. Une seule échelle par graphique.
 */
export function LineChart(props: {
  title: string;
  points: readonly Point[];
  /** Format des valeurs (axe, étiquette, infobulle). */
  format?: (v: number) => string;
  testId?: string;
}) {
  const { points } = props;
  const format = props.format ?? ((v: number) => String(Math.round(v)));
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) {
    return (
      <figure className="chart" data-testid={props.testId}>
        <figcaption>{props.title}</figcaption>
        <p className="muted chart-empty">Pas encore de données.</p>
      </figure>
    );
  }
  const values = points.map((p) => p.value);
  const yTicks = ticks(Math.min(...values), Math.max(...values));
  const yMin = yTicks[0] ?? 0;
  const yMax = yTicks.at(-1) ?? 1;
  const xs = points.map((p) => dayOf(p.date));
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const x = (t: number) =>
    xMax === xMin
      ? (PAD.left + W - PAD.right) / 2
      : PAD.left + ((t - xMin) / (xMax - xMin)) * (W - PAD.left - PAD.right);
  const y = (v: number) =>
    H - PAD.bottom - ((v - yMin) / (yMax - yMin || 1)) * (H - PAD.top - PAD.bottom);
  const coords = points.map((p, i) => [x(xs[i] ?? 0), y(p.value)] as const);
  const line = coords.map(([cx, cy], i) => `${i === 0 ? 'M' : 'L'}${cx},${cy}`).join(' ');
  const area = `${line} L${coords.at(-1)?.[0]},${H - PAD.bottom} L${coords[0]?.[0]},${H - PAD.bottom} Z`;
  const last = coords.at(-1) ?? [0, 0];
  const lastPoint = points.at(-1);

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    coords.forEach(([cx], i) => {
      if (Math.abs(cx - px) < Math.abs((coords[best]?.[0] ?? 0) - px)) best = i;
    });
    setHover(best);
  };
  const h = hover === null ? null : { p: points[hover], c: coords[hover] };

  return (
    <figure className="chart" data-testid={props.testId}>
      <figcaption>{props.title}</figcaption>
      <div className="chart-box">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${props.title} : ${points.length} points, dernière valeur ${lastPoint ? format(lastPoint.value) : ''}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
              <text x={PAD.left - 6} y={y(t) + 4} className="chart-tick" textAnchor="end">
                {format(t)}
              </text>
            </g>
          ))}
          <text x={PAD.left} y={H - 6} className="chart-tick">
            {short(points[0]?.date ?? '')}
          </text>
          {points.length > 1 && (
            <text x={W - PAD.right} y={H - 6} className="chart-tick" textAnchor="end">
              {short(lastPoint?.date ?? '')}
            </text>
          )}
          <path d={area} className="chart-area" />
          <path d={line} className="chart-line" />
          <circle cx={last[0]} cy={last[1]} r={4} className="chart-dot" />
          <text x={last[0] + 8} y={last[1] + 4} className="chart-label">
            {lastPoint ? format(lastPoint.value) : ''}
          </text>
          {h?.c && (
            <>
              <line
                x1={h.c[0]}
                x2={h.c[0]}
                y1={PAD.top}
                y2={H - PAD.bottom}
                className="chart-cross"
              />
              <circle cx={h.c[0]} cy={h.c[1]} r={4} className="chart-dot" />
            </>
          )}
        </svg>
        {h?.p && h.c && (
          <div
            className="chart-tip"
            style={{ left: `${(h.c[0] / W) * 100}%`, top: `${(h.c[1] / H) * 100}%` }}
          >
            <strong>{format(h.p.value)}</strong>
            <span>{short(h.p.date)}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
