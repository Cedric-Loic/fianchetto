import { Fragment, useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
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
import { usePremoves } from '../game/usePremoves';
import { api } from '../lib/api';
import { carryIds, piecesFromFen } from '../lib/fen';
import { useSession } from '../lib/session';
import { useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';
import { useStreak } from '../lib/streak';
import { applyLocalMoves, type LocalMove } from '../lib/virtual';
import { SIDE } from './labels';
import { Button } from '../ui/Button';
import { EmptyState, LoginRequired } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';
import { IconBook, IconNext } from '../ui/icons';
import { StreakBadge } from '../ui/StreakBadge';

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
  return <LoginRequired title="Leçons" text="Connecte-toi pour suivre ta progression." />;
}

/** Liste des leçons, par phase du plan, avec la progression. */
export function Lessons() {
  const user = useSession((s) => s.user);
  const [lessons, setLessons] = useState<LessonSummary[] | null>(null);
  useEffect(() => {
    if (user) void api.lessons().then((r) => setLessons(r?.lessons ?? []));
  }, [user]);
  if (!user) return <LoginNeeded />;
  if (lessons === null) return <Loading label="Chargement des leçons…" />;
  const phases = [...new Set(lessons.map((l) => l.phase))];
  const passed = lessons.filter((l) => l.passed).length;
  return (
    <div className="page">
      <div className="panel page-panel">
        <h2>Leçons</h2>
        <p className="muted">
          {passed} leçon{passed > 1 ? 's' : ''} validée{passed > 1 ? 's' : ''} sur {lessons.length}.
          Une leçon est validée quand 80 % de ses exercices sont réussis du premier coup.
        </p>
        <p>
          <a href="#/endgames" data-testid="lessons-endgames">
            Finales contre le bot : mets la théorie en pratique →
          </a>
        </p>
        <p>
          <a href="#/openings" data-testid="lessons-openings">
            Répertoire d’ouvertures : révise tes lignes en répétition espacée →
          </a>
        </p>
        {lessons.length === 0 && (
          <EmptyState icon={<IconBook size={40} />} title="Aucune leçon disponible">
            Le serveur n'a renvoyé aucune leçon.
          </EmptyState>
        )}
        {phases.map((phase) => (
          <div key={phase} className="lesson-phase">
            <h3>{PHASES[phase] ?? `Phase ${phase}`}</h3>
            <div className="lesson-list">
              {lessons
                .filter((l) => l.phase === phase)
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
  /** Éclair sur la case d'arrivée de mon coup : bon (vert) ou faux (rouge). */
  const [flash, setFlash] = useState<{
    square: Square;
    tone: 'success' | 'error';
    id: number;
  } | null>(null);
  const record = useStreak((s) => s.record);
  /** Mon coup envoyé, affiché tout de suite en attendant la réponse du serveur. */
  const [pending, setPending] = useState<LocalMove | null>(null);
  // Premoves pendant la réponse adverse, oubliés dès que l'exercice est terminé.
  const premoveOn = useSettings((s) => s.premoves);
  const queue = usePremoves(phase, premoveOn);
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

  const onMove = async (move: LocalMove) => {
    if (phase !== 'playing' || busy) return;
    setBusy(true);
    setPending(move);
    const res = await api.lessonMove(
      props.lessonId,
      props.index,
      step,
      `${move.from}${move.to}${move.promotion ?? ''}`,
    );
    setPending(null);
    if (!res || res.status === 'illegal') {
      // Coup (ou premove) refusé : la pièce revient, les premoves suivants sont annulés.
      queue.clear();
      setBusy(false);
      return;
    }
    const failed = res.status === 'failed';
    setFlash((f) => ({
      square: move.to,
      tone: failed ? 'error' : 'success',
      id: (f?.id ?? 0) + 1,
    }));
    if (res.status === 'failed') {
      playSound('failure');
      record(false);
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
        playSound('success');
        record(true);
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

  // Position de nouveau jouable : le premier premove part comme un coup normal.
  const playable = phase === 'playing' && !busy;
  const nextPremove = playable ? queue.next : undefined;
  const playPremove = useEffectEvent((move: LocalMove) => {
    queue.shift();
    void onMove(move);
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chaque premove ne part qu'une fois
    if (nextPremove) playPremove(nextPremove);
  }, [nextPremove]);

  return (
    <div className="exercise">
      <div className="example-board">
        <Board
          pieces={applyLocalMoves(pieces, [...(pending ? [pending] : []), ...queue.premoves])}
          orientation={exercise.color}
          movable={playable ? exercise.color : null}
          premoveColor={premoveOn && phase === 'playing' && busy ? exercise.color : null}
          premoves={queue.premoves}
          onPremove={queue.add}
          onCancelPremove={queue.clear}
          legalMoves={showLegalMoves && phase === 'playing' ? legal : null}
          lastMove={lastMove}
          flash={flash}
          onMove={(from, to, promotion) =>
            void onMove(promotion ? { from, to, promotion } : { from, to })
          }
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
  if (lesson === undefined) return <Loading label="Chargement de la leçon…" />;
  if (lesson === null) {
    return (
      <div className="page">
        <div className="panel page-panel">
          <EmptyState
            icon={<IconBook size={40} />}
            title="Leçon introuvable"
            action={<Button href="#/lessons">Toutes les leçons</Button>}
          />
        </div>
      </div>
    );
  }

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
        <a href="#/lessons" className="back-link">
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
                  arrows={s.arrows.map((a) => ({ ...a, kind: 'line' as const }))}
                  squareMarks={s.marks.map((square) => ({ square, kind: 'user' as const }))}
                />
              </div>
              <figcaption>{s.caption}</figcaption>
            </figure>
          ),
        )}
      </div>

      <div className="panel page-panel" data-testid="exercises">
        <div className="puzzle-stats-row">
          <h2>Exercices</h2>
          <StreakBadge />
        </div>
        {current === null && (
          <>
            <p className="muted">
              {total} exercices. Réussis-en {Math.ceil(lesson.passRatio * total)} du premier coup
              pour valider la leçon.
            </p>
            <Button variant="primary" onClick={() => setCurrent(0)} data-testid="start-exercises">
              Commencer les exercices
            </Button>
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
              <Button
                variant="primary"
                onClick={() => setCurrent(current + 1)}
                data-testid="next-exercise"
              >
                {current + 1 < total ? 'Exercice suivant' : 'Voir le bilan'}
                <IconNext size={18} />
              </Button>
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
              <Button onClick={restart}>Recommencer</Button>
              <Button href="#/lessons">Leçons</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
