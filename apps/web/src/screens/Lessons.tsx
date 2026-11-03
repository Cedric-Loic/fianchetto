import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LessonSummary, LessonView } from '@sq/shared';
import {
  ExercisePlayer,
  type ExerciseAnswer,
  type ExerciseVerdict,
} from '../exercise/ExercisePlayer';
import { Board } from '../game/Board';
import { api } from '../lib/api';
import { piecesFromFen } from '../lib/fen';
import { MOBILE_QUERY, useMediaQuery } from '../lib/media';
import { useSession } from '../lib/session';
import { BoardLayout } from '../ui/BoardLayout';
import { Button } from '../ui/Button';
import { EmptyState, LoginRequired } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';
import { IconBook, IconNext } from '../ui/icons';
import { StreakBadge } from '../ui/StreakBadge';

/** Position de départ (copie locale : `analysis/tree` embarque chess.js, chargé à la demande). */
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

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

/** Carte d'une leçon : numéro, titre, résumé et état (validée, meilleur score). */
export function LessonCard({ lesson: l, number }: { lesson: LessonSummary; number: number }) {
  return (
    <a href={`#/lessons/${l.id}`} className="lesson-card" data-testid={`lesson-${l.id}`}>
      <span className="lesson-number">{number}</span>
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
  if (lessons === null) return <Loading label="Chargement des leçons…" />;
  const phases = [...new Set(lessons.map((l) => l.phase))];
  const passed = lessons.filter((l) => l.passed).length;
  return (
    <div className="page">
      <div className="panel page-panel">
        <a href="#/learn" className="back-link">
          ← Apprendre
        </a>
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
                  <LessonCard key={l.id} lesson={l} number={i + 1} />
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Jugement d'une réponse d'exercice de leçon par le serveur (coup ou cases). */
async function judgeLesson(
  lessonId: string,
  index: number,
  answer: ExerciseAnswer,
  hints: number,
): Promise<ExerciseVerdict | null> {
  if (answer.kind === 'move') {
    return api.lessonMove(lessonId, index, answer.step, answer.uci, hints);
  }
  if (answer.kind === 'squares') {
    return api.lessonSquares(lessonId, index, answer.squares, hints);
  }
  return null; // pas de QCM dans les leçons pour l'instant
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
    return (
      <ExercisePlayer
        key={`${attempt}-${current}`}
        spec={exercise}
        judge={(answer, hints) => judgeLesson(lesson.id, current, answer, hints)}
        hint={(level) => api.lessonHint(lesson.id, current, level).then((r) => r?.hint ?? null)}
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
    <LessonReader lesson={lesson}>
      <div className="lesson-exercises" data-testid="exercises">
        <div className="puzzle-stats-row">
          <h3>Exercices</h3>
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
    </LessonReader>
  );
}

type ExampleSection = Extract<LessonView['sections'][number], { kind: 'example' }>;
type WalkthroughSection = Extract<LessonView['sections'][number], { kind: 'walkthrough' }>;

/** Vrai pour les sections qui s'affichent sur le plateau (exemple, partie commentée). */
function hasBoard(s: LessonView['sections'][number]): s is ExampleSection | WalkthroughSection {
  return s.kind !== 'text';
}

/**
 * Lecture d'une leçon : le plateau (fixe, toute la hauteur) montre la section active, exemple
 * ou partie commentée ; le panneau latéral contient tout le texte, qui défile. Les touches ←/→
 * font avancer la partie commentée active.
 */
function LessonReader({ lesson, children }: { lesson: LessonView; children: ReactNode }) {
  const { sections } = lesson;
  const [active, setActive] = useState<number | null>(() => {
    const first = sections.findIndex(hasBoard);
    return first < 0 ? null : first;
  });
  // Coup affiché de chaque partie commentée (indice de section) : on retrouve sa place en revenant.
  const [steps, setSteps] = useState<Record<number, number>>({});
  const [auto, setAuto] = useState(false);
  const mobile = useMediaQuery(MOBILE_QUERY);
  const columnRef = useRef<HTMLDivElement>(null);

  const candidate = active === null ? undefined : sections[active];
  const section = candidate && hasBoard(candidate) ? candidate : undefined;
  const walk = section?.kind === 'walkthrough' ? section : undefined;
  const max = walk?.steps.length ?? 0;
  const n = active === null ? 0 : (steps[active] ?? 0);
  const go = (to: number) => {
    if (active === null) return;
    setSteps((m) => ({ ...m, [active]: Math.max(0, Math.min(max, to)) }));
  };

  useEffect(() => {
    if (!auto || !walk || active === null) return;
    if (n >= max) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fin de la lecture automatique
      setAuto(false);
      return;
    }
    const t = setTimeout(() => setSteps((m) => ({ ...m, [active]: n + 1 })), 2200);
    return () => clearTimeout(t);
  }, [auto, walk, active, n, max]);

  // Touches ←/→ sur toute la page (sauf quand le plateau a le focus : elles y déplacent le curseur).
  useEffect(() => {
    if (!walk || active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('[role="grid"], input, textarea')) return;
      const at = (d: number) =>
        setSteps((m) => ({ ...m, [active]: Math.max(0, Math.min(max, (m[active] ?? 0) + d)) }));
      if (e.key === 'ArrowLeft') at(-1);
      else if (e.key === 'ArrowRight') at(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [walk, active, max]);

  const show = (i: number) => {
    setActive(i);
    setAuto(false);
    // Téléphone : le plateau est au-dessus du texte, on y remonte.
    if (mobile) columnRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  // Plateau : section active, sinon position du premier exercice (lecture seule).
  const fallback = lesson.exercises[0];
  const step = walk && n > 0 ? walk.steps[n - 1] : undefined;
  const view =
    section?.kind === 'example'
      ? {
          fen: section.fen,
          arrows: section.arrows.map((a) => ({ ...a, kind: 'line' as const })),
          marks: section.marks.map((square) => ({ square, kind: 'user' as const })),
          lastMove: null,
        }
      : walk
        ? {
            fen: step?.fen ?? walk.fen,
            arrows: step ? [{ from: step.from, to: step.to, kind: 'played' as const }] : [],
            marks: [],
            lastMove: step ? { from: step.from, to: step.to } : null,
          }
        : { fen: fallback?.fen ?? START_FEN, arrows: [], marks: [], lastMove: null };
  // Orienté du côté qui a le trait dans la position de départ de la section.
  const orientation = section
    ? section.fen.split(' ')[1] === 'b'
      ? 'b'
      : 'w'
    : (fallback?.color ?? 'w');

  return (
    <BoardLayout
      wide
      className="lesson-reader"
      testId="lesson-reader"
      board={
        <div ref={columnRef}>
          <Board
            pieces={piecesFromFen(view.fen)}
            orientation={orientation}
            movable={null}
            lastMove={view.lastMove}
            arrows={view.arrows}
            squareMarks={view.marks}
          />
        </div>
      }
      side={
        <>
          <a href="#/lessons" className="back-link">
            ← Toutes les leçons
          </a>
          <h2 className="lesson-title">{lesson.title}</h2>
          <p className="muted">
            {PHASES[lesson.phase]} · {lesson.minutes} min
            {lesson.passed && <span className="win"> · ✓ Validée</span>}
          </p>
          {sections.map((sec, i) => {
            if (sec.kind === 'text') {
              return (
                <div key={i} className="lesson-text">
                  {sec.title && <h3>{sec.title}</h3>}
                  <RichText text={sec.body} />
                </div>
              );
            }
            const isActive = active === i;
            const title = sec.kind === 'example' ? sec.caption : sec.title;
            return (
              <div
                key={i}
                className={`lesson-section-card${isActive ? ' active' : ''}`}
                data-testid={`lesson-section-${i}`}
              >
                {sec.kind === 'example' ? (
                  <>
                    <p>{title}</p>
                    {!isActive && (
                      <Button size="s" onClick={() => show(i)} data-testid={`section-show-${i}`}>
                        Voir sur l'échiquier
                      </Button>
                    )}
                  </>
                ) : isActive ? (
                  <div className="walkthrough" data-testid="walkthrough">
                    {title && <h3>{title}</h3>}
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
                        onClick={() => go(n - 1)}
                        data-testid="walkthrough-prev"
                      >
                        Précédent
                      </Button>
                      <Button
                        size="s"
                        variant="primary"
                        disabled={n >= max}
                        onClick={() => go(n + 1)}
                        data-testid="walkthrough-next"
                      >
                        Suivant
                      </Button>
                      <Button size="s" variant="outline" onClick={() => setAuto((a) => !a)}>
                        {auto ? 'Pause' : 'Lecture auto'}
                      </Button>
                    </div>
                    <div className="wt-moves" data-testid="walkthrough-moves">
                      {sec.steps.map((st, k) => (
                        <button
                          key={k}
                          type="button"
                          className={n === k + 1 ? 'active' : ''}
                          aria-current={n === k + 1 ? 'step' : undefined}
                          onClick={() => {
                            setAuto(false);
                            go(k + 1);
                          }}
                        >
                          {k % 2 === 0 ? `${k / 2 + 1}. ` : ''}
                          {st.san}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {title && <h3>{title}</h3>}
                    <p className="muted">Partie commentée · {sec.steps.length} coups</p>
                    <Button
                      size="s"
                      variant="primary"
                      onClick={() => show(i)}
                      data-testid={`walkthrough-open-${i}`}
                    >
                      Ouvrir la partie
                    </Button>
                  </>
                )}
              </div>
            );
          })}
          {children}
        </>
      }
    />
  );
}
