import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Color, DisplayedPiece, PromotionPiece, Square } from '@sq/shared';

const FILES = 'abcdefgh';

export interface BoardProps {
  pieces: readonly DisplayedPiece[];
  orientation: Color;
  /** Camp dont les pièces peuvent être déplacées (`null` = plateau en lecture seule). */
  movable: Color | null;
  lastMove?: { from: Square; to: Square } | null;
  checkSquare?: Square | null;
  /** Cases marquées d'une couronne (dame secrète). */
  crowns?: readonly Square[];
  /** Case mise en avant (pion choisi pendant la sélection). */
  highlighted?: Square | null;
  onMove?: (from: Square, to: Square, promotion?: PromotionPiece) => void;
  /** Mode bot : ma dame secrète (pas de fenêtre de promotion pour elle). */
  ownSecretSquare?: Square | null;
  /** Mode sélection : clic sur une pièce au lieu d'un déplacement. */
  onPieceClick?: (piece: DisplayedPiece) => void;
}

function squareXY(square: Square, orientation: Color): [number, number] {
  const file = FILES.indexOf(square[0] ?? 'a');
  const rank = Number(square[1]) - 1;
  return orientation === 'w' ? [file, 7 - rank] : [7 - file, rank];
}

function xyToSquare(x: number, y: number, orientation: Color): Square | null {
  if (x < 0 || x > 7 || y < 0 || y > 7) return null;
  const file = orientation === 'w' ? x : 7 - x;
  const rank = orientation === 'w' ? 7 - y : y;
  return `${FILES[file]}${rank + 1}` as Square;
}

const pieceUrl = (p: DisplayedPiece) => `/pieces/cburnett/${p.color}${p.type.toUpperCase()}.svg`;

/**
 * Échiquier : glisser-déposer et clic-clic (pointer events), coordonnées dans les cases,
 * surlignage du dernier coup et de la case sélectionnée, roi en échec, animations CSS.
 * Aucune surbrillance des coups légaux (le client ne connaît pas les règles).
 */
export function Board(props: BoardProps) {
  const { pieces, orientation, movable } = props;
  const boardRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; from: Square } | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const bySquare = new Map(pieces.map((p) => [p.square, p]));

  const squareFromEvent = (e: { clientX: number; clientY: number }): Square | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const size = rect.width / 8;
    return xyToSquare(
      Math.floor((e.clientX - rect.left) / size),
      Math.floor((e.clientY - rect.top) / size),
      orientation,
    );
  };

  const attempt = (from: Square, to: Square) => {
    setSelected(null);
    if (from === to) return;
    const piece = bySquare.get(from);
    const lastRank = piece?.color === 'w' ? '8' : '1';
    // Un « pion » qui atteint la dernière rangée : choix de promotion (ignoré par le serveur
    // s'il s'agit de la dame secrète, qui ne se promeut pas).
    if (piece?.type === 'p' && to[1] === lastRank && from !== props.ownSecretSquare) {
      return setPromotion({ from, to });
    }
    props.onMove?.(from, to);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const square = squareFromEvent(e);
    if (!square) return;
    const piece = bySquare.get(square);
    if (props.onPieceClick) {
      if (piece) props.onPieceClick(piece);
      return;
    }
    if (movable === null) return;
    if (selected && (!piece || piece.color !== movable)) return attempt(selected, square);
    if (piece && piece.color === movable) {
      setSelected(square);
      setDrag({ id: piece.id, dx: 0, dy: 0 });
      boardRef.current?.setPointerCapture(e.pointerId);
      dragStart.current = { x: e.clientX, y: e.clientY, from: square };
    } else {
      setSelected(null);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!drag || !start) return;
    setDrag({ ...drag, dx: e.clientX - start.x, dy: e.clientY - start.y });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    dragStart.current = null;
    setDrag(null);
    if (!start) return;
    const target = squareFromEvent(e);
    // Relâché sur sa propre case : on garde la sélection pour un clic-clic.
    if (target && target !== start.from) attempt(start.from, target);
  };

  const squares = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const square = xyToSquare(x, y, orientation) as Square;
      const light = (x + y) % 2 === 0;
      const classes = ['sq', light ? 'light' : 'dark'];
      if (props.lastMove && (props.lastMove.from === square || props.lastMove.to === square)) {
        classes.push('last');
      }
      if (selected === square || props.highlighted === square) classes.push('selected');
      if (props.checkSquare === square) classes.push('check');
      squares.push(
        <div
          key={square}
          className={classes.join(' ')}
          style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%` }}
        >
          {x === 0 && <span className="coord rank">{square[1]}</span>}
          {y === 7 && <span className="coord file">{square[0]}</span>}
        </div>,
      );
    }
  }

  return (
    <div
      ref={boardRef}
      className="board"
      data-testid="board"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {squares}
      {pieces.map((p) => {
        const [x, y] = squareXY(p.square, orientation);
        const dragging = drag?.id === p.id;
        return (
          <img
            key={p.id}
            className={`piece${dragging ? ' dragging' : ''}`}
            src={pieceUrl(p)}
            alt={`${p.color}${p.type}`}
            data-square={p.square}
            draggable={false}
            style={{
              transform: `translate(${x * 100}%, ${y * 100}%)${
                dragging ? ` translate(${drag.dx}px, ${drag.dy}px)` : ''
              }`,
            }}
          />
        );
      })}
      {props.crowns?.map((square) => {
        const [x, y] = squareXY(square, orientation);
        return (
          <div
            key={`crown-${square}`}
            className="crown"
            data-testid="secret-marker"
            style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%` }}
          >
            ♛
          </div>
        );
      })}
      {promotion && (
        <div className="promotion" onPointerDown={(e) => e.stopPropagation()}>
          {(['q', 'r', 'b', 'n'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                props.onMove?.(promotion.from, promotion.to, type);
                setPromotion(null);
              }}
            >
              <img src={`/pieces/cburnett/${movable ?? 'w'}${type.toUpperCase()}.svg`} alt={type} />
            </button>
          ))}
          <button className="cancel" onClick={() => setPromotion(null)}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
