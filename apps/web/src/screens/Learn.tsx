import { useEffect, useState } from 'react';
import type { EndgameSummary, ExamSummary, LessonSummary } from '@sq/shared';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { IconBook } from '../ui/icons';
import { ProgressBar as Bar } from '../ui/ProgressBar';
import { Loading } from '../ui/Spinner';
import { useCoachPlan } from '../lib/coachPlan';
import { PathCard } from './CoachPlan';
import { LessonCard } from './Lessons';

/** Paliers du parcours : les phases 1 à 3 du plan, rangées par classe Elo. */
const STAGES = [
  { phase: 1, id: 'P1', elo: '1000-1200', title: 'Ne plus rien donner' },
  { phase: 2, id: 'P2', elo: '1200-1400', title: 'Calculer et punir' },
  { phase: 3, id: 'P3', elo: '1400-1600', title: 'Jouer avec un plan' },
];

/** Les parties commentées sont des leçons dont l'identifiant commence par « classique- ». */
const isClassic = (l: LessonSummary) => l.id.startsWith('classique-');

/** Carte « Examen du palier » : jamais passé, meilleur score ou validé ; grisée si indisponible. */
function ExamCard({
  stage,
  id,
  exam,
}: {
  stage: number;
  id: string;
  exam: ExamSummary | undefined;
}) {
  if (!exam) return null;
  const state = exam.passed
    ? `✓ Validé · ${exam.best ?? exam.total} / ${exam.total}`
    : exam.best !== null
      ? `Meilleur score : ${exam.best} / ${exam.total}`
      : 'Jamais passé';
  return (
    <div className="exam-card" data-testid={`exam-card-${id}`}>
      <h3>Examen du palier</h3>
      <p className="muted">
        20 questions mêlant finales, calcul, tactique et stratégie · 80 % pour valider, conseillé
        mais jamais bloquant.
      </p>
      <p className={exam.passed ? 'win' : 'muted'} data-testid={`exam-state-${id}`}>
        {state}
      </p>
      {exam.available ? (
        <Button
          variant={exam.passed ? 'secondary' : 'primary'}
          href={`#/exam/${stage}`}
          data-testid={`exam-start-${id}`}
        >
          {exam.passed ? "Repasser l'examen" : "Passer l'examen"}
        </Button>
      ) : (
        <>
          <Button disabled data-testid={`exam-start-${id}`}>
            Passer l'examen
          </Button>
          <p className="muted" data-testid={`exam-unavailable-${id}`}>
            Pas encore disponible : ce palier n'a pas assez d'exercices pour composer un examen.
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Apprendre : le parcours par palier (P1 à P3). Chaque palier regroupe ses leçons, ses parties
 * commentées et ses finales, avec une barre de progression ; les ouvertures et le parcours
 * conseillé du coach complètent la page. `module` : module du parcours à mettre en évidence.
 */
export function Learn({ module = null }: { module?: string | null }) {
  const user = useSession((s) => s.user);
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  const [endgames, setEndgames] = useState<EndgameSummary[]>([]);
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const plan = useCoachPlan(user !== null, { curriculum: true });
  useEffect(() => {
    if (!user) return;
    void api.lessons().then((r) => setLessons(r?.lessons ?? []));
    void api.endgames().then((r) => setEndgames(r?.endgames ?? []));
    void api.exams().then((r) => setExams(r?.exams ?? []));
  }, [user]);

  // Arrivée depuis une compétence (Progrès) : le module du parcours est centré et surligné.
  const modulesReady = plan.curriculum !== null;
  useEffect(() => {
    if (module && modulesReady) {
      document.getElementById(`module-${module}`)?.scrollIntoView({ block: 'center' });
    }
  }, [module, modulesReady]);

  if (!user) {
    return (
      <div className="page">
        <div className="panel page-panel">
          <h2>Apprendre</h2>
          <EmptyState
            icon="♟"
            title="Connexion requise"
            action={
              <>
                <Button variant="primary" href="#/login">
                  Se connecter
                </Button>
                <Button href="#/openings">Ouvertures</Button>
              </>
            }
          >
            Connecte-toi pour suivre le parcours et ta progression.
          </EmptyState>
        </div>
      </div>
    );
  }
  if (lessons === null) return <Loading label="Chargement du parcours…" />;

  const extra = lessons.filter((l) => !STAGES.some((s) => s.phase === l.phase));
  return (
    <div className="page learn" data-testid="learn">
      <section className="panel page-panel">
        <h2>Apprendre</h2>
        <p className="muted">
          Trois paliers, du 1000 au 1600 Elo. Chaque palier mêle leçons, finales et parties
          commentées ; l'ordre est conseillé, jamais imposé.
        </p>
        <p>
          <a href="#/lessons" data-testid="learn-lessons">
            Toutes les leçons
          </a>
          {' · '}
          <a href="#/endgames" data-testid="learn-endgames">
            Finales contre le bot
          </a>
          {' · '}
          <a href="#/openings" data-testid="learn-openings">
            Répertoire d’ouvertures
          </a>
        </p>
      </section>

      {STAGES.map((stage) => {
        const inStage = lessons.filter((l) => l.phase === stage.phase);
        const courses = inStage.filter((l) => !isClassic(l));
        const classics = inStage.filter(isClassic);
        const stageEndgames = endgames.filter((e) => e.stage === stage.phase);
        const done =
          inStage.filter((l) => l.passed).length + stageEndgames.filter((e) => e.passed).length;
        const total = inStage.length + stageEndgames.length;
        return (
          <section
            key={stage.id}
            className="panel page-panel"
            data-testid={`stage-${stage.id}`}
            aria-label={`Palier ${stage.id}`}
          >
            <div className="puzzle-stats-row">
              <h2>
                {stage.id} · {stage.elo}
              </h2>
              <span className="muted">
                {done} / {total}
              </span>
            </div>
            <p className="muted">{stage.title}</p>
            <Bar label={`Progression du palier ${stage.id}`} done={done} total={total} />

            <h3>Leçons</h3>
            {courses.length === 0 ? (
              <EmptyState icon={<IconBook size={32} />} title="Aucune leçon dans ce palier" />
            ) : (
              <div className="lesson-list">
                {courses.map((l, i) => (
                  <LessonCard key={l.id} lesson={l} number={i + 1} />
                ))}
              </div>
            )}

            {classics.length > 0 && (
              <>
                <h3>Parties commentées</h3>
                <div className="lesson-list">
                  {classics.map((l, i) => (
                    <LessonCard key={l.id} lesson={l} number={i + 1} />
                  ))}
                </div>
              </>
            )}

            <h3>Finales</h3>
            <p className="muted" data-testid={`stage-${stage.id}-endgames`}>
              {stageEndgames.filter((e) => e.passed).length} / {stageEndgames.length} réussie
              {stageEndgames.length > 1 ? 's' : ''} contre le bot.{' '}
              <a href="#/endgames">Ouvrir le cours de finales</a>
            </p>

            <ExamCard
              stage={stage.phase}
              id={stage.id}
              exam={exams.find((e) => e.stage === stage.phase)}
            />
          </section>
        );
      })}

      {extra.length > 0 && (
        <section className="panel page-panel" data-testid="stage-extra">
          <h2>Programme personnalisé</h2>
          <div className="lesson-list">
            {extra.map((l, i) => (
              <LessonCard key={l.id} lesson={l} number={i + 1} />
            ))}
          </div>
        </section>
      )}

      <section className="panel page-panel" data-testid="learn-openings-card">
        <h2>Ouvertures</h2>
        <p className="muted">
          Un répertoire en répétition espacée : tes lignes reviennent quand elles sont dues.
        </p>
        <Button href="#/openings">Réviser mes ouvertures</Button>
      </section>

      {plan.curriculum && <PathCard curriculum={plan.curriculum} highlight={module} />}
    </div>
  );
}
