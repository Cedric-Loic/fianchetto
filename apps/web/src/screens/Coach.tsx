import { useEffect, useState } from 'react';
import { PUZZLE_THEME_LABELS, type CoachDashboard } from '@sq/shared';
import { LineChart } from '../game/LineChart';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Button } from '../ui/Button';
import { IconCheck, IconTarget } from '../ui/icons';
import { EmptyState, LoginRequired } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';

const fr1 = (v: number) => v.toFixed(1).replace('.', ',');

const CURVE_FORMAT: Record<string, (v: number) => string> = {
  accuracy: (v) => `${Math.round(v)} %`,
};

const monthName = (key: string) =>
  new Date(`${key}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

/**
 * Tableau de bord du coach : phase du programme, plan de la semaine, recommandations, profil de
 * faiblesses, courbes de progression, objectifs du plan et bilan mensuel.
 */
export function Coach() {
  const user = useSession((s) => s.user);
  const [data, setData] = useState<CoachDashboard | null>(null);
  useEffect(() => {
    if (user) void api.dashboard().then(setData);
  }, [user]);

  if (!user) {
    return <LoginRequired title="Coach" text="Connecte-toi pour suivre ton plan de progression." />;
  }
  if (!data) return <Loading label="Chargement du tableau de bord…" />;
  const { phase, week, weaknesses: w } = data;
  const maxKind = Math.max(1, ...w.kinds.map((k) => k.count));
  const totalPhases = w.phases.opening + w.phases.middlegame + w.phases.endgame;

  // Prochaine action : la première recommandation, sinon la première tâche pas encore faite.
  const reco = data.recommendations[0];
  const task = week.tasks.find((t) => t.done < t.target);
  const next = reco
    ? { title: reco.text, detail: null, href: reco.href }
    : task
      ? {
          title: task.label,
          detail: `${task.done} / ${task.target} cette semaine`,
          href: task.href,
        }
      : null;

  return (
    <div className="page coach">
      <section
        className="panel banner coach-next"
        data-testid="coach-next"
        aria-label="Prochaine action"
      >
        <span className="banner-icon">
          <IconTarget size={28} />
        </span>
        <div className="banner-body">
          <span className="banner-title">Prochaine action</span>
          {next ? (
            <>
              <strong>{next.title}</strong>
              {next.detail && <span className="muted">{next.detail}</span>}
            </>
          ) : (
            <strong>Tout est fait cette semaine : bravo !</strong>
          )}
        </div>
        <Button variant="primary" href={next?.href ?? '#/puzzles'}>
          {next ? "C'est parti" : 'Un puzzle de plus'}
        </Button>
      </section>

      <div className="panel page-panel" data-testid="coach-phase">
        <p className="muted">Ton programme</p>
        <h2>
          Phase {phase.current} · {phase.title}
        </h2>
        <p>{phase.focus}</p>
        {phase.criteria.length > 0 && (
          <>
            <h3>Pour passer à la phase suivante</h3>
            <ul className="criteria">
              {phase.criteria.map((c) => (
                <li key={c.label} className={c.met ? 'met' : ''}>
                  <span aria-hidden>{c.met ? '✓' : '○'}</span>
                  <span>
                    {c.label} : <strong>{c.value ?? 'pas encore mesuré'}</strong>{' '}
                    <span className="muted">(objectif : {c.target})</span>
                    <span className="sr-only">
                      {c.met ? ' — atteint' : ' — pas encore atteint'}
                    </span>
                  </span>
                  {c.value === null && (
                    <Button size="s" href="#/analyse" data-testid="import-cta">
                      Importer
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="coach-grid">
        <div className="panel page-panel" data-testid="coach-week">
          <h2>Cette semaine</h2>
          <p className="muted">
            Depuis le lundi{' '}
            {new Date(`${week.start}T12:00:00`).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <ul className="task-list">
            {week.tasks.map((t) => {
              const ratio = Math.min(1, t.done / t.target);
              const done = ratio >= 1;
              return (
                <li
                  key={t.id}
                  className={`task-item${done ? ' done' : ''}`}
                  data-testid={`task-${t.id}`}
                >
                  {/* Case cochée = tâche faite (calculée par le serveur, non modifiable). */}
                  <span className="task-check" aria-hidden="true">
                    {done && <IconCheck size={16} />}
                  </span>
                  <a href={t.href} className="task">
                    <span className="task-head">
                      <span>
                        {t.label}
                        <span className="sr-only">{done ? ' (faite)' : ' (à faire)'}</span>
                      </span>
                      <strong>
                        {t.done} / {t.target}
                      </strong>
                    </span>
                    <span className="progress">
                      <span className="progress-bar" style={{ width: `${ratio * 100}%` }} />
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel page-panel" data-testid="coach-reco">
          <h2>Que faire maintenant ?</h2>
          {data.recommendations.length === 0 ? (
            <EmptyState icon="✓" title="Rien d'urgent">
              Continue ton plan de la semaine.
            </EmptyState>
          ) : (
            <ol className="reco">
              {data.recommendations.map((r) => (
                <li key={r.text}>
                  <a href={r.href}>{r.text}</a>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <div className="panel page-panel" data-testid="coach-weaknesses">
        <h2>Ton profil</h2>
        {w.games === 0 ? (
          <EmptyState
            icon="♞"
            title="Pas encore de partie analysée"
            action={<Button href="#/analyse">Importer et analyser mes parties</Button>}
          >
            Le profil se calcule sur tes 20 dernières parties analysées.
          </EmptyState>
        ) : (
          <>
            <p className="muted">
              {w.games === 1
                ? 'Sur ta seule partie analysée.'
                : `Sur tes ${w.games} dernières parties analysées.`}
            </p>
            <div className="baseline">
              <div>
                <strong>{w.accuracy === null ? '—' : `${fr1(w.accuracy)} %`}</strong>
                <span className="muted">précision moyenne</span>
              </div>
              <div>
                <strong>{w.perGame ? fr1(w.perGame.blunder) : '—'}</strong>
                <span className="muted">gaffes par partie</span>
              </div>
              <div>
                <strong>{w.perGame ? fr1(w.perGame.mistake) : '—'}</strong>
                <span className="muted">erreurs par partie</span>
              </div>
              <div>
                <strong>{w.perGame ? fr1(w.perGame.inaccuracy) : '—'}</strong>
                <span className="muted">imprécisions par partie</span>
              </div>
            </div>
            <div className="coach-grid">
              <div>
                <h3>Tes erreurs les plus fréquentes</h3>
                {w.kinds.length === 0 && <p className="muted">Aucune erreur ou gaffe : bravo !</p>}
                {w.kinds.map((k) => (
                  <div key={k.kind} className="hbar">
                    <span>{PUZZLE_THEME_LABELS[k.kind] ?? k.kind}</span>
                    <span className="hbar-track">
                      <span
                        className="hbar-fill"
                        style={{ width: `${(k.count / maxKind) * 100}%` }}
                      />
                    </span>
                    <strong>{k.count}</strong>
                  </div>
                ))}
              </div>
              <div>
                <h3>Quand tu te trompes</h3>
                {(
                  [
                    ['opening', 'Ouverture (10 premiers coups)'],
                    ['middlegame', 'Milieu de partie'],
                    ['endgame', 'Finale'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="hbar">
                    <span>{label}</span>
                    <span className="hbar-track">
                      <span
                        className="hbar-fill"
                        style={{
                          width: `${totalPhases ? (w.phases[key] / totalPhases) * 100 : 0}%`,
                        }}
                      />
                    </span>
                    <strong>{w.phases[key]}</strong>
                  </div>
                ))}
                {w.weakThemes.length > 0 && (
                  <>
                    <h3>Thèmes de puzzles à travailler</h3>
                    <ul>
                      {w.weakThemes.map((t) => (
                        <li key={t.theme}>
                          <a href={`#/puzzles/theme/${t.theme}`}>
                            {PUZZLE_THEME_LABELS[t.theme] ?? t.theme}
                          </a>{' '}
                          : {t.rate} % réussis ({t.attempts} essais)
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="panel page-panel">
        <h2>Ta progression</h2>
        <div className="charts">
          {data.curves.map((c) => (
            <LineChart
              key={c.id}
              title={c.label}
              points={c.points}
              format={CURVE_FORMAT[c.id]}
              testId={`curve-${c.id}`}
            />
          ))}
        </div>
      </div>

      <div className="panel page-panel" data-testid="coach-targets">
        <h2>Objectifs du plan</h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Indicateur</th>
                <th>Départ</th>
                <th>Actuel</th>
                <th>Cible</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.targets.map((t) => (
                <tr key={t.label}>
                  <td>{t.label}</td>
                  <td>{t.start ?? '—'}</td>
                  <td>
                    <strong>{t.current ?? '—'}</strong>
                  </td>
                  <td className="muted">{t.target}</td>
                  <td>
                    {t.met ? (
                      '✓ atteint'
                    ) : t.current === null ? (
                      <Button size="s" href="#/analyse" data-testid="import-cta">
                        Importer
                      </Button>
                    ) : (
                      ''
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel page-panel" data-testid="coach-months">
        <h2>Bilan mensuel</h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Mois</th>
                <th>Parties analysées</th>
                <th>Précision</th>
                <th>Gaffes / partie</th>
                <th>Puzzles</th>
                <th>Classement puzzle</th>
                <th>Leçons validées</th>
                <th>chess.com Rapide</th>
                <th>chess.com Blitz</th>
              </tr>
            </thead>
            <tbody>
              {[...data.months].reverse().map((m) => (
                <tr key={m.month}>
                  <td>{monthName(m.month)}</td>
                  <td>{m.games}</td>
                  <td>{m.accuracy === null ? '—' : `${fr1(m.accuracy)} %`}</td>
                  <td>{m.blunders === null ? '—' : fr1(m.blunders)}</td>
                  <td>{m.puzzles}</td>
                  <td>{m.puzzleRating ?? '—'}</td>
                  <td>{m.lessons}</td>
                  <td>{m.chessComRapid ?? '—'}</td>
                  <td>{m.chessComBlitz ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
