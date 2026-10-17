import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Color, DisplayedPiece, PromotionPiece, Square } from '@sq/shared';
import { BOARD_THEMES, pieceUrl, useSettings } from '../lib/settings';

const FILES = 'abcdefgh';

export interface Arrow {
  from: Square;
  to: Square;
}

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
  /** Premove (mode bot) : camp autorisé à préparer un coup pendant le tour adverse. */
  premoveColor?: Color | null;
  /** Premoves en file d'attente (cases surlignées en rouge). */
  premoves?: readonly Arrow[];
  onPremove?: (move: Arrow & { promotion?: PromotionPiece }) => void;
  /** Clic droit : annule tous les premoves. */
  onCancelPremove?: () => void;
  /** Flèches imposées (meilleur coup en analyse). */
  extraArrows?: readonly Arrow[];
  /**
   * Classique, si le réglage est actif : coups légaux du camp au trait, fournis par le serveur.
   * Les cases accessibles à la pièce sélectionnée sont marquées. Toujours absent en Secret Queen.
   */
  legalMoves?: readonly Arrow[] | null;
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

/** Flèche SVG d'une case à une autre (coordonnées en 1/8 de plateau). */
function ArrowShape({
  arrow,
  orientation,
  color,
}: {
  arrow: Arrow;
  orientation: Color;
  color: string;
}) {
  const [x1, y1] = squareXY(arrow.from, orientation);
  const [x2, y2] = squareXY(arrow.to, orientation);
  const [ax, ay, bx, by] = [x1 + 0.5, y1 + 0.5, x2 + 0.5, y2 + 0.5];
  const len = Math.hypot(bx - ax, by - ay);
  // On arrête la tige avant la pointe.
  const ex = bx - ((bx - ax) / len) * 0.35;
  const ey = by - ((by - ay) / len) * 0.35;
  return (
    <g opacity={0.8}>
      <line
        x1={ax}
        y1={ay}
        x2={ex}
        y2={ey}
        stroke={color}
        strokeWidth={0.17}
        strokeLinecap="round"
      />
      <polygon
        points="0,-0.32 0.42,0 0,0.32"
        fill={color}
        transform={`translate(${ex},${ey}) rotate(${(Math.atan2(by - ay, bx - ax) * 180) / Math.PI})`}
      />
    </g>
  );
}

/**
 * Échiquier : glisser-déposer et clic-clic (pointer events), coordonnées dans les cases,
 * surlignage du dernier coup et de la case sélectionnée, roi en échec, animations CSS,
 * flèches et surlignages au clic droit, premoves. Le client ne connaît pas les règles : les
 * coups possibles ne sont marqués qu'en classique, à partir de la liste envoyée par le serveur.
 */
export function Board(props: BoardProps) {
  const { pieces, orientation, movable } = props;
  const settings = useSettings();
  const theme = BOARD_THEMES[settings.board];
  const boardRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  /** Glisser en cours : pièce, position du pointeur dans le plateau (px), case survolée. */
  const [drag, setDrag] = useState<{
    id: string;
    x: number;
    y: number;
    /** Taille d'une case en px (lue au mouvement, pas pendant le rendu). */
    size: number;
    over: Square | null;
  } | null>(null);
  const dragStart = useRef<{ x: number; y: number; from: Square; id: string } | null>(null);
  /** Pièce déposée à la main : pas d'animation, elle « tombe » au centre de la case. */
  const [dropped, setDropped] = useState<string | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [marks, setMarks] = useState<Square[]>([]);
  const rightStart = useRef<Square | null>(null);
  const bySquare = new Map(pieces.map((p) => [p.square, p]));

  // Camp manipulable maintenant : le mien à mon tour, ou mes pièces en premove.
  const handColor = movable ?? props.premoveColor ?? null;
  const premoving = movable === null && handColor !== null;

  const pointerInBoard = (e: { clientX: number; clientY: number }) => {
    const rect = boardRef.current?.getBoundingClientRect();
    return rect
      ? { x: e.clientX - rect.left, y: e.clientY - rect.top, size: rect.width / 8 }
      : null;
  };

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
    const promotes = piece?.type === 'p' && to[1] === lastRank && from !== props.ownSecretSquare;
    if (premoving) return props.onPremove?.(promotes ? { from, to, promotion: 'q' } : { from, to });
    // Un « pion » qui atteint la dernière rangée : choix de promotion (ignoré par le serveur
    // s'il s'agit de la dame secrète, qui ne se promeut pas).
    if (promotes) return setPromotion({ from, to });
    props.onMove?.(from, to);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const square = squareFromEvent(e);
    if (!square) return;
    if (e.button === 2) {
      // Clic droit avec des premoves en attente : tout est annulé (comme sur les sites
      // habituels) ; sinon, début d'une flèche ou d'un surlignage.
      if (props.premoves?.length) {
        props.onCancelPremove?.();
        setSelected(null);
        return;
      }
      rightStart.current = square;
      return;
    }
    if (e.button !== 0) return;
    setDropped(null);
    // Un clic gauche efface les annotations (comme sur les sites d'échecs habituels).
    setArrows([]);
    setMarks([]);
    const piece = bySquare.get(square);
    if (props.onPieceClick) {
      if (piece) props.onPieceClick(piece);
      return;
    }
    if (handColor === null) return;
    if (selected && (!piece || piece.color !== handColor)) return attempt(selected, square);
    if (piece && piece.color === handColor) {
      setSelected(square);
      boardRef.current?.setPointerCapture(e.pointerId);
      dragStart.current = { x: e.clientX, y: e.clientY, from: square, id: piece.id };
    } else {
      setSelected(null);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragStart.current;
    if (!start) return;
    // Petit seuil : en dessous, c'est un clic (clic-clic), pas un glisser.
    if (!drag && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 4) return;
    const pos = pointerInBoard(e);
    if (!pos) return;
    setDrag({ id: start.id, x: pos.x, y: pos.y, size: pos.size, over: squareFromEvent(e) });
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button === 2) {
      const from = rightStart.current;
      rightStart.current = null;
      const to = squareFromEvent(e);
      if (!from || !to) return;
      props.onCancelPremove?.();
      if (from === to) {
        setMarks((m) => (m.includes(to) ? m.filter((s) => s !== to) : [...m, to]));
      } else {
        setArrows((a) =>
          a.some((x) => x.from === from && x.to === to)
            ? a.filter((x) => !(x.from === from && x.to === to))
            : [...a, { from, to }],
        );
      }
      return;
    }
    const start = dragStart.current;
    const wasDragging = drag !== null;
    dragStart.current = null;
    setDrag(null);
    if (!start) return;
    const target = squareFromEvent(e);
    // Relâché sur sa propre case : on garde la sélection pour un clic-clic.
    if (target && target !== start.from) {
      if (wasDragging) setDropped(start.id);
      attempt(start.from, target);
    }
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
      if (props.premoves?.some((p) => p.from === square || p.to === square)) {
        classes.push('premove');
      }
      if (drag?.over === square) classes.push('drag-over');
      if (marks.includes(square)) classes.push('marked');
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

  // Coups possibles de la pièce sélectionnée (classique) : point, ou anneau sur une prise.
  const hints =
    selected && movable !== null && props.legalMoves
      ? props.legalMoves.filter((m) => m.from === selected).map((m) => m.to)
      : [];

  const allArrows = [
    ...arrows.map((a) => ({ a, c: '#f2a33a' })),
    ...(props.extraArrows ?? []).map((a) => ({ a, c: '#4a9eea' })),
  ];

  return (
    <div
      ref={boardRef}
      className="board"
      data-testid="board"
      style={{ ['--square-light' as string]: theme.light, ['--square-dark' as string]: theme.dark }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {squares}
      {pieces.map((p) => {
        const [x, y] = squareXY(p.square, orientation);
        const dragging = drag?.id === p.id;
        const src = pieceUrl(settings.pieces, p.color, p.type);
        // Pendant le glisser, le CENTRE de la pièce suit le pointeur ; un fantôme reste en place.
        return [
          dragging && (
            <img
              key={`${p.id}-ghost`}
              className="piece ghost"
              src={src}
              alt=""
              draggable={false}
              style={{ transform: `translate(${x * 100}%, ${y * 100}%)` }}
            />
          ),
          <img
            key={p.id}
            className={`piece${dragging ? ' dragging' : ''}${dropped === p.id ? ' no-anim' : ''}`}
            src={src}
            alt={`${p.color}${p.type}`}
            data-square={p.square}
            draggable={false}
            style={{
              transform: dragging
                ? `translate(${drag.x - drag.size / 2}px, ${drag.y - drag.size / 2}px)`
                : `translate(${x * 100}%, ${y * 100}%)`,
            }}
          />,
        ];
      })}
      {hints.map((square) => {
        const [x, y] = squareXY(square, orientation);
        return (
          <div
            key={`hint-${square}`}
            className={`hint${bySquare.has(square) ? ' capture' : ''}`}
            data-testid="legal-hint"
            style={{ left: `${x * 12.5}%`, top: `${y * 12.5}%` }}
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
      {allArrows.length > 0 && (
        <svg className="arrows" viewBox="0 0 8 8" data-testid="arrows">
          {allArrows.map(({ a, c }) => (
            <ArrowShape
              key={`${a.from}${a.to}${c}`}
              arrow={a}
              orientation={orientation}
              color={c}
            />
          ))}
        </svg>
      )}
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
              <img src={pieceUrl(settings.pieces, movable ?? 'w', type)} alt={type} />
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
