import { useEffect, useState } from 'react';
import { SKILL_LABELS, type CardsResponse, type ReviewCard } from '@sq/shared';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Button } from '../ui/Button';
import { EmptyState, LoginRequired } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';

/** `ref` = `leçon:index` : ouvre l'exercice directement. */
function exerciseHref(card: ReviewCard): string | null {
  const m = /^(.+):(\d+)$/.exec(card.ref);
  return m?.[1] ? `#/lessons/${m[1]}?exercise=${m[2]}` : null;
}

/** Repli (serveur ancien, `ref` absent) : retrouve l'exercice par sa position et sa consigne. */
async function exerciseHrefByFen(card: ReviewCard): Promise<string | null> {
  const list = await api.lessons();
  for (const summary of list?.lessons ?? []) {
    const lesson = await api.lesson(summary.id);
    const index = lesson?.exercises.findIndex(
      (e) => e.fen === card.fen && e.prompt === card.prompt,
    );
    if (index !== undefined && index >= 0) return `#/lessons/${summary.id}?exercise=${index}`;
  }
  return null;
}

/** Révisions espacées : cartes dues (erreurs personnelles, exercices de leçons) à rejouer. */
export function Reviews() {
  const user = useSession((s) => s.user);
  const [data, setData] = useState<CardsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (user) void api.reviewCards().then(setData);
  }, [user]);

  if (!user) return <LoginRequired title="Révisions" text="Connecte-toi pour réviser." />;
  if (!data) return <Loading label="Chargement des révisions…" />;

  const open = async (card: ReviewCard) => {
    if (card.source === 'mistake') {
      location.hash = '#/puzzles/mine';
      return;
    }
    setBusy(true);
    setError(null);
    const href = exerciseHref(card) ?? (await exerciseHrefByFen(card));
    setBusy(false);
    if (href) location.hash = href;
    else setError('Impossible de retrouver cet exercice.');
  };

  const first = data.due[0];
  return (
    <div className="page">
      <section className="panel page-panel" data-testid="reviews">
        <a href="#/coach" className="back-link">
          ← Coach
        </a>
        <h2>Révisions</h2>
        <p className="muted" data-testid="reviews-count">
          {data.due.length === 0
            ? '0 carte due'
            : `${data.due.length} carte${data.due.length > 1 ? 's' : ''} due${data.due.length > 1 ? 's' : ''}`}{' '}
          · {data.mastered} maîtrisée{data.mastered > 1 ? 's' : ''} / {data.total}
        </p>
        {error && <p className="loss">{error}</p>}
        {data.due.length === 0 ? (
          <EmptyState icon="✓" title="Rien à réviser pour l'instant">
            Les cartes viennent de tes erreurs et des exercices ratés : elles reviennent après un
            délai croissant.
          </EmptyState>
        ) : (
          <>
            {first && (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void open(first)}
                data-testid="reviews-start"
              >
                Réviser la première carte
              </Button>
            )}
            <ul className="review-list">
              {data.due.map((c) => (
                <li key={c.id} className="review-card">
                  <span className="review-text">
                    <strong>{c.prompt}</strong>
                    <br />
                    <span className="muted">
                      {SKILL_LABELS[c.skill]} ·{' '}
                      {c.source === 'mistake' ? 'Erreur de partie' : 'Exercice de leçon'}
                    </span>
                  </span>
                  <Button size="s" disabled={busy} onClick={() => void open(c)}>
                    Réviser
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
