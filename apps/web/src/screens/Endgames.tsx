import { useEffect, useState } from 'react';
import type { EndgameSummary, ExamSummary } from '@sq/shared';
import { api } from '../lib/api';
import { startEndgame } from '../lib/endgame';
import { useSession } from '../lib/session';
import { SIDE } from './labels';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LoginRequired } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';
import { IconPlay } from '../ui/icons';

/** Paliers du cours (même découpage que le parcours « Apprendre »). */
const STAGES = [
  { stage: 1, label: 'Palier 1', elo: '1000-1200' },
  { stage: 2, label: 'Palier 2', elo: '1200-1400' },
  { stage: 3, label: 'Palier 3', elo: '1400-1600' },
] as const;

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

/**
 * Cours de finales : rangé par palier, chaque finale en deux temps (lire le cours, puis la jouer
 * contre le bot à pleine force, en partie d'entraînement non classée). Une finale est réussie dès
 * que le résultat attendu a été obtenu dans la limite de coups ; elle revient « à rejouer » après
 * un échec, selon la révision espacée.
 */
export function Endgames() {
  const user = useSession((s) => s.user);
  const [endgames, setEndgames] = useState<EndgameSummary[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [exam, setExam] = useState<ExamSummary | null>(null);
  useEffect(() => {
    if (!user) return;
    void api.endgames().then((r) => setEndgames(r?.endgames ?? []));
    void api.exams().then((r) => setExam(r?.exams.find((e) => e.stage === 1) ?? null));
  }, [user]);
  if (!user) {
    return <LoginRequired title="Finales" text="Connecte-toi pour suivre ta progression." />;
  }
  if (endgames === null) return <Loading label="Chargement des finales…" />;
  const passed = endgames.filter((e) => e.passed).length;
  const play = async (id: string) => {
    setBusy(id);
    setError(false);
    if (!(await startEndgame(id))) {
      setError(true);
      setBusy(null);
    }
  };
  return (
    <div className="page">
      <div className="panel page-panel">
        <a href="#/learn" className="back-link">
          ← Apprendre
        </a>
        <h2>Finales contre le bot</h2>
        <p className="muted" data-testid="endgames-count">
          {plural(passed, 'finale')} réussie{passed > 1 ? 's' : ''} sur {endgames.length}. Pour
          chaque finale : lis d'abord le cours, puis joue-la contre le bot (pleine force) ; indices
          et reprises de coups restent disponibles.
        </p>
        {error && (
          <p className="error" role="alert">
            Impossible de lancer la finale. Réessaie dans un instant.
          </p>
        )}
        {STAGES.map(({ stage, label, elo }) => {
          const list = endgames.filter((e) => e.stage === stage);
          if (list.length === 0) return null;
          const done = list.filter((e) => e.passed).length;
          return (
            <section key={stage} className="endgame-stage" data-testid={`endgame-stage-${stage}`}>
              <h3 className="endgame-stage-title">
                {label} <span className="muted">· {elo} Elo</span>
                <Badge tone={done === list.length ? 'accent' : 'neutral'}>
                  <span data-testid={`endgame-stage-${stage}-count`}>
                    {done} / {list.length} réussies
                  </span>
                </Badge>
              </h3>
              {stage === 1 && (
                <div className="exam-mini" data-testid="exam-mini">
                  <Button
                    size="s"
                    variant="secondary"
                    href="#/exam/1/mini"
                    data-testid="exam-mini-start"
                  >
                    Mini-test : 5 questions
                  </Button>
                  {exam?.miniPassed && (
                    <Badge tone="accent" testId="exam-mini-passed">
                      ✓ Mini-test réussi
                    </Badge>
                  )}
                </div>
              )}
              <div className="lesson-list">
                {list.map((e, i) => (
                  <EndgameCard
                    key={e.id}
                    endgame={e}
                    number={i + 1}
                    busy={busy !== null}
                    onPlay={() => void play(e.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/** Une finale : titre, objectif complet, badges d'état, puis les deux temps (cours, partie). */
function EndgameCard(props: {
  endgame: EndgameSummary;
  number: number;
  busy: boolean;
  onPlay: () => void;
}) {
  const e = props.endgame;
  // Jamais tentée : le cours passe en premier.
  const fresh = e.attempts === 0 && !e.passed;
  return (
    <div className="lesson-card endgame-card" data-testid={`endgame-${e.id}`}>
      <span className="lesson-number">{props.number}</span>
      <span className="lesson-body">
        <strong>{e.title}</strong>
        <span className="muted">
          Avec les {SIDE[e.color]} · {e.goal === 'win' ? 'Gagner' : 'Tenir la nulle'} ·{' '}
          {e.objective}
        </span>
        <span className="endgame-badges">
          {e.passed && <Badge tone="accent">✓ Réussie</Badge>}
          {e.due && (
            <Badge tone="warning" testId={`endgame-due-${e.id}`}>
              À rejouer
            </Badge>
          )}
          {e.maxMoves !== null && <Badge tone="info">en {e.maxMoves} coups max</Badge>}
          {e.attempts > 0 && <Badge>{plural(e.attempts, 'essai')}</Badge>}
        </span>
      </span>
      <span className="endgame-steps">
        <span
          className={`endgame-step${fresh && e.lesson ? ' endgame-step-first' : ''}`}
          data-testid={`endgame-course-${e.id}`}
        >
          <span className="endgame-step-title">1. Cours</span>
          {e.lesson ? (
            fresh ? (
              <Button size="s" variant="primary" href={`#/lessons/${e.lesson}`}>
                Commence par le cours
              </Button>
            ) : (
              <a href={`#/lessons/${e.lesson}`}>Revoir le cours</a>
            )
          ) : (
            <span className="muted">Pas de cours dédié : l'objectif suffit.</span>
          )}
        </span>
        <span className="endgame-step">
          <span className="endgame-step-title">2. Joue-la</span>
          <Button
            size="s"
            variant={e.passed || (fresh && e.lesson) ? 'secondary' : 'primary'}
            disabled={props.busy}
            onClick={props.onPlay}
            data-testid={`endgame-play-${e.id}`}
          >
            <IconPlay size={16} />
            Jouer
          </Button>
        </span>
      </span>
    </div>
  );
}
