import type { ReactNode } from 'react';
import {
  PUZZLE_THEME_LABELS,
  type Color,
  type GameReview,
  type ReviewInfo,
  type ReviewMove,
} from '@sq/shared';
import { CLASS_LABEL, CLASS_SYMBOL, classCss } from '../lib/classes';
import { useSan } from '../lib/notation';
import { Button } from '../ui/Button';
import { IconNext, IconPlay, IconPrev, IconRetry, IconTarget } from '../ui/icons';
import { SIDE } from '../screens/labels';
import {
  guidedSummary,
  MOMENT_LABEL,
  splitSquares,
  type KeyMoment,
  type MomentTag,
} from './moments';
import { ModeBanner } from './ModeBanner';

/**
 * Texte d'explication dont les cases citées (« e5 ») sont surlignées sur le plateau au survol
 * (ou au focus clavier).
 */
export function ExplainText(props: { text: string; onSquare: (square: string | null) => void }) {
  return (
    <>
      {splitSquares(props.text).map((part, i) =>
        part.square ? (
          <span
            key={i}
            className="square-ref"
            data-testid="square-ref"
            tabIndex={0}
            onMouseEnter={() => props.onSquare(part.square)}
            onMouseLeave={() => props.onSquare(null)}
            onFocus={() => props.onSquare(part.square)}
            onBlur={() => props.onSquare(null)}
          >
            {part.text}
          </span>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

const moveLabel = (m: ReviewMove, san: (s: string) => string) =>
  `${Math.ceil(m.ply / 2)}${m.color === 'w' ? '.' : '…'} ${san(m.san)}`;
const pct = (v: number) => `${Math.round(v)} %`;

const TAG_TONE: Record<MomentTag, string> = {
  blunder: 'cls-blunder',
  mistake: 'cls-mistake',
  'missed-win': 'tag-missed-win',
  'turning-point': 'tag-turning-point',
};

interface MomentProps {
  moment: KeyMoment;
  bestSan: string | null;
  names: Record<Color, string>;
  /** Le coup est-il du camp de l'utilisateur (Réessayer possible) ? */
  mine: boolean;
  hasLine: boolean;
  onSquare: (square: string | null) => void;
  onShowLine: () => void;
  onRetry: () => void;
}

/** Bulle du coach pour un moment clé : étiquettes, explication, probabilité de gain avant / après. */
function CoachBubble(props: MomentProps) {
  const { move, tags } = props.moment;
  const san = useSan();
  const text =
    move.explanation?.text ??
    (move.classification === 'best'
      ? 'Bon coup, mais la partie bascule ici.'
      : 'Ce coup fait basculer la partie.');
  return (
    <div className="coach-bubble-row" data-testid="guided-moment">
      <span className="coach-avatar" aria-hidden="true">
        ♞
      </span>
      <div className="coach-bubble">
        <p className="coach-bubble-head">
          <strong>{moveLabel(move, san)}</strong>{' '}
          <span className="muted">
            ({props.names[move.color]}, {SIDE[move.color]})
          </span>
        </p>
        <p className="coach-tags">
          {tags.map((t) => (
            <span key={t} className={`class-badge ${TAG_TONE[t]}`} data-testid="moment-tag">
              {MOMENT_LABEL[t]}
            </span>
          ))}
          {!tags.includes(move.classification as MomentTag) && (
            <span className={`class-badge ${classCss(move.classification)}`}>
              {CLASS_LABEL[move.classification]} {CLASS_SYMBOL[move.classification]}
            </span>
          )}
        </p>
        <p data-testid="guided-explanation">
          <ExplainText text={text} onSquare={props.onSquare} />
        </p>
        <p className="win-swing" data-testid="win-swing">
          Chances de gain : <strong className="pct">{pct(move.winBefore)}</strong> →{' '}
          <strong className={`pct${move.winAfter < move.winBefore ? ' drop' : ''}`}>
            {pct(move.winAfter)}
          </strong>
        </p>
        {props.bestSan && move.classification !== 'best' && (
          <p className="muted">
            Meilleur : <span className="best-move">{san(props.bestSan)}</span>
          </p>
        )}
        <div className="actions">
          {props.hasLine && (
            <Button size="s" data-testid="guided-line" onClick={props.onShowLine}>
              <IconPlay size={16} />
              Voir la ligne
            </Button>
          )}
          {props.mine && props.bestSan && move.classification !== 'best' && (
            <Button size="s" data-testid="guided-retry" onClick={props.onRetry}>
              <IconRetry size={16} />
              Réessayer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export interface GuidedPanelProps {
  info: ReviewInfo;
  review: GameReview;
  moments: readonly KeyMoment[];
  /** Rang du moment affiché ; `moments.length` = bilan. */
  index: number;
  onIndex: (index: number) => void;
  onSquare: (square: string | null) => void;
  onShowLine: (move: ReviewMove, line: readonly string[]) => void;
  onRetry: (move: ReviewMove) => void;
  onLearn: () => void;
  onExit: () => void;
  /** Courbe d'évaluation (placée sous la bulle). */
  chart?: ReactNode;
}

/** Revue guidée : moments clés un par un, puis bilan. */
export function GuidedPanel(props: GuidedPanelProps) {
  const { info, review, moments, index } = props;
  const total = moments.length;
  const atEnd = index >= total;
  const moment = moments[index];
  const names = { w: info.white, b: info.black };

  const banner = (
    <ModeBanner
      title="Revue guidée"
      progress={atEnd ? 'Bilan' : `${index + 1} / ${total}`}
      onExit={props.onExit}
    />
  );

  const nav = (
    <div className="nav guided-nav">
      <button
        type="button"
        data-testid="guided-prev"
        disabled={index === 0}
        onClick={() => props.onIndex(index - 1)}
      >
        <IconPrev size={18} />
        Précédent
      </button>
      {!atEnd && (
        <button
          type="button"
          className="primary-nav"
          data-testid="guided-next"
          onClick={() => props.onIndex(index + 1)}
        >
          {index + 1 < total ? 'Suivant' : 'Bilan'}
          <IconNext size={18} />
        </button>
      )}
    </div>
  );

  if (atEnd || !moment) {
    const summary = guidedSummary(review, info.userColor);
    return (
      <>
        {banner}
        <div className="move-card guided-summary" data-testid="guided-summary">
          <p>
            <strong>Bilan de la partie</strong>
            {total === 0 && <span className="muted"> — aucun moment clé à revoir.</span>}
          </p>
          <div className="summary-stats">
            {summary.accuracy.map((a) => (
              <span key={a.color} className="summary-stat" data-testid="summary-accuracy">
                <span className="muted">
                  Précision{info.userColor ? '' : ` (${SIDE[a.color]})`}
                </span>
                <strong className="pct">{a.value === null ? '—' : `${a.value} %`}</strong>
              </span>
            ))}
            {(['blunder', 'mistake', 'inaccuracy'] as const).map((cls) => (
              <span key={cls} className="summary-stat" data-testid={`summary-${cls}`}>
                <span className="muted">{CLASS_LABEL[cls]}s</span>
                <strong className={classCss(cls)}>{summary.counts[cls]}</strong>
              </span>
            ))}
          </div>
          <p>
            <strong>Conseils</strong>
          </p>
          <ol className="summary-tips" data-testid="summary-tips">
            {summary.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ol>
        </div>
        <div className="actions">
          <Button variant="primary" href={summary.puzzlesHref} data-testid="summary-puzzles">
            {summary.theme
              ? `Puzzles : ${PUZZLE_THEME_LABELS[summary.theme] ?? summary.theme}`
              : 'Puzzles « Mes erreurs »'}
          </Button>
          {summary.theme && <Button href="#/puzzles/mine">Mes erreurs</Button>}
          <Button
            data-testid="summary-learn"
            disabled={info.userColor === null}
            title={info.userColor === null ? 'Camp inconnu dans cette partie' : undefined}
            onClick={props.onLearn}
          >
            <IconTarget size={18} />
            Apprends de tes erreurs
          </Button>
        </div>
        {nav}
        {props.chart}
      </>
    );
  }

  const before = review.evals[moment.ply - 1];
  // Ligne du schéma de l'explication, sinon la meilleure suite du moteur depuis la position d'avant.
  const line = moment.move.explanation?.visual?.line ?? before?.pv ?? [];
  return (
    <>
      {banner}
      <CoachBubble
        moment={moment}
        bestSan={before?.bestMoveSan ?? null}
        names={names}
        mine={info.userColor === null || moment.move.color === info.userColor}
        hasLine={line.length > 0}
        onSquare={props.onSquare}
        onShowLine={() => props.onShowLine(moment.move, line)}
        onRetry={() => props.onRetry(moment.move)}
      />
      {nav}
      {props.chart}
    </>
  );
}
