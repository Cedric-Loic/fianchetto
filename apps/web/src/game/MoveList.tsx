import type { PublicMove } from '@sq/shared';
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
