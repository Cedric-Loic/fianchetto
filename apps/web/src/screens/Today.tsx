import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { IconBook, IconPuzzle, IconTarget } from '../ui/icons';
import { Loading } from '../ui/Spinner';
import { useCoachPlan } from '../lib/coachPlan';
import { SessionCard } from './CoachPlan';
import { ResumeCard } from './Home';

/**
 * Accueil connecté : ce qu'il y a à faire aujourd'hui. Séance du jour, partie en cours à
 * reprendre, révisions dues (avec leur compteur) et prochaine étape du parcours.
 */
export function Today() {
  const user = useSession((s) => s.user);
  const plan = useCoachPlan(user !== null, { session: true, curriculum: true, due: true });
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (user) void api.activeGame().then((a) => setActive(a?.gameId ?? null));
  }, [user]);

  if (!user) {
    return (
      <div className="page">
        <div className="panel page-panel" data-testid="today-visitor">
          <h2>Aujourd'hui</h2>
          <EmptyState
            icon="♟"
            title="Connexion requise"
            action={
              <>
                <Button variant="primary" href="#/login">
                  Se connecter
                </Button>
                <Button href="#/">Jouer</Button>
                <Button href="#/puzzles">Puzzles</Button>
                <Button href="#/progress">Classement</Button>
              </>
            }
          >
            Connecte-toi pour retrouver ta séance du jour et tes révisions. Tu peux déjà jouer,
            résoudre des puzzles et consulter le classement.
          </EmptyState>
        </div>
      </div>
    );
  }
  if (!plan.session) return <Loading label="Chargement de ta séance…" />;

  const next = plan.curriculum?.next;
  return (
    <div className="page today" data-testid="today">
      {active && (
        <ResumeCard
          gameId={active}
          username={user.username}
          onResume={() => (location.hash = `#/game/${active}`)}
        />
      )}

      <SessionCard session={plan.session} onChange={plan.setSession} />

      <div className="coach-grid">
        <section className="panel page-panel" data-testid="today-reviews">
          <h2>Révisions</h2>
          <p data-testid="today-reviews-count">
            <IconPuzzle size={16} />{' '}
            {plan.due === null
              ? 'Chargement…'
              : plan.due === 0
                ? 'Aucune carte due.'
                : `${plan.due} carte${plan.due > 1 ? 's' : ''} due${plan.due > 1 ? 's' : ''}.`}
          </p>
          <p className="muted">
            Tes erreurs et exercices ratés reviennent après un délai croissant.
          </p>
          <Button href="#/reviews" data-testid="to-reviews">
            Révisions{plan.due ? ` (${plan.due})` : ''}
          </Button>
        </section>

        <section className="panel page-panel" data-testid="today-next-step">
          <h2>Prochaine étape du parcours</h2>
          {next ? (
            <>
              <p>
                <IconTarget size={16} />{' '}
                <a href={next.step.href} data-testid="path-next">
                  {next.step.title}
                </a>
              </p>
              <p className="muted">Phase {plan.curriculum?.phase}, conseillée sans être imposée.</p>
            </>
          ) : (
            <p className="muted">
              {plan.curriculum ? 'Parcours de la phase terminé : bravo !' : 'Chargement…'}
            </p>
          )}
          <Button href="#/learn">
            <IconBook size={16} />
            Tout le parcours
          </Button>
        </section>
      </div>
    </div>
  );
}
