import { useEffect, useState } from 'react';
import {
  EXAM_MINI_SIZE,
  EXAM_PASS_RATIO,
  EXAM_SIZE,
  SKILL_LABELS,
  type ExamKind,
  type ExamQuestion,
  type ExamResultResponse,
  type ExamSummary,
  type SkillId,
} from '@sq/shared';
import { ExercisePlayer } from '../exercise/ExercisePlayer';
import { judgeLesson } from '../exercise/judge';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { Button } from '../ui/Button';
import { LoginRequired } from '../ui/EmptyState';
import { IconNext } from '../ui/icons';
import { ProgressBar } from '../ui/ProgressBar';

const ELO = ['', '1000-1200', '1200-1400', '1400-1600'];

/** Nombre de bonnes réponses requis pour valider (80 %, arrondi au-dessus). */
const required = (total: number) => Math.ceil(total * EXAM_PASS_RATIO - 1e-9);

/**
 * Examen de palier (20 questions) ou mini-test de finales (5 questions). Les questions viennent
 * du serveur sans leur solution ; chacune est jugée par les routes des leçons. Le passage au
 * palier suivant est conseillé, jamais bloquant : l'écran de bilan propose de refaire l'examen
 * ou de retourner au parcours.
 */
export function Exam({ stage, kind }: { stage: number; kind: ExamKind }) {
  const user = useSession((s) => s.user);
  const [summary, setSummary] = useState<ExamSummary | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (user)
      void api.exams().then((r) => setSummary(r?.exams.find((e) => e.stage === stage) ?? null));
  }, [user, stage]);

  if (!user) return <LoginRequired title="Examen" text="Connecte-toi pour passer un examen." />;

  const mini = kind === 'mini';
  const size = mini ? EXAM_MINI_SIZE : EXAM_SIZE;
  const back = mini ? '#/endgames' : '#/learn';

  const start = async () => {
    setBusy(true);
    setError(null);
    const res = await api.startExam(stage, kind);
    setBusy(false);
    if (!res.ok || res.data.questions.length === 0) {
      setError(
        !res.ok && res.status === 0
          ? 'Serveur injoignable. Réessaie dans un instant.'
          : "Impossible de composer l'examen pour l'instant : ce palier n'a pas assez d'exercices.",
      );
      return;
    }
    setQuestions(res.data.questions);
    setAttempt((a) => a + 1);
  };

  if (questions) {
    return (
      <ExamRun
        key={attempt}
        stage={stage}
        kind={kind}
        questions={questions}
        busy={busy}
        error={error}
        onRestart={() => void start()}
      />
    );
  }

  const title = mini ? 'Mini-test de finales' : `Examen du palier ${stage}`;
  return (
    <div className="page">
      <div className="panel page-panel exam" data-testid="exam-intro">
        <a href={back} className="back-link">
          {mini ? '← Finales' : '← Apprendre'}
        </a>
        <h2>{title}</h2>
        <p className="muted">
          Palier P{stage} · {ELO[stage]} Elo
        </p>
        <p>
          <strong>{size} questions</strong>, tirées des exercices{' '}
          {mini ? 'du premier chapitre de finales' : 'du palier'}. Une question après l'autre :
          l'explication n'apparaît qu'après ta réponse.
        </p>
        <p>
          <strong>80 % pour valider</strong> ({required(size)} bonnes réponses du premier coup sur{' '}
          {size}). Réussir est conseillé pour passer au palier suivant, mais jamais bloquant. Les
          indices restent permis, mais une question réussie avec indice ne compte pas.
        </p>
        {summary && (
          <p className="muted" data-testid="exam-best">
            {summary.best === null
              ? 'Jamais passé.'
              : `Meilleur score : ${summary.best} / ${summary.total}${summary.passed ? ' · ✓ validé' : ''}`}
            {mini && summary.miniPassed && ' · ✓ Mini-test déjà réussi'}
          </p>
        )}
        {error && (
          <p className="error" role="alert" data-testid="exam-error">
            {error}
          </p>
        )}
        <div className="actions">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => void start()}
            data-testid="exam-start"
          >
            Commencer
          </Button>
          <Button href={back}>Plus tard</Button>
        </div>
      </div>
    </div>
  );
}

/** Déroulé des questions, puis bilan. Remonté (key) à chaque nouvelle tentative. */
function ExamRun(props: {
  stage: number;
  kind: ExamKind;
  questions: ExamQuestion[];
  busy: boolean;
  error: string | null;
  onRestart: () => void;
}) {
  const { stage, kind, questions } = props;
  const total = questions.length;
  const [current, setCurrent] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [saved, setSaved] = useState<ExamResultResponse | 'failed' | null>(null);

  const correct = results.filter(Boolean).length;
  const question = questions[current];

  const onDone = (firstTry: boolean) => {
    const next = [...results, firstTry];
    setResults(next);
    if (next.length === total) {
      void api
        .examResult(stage, kind, next.filter(Boolean).length)
        .then((r) => setSaved(r ?? 'failed'));
    }
  };

  if (question && current < total) {
    const answered = results.length > current;
    return (
      <ExercisePlayer
        key={current}
        spec={question.exercise}
        judge={(answer, hints) => judgeLesson(question.lesson, question.index, answer, hints)}
        hint={(level) =>
          api.lessonHint(question.lesson, question.index, level).then((r) => r?.hint ?? null)
        }
        onDone={onDone}
        header={
          <div data-testid="exam-header">
            <a href={kind === 'mini' ? '#/endgames' : '#/learn'} className="back-link">
              ← Quitter l'examen
            </a>
            <h2 className="exercise-title">{kind === 'mini' ? 'Mini-test' : `Examen P${stage}`}</h2>
            <p className="muted">
              <span data-testid="exam-progress">
                Question {current + 1} / {total}
              </span>
              {' · '}
              <span data-testid="exam-score">
                Score : {correct} / {results.length}
              </span>
            </p>
            <ProgressBar label="Progression de l'examen" done={results.length} total={total} />
          </div>
        }
        footer={
          answered && (
            <Button
              variant="primary"
              onClick={() => setCurrent(current + 1)}
              data-testid="exam-next"
            >
              {current + 1 < total ? 'Question suivante' : 'Voir le bilan'}
              <IconNext size={18} />
            </Button>
          )
        }
      />
    );
  }

  return (
    <Report
      stage={stage}
      kind={kind}
      questions={questions}
      results={results}
      saved={saved}
      busy={props.busy}
      error={props.error}
      onRestart={props.onRestart}
    />
  );
}

/** Bilan : score, verdict, répartition par compétence et conseil sur la plus faible. */
function Report(props: {
  stage: number;
  kind: ExamKind;
  questions: ExamQuestion[];
  results: boolean[];
  saved: ExamResultResponse | 'failed' | null;
  busy: boolean;
  error: string | null;
  onRestart: () => void;
}) {
  const { stage, kind, questions, results } = props;
  const total = questions.length;
  const correct = results.filter(Boolean).length;
  const passed = correct >= required(total);

  const bySkill = new Map<SkillId, { ok: number; total: number }>();
  questions.forEach((q, i) => {
    const row = bySkill.get(q.skill) ?? { ok: 0, total: 0 };
    row.total += 1;
    if (results[i]) row.ok += 1;
    bySkill.set(q.skill, row);
  });
  const rows = [...bySkill.entries()];
  // Compétence la plus faible : plus petit taux de réussite, à égalité le plus d'erreurs.
  const weakest = rows
    .filter(([, r]) => r.ok < r.total)
    .sort((a, b) => a[1].ok / a[1].total - b[1].ok / b[1].total || b[1].total - a[1].total)[0]?.[0];

  const [moduleId, setModuleId] = useState<string | null>(null);
  useEffect(() => {
    if (!weakest) return;
    void api.coachCurriculum().then((r) => {
      const modules = r?.modules.filter((m) => m.skill === weakest) ?? [];
      setModuleId((modules.find((m) => m.phase === stage) ?? modules[0])?.id ?? null);
    });
  }, [weakest, stage]);

  const mini = kind === 'mini';
  return (
    <div className="page">
      <div className="panel page-panel exam" data-testid="exam-report">
        <h2>{mini ? 'Bilan du mini-test' : `Bilan de l'examen du palier ${stage}`}</h2>
        <p className="exam-score">
          <strong data-testid="exam-final-score">
            {correct} / {total}
          </strong>{' '}
          réussies du premier coup.
        </p>
        <p className={passed ? 'win' : ''} data-testid="exam-verdict">
          {passed
            ? mini
              ? '✓ Mini-test réussi : tu as les bases pour continuer les finales.'
              : stage < 3
                ? `✓ Examen validé : tu peux passer au palier ${stage + 1}.`
                : '✓ Examen validé : le parcours est maîtrisé, bravo !'
            : `À retravailler : il fallait ${required(total)} bonnes réponses sur ${total}. Ce n'est pas bloquant : reprends le point faible ci-dessous, puis retente ta chance.`}
        </p>
        {props.saved === 'failed' && (
          <p className="muted" role="status">
            Résultat non enregistré (serveur injoignable).
          </p>
        )}
        {props.saved !== null && props.saved !== 'failed' && props.saved.exam.best !== null && (
          <p className="muted" data-testid="exam-saved">
            Meilleur score : {props.saved.exam.best} / {props.saved.exam.total}
            {props.saved.passedNow && ' · nouvelle validation !'}
          </p>
        )}

        <h3>Par compétence</h3>
        <ul className="exam-skills" data-testid="exam-skills">
          {rows.map(([skill, r]) => (
            <li
              key={skill}
              className={skill === weakest ? 'weakest' : ''}
              data-testid={`exam-skill-${skill}`}
            >
              <span className="skill-name">{SKILL_LABELS[skill]}</span>
              <ProgressBar label={SKILL_LABELS[skill]} done={r.ok} total={r.total} />
              <span className="muted">
                {r.ok} / {r.total}
              </span>
            </li>
          ))}
        </ul>
        {weakest && (
          <p data-testid="exam-weakest">
            Point le plus faible : <strong>{SKILL_LABELS[weakest]}</strong>.{' '}
            <a href={moduleId ? `#/learn?module=${moduleId}` : '#/learn'} data-testid="exam-advice">
              Revoir le module conseillé →
            </a>
          </p>
        )}
        {props.error && (
          <p className="error" role="alert">
            {props.error}
          </p>
        )}
        <div className="actions">
          <Button
            variant="primary"
            disabled={props.busy}
            onClick={props.onRestart}
            data-testid="exam-restart"
          >
            Refaire un examen
          </Button>
          <Button href="#/learn" data-testid="exam-back">
            Retour au parcours
          </Button>
        </div>
      </div>
    </div>
  );
}
