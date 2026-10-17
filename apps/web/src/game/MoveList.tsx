import type { PublicMove } from '@sq/shared';

/** Liste des coups sur deux colonnes (notation publique) ; clic = aller à la position. */
export function MoveList(props: {
  moves: readonly PublicMove[];
  cursor: number;
  onSelect: (ply: number) => void;
}) {
  const rows = [];
  for (let i = 0; i < props.moves.length; i += 2) {
    const white = props.moves[i];
    const black = props.moves[i + 1];
    rows.push(
      <div className="move-row" key={i}>
        <span className="move-number">{i / 2 + 1}.</span>
        {[white, black].map((m) =>
          m ? (
            <button
              key={m.ply}
              className={`move${props.cursor === m.ply ? ' current' : ''}`}
              onClick={() => props.onSelect(m.ply)}
            >
              {m.san}
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
