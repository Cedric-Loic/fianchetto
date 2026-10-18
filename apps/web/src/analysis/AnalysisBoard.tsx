import { useEffect, useState, type ReactNode } from 'react';
import type { BoardArrow, Color, MoveClass, Square } from '@sq/shared';
import { EvalBar } from '../game/Analysis';
import { Board, type BoardMark } from '../game/Board';
import { evalLabel, evalValue } from '../lib/eval';
import { piecesFromFen } from '../lib/fen';
import { useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';
import { IconFirst, IconFlip, IconLast, IconNext, IconPrev } from '../ui/icons';
import { EnginePanel } from './EnginePanel';
import { MoveTree } from './MoveTree';
import { morphPieces } from './pieces';
import { turnOf, type LineMove, type TreeNode } from './tree';
import { useAnalysisTree, type TreeController } from './useAnalysisTree';
import { useEngine } from './useEngine';

interface EvalLike {
  evalCp: number | null;
  mate: number | null;
}

export interface AnalysisBoardProps {
  /** Position de départ et ligne principale (ignorées si `controller` est fourni). */
  initialFen?: string;
  mainline?: readonly (LineMove | string)[];
  /** Arbre géré par la page (revue : navigation depuis la courbe, « Voir la ligne »…). */
  controller?: TreeController;
  /** Évaluation de chaque position de la ligne fournie (indice = demi-coup, 0 = départ). */
  evals?: readonly (EvalLike | undefined)[];
  /** Classe de chaque coup de la ligne fournie (indice = demi-coup − 1). */
  moveClasses?: readonly (MoveClass | null | undefined)[];
  /** Temps restant (ms) après chaque coup de la ligne fournie (indice = demi-coup − 1). */
  clocks?: readonly (number | null | undefined)[];
  orientation?: Color;
  /** Flèches et cases supplémentaires fournies par la page (explication du coup…). */
  arrows?: readonly BoardArrow[];
  marks?: readonly BoardMark[];
  /** Nœud courant changé ; `ply` = rang dans la ligne fournie, `null` dans une variante. */
  onNodeChange?: (node: TreeNode, ply: number | null) => void;
  /** Les coups de la ligne fournie (partie revue) ne peuvent être ni supprimés ni déclassés. */
  lockMainline?: boolean;
  /** Noms affichés au-dessus et au-dessous du plateau, par camp. */
  names?: Partial<Record<Color, ReactNode>>;
  /** Contenu du panneau latéral, avant et après le moteur et la liste des coups. */
  panelTop?: ReactNode;
  panelBottom?: ReactNode;
  /**
   * Mode guidé (revue guidée) : plateau en lecture seule, sans moteur, arbre ni navigation au
   * clavier ; la page pilote la position.
   */
  guided?: boolean;
}

const uciArrow = (uci: string, kind: BoardArrow['kind']): BoardArrow => ({
  from: uci.slice(0, 2) as Square,
  to: uci.slice(2, 4) as Square,
  kind,
});

/** Les raccourcis clavier ne s'appliquent pas pendant la saisie ni dans des onglets. */
function ignoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  // Une case à cocher (interrupteur du moteur) ne capte pas la saisie : raccourcis actifs.
  if (target instanceof HTMLInputElement && ['checkbox', 'radio'].includes(target.type)) {
    return false;
  }
  return (
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) ||
    target.isContentEditable ||
    target.closest('[role="tablist"]') !== null
  );
}

/**
 * Échiquier d'analyse : plateau jouable des deux côtés (coups légaux calculés localement, sur
 * une position publique uniquement), arbre de variantes, barre d'évaluation, moteur en direct,
 * navigation au clavier (← → ↑ ↓ Début Fin, f = retourner).
 */
export function AnalysisBoard(props: AnalysisBoardProps) {
  const own = useAnalysisTree(props.initialFen ?? '', props.controller ? [] : props.mainline);
  const ctl = props.controller ?? own;
  const { tree, current } = ctl;
  const node = tree.get(current);
  const settings = useSettings();
  const [flipped, setFlipped] = useState(false);
  const [hover, setHover] = useState<{ fen: string; uci: string } | null>(null);
  const [threatOn, setThreatOn] = useState(false);
  const guided = props.guided === true;
  const checkSquare = tree.checkSquare(current);
  // Menace : seulement si le camp au trait n'est pas en échec (trait inversé impossible sinon).
  const threatActive = threatOn && checkSquare === null;
  const engineOn = settings.engine && !guided;
  const engine = useEngine(node.fen, engineOn, 3, threatActive);

  // Rang de chaque nœud de la ligne fournie (0 = position de départ).
  const lineIds = [tree.rootId, ...tree.initialLine];
  const plyOf = (id: string) => {
    const index = lineIds.indexOf(id);
    return index >= 0 ? index : null;
  };
  const ply = plyOf(current);

  const { onNodeChange } = props;
  useEffect(() => {
    if (!tree.has(current)) return;
    onNodeChange?.(tree.get(current), plyOf(current));
    // Seul le changement de nœud compte ; les rappels de la page ne relancent rien.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, tree]);

  // Pièces affichées : identifiants transmis d'une position à l'autre pour animer les coups.
  const [display, setDisplay] = useState(() => ({
    fen: node.fen,
    pieces: piecesFromFen(node.fen),
  }));
  let pieces = display.pieces;
  if (display.fen !== node.fen) {
    pieces = morphPieces(display.pieces, piecesFromFen(node.fen));
    setDisplay({ fen: node.fen, pieces });
  }

  const go = (id: string | null) => {
    if (id) ctl.select(id);
  };

  // Clavier : ← → coup précédent / suivant, ↑ ↓ variante voisine, Début / Fin, f = retourner.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || ignoredTarget(e.target)) return;
      if (guided) {
        if (e.key === 'f') setFlipped((f) => !f);
        return;
      }
      const actions: Record<string, () => void> = {
        ArrowLeft: () => go(tree.prev(current)),
        ArrowRight: () => go(tree.next(current)),
        ArrowUp: () => go(tree.sibling(current, -1)),
        ArrowDown: () => go(tree.sibling(current, 1)),
        Home: () => go(tree.rootId),
        End: () => go(tree.end(current)),
        f: () => setFlipped((f) => !f),
        x: () => setThreatOn((t) => !t),
      };
      const action = actions[e.key];
      if (!action) return;
      e.preventDefault();
      action();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onMove = (from: Square, to: Square, promotion?: string) => {
    const id = ctl.play(`${from}${to}${promotion ?? ''}`);
    if (!id) return playSound('illegal');
    const san = tree.get(id).san ?? '';
    playSound(/[+#]/.test(san) ? 'check' : san.includes('x') ? 'capture' : 'move');
  };

  const base = props.orientation ?? 'w';
  const orientation: Color = flipped ? (base === 'w' ? 'b' : 'w') : base;
  const turn = turnOf(node.fen);

  // Flèches : celles de la page, le meilleur coup du moteur (si la page n'en dessine pas),
  // et la ligne survolée dans le panneau du moteur.
  const hovered = hover && hover.fen === node.fen ? hover.uci : null;
  const engineBest = engine.lines[0]?.pv[0];
  const arrows: BoardArrow[] = [...(props.arrows ?? [])];
  if (hovered) arrows.push(uciArrow(hovered, 'best'));
  else if (engineBest && arrows.length === 0) arrows.push(uciArrow(engineBest, 'best'));
  const threatMove = threatActive ? engine.threat?.pv[0] : undefined;
  if (threatMove) arrows.push(uciArrow(threatMove, 'threat'));

  // Barre : moteur en direct s'il tourne, sinon l'évaluation fournie par la page.
  const liveEval = engine.lines[0];
  const evalShown = liveEval ?? (ply !== null ? props.evals?.[ply] : undefined);

  const annotations = new Map<string, MoveClass>();
  tree.initialLine.forEach((id, i) => {
    const cls = props.moveClasses?.[i];
    if (cls) annotations.set(id, cls);
  });
  const clocks = new Map<string, number>();
  tree.initialLine.forEach((id, i) => {
    const ms = props.clocks?.[i];
    if (ms != null) clocks.set(id, ms);
  });
  const locked = new Set(props.lockMainline ? tree.initialLine : []);

  const name = (c: Color) =>
    props.names?.[c] !== undefined ? (
      <div className="player-bar simple">{props.names[c]}</div>
    ) : null;

  return (
    <div className="game review analysis-board" data-testid="analysis-board">
      <EvalBar value={evalValue(evalShown)} label={evalLabel(evalShown)} />
      <div className="board-column">
        {name(orientation === 'w' ? 'b' : 'w')}
        <div className="board-wrap">
          <Board
            pieces={pieces}
            orientation={orientation}
            movable={guided ? null : turn}
            onMove={onMove}
            lastMove={
              node.uci
                ? { from: node.uci.slice(0, 2) as Square, to: node.uci.slice(2, 4) as Square }
                : null
            }
            checkSquare={checkSquare}
            legalMoves={settings.showLegalMoves && !guided ? tree.legalMoves(current) : null}
            arrows={arrows}
            {...(props.marks ? { squareMarks: props.marks } : {})}
          />
        </div>
        {name(orientation)}
      </div>

      <aside className="panel side-panel">
        {props.panelTop}
        {!guided && (
          <>
            <EnginePanel
              fen={node.fen}
              engine={engine}
              enabled={settings.engine}
              onToggle={(on) => settings.update({ engine: on })}
              onPlay={(ucis) => ctl.playLine(ucis)}
              onHover={(uci) => setHover(uci ? { fen: node.fen, uci } : null)}
              threat={{ enabled: threatOn, inCheck: checkSquare !== null, onToggle: setThreatOn }}
            />
            <MoveTree
              tree={tree}
              version={ctl.version}
              current={current}
              onSelect={ctl.select}
              onPromote={ctl.promote}
              onDelete={ctl.remove}
              annotations={annotations}
              locked={locked}
              clocks={clocks}
            />
            <div className="nav">
              <button title="Début" aria-label="Début" onClick={() => go(tree.rootId)}>
                <IconFirst size={20} />
              </button>
              <button
                title="Précédent"
                aria-label="Précédent"
                onClick={() => go(tree.prev(current))}
              >
                <IconPrev size={20} />
              </button>
              <button title="Suivant" aria-label="Suivant" onClick={() => go(tree.next(current))}>
                <IconNext size={20} />
              </button>
              <button title="Fin" aria-label="Fin" onClick={() => go(tree.end(current))}>
                <IconLast size={20} />
              </button>
              <button
                title="Retourner le plateau (f)"
                aria-label="Retourner le plateau"
                onClick={() => setFlipped(!flipped)}
              >
                <IconFlip size={20} />
              </button>
            </div>
          </>
        )}
        {props.panelBottom}
      </aside>
    </div>
  );
}
