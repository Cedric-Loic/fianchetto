import { useState } from 'react';
import {
  THINKING_FLAWS,
  THINKING_FLAW_LABELS,
  type Color,
  type GameReview,
  type SelfReview,
  type SelfReviewMoment,
  type ThinkingFlaw,
} from '@sq/shared';
import { api } from '../lib/api';
import { CLASS_SYMBOL, classCss } from '../lib/classes';
import { useSan } from '../lib/notation';
import { Button } from '../ui/Button';
import { IconFlag } from '../ui/icons';
import { compareSelfReview } from './moments';

/** Nombre maximal de moments à signaler (contrat `SelfReviewRequest`). */
export const MAX_MOMENTS = 3;

/** Moment en cours de saisie : le défaut n'est pas encore choisi tant qu'il vaut `null`. */
export interface DraftMoment {
  ply: number;
  flaw: ThinkingFlaw | null;
}

const label = (review: GameReview, ply: number, san: (s: string) => string): string => {
  const m = review.moves[ply - 1];
  return m ? `${Math.ceil(ply / 2)}${ply % 2 === 1 ? '.' : '…'} ${san(m.san)}` : `coup ${ply}`;
};

/**
 * Étape 1 de la revue réflexive (sans moteur) : le joueur parcourt la partie, marque 1 à 3 moments
 * où il a hésité et nomme son défaut de réflexion, puis demande le moteur. Aucune donnée de
 * l'analyse n'est affichée ici (ni classe, ni évaluation, ni explication).
 */
export function SelfReviewStep(props: {
  reviewId: string;
  review: GameReview;
  userColor: Color;
  /** Demi-coup affiché sur le plateau (0 = position initiale). */
  ply: number;
  moments: DraftMoment[];
  onMoments: (moments: DraftMoment[]) => void;
  onSelect: (ply: number) => void;
  /** Revue enregistrée : passage à l'étape 2. */
  onSaved: (review: SelfReview) => void;
  onSkip: () => void;
}) {
  const { review, moments, ply } = props;
  const san = useSan();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const move = ply > 0 ? review.moves[ply - 1] : undefined;
  const own = move?.color === props.userColor;
  const already = moments.some((m) => m.ply === ply);
  const full = moments.length >= MAX_MOMENTS;
  const ready = moments.length > 0 && moments.every((m) => m.flaw !== null);

  const mark = () => {
    if (!own || already || full) return;
    props.onMoments([...moments, { ply, flaw: null }].sort((a, b) => a.ply - b.ply));
  };
  const setFlaw = (p: number, flaw: ThinkingFlaw | null) =>
    props.onMoments(moments.map((m) => (m.ply === p ? { ...m, flaw } : m)));

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const payload: SelfReviewMoment[] = [];
    for (const m of moments) if (m.flaw) payload.push({ ply: m.ply, flaw: m.flaw });
    const res = await api.saveSelfReview(props.reviewId, { moments: payload });
    setBusy(false);
    if (res.ok && res.data.selfReview) props.onSaved(res.data.selfReview);
    else setError('Enregistrement impossible. Réessaie, ou passe cette étape.');
  };

  return (
    <div className="self-step" data-testid="self-step">
      <div className="turn-banner">
        <IconFlag size={16} /> Revue en deux temps · étape 1 sur 2
      </div>
      <p>
        Avant de voir le moteur, parcours ta partie et repère <strong>1 à 3 moments</strong> où tu
        as hésité. Pour chacun, nomme ce qui t’a manqué.
      </p>
      <div className="move-card" data-testid="self-current">
        {move ? (
          <p>
            <strong>{label(review, ply, san)}</strong>{' '}
            <span className="muted">{own ? '(ton coup)' : '(coup de l’adversaire)'}</span>
          </p>
        ) : (
          <p className="muted">
            Position initiale : avance avec les flèches ou la liste des coups ci-dessous.
          </p>
        )}
        <Button
          size="s"
          variant="primary"
          data-testid="self-mark"
          disabled={!own || already || full}
          title={
            !move
              ? 'Choisis un coup dans la liste'
              : !own
                ? 'Signale un de tes propres coups'
                : full
                  ? `${MAX_MOMENTS} moments au maximum`
                  : undefined
          }
          onClick={mark}
        >
          J’ai hésité ici
        </Button>
      </div>

      <ul className="self-moments" data-testid="self-moments">
        {moments.length === 0 && (
          <li className="muted">Aucun moment signalé pour l’instant ({MAX_MOMENTS} au plus).</li>
        )}
        {moments.map((m) => (
          <li key={m.ply} data-testid="self-moment">
            <Button variant="link" onClick={() => props.onSelect(m.ply)}>
              ⚑ {label(review, m.ply, san)}
            </Button>
            <select
              aria-label={`Défaut de réflexion au coup ${label(review, m.ply, san)}`}
              data-testid="self-flaw"
              value={m.flaw ?? ''}
              onChange={(e) => setFlaw(m.ply, (e.target.value || null) as ThinkingFlaw | null)}
            >
              <option value="">Ce qui m’a manqué…</option>
              {THINKING_FLAWS.map((f) => (
                <option key={f} value={f}>
                  {THINKING_FLAW_LABELS[f]}
                </option>
              ))}
            </select>
            <Button
              size="s"
              variant="ghost"
              aria-label="Retirer ce moment"
              onClick={() => props.onMoments(moments.filter((x) => x.ply !== m.ply))}
            >
              Retirer
            </Button>
          </li>
        ))}
      </ul>

      {error && (
        <p className="error" role="alert" data-testid="self-error">
          {error}
        </p>
      )}
      <div className="actions">
        <Button
          variant="primary"
          data-testid="self-submit"
          disabled={!ready || busy}
          onClick={() => void submit()}
        >
          Voir ce qu’en dit le moteur
        </Button>
        <Button variant="ghost" data-testid="self-skip" onClick={props.onSkip}>
          Passer cette étape
        </Button>
      </div>
    </div>
  );
}

/** Étape 2 : bandeau comparant les moments signalés aux coups classés ?!, ? ou ?? du joueur. */
export function SelfCompare(props: {
  review: GameReview;
  userColor: Color;
  selfReview: SelfReview;
  onSelect: (ply: number) => void;
}) {
  const san = useSan();
  const { review, selfReview } = props;
  const cmp = compareSelfReview(
    review,
    props.userColor,
    selfReview.moments.map((m) => m.ply),
  );
  const plural = (n: number) => `${n} moment${n > 1 ? 's' : ''}`;
  return (
    <div className="move-card self-compare" data-testid="self-compare">
      <p data-testid="self-compare-text">
        Tu as signalé {plural(cmp.flagged)} ; le moteur en a repéré {cmp.engine} ; en commun :{' '}
        {cmp.common.length}.
      </p>
      <ul className="self-moments">
        {selfReview.moments.map((m) => {
          const played = review.moves[m.ply - 1];
          const flagged =
            played &&
            ['inaccuracy', 'mistake', 'blunder'].includes(played.classification) &&
            cmp.common.includes(m.ply);
          return (
            <li key={m.ply} data-testid="self-compare-moment">
              <Button variant="link" onClick={() => props.onSelect(m.ply)}>
                ⚑ {label(review, m.ply, san)}
              </Button>
              {played && (
                <span className={`class-symbol ${classCss(played.classification)}`}>
                  {' '}
                  {CLASS_SYMBOL[played.classification]}
                </span>
              )}{' '}
              <span className="muted">
                {THINKING_FLAW_LABELS[m.flaw]}
                {flagged ? ' · le moteur confirme' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
