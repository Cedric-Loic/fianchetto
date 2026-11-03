import type { PublicMove } from '@sq/shared';
import { useEffect, useRef } from 'react';
import { useSan } from '../lib/notation';

/** Liste des coups sur deux colonnes (notation publique) ; clic = aller à la position. */
export function MoveList(props: {
  moves: readonly PublicMove[];
  /** Notation à afficher à la place de la notation publique (analyse : notation réelle). */
  labels?: readonly string[] | undefined;
  cursor: number;
  onSelect: (ply: number) => void;
}) {
  const san = useSan();
  const rows = [];
  // Partie commencée par les Noirs (entraînement depuis une position) : case blanche vide.
  const offset = props.moves[0]?.color === 'b' ? 1 : 0;
  for (let i = -offset; i < props.moves.length; i += 2) {
    const white = i >= 0 ? props.moves[i] : undefined;
    const black = props.moves[i + 1];
    rows.push(
      <div className="move-row" key={i + offset}>
        <span className="move-number">{(i + offset) / 2 + 1}.</span>
        {[white, black].map((m) =>
          m ? (
            <button
              key={m.ply}
              className={`move${props.cursor === m.ply ? ' current' : ''}`}
              onClick={() => props.onSelect(m.ply)}
            >
              {san(props.labels?.[m.ply - 1] ?? m.san)}
            </button>
          ) : (
            <span key="empty" className="move" />
          ),
        )}
      </div>,
    );
  }
  return (
    <div className="move-list" data-testid="move-list">
      {rows}
    </div>
  );
}

/**
 * Téléphone : coups en bande horizontale qui défile sous le plateau (façon Lichess) ; le coup
 * courant est ramené dans la partie visible à chaque changement.
 */
export function MoveStrip(props: {
  moves: readonly PublicMove[];
  cursor: number;
  onSelect: (ply: number) => void;
}) {
  const san = useSan();
  const ref = useRef<HTMLDivElement>(null);
  const { cursor } = props;
  const count = props.moves.length;
  const offset = props.moves[0]?.color === 'b' ? 1 : 0;
  useEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    const current = strip.querySelector<HTMLElement>('.move.current');
    // Défilement horizontal de la bande seulement (pas de la page).
    strip.scrollLeft = current
      ? current.offsetLeft - strip.clientWidth / 2 + current.offsetWidth / 2
      : cursor === 0
        ? 0
        : strip.scrollWidth;
  }, [cursor, count]);
  return (
    <div className="move-strip" ref={ref} data-testid="move-strip">
      <div className="move-strip-inner" data-testid="move-list" role="list" aria-label="Coups">
        {count === 0 && <span className="muted move-strip-empty">Aucun coup joué</span>}
        {props.moves.map((m, i) => (
          <span key={m.ply} role="listitem" className="move-strip-item">
            {(m.color === 'w' || i === 0) && (
              <span className="move-number">
                {Math.floor((i + offset) / 2) + 1}
                {m.color === 'w' ? '.' : '…'}
              </span>
            )}
            <button
              className={`move${cursor === m.ply ? ' current' : ''}`}
              aria-current={cursor === m.ply ? 'true' : undefined}
              onClick={() => props.onSelect(m.ply)}
            >
              {san(m.san)}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
