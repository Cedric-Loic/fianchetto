import {
  Fragment,
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
import { BoardLayout } from '../ui/BoardLayout';
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

/** Indices progressifs : textes cumulés, demandés un à un au serveur. */
function useHints(lessonId: string, index: number, available: number) {
  const [texts, setTexts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const ask = useCallback(async () => {
    if (loading || texts.length >= available) return;
    setLoading(true);
    const res = await api.lessonHint(lessonId, index, texts.length + 1);
    setLoading(false);
    if (res) setTexts((t) => (t.length === texts.length ? [...t, res.hint] : t));
  }, [loading, texts.length, available, lessonId, index]);
  return { texts, ask, loading, left: available - texts.length };
}

type Hints = ReturnType<typeof useHints>;

/** Bouton « Indice (n restants) » et indices déjà obtenus. */
function HintPanel({ hints, active }: { hints: Hints; active: boolean }) {
  return (
    <>
      {active && hints.left > 0 && (
        <Button
          size="s"
          variant="outline"
          disabled={hints.loading}
          onClick={() => void hints.ask()}
          data-testid="exercise-hint"
        >
          Indice ({hints.left} restant{hints.left > 1 ? 's' : ''})
        </Button>
      )}
      {hints.texts.length > 0 && (
        <ul className="hint-list" data-testid="hint-list">
          {hints.texts.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      )}
    </>
  );
}

type ExerciseProps = {
  lessonId: string;
  index: number;
  exercise: LessonExercise;
  onDone: (firstTry: boolean) => void;
  /** Panneau latéral : en-tête (retour, titre) et suite (bouton suivant). */
  header: ReactNode;
  footer: ReactNode;
};

/** Exercice « désigne les cases » : sélection multiple, validation par le serveur. */
function SquaresBoard(props: ExerciseProps) {
  const { exercise } = props;
  const [picked, setPicked] = useState<Square[]>([]);
  const [phase, setPhase] = useState<'playing' | 'solved' | 'failed'>('playing');
  const [correct, setCorrect] = useState<Square[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const record = useStreak((s) => s.record);
  const hints = useHints(props.lessonId, props.index, exercise.hints);
  const playing = phase === 'playing';

  const toggle = (sq: Square) => {
    if (!playing || busy) return;
    setPicked((p) => (p.includes(sq) ? p.filter((x) => x !== sq) : p.length < 8 ? [...p, sq] : p));
  };
  const validate = async () => {
    if (!playing || busy || picked.length === 0) return;
    setBusy(true);
    const res = await api.lessonSquares(props.lessonId, props.index, picked, hints.texts.length);
    setBusy(false);
    if (!res) return;
    setExplanation(res.explanation);
    const ok = res.status === 'solved';
    setCorrect(res.correct ?? []);
    setPhase(ok ? 'solved' : 'failed');
    playSound(ok ? 'success' : 'failure');
    record(ok);
    props.onDone(ok && hints.texts.length === 0);
  };

  const marks = [
    ...(playing ? picked.map((square) => ({ square, kind: 'pick' as const })) : []),
    ...(phase === 'failed' ? correct.map((square) => ({ square, kind: 'correct' as const })) : []),
  ];
  return (
    <BoardLayout
      className="exercise"
      testId="exercises"
      board={
        <Board
          pieces={piecesFromFen(exercise.fen)}
          orientation={exercise.color}
          movable={null}
          onSquareClick={toggle}
          squareMarks={marks}
        />
      }
      side={
        <>
          {props.header}
          <p>
            <strong>{exercise.prompt}</strong>
          </p>
          <p className="muted">Clique les cases concernées (re-clic pour retirer).</p>
          <HintPanel hints={hints} active={playing} />
          {playing && (
            <Button
              variant="primary"
              disabled={busy || picked.length === 0}
              onClick={() => void validate()}
              data-testid="squares-validate"
            >
              Valider
            </Button>
          )}
          {!playing && (
            <div className={`move-card puzzle-status ${phase}`} data-testid="exercise-status">
              {phase === 'solved' && <p className="win">✓ Réussi !</p>}
              {phase === 'failed' && (
                <p className="loss">✗ Pas tout à fait. Les bonnes cases sont marquées en vert.</p>
              )}
              {explanation && <p data-testid="exercise-explanation">{explanation}</p>}
            </div>
          )}
          {props.footer}
        </>
      }
    />
  );
}

/** Un exercice « trouve le coup » : le serveur valide chaque coup. */
function ExerciseBoard(props: ExerciseProps) {
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
  const hints = useHints(props.lessonId, props.index, exercise.hints);
  /** Coups refusés : après deux, le premier indice est proposé d'office. */
  const refused = useRef(0);
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
      hints.texts.length,
    );
    setPending(null);
    if (!res || res.status === 'illegal') {
      // Coup (ou premove) refusé : la pièce revient, les premoves suivants sont annulés.
      queue.clear();
      setBusy(false);
      refused.current += 1;
      if (refused.current === 2 && hints.texts.length === 0 && exercise.hints > 0) {
        void hints.ask();
      }
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
        props.onDone(hints.texts.length === 0);
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
    <BoardLayout
      className="exercise"
      testId="exercises"
      board={
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
      }
      side={
        <>
          {props.header}
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
          <HintPanel hints={hints} active={phase === 'playing'} />
          {props.footer}
        </>
      }
    />
  );
}

/** Une leçon : explications et exemples, puis les exercices un par un, puis le bilan. */
export function LessonPage({ id, only = null }: { id: string; only?: number | null }) {
  const user = useSession((s) => s.user);
  const [lesson, setLesson] = useState<LessonView | null | undefined>(undefined);
  const [current, setCurrent] = useState<number | null>(only);
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
    // Exercice isolé (révisions) : le serveur a déjà jugé et replanifié la carte, pas de bilan.
    if (only === null && next.length === total) {
      void api.lessonResult(lesson.id, next.filter(Boolean).length).then(setSummary);
    }
  };
  const restart = () => {
    setResults([]);
    setSummary(null);
    setCurrent(0);
    setAttempt((a) => a + 1);
  };

  if (exercise && current !== null) {
    const Exercise = exercise.kind === 'squares' ? SquaresBoard : ExerciseBoard;
    return (
      <Exercise
        key={`${attempt}-${current}`}
        lessonId={lesson.id}
        index={current}
        exercise={exercise}
        onDone={onDone}
        header={
          <>
            <a href={only === null ? '#/lessons' : '#/reviews'} className="back-link">
              {only === null ? '← Toutes les leçons' : '← Révisions'}
            </a>
            <div className="puzzle-stats-row">
              <h2 className="exercise-title">{lesson.title}</h2>
              <StreakBadge />
            </div>
            <p className="muted">
              Exercice {current + 1} / {total}
            </p>
          </>
        }
        footer={
          answered &&
          (only !== null ? (
            <Button variant="primary" href="#/reviews" data-testid="back-to-reviews">
              Retour aux révisions
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => setCurrent(current + 1)}
              data-testid="next-exercise"
            >
              {current + 1 < total ? 'Exercice suivant' : 'Voir le bilan'}
              <IconNext size={18} />
            </Button>
          ))
        }
      />
    );
  }

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
          ) : s.kind === 'walkthrough' ? (
            <Walkthrough key={i} section={s} />
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

type WalkthroughSection = Extract<LessonView['sections'][number], { kind: 'walkthrough' }>;

/** Partie commentée : plateau, commentaire, ←/→, liste des coups cliquable, lecture auto. */
function Walkthrough({ section }: { section: WalkthroughSection }) {
  const [n, setN] = useState(0);
  const [auto, setAuto] = useState(false);
  const max = section.steps.length;
  const step = n > 0 ? section.steps[n - 1] : undefined;
  const fen = step?.fen ?? section.fen;

  useEffect(() => {
    if (!auto) return;
    if (n >= max) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fin de la lecture automatique
      setAuto(false);
      return;
    }
    const t = setTimeout(() => setN((x) => x + 1), 2200);
    return () => clearTimeout(t);
  }, [auto, n, max]);

  // Touches ←/→ sur toute la page (sauf quand le plateau a le focus : elles y déplacent le curseur).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('[role="grid"], input, textarea')) return;
      if (e.key === 'ArrowLeft') setN((x) => Math.max(0, x - 1));
      else if (e.key === 'ArrowRight') setN((x) => Math.min(max, x + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [max]);

  return (
    <div className="walkthrough-block" data-testid="walkthrough">
      <BoardLayout
        className="walkthrough"
        board={
          <Board
            pieces={piecesFromFen(fen)}
            orientation={section.fen.split(' ')[1] === 'b' ? 'b' : 'w'}
            movable={null}
            lastMove={step ? { from: step.from, to: step.to } : null}
            arrows={step ? [{ from: step.from, to: step.to, kind: 'played' as const }] : []}
          />
        }
        side={
          <>
            {section.title && <h3>{section.title}</h3>}
            <p className="muted">
              Coup {n} / {max}
            </p>
            <div className="move-card" data-testid="walkthrough-comment" aria-live="polite">
              {step ? (
                <RichText text={`**${step.san}** ${step.comment}`} />
              ) : (
                <p>Position de départ. Avance coup par coup (touches ← →).</p>
              )}
            </div>
            <div className="btn-row">
              <Button
                size="s"
                disabled={n === 0}
                onClick={() => setN(n - 1)}
                data-testid="walkthrough-prev"
              >
                Précédent
              </Button>
              <Button
                size="s"
                variant="primary"
                disabled={n >= max}
                onClick={() => setN(n + 1)}
                data-testid="walkthrough-next"
              >
                Suivant
              </Button>
              <Button size="s" variant="outline" onClick={() => setAuto((a) => !a)}>
                {auto ? 'Pause' : 'Lecture auto'}
              </Button>
            </div>
            <div className="wt-moves" data-testid="walkthrough-moves">
              {section.steps.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  className={n === i + 1 ? 'active' : ''}
                  aria-current={n === i + 1 ? 'step' : undefined}
                  onClick={() => {
                    setAuto(false);
                    setN(i + 1);
                  }}
                >
                  {i % 2 === 0 ? `${i / 2 + 1}. ` : ''}
                  {s.san}
                </button>
              ))}
            </div>
          </>
        }
      />
    </div>
  );
}
