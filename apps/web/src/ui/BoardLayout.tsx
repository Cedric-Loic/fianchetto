import { useEffect, type CSSProperties, type ReactNode } from 'react';

export interface BoardLayoutProps {
  /** Le plateau (et ce qui se superpose à lui : notifications, etc.). */
  board: ReactNode;
  /** Barre au-dessus du plateau (joueur adverse). */
  top?: ReactNode;
  /** Barre sous le plateau (joueur au trait en bas). */
  bottom?: ReactNode;
  /** Barres fines (noms seuls) plutôt que barres joueur complètes. */
  slimBars?: boolean;
  /** Barre d'évaluation, à gauche du plateau (au-dessus sur téléphone). */
  evalBar?: ReactNode;
  /** Contenu sous la colonne du plateau, non compté dans la hauteur (téléphone uniquement). */
  below?: ReactNode;
  /** Contenu du panneau latéral ; pas de panneau si absent. */
  side?: ReactNode;
  /** Éléments rendus après le panneau (barre d'actions fixe du téléphone, fenêtres). */
  after?: ReactNode;
  className?: string;
  testId?: string;
  sideTestId?: string;
}

/**
 * Mise en page commune des écrans avec échiquier : colonne du plateau (barres, évaluation) et
 * panneau latéral. Le côté du plateau (`--board-size`) est calculé en CSS par requêtes de
 * conteneur : sur grand écran, toute la hauteur disponible, le panneau prenant le reste de la
 * largeur ; sur téléphone, toute la largeur moins la gouttière (styles.css, « Mise en page
 * plateau »).
 */
export function BoardLayout(props: BoardLayoutProps) {
  // Arrivée sur un écran à plateau depuis une page défilée (leçon, répertoire) : le plateau
  // s'affiche en entier, depuis le haut.
  useEffect(() => {
    if (window.scrollY > 0) window.scrollTo(0, 0);
  }, []);
  const bars = (props.top ? 1 : 0) + (props.bottom ? 1 : 0);
  const classes = [
    'board-layout',
    props.evalBar ? 'has-eval' : '',
    props.slimBars ? 'slim-bars' : '',
    props.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={classes}
      style={{ '--bars-n': bars } as CSSProperties}
      {...(props.testId ? { 'data-testid': props.testId } : {})}
    >
      <div className="board-column">
        {props.top && <div className="board-bar">{props.top}</div>}
        <div className="board-stage">
          {props.evalBar && <div className="board-eval">{props.evalBar}</div>}
          <div className="board-wrap">{props.board}</div>
        </div>
        {props.bottom && <div className="board-bar">{props.bottom}</div>}
        {props.below}
      </div>
      {props.side !== undefined && (
        <aside
          className="panel side-panel"
          {...(props.sideTestId ? { 'data-testid': props.sideTestId } : {})}
        >
          {props.side}
        </aside>
      )}
      {props.after}
    </div>
  );
}
