import { useState, type ReactNode } from 'react';
import type {
  CurriculumResponse,
  DailySession,
  SessionStep,
  SkillId,
  SkillLevel,
} from '@sq/shared';
import { SKILL_LABELS } from '@sq/shared';
import { api } from '../lib/api';
import { Button } from '../ui/Button';
import { IconCheck, IconHourglass, IconTarget } from '../ui/icons';

/** Séance du jour : étapes cochées par le serveur, bouton « Commencer / Continuer ». */
export function SessionCard(props: {
  session: DailySession;
  /** Cartes dues : affiche le bouton « Révisions » de la séance (absent si la page l'affiche). */
  due?: number | null;
  onChange: (s: DailySession) => void;
  /** Contenu ajouté en bas de la séance (conseil de réflexion). */
  footer?: ReactNode;
}) {
  const { session } = props;
  const [bilan, setBilan] = useState(false);
  const current = session.steps.find((s) => !s.done);
  const started = session.steps.some((s) => s.done);

  const start = (step: SessionStep) => {
    if (step.kind === 'summary') {
      // Seule étape cochée par le client : l'ouverture du bilan.
      void api.coachProgress('summary').then((r) => r && props.onChange(r.session));
      setBilan(true);
    } else {
      window.location.assign(step.href);
    }
  };

  return (
    <section className="panel page-panel session" data-testid="coach-session">
      <div className="puzzle-stats-row">
        <h2>Séance du jour</h2>
        <span className="muted">
          <IconHourglass size={16} /> ≈ {session.minutes} min
        </span>
      </div>
      {session.focus && (
        <p className="muted">
          Compétence en priorité : <strong>{SKILL_LABELS[session.focus]}</strong>
        </p>
      )}
      <ol className="session-steps">
        {session.steps.map((s) => (
          <li key={s.kind} className={s.done ? 'done' : ''} data-testid={`session-${s.kind}`}>
            <span className="task-check" aria-hidden="true">
              {s.done && <IconCheck size={16} />}
            </span>
            <a href={s.kind === 'summary' ? undefined : s.href} onClick={() => start(s)}>
              {s.label}
              <span className="sr-only">{s.done ? ' (faite)' : ' (à faire)'}</span>
            </a>
            <span className="muted">{s.minutes} min</span>
          </li>
        ))}
      </ol>
      {bilan && (
        <p className="move-card" data-testid="session-bilan">
          Bilan : {session.steps.filter((s) => s.done && s.kind !== 'summary').length} étape(s) sur{' '}
          {session.steps.length - 1} faites aujourd'hui.
          {session.focus && ` Prochain axe : ${SKILL_LABELS[session.focus].toLowerCase()}.`}
        </p>
      )}
      <div className="actions">
        {current ? (
          <Button variant="primary" onClick={() => start(current)} data-testid="session-start">
            {started ? 'Continuer' : 'Commencer'}
          </Button>
        ) : (
          <span className="win" data-testid="session-complete">
            ✓ Séance terminée, bravo !
          </span>
        )}
        {props.due !== undefined && (
          <Button href="#/reviews" data-testid="to-reviews">
            Révisions{props.due ? ` (${props.due})` : ''}
          </Button>
        )}
        {session.followUp && (
          <Button variant="link" href={session.followUp.href} data-testid="session-followup">
            Application : {session.followUp.label}
          </Button>
        )}
      </div>
      {props.footer}
    </section>
  );
}

/** Compétences, les plus faibles d'abord ; `onPick` ouvre le module du parcours correspondant. */
export function SkillsCard(props: {
  skills: SkillLevel[];
  hasModule: (s: SkillId) => boolean;
  onPick: (s: SkillId) => void;
}) {
  // Les plus faibles d'abord ; les compétences non mesurées en dernier.
  const sorted = [...props.skills].sort((a, b) => (a.level ?? 101) - (b.level ?? 101));
  return (
    <section className="panel page-panel" data-testid="coach-skills">
      <h2>Mes compétences</h2>
      <ul className="skill-list">
        {sorted.map((s) => {
          const clickable = props.hasModule(s.id);
          const row = (
            <>
              <span className="skill-name">{SKILL_LABELS[s.id]}</span>
              <span
                className="progress"
                role="meter"
                aria-label={SKILL_LABELS[s.id]}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={s.level ?? 0}
                aria-valuetext={s.level === null ? 'pas encore mesuré' : undefined}
              >
                <span className="progress-bar" style={{ width: `${s.level ?? 0}%` }} />
              </span>
              <span className="skill-level">
                {s.level === null ? (
                  <span className="muted">pas encore mesuré</span>
                ) : (
                  <>
                    <strong>{s.level}</strong>
                    {s.trend !== null && s.trend !== 0 && (
                      <span className={s.trend > 0 ? 'win' : 'loss'}>
                        {s.trend > 0 ? ' ▲' : ' ▼'}
                        {Math.abs(s.trend)}
                      </span>
                    )}
                  </>
                )}
              </span>
            </>
          );
          return (
            <li key={s.id} data-testid={`skill-${s.id}`}>
              {clickable ? (
                <button type="button" className="skill-row" onClick={() => props.onPick(s.id)}>
                  {row}
                </button>
              ) : (
                <div className="skill-row">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Parcours de la phase : modules et étapes, prochaine étape conseillée (`highlight` : module). */
export function PathCard({
  curriculum,
  highlight,
}: {
  curriculum: CurriculumResponse;
  highlight: string | null;
}) {
  const next = curriculum.next;
  return (
    <section className="panel page-panel" data-testid="coach-path">
      <h2>Parcours · palier {curriculum.phase}</h2>
      {next && (
        <p className="muted">
          <IconTarget size={16} /> Prochaine étape conseillée :{' '}
          <a href={next.step.href} data-testid="path-next">
            {next.step.title}
          </a>
        </p>
      )}
      {/* Replié par défaut : les leçons sont déjà listées par palier ; ouvert si un module est visé. */}
      <details className="path-details" open={highlight !== null}>
        <summary>Voir le parcours conseillé, module par module</summary>
        <div className="coach-grid">
          {curriculum.modules.map((m) => {
            const done = m.steps.filter((s) => s.done).length;
            return (
              <div
                key={m.id}
                id={`module-${m.id}`}
                className={`path-module${highlight === m.id ? ' highlight' : ''}`}
              >
                <h3>
                  {m.title}{' '}
                  <span className="muted">
                    {done}/{m.steps.length}
                  </span>
                </h3>
                <ul className="path-steps">
                  {m.steps.map((s) => (
                    <li
                      key={`${s.type}-${s.id}`}
                      className={`${s.done ? 'done' : ''}${next?.step.id === s.id && next.step.type === s.type ? ' next' : ''}`}
                    >
                      <span aria-hidden>{s.done ? '✓' : '○'}</span>
                      {s.type !== 'lesson' && (
                        <span className="path-kind">
                          {s.type === 'endgame' ? 'Finale' : 'Ouverture'}
                        </span>
                      )}
                      <a href={s.href}>{s.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </details>
    </section>
  );
}
