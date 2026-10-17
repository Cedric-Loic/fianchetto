import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  DisplayedPiece,
  LegalMove,
  LessonExercise,
  LessonSummary,
  LessonView,
  PuzzleStep,
  Square,
} from '@sq/shared';
import { Board } from '../game/Board';
import { api } from '../lib/api';
import { carryIds, piecesFromFen } from '../lib/fen';
import { useSession } from '../lib/session';
import { useSettings } from '../lib/settings';
import { SIDE } from './labels';

const PHASES: Record<number, string> = {
  1: 'Phase 1 · Ne plus rien donner',
  2: 'Phase 2 · Calculer et punir',
  3: 'Phase 3 · Jouer avec un plan',
  4: 'Phase 4 · Programme personnalisé',
};

/** Texte des leçons : paragraphes (une ligne = un paragraphe) et **gras**. */
function RichText({ text }: { text: string }) {
  const inline = (line: string): ReactNode[] =>
    line
      .split(/(\*\*[^*]+\*\*)/)
      .map((part, i) =>
        part.startsWith('**') ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      );
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i}>{inline(line)}</p>
      ))}
    </>
  );
}

function LoginNeeded() {
  return (
    <div className="page">
      <div className="panel page-panel">
        <h2>Leçons</h2>
        <p className="muted">Connecte-toi pour suivre ta progression.</p>
        <a className="button primary" href="#/login">
          Se connecter
        </a>
      </div>
    </div>
  );
}

/** Liste des leçons, par phase du plan, avec la progression. */
export function Lessons() {
  const user = useSession((s) => s.user);
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  useEffect(() => {
    if (user) void api.lessons().then((r) => setLessons(r?.lessons ?? []));
  }, [user]);
  if (!user) return <LoginNeeded />;
  const phases = [...new Set((lessons ?? []).map((l) => l.phase))];
  const passed = lessons?.filter((l) => l.passed).length ?? 0;
  return (
    <div className="page">
      <div className="panel page-panel">
        <h2>Leçons</h2>
        <p className="muted">
          {passed} leçon{passed > 1 ? 's' : ''} validée{passed > 1 ? 's' : ''} sur{' '}
          {lessons?.length ?? 0}. Une leçon est validée quand 80 % de ses exercices sont réussis du
          premier coup.
        </p>
        {phases.map((phase) => (
          <div key={phase} className="lesson-phase">
            <h3>{PHASES[phase] ?? `Phase ${phase}`}</h3>
            <div className="lesson-list">
              {lessons
                ?.filter((l) => l.phase === phase)
                .map((l, i) => (
                  <a
                    key={l.id}
                    href={`#/lessons/${l.id}`}
                    className="lesson-card"
                    data-testid={`lesson-${l.id}`}
                  >
                    <span className="lesson-number">{i + 1}</span>
                    <span className="lesson-body">
                      <strong>{l.title}</strong>
                      <span className="muted">
                        {l.summary} · {l.minutes} min
                      </span>
                    </span>
                    <span className={`lesson-status${l.passed ? ' win' : ''}`}>
                      {l.passed ? '✓ Validée' : l.best !== null ? `${l.best}/${l.exercises}` : ''}
                    </span>
                  </a>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Un exercice « trouve le coup » : le serveur valide chaque coup. */
function ExerciseBoard(props: {
  lessonId: string;
  index: number;
  exercise: LessonExercise;
  onDone: (firstTry: boolean) => void;
}) {
  const { exercise } = props;
  const showLegalMoves = useSettings((s) => s.showLegalMoves);
  const [pieces, setPieces] = useState<DisplayedPiece[]>(() => piecesFromFen(exercise.fen));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [legal, setLegal] = useState<LegalMove[]>(exercise.legalMoves);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<'playing' | 'solved' | 'failed'>('playing');
  const [progress, setProgress] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
    },
    [],
  );

  const apply = (s: PuzzleStep) => {
    setPieces((prev) => carryIds(prev, piecesFromFen(s.fen), s.uci));
    setLastMove({ from: s.uci.slice(0, 2) as Square, to: s.uci.slice(2, 4) as Square });
  };
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));

  const onMove = async (from: Square, to: Square, promotion?: string) => {
    if (phase !== 'playing' || busy) return;
    setBusy(true);
    const res = await api.lessonMove(
      props.lessonId,
      props.index,
      step,
      `${from}${to}${promotion ?? ''}`,
    );
    if (!res || res.status === 'illegal') {
      setBusy(false);
      return;
    }
    if (res.status === 'failed') {
      setExplanation(res.explanation);
      setPhase('failed');
      // Solution jouée automatiquement, coup par coup.
      (res.solution ?? []).forEach((s, i) => later(() => apply(s), 600 * (i + 1)));
      later(() => setBusy(false), 600 * ((res.solution?.length ?? 0) + 1));
      props.onDone(false);
      return;
    }
    const [mine, reply] = res.steps;
    if (mine) apply(mine);
    const finish = () => {
      setLegal(res.legalMoves);
      setStep((s) => s + 2);
      if (res.status === 'solved') {
        setExplanation(res.explanation);
        setPhase('solved');
        props.onDone(true);
      } else setProgress(true);
      setBusy(false);
    };
    if (reply)
      later(() => {
        apply(reply);
        finish();
      }, 450);
    else finish();
  };

  return (
    <div className="exercise">
      <div className="example-board">
        <Board
          pieces={pieces}
          orientation={exercise.color}
          movable={phase === 'playing' && !busy ? exercise.color : null}
          legalMoves={showLegalMoves && phase === 'playing' ? legal : null}
          lastMove={lastMove}
          onMove={(from, to, promotion) => void onMove(from, to, promotion)}
        />
      </div>
      <div className="exercise-side">
        <p>
          <strong>{exercise.prompt}</strong>
        </p>
        <p className="muted">Trait aux {SIDE[exercise.color]}.</p>
        <div className={`move-card puzzle-status ${phase}`} data-testid="exercise-status">
          {phase === 'playing' && <p>{progress ? '✓ Bien vu ! Continue.' : 'À toi de jouer.'}</p>}
          {phase === 'solved' && <p className="win">✓ Réussi !</p>}
          {phase === 'failed' && <p className="loss">✗ Ce n'est pas ça. Voici la solution.</p>}
          {explanation && <p data-testid="exercise-explanation">{explanation}</p>}
        </div>
      </div>
    </div>
  );
}

/** Une leçon : explications et exemples, puis les exercices un par un, puis le bilan. */
export function LessonPage({ id }: { id: string }) {
  const user = useSession((s) => s.user);
  const [lesson, setLesson] = useState<LessonView | null | undefined>(undefined);
  const [current, setCurrent] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (user) void api.lesson(id).then(setLesson);
  }, [id, user]);

  if (!user) return <LoginNeeded />;
  if (lesson === undefined) return <div className="loading">Chargement…</div>;
  if (lesson === null) return <div className="loading">Leçon introuvable.</div>;

  const total = lesson.exercises.length;
  const exercise = current === null ? undefined : lesson.exercises[current];
  const finished = current !== null && current >= total;
  const correct = results.filter(Boolean).length;
  const answered = current !== null && results.length > current;

  const onDone = (firstTry: boolean) => {
    const next = [...results, firstTry];
    setResults(next);
    if (next.length === total) {
      void api.lessonResult(lesson.id, next.filter(Boolean).length).then(setSummary);
    }
  };
  const restart = () => {
    setResults([]);
    setSummary(null);
    setCurrent(0);
    setAttempt((a) => a + 1);
  };

  return (
    <div className="page lesson">
      <div className="panel page-panel">
        <a href="#/lessons" className="muted">
          ← Toutes les leçons
        </a>
        <h2>{lesson.title}</h2>
        <p className="muted">
          {PHASES[lesson.phase]} · {lesson.minutes} min
          {lesson.passed && <span className="win"> · ✓ Validée</span>}
        </p>
        {lesson.sections.map((s, i) =>
          s.kind === 'text' ? (
            <div key={i} className="lesson-text">
              {s.title && <h3>{s.title}</h3>}
              <RichText text={s.body} />
            </div>
          ) : (
            <figure key={i} className="lesson-example">
              <div className="example-board">
                <Board
                  pieces={piecesFromFen(s.fen)}
                  orientation={s.fen.split(' ')[1] === 'b' ? 'b' : 'w'}
                  movable={null}
                  extraArrows={s.arrows}
                  markedSquares={s.marks}
                />
              </div>
              <figcaption>{s.caption}</figcaption>
            </figure>
          ),
        )}
      </div>

      <div className="panel page-panel" data-testid="exercises">
        <h2>Exercices</h2>
        {current === null && (
          <>
            <p className="muted">
              {total} exercices. Réussis-en {Math.ceil(lesson.passRatio * total)} du premier coup
              pour valider la leçon.
            </p>
            <button className="primary" onClick={() => setCurrent(0)} data-testid="start-exercises">
              Commencer les exercices
            </button>
          </>
        )}
        {exercise && current !== null && (
          <>
            <p className="muted">
              Exercice {current + 1} / {total}
            </p>
            <ExerciseBoard
              key={`${attempt}-${current}`}
              lessonId={lesson.id}
              index={current}
              exercise={exercise}
              onDone={onDone}
            />
            {answered && (
              <button
                className="primary"
                onClick={() => setCurrent(current + 1)}
                data-testid="next-exercise"
              >
                {current + 1 < total ? 'Exercice suivant ▶' : 'Voir le bilan'}
              </button>
            )}
          </>
        )}
        {finished && (
          <div className="move-card" data-testid="lesson-result">
            <p>
              <strong>
                {correct} / {total}
              </strong>{' '}
              réussis du premier coup.
            </p>
            {summary?.passed ? (
              <p className="win">✓ Leçon validée !</p>
            ) : (
              <p>Pas encore validée : relis la leçon et recommence les exercices.</p>
            )}
            <div className="actions">
              <button onClick={restart}>Recommencer</button>
              <a className="button" href="#/lessons">
                Leçons
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
