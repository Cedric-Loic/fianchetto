import type { ReactNode } from 'react';
import type { MoveClass } from '@sq/shared';
import { CLASS_SYMBOL, classCss } from '../lib/classes';
import { useSan } from '../lib/notation';
import { Button } from '../ui/Button';
import { IconClose, IconUp } from '../ui/icons';
import type { AnalysisTree } from './tree';

/** Classes signalées par un symbole dans la liste (les autres n'encombrent pas la lecture). */
const SHOWN: readonly MoveClass[] = ['best', 'inaccuracy', 'mistake', 'blunder'];

export interface MoveTreeProps {
  tree: AnalysisTree;
  /** Version de l'arbre (l'arbre est mutable) : sert seulement à redessiner. */
  version?: number;
  current: string;
  onSelect: (id: string) => void;
  onPromote: (id: string) => void;
  onDelete: (id: string) => void;
  /** Classe de certains coups (revue) : symbole ?!, ?, ??, ★ après le coup. */
  annotations?: ReadonlyMap<string, MoveClass>;
  /** Nœuds protégés (coups de la partie revue) : ni supprimés, ni déclassés. */
  locked?: ReadonlySet<string>;
}

/**
 * Liste des coups de l'arbre, comme sur les sites d'analyse : ligne principale en deux colonnes
 * numérotées, variantes en ligne entre parenthèses sous le coup qu'elles remplacent, nœud courant
 * surligné. Clic : aller au nœud ; clic droit : le sélectionner (boutons Promouvoir / Supprimer).
 */
export function MoveTree(props: MoveTreeProps) {
  const { tree, current } = props;
  const san = useSan();

  const moveButton = (id: string, extra = '') => {
    const node = tree.get(id);
    const cls = props.annotations?.get(id);
    return (
      <button
        key={id}
        type="button"
        className={`move${extra}${id === current ? ' current' : ''}`}
        data-node={id}
        onClick={() => props.onSelect(id)}
        onContextMenu={(e) => {
          e.preventDefault();
          props.onSelect(id);
        }}
      >
        {san(node.san ?? '')}
        {cls && SHOWN.includes(cls) && (
          <span className={`class-symbol ${classCss(cls)}`}> {CLASS_SYMBOL[cls]}</span>
        )}
      </button>
    );
  };

  /** Variante en ligne depuis `startId` (premiers enfants), sous-variantes entre parenthèses. */
  const inline = (startId: string): ReactNode[] => {
    const out: ReactNode[] = [];
    let needNumber = true;
    for (let id: string | null = startId; id; id = tree.get(id).children[0] ?? null) {
      const node = tree.get(id);
      const { number, color } = tree.moveLabel(id);
      if (color === 'w')
        out.push(<span key={`${id}-n`} className="tree-number">{`${number}.`}</span>);
      else if (needNumber) {
        out.push(<span key={`${id}-n`} className="tree-number">{`${number}…`}</span>);
      }
      out.push(moveButton(id, ' tree-move'));
      needNumber = false;
      // Sous-variantes : les frères de ce coup (sauf pour le premier coup, déjà traités).
      const parent = node.parent ? tree.get(node.parent) : null;
      if (id !== startId && parent && parent.children.length > 1) {
        for (const alt of parent.children.slice(1)) {
          out.push(
            <span key={`${alt}-v`} className="tree-sub">
              ({inline(alt)})
            </span>,
          );
        }
        needNumber = true;
      }
    }
    return out;
  };

  // Ligne principale : rangées « numéro, Blancs, Noirs », interrompues par les variantes.
  const rows: ReactNode[] = [];
  let row: { number: number; white: ReactNode; black: ReactNode } | null = null;
  const flush = () => {
    if (!row) return;
    rows.push(
      <div className="move-row" key={`row-${rows.length}`}>
        <span className="move-number">{row.number}.</span>
        {row.white ?? <span className="move muted">…</span>}
        {row.black ?? <span className="move" />}
      </div>,
    );
    row = null;
  };
  const main = tree.mainline().slice(1);
  for (const id of main) {
    const { number, color } = tree.moveLabel(id);
    if (color === 'w') {
      flush();
      row = { number, white: moveButton(id), black: null };
    } else {
      row ??= { number, white: null, black: null };
      row.black = moveButton(id);
    }
    const parent = tree.get(tree.get(id).parent ?? tree.rootId);
    if (parent.children.length > 1) {
      flush();
      rows.push(
        <div className="move-variations" key={`var-${id}`} data-testid="variation">
          {parent.children.slice(1).map((alt) => (
            <div className="variation" key={alt}>
              {inline(alt)}
            </div>
          ))}
        </div>,
      );
      // Coup noir après une variante : la rangée suivante commence par « … ».
      if (color === 'w') {
        const next = tree.get(id).children[0];
        if (next) row = { number, white: null, black: null };
      }
    }
  }
  flush();

  const start = tree.variationStart(current);
  const startParent = start ? tree.get(tree.get(start).parent ?? tree.rootId) : null;
  const canPromote =
    start !== null && !props.locked?.has(startParent?.children[0] ?? '') && startParent !== null;
  const canDelete = current !== tree.rootId && !props.locked?.has(current);

  return (
    <>
      <div className="move-list move-tree" data-testid="move-list">
        {rows.length === 0 ? (
          <p className="muted tree-empty">Joue un coup sur l'échiquier.</p>
        ) : (
          rows
        )}
      </div>
      {(canPromote || canDelete) && (
        <div className="tree-tools">
          {canPromote && (
            <Button
              size="s"
              data-testid="promote-variation"
              onClick={() => props.onPromote(current)}
            >
              <IconUp size={16} />
              Promouvoir la variante
            </Button>
          )}
          {canDelete && (
            <Button size="s" data-testid="delete-variation" onClick={() => props.onDelete(current)}>
              <IconClose size={16} />
              Supprimer à partir d'ici
            </Button>
          )}
        </div>
      )}
    </>
  );
}
