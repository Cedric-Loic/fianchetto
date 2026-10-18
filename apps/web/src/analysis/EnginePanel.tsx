import type { EngineLine } from '@sq/shared';
import { engineEvalLabel } from '../lib/eval';
import { fullmoveOf, turnOf } from './tree';
import type { EngineState } from './useEngine';

/** Suite SAN numérotée à partir de la position `fen` : « 12. e4 e5 13. Nf3 » ou « 12… e5 ». */
function numbered(fen: string, sans: readonly string[]): { prefix: string | null; san: string }[] {
  let number = fullmoveOf(fen);
  let color = turnOf(fen);
  return sans.map((san, i) => {
    const prefix = color === 'w' ? `${number}.` : i === 0 ? `${number}…` : null;
    if (color === 'b') number++;
    color = color === 'w' ? 'b' : 'w';
    return { prefix, san };
  });
}

/**
 * Moteur en direct : interrupteur, profondeur, et les meilleures lignes (évaluation du point de
 * vue des Blancs puis la suite en SAN). Clic sur un coup : la ligne est jouée jusqu'à lui dans
 * l'arbre ; survol d'une ligne : flèche de son premier coup sur le plateau.
 */
export function EnginePanel(props: {
  fen: string;
  engine: EngineState;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onPlay: (ucis: string[]) => void;
  onHover: (uci: string | null) => void;
}) {
  const { engine, enabled } = props;
  const line = (l: EngineLine) => (
    <div
      key={l.multipv}
      className="engine-line"
      data-testid="engine-line"
      onMouseEnter={() => props.onHover(l.pv[0] ?? null)}
      onMouseLeave={() => props.onHover(null)}
    >
      <span
        className={`engine-eval ${(l.mate ?? l.evalCp ?? 0) >= 0 ? 'white' : 'black'}`}
        data-testid="engine-eval"
      >
        {engineEvalLabel(l)}
      </span>
      <span className="engine-pv">
        {numbered(props.fen, l.sanPv).map((m, i) => (
          <span key={i} className="engine-step">
            {m.prefix && <span className="engine-number">{m.prefix}</span>}
            <button
              type="button"
              className="engine-move"
              onClick={() => props.onPlay(l.pv.slice(0, i + 1))}
            >
              {m.san}
            </button>
          </span>
        ))}
      </span>
    </div>
  );

  return (
    <div className="engine-panel" data-testid="engine-panel">
      <div className="engine-header">
        <label className="switch">
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            data-testid="engine-toggle"
            onChange={(e) => props.onToggle(e.target.checked)}
          />
          <span className="switch-track" aria-hidden="true" />
          Moteur
        </label>
        {enabled && (
          <span className="muted engine-depth" data-testid="engine-depth">
            {engine.status === 'loading'
              ? 'Analyse…'
              : engine.depth > 0
                ? `Profondeur ${engine.depth}${engine.status === 'done' ? '' : '…'}`
                : ''}
          </span>
        )}
      </div>
      {enabled && engine.message && (
        <p className="muted engine-message" data-testid="engine-message">
          {engine.message}
        </p>
      )}
      {enabled && engine.lines.length > 0 && (
        <div className="engine-lines">{engine.lines.map(line)}</div>
      )}
    </div>
  );
}
