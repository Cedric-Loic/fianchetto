import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  BoardArrow,
  Color,
  ExplanationKind,
  GameReview,
  MoveClass,
  ReviewInfo,
  ReviewMove,
  ReviewResponse,
  Square,
} from '@sq/shared';
import { AnalysisBoard } from '../analysis/AnalysisBoard';
import { useAnalysisTree } from '../analysis/useAnalysisTree';
import { EvalChart } from '../game/Analysis';
import type { BoardMark } from '../game/Board';
import { CLASS_LABEL, CLASS_SYMBOL, classCss } from '../lib/classes';
import { api, reviewFailureMessage, SERVER_UNREACHABLE } from '../lib/api';
import { pollDelay, wait } from '../lib/poll';
import { evalLabel } from '../lib/eval';
import { useSan } from '../lib/notation';
import { useSettings } from '../lib/settings';
import { ExplainText, GuidedPanel } from '../review/GuidedReview';
import { LearnMistakes } from '../review/LearnMistakes';
import {
  formatMoveClock,
  isQuizMoment,
  keyMoments,
  mistakesOf,
  quizScore,
  TIPS,
} from '../review/moments';
import { RepertoireNote } from './Openings';
import { SIDE, VARIANT_LABEL } from './labels';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';
import { IconBack, IconPlay, IconRetry, IconTarget } from '../ui/icons';

const ERRORS: readonly MoveClass[] = ['inaccuracy', 'mistake', 'blunder'];
const SOURCE_LABEL = { local: 'Partie locale', pgn: 'Import PGN', chesscom: 'chess.com' } as const;

const isError = (m: ReviewMove) => ERRORS.includes(m.classification);

/**
 * Revue de partie (coach) : analyse Stockfish de chaque coup, classe, explication des erreurs,
 * précision des deux camps, courbe d'évaluation, meilleur coup en flèche. Partie locale
 * terminée ou importée ; l'analyse se fait en arrière-plan sur le serveur.
 */
/** Les 3 plus grosses erreurs du joueur et un conseil (bilan du coach). */
function CoachSummary(props: {
  moves: readonly ReviewMove[];
  color: Color;
  onSelect: (ply: number) => void;
}) {
  const san = useSan();
  const errors = props.moves.filter((m) => m.color === props.color && isError(m));
  const key = [...errors]
    .sort((a, b) => b.winBefore - b.winAfter - (a.winBefore - a.winAfter))
    .slice(0, 3)
    .sort((a, b) => a.ply - b.ply);
  const kinds = new Map<ExplanationKind, number>();
  for (const m of errors) {
    if (m.explanation) kinds.set(m.explanation.kind, (kinds.get(m.explanation.kind) ?? 0) + 1);
  }
  const main = [...kinds.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return (
    <div className="move-card" data-testid="coach-summary">
      <p>
        <strong>Bilan du coach</strong>
      </p>
      {key.length === 0 ? (
        <p>Aucune erreur notable de ta part : bravo ! Essaie un niveau de bot au-dessus.</p>
      ) : (
        <>
          {key.map((m) => (
            <p key={m.ply} className="key-moment">
              <Button variant="link" onClick={() => props.onSelect(m.ply)}>
                {Math.ceil(m.ply / 2)}
                {m.color === 'w' ? '.' : '…'} {san(m.san)} {CLASS_SYMBOL[m.classification]}
              </Button>{' '}
              {m.explanation?.text}
            </p>
          ))}
          {main && (
            <p data-testid="coach-tip">
              <strong>Conseil :</strong> {TIPS[main]}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function Review({ id, guided = false }: { id: string; guided?: boolean }) {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // « Réessayer » après un serveur injoignable : recharge sans relancer l'analyse.
  const [reload, setReload] = useState(0);

  // Chargement, lancement de l'analyse si besoin, puis suivi de sa progression (espacement
  // progressif, arrêt au démontage).
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      let res = await api.review(id, signal);
      const status = res.ok ? res.data.state.status : null;
      if (status === 'none' || (attempt > 0 && status === 'error')) {
        res = await api.startReview(id, signal);
      }
      for (let round = 0; !signal.aborted; round++) {
        if (!res.ok) {
          setFailure(reviewFailureMessage(res.status));
          return;
        }
        setData(res.data);
        const current = res.data.state.status;
        if (current !== 'queued' && current !== 'running') return;
        if (!(await wait(pollDelay(round), signal))) return;
        res = await api.review(id, signal);
      }
    })();
    return () => controller.abort();
  }, [id, attempt, reload]);

  const review = data?.state.status === 'done' ? data.state.review : null;

  if (failure) {
    return (
      <div className="page">
        <div className="panel page-panel">
          <EmptyState
            icon="♞"
            title={failure}
            action={
              failure === SERVER_UNREACHABLE ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setFailure(null);
                    setReload((r) => r + 1);
                  }}
                >
                  Réessayer
                </Button>
              ) : (
                <Button variant="primary" href="#/analyse">
                  Mes parties analysées
                </Button>
              )
            }
          />
        </div>
      </div>
    );
  }
  if (!data) return <Loading label="Chargement de la revue…" />;
  const { info, state } = data;

  if (state.status !== 'done' || !review) {
    const progress = state.status === 'running' ? Math.round(state.progress * 100) : 0;
    return (
      <div className="page">
        <div className="panel page-panel review-wait" data-testid="review-progress">
          <h2>
            Revue : {info.white} – {info.black}
          </h2>
          {state.status === 'error' ? (
            <>
              <p className="error">L'analyse a échoué.</p>
              <Button variant="primary" onClick={() => setAttempt((a) => a + 1)}>
                Réessayer
              </Button>
            </>
          ) : (
            <>
              <Loading
                inline
                label={
                  state.status === 'running'
                    ? `Analyse Stockfish en cours… ${progress} %`
                    : 'En attente : d’autres parties sont en cours d’analyse…'
                }
              />
              <div className="progress">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return <ReviewBoard reviewId={id} info={info} review={review} guided={guided} />;
}

/** Délai entre deux coups de « Voir la ligne ». */
const LINE_STEP_MS = 700;

const uciArrow = (uci: string, kind: BoardArrow['kind']): BoardArrow => ({
  from: uci.slice(0, 2) as Square,
  to: uci.slice(2, 4) as Square,
  kind,
});

/**
 * Revue terminée : échiquier d'analyse (ligne principale = coups de la partie, variantes
 * libres), précision, courbe d'évaluation, bilan du coach, carte du coup courant.
 */
/** Mode de la revue : libre, guidée (moment clé `index`), ou « Apprends de tes erreurs ». */
type ReviewMode =
  | { kind: 'free' }
  | { kind: 'guided'; index: number }
  | { kind: 'learn'; moves: readonly ReviewMove[]; back: ReviewMode };

function ReviewBoard({
  reviewId,
  info,
  review,
  guided,
}: {
  reviewId: string;
  info: ReviewInfo;
  review: GameReview;
  /** Revue ouverte directement en mode guidé (lien de la fin de partie). */
  guided: boolean;
}) {
  const san = useSan();
  const ctl = useAnalysisTree(
    review.positions[0] ?? '',
    review.moves.map((m, i) => {
      const fen = review.positions[i + 1];
      return fen ? { uci: m.uci, san: m.san, fen } : { uci: m.uci, san: m.san };
    }),
  );
  const { tree, current } = ctl;
  const engineOn = useSettings((s) => s.engine);
  const quizOn = useSettings((s) => s.quiz);
  const updateSettings = useSettings((s) => s.update);
  /** Réponses du quiz : ply du moment → trouvé ou non. */
  const [quizResults, setQuizResults] = useState<Record<number, boolean>>({});
  const [replayLevel, setReplayLevel] = useState(4);
  const [replayError, setReplayError] = useState<string | null>(null);
  /** Premier nœud de la variante créée par « Voir la ligne » (supprimée au retour). */
  const [tempLine, setTempLine] = useState<string | null>(null);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [mode, setMode] = useState<ReviewMode>(() =>
    guided ? { kind: 'guided', index: 0 } : { kind: 'free' },
  );
  /** Case citée dans une explication et survolée : surlignée sur le plateau. */
  const [hoverSquare, setHoverSquare] = useState<Square | null>(null);
  const moments = useMemo(() => keyMoments(review, info.userColor), [review, info.userColor]);
  const learnMoves = useMemo(
    () => (info.userColor ? mistakesOf(review, info.userColor) : []),
    [review, info.userColor],
  );

  const stopLine = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current.clear();
  };
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) clearTimeout(t);
    };
  }, []);

  const lineIds = [tree.rootId, ...tree.initialLine];
  const total = tree.initialLine.length;
  const index = lineIds.indexOf(current);
  const inVariation = index < 0;
  // Dernier coup de la partie avant la variante (curseur de la courbe, retour à la partie).
  const deviation = inVariation
    ? Math.max(0, ...tree.path(current).map((id) => lineIds.indexOf(id)))
    : index;
  const ply = Math.min(deviation, total);
  const setCursor = (p: number) => {
    const id = lineIds[Math.max(0, Math.min(total, p))];
    if (id) ctl.select(id);
  };

  const move = !inVariation && ply > 0 ? review.moves[ply - 1] : undefined;
  const before = ply > 0 ? review.evals[ply - 1] : undefined;
  const here = review.evals[ply];
  const visual = move?.explanation?.visual;

  // Schéma de l'explication s'il existe, sinon le meilleur coup à la place du coup joué.
  let arrows: BoardArrow[] = [];
  let marks: BoardMark[] = [];
  if (move && visual) {
    arrows = visual.arrows;
    marks = visual.marks;
  } else if (move && move.classification !== 'best' && before?.bestMoveUci) {
    arrows = [uciArrow(before.bestMoveUci, 'best')];
  }
  if (hoverSquare) marks = [...marks, { square: hoverSquare, kind: 'target' }];

  const chartMarks = review.moves
    .filter(isError)
    .map((m) => ({ ply: m.ply, cls: m.classification }));
  // Moments clés : erreurs du joueur (ou des deux camps si son camp est inconnu).
  const keyMoves = review.moves.filter(
    (m) => isError(m) && (info.userColor === null || m.color === info.userColor),
  );
  const prevKey = [...keyMoves].reverse().find((m) => m.ply < ply);
  const nextKey = keyMoves.find((m) => m.ply > ply);
  const name = (c: Color) => (c === 'w' ? info.white : info.black);

  /** Entraînement depuis la position d'avant l'erreur, côté du joueur qui s'est trompé. */
  const replay = async (m: ReviewMove) => {
    setReplayError(null);
    const res = await api.createGame({
      mode: 'bot',
      variant: 'classic',
      level: replayLevel,
      color: m.color,
      timeControl: 'untimed',
      training: true,
      fen: review.positions[m.ply - 1],
    });
    if (res) location.hash = `#/game/${res.gameId}`;
    else setReplayError('Connecte-toi pour rejouer contre le bot.');
  };

  /** « Voir la ligne » : la ligne est jouée coup par coup depuis la position d'avant le coup. */
  const showLine = (m: ReviewMove, ucis: readonly string[]) => {
    stopLine();
    const start = lineIds[m.ply - 1];
    if (!start) return;
    ctl.select(start);
    let previous = start;
    let created: string | null = null;
    ucis.forEach((uci, i) => {
      const timer = setTimeout(
        () => {
          timers.current.delete(timer);
          const existed = tree.child(previous, uci) !== null;
          const id = ctl.playFrom(previous, uci);
          if (!id) return stopLine();
          if (!existed && created === null && !lineIds.includes(id)) {
            created = id;
            setTempLine(id);
          }
          previous = id;
          ctl.select(id);
        },
        LINE_STEP_MS * (i + 1),
      );
      timers.current.add(timer);
    });
  };

  const dropTempLine = () => {
    stopLine();
    if (tempLine && tree.has(tempLine)) ctl.remove(tempLine);
    setTempLine(null);
  };
  const backToGame = () => {
    dropTempLine();
    setCursor(deviation);
  };

  // Revue guidée : chaque moment clé place le plateau sur la position après le coup.
  const showMoment = (index: number) => {
    dropTempLine();
    setHoverSquare(null);
    // Bilan : position finale de la partie.
    setCursor(moments[index]?.ply ?? total);
    setMode({ kind: 'guided', index });
  };
  const startGuided = () => showMoment(0);
  // Ouverture en mode guidé : le plateau se place sur le premier moment clé.
  const firstMomentPly = moments[0]?.ply ?? total;
  useEffect(() => {
    if (!guided) return;
    const id = [tree.rootId, ...tree.initialLine][firstMomentPly];
    if (id) ctl.select(id);
    // Une seule fois, à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const exitMode = useCallback(() => {
    setHoverSquare(null);
    setMode((m) => (m.kind === 'learn' ? m.back : { kind: 'free' }));
  }, []);
  const startLearn = (moves: readonly ReviewMove[]) => {
    dropTempLine();
    setHoverSquare(null);
    setMode((m) => ({ kind: 'learn', moves, back: m.kind === 'learn' ? m.back : m }));
  };

  const quizCurrent = mode.kind === 'guided' ? moments[mode.index] : undefined;
  if (
    mode.kind === 'guided' &&
    quizOn &&
    quizCurrent &&
    info.userColor &&
    isQuizMoment(quizCurrent, info.userColor) &&
    quizResults[quizCurrent.ply] === undefined
  ) {
    const score = quizScore(moments, info.userColor, quizResults);
    return (
      <LearnMistakes
        key={quizCurrent.ply}
        reviewId={reviewId}
        review={review}
        moves={[quizCurrent.move]}
        orientation={info.userColor}
        quiz={{
          progress: `${mode.index + 1} / ${moments.length}`,
          score: `Quiz : ${score.found}/${score.total} trouvés`,
          onAnswered: (found) => setQuizResults((r) => ({ ...r, [quizCurrent.ply]: found })),
        }}
        onExit={exitMode}
      />
    );
  }

  if (mode.kind === 'learn') {
    return (
      <LearnMistakes
        reviewId={reviewId}
        review={review}
        moves={mode.moves}
        orientation={info.userColor ?? mode.moves[0]?.color ?? 'w'}
        onExit={exitMode}
      />
    );
  }

  const accuracyCard = (c: Color) => (
    <div className="accuracy-card" data-testid={`accuracy-${c}`} key={c}>
      <span className="muted">
        {name(c)} ({SIDE[c]})
      </span>
      <strong>{review.accuracy[c] === null ? '—' : `${review.accuracy[c]} %`}</strong>
      <span className="counts">
        {(['blunder', 'mistake', 'inaccuracy'] as const).map((cls) => (
          <span key={cls} className={`class-count ${classCss(cls)}`} title={CLASS_LABEL[cls]}>
            {review.counts[c][cls]} {CLASS_SYMBOL[cls]}
          </span>
        ))}
      </span>
    </div>
  );

  const node = tree.get(current);
  const label = tree.moveLabel(current);
  const card = inVariation ? (
    <div className="move-card variation-card" data-testid="move-card">
      <p>
        <Badge>Variante</Badge>{' '}
        <strong>
          {label.number}
          {label.color === 'w' ? '.' : '…'} {san(node.san ?? '')}
        </strong>
      </p>
      <p className="muted">
        Tu explores une autre suite que celle de la partie.
        {!engineOn && ' Active le moteur pour l’évaluer.'}
      </p>
      <Button size="s" variant="primary" data-testid="back-to-game" onClick={backToGame}>
        <IconBack size={16} />
        Revenir à la partie
      </Button>
    </div>
  ) : (
    <div className="move-card" data-testid="move-card">
      {move ? (
        <>
          <p>
            <strong>
              {Math.ceil(move.ply / 2)}
              {move.color === 'w' ? '.' : '…'} {san(move.san)}
            </strong>{' '}
            <span className={`class-badge ${classCss(move.classification)}`}>
              {CLASS_LABEL[move.classification]}
            </span>{' '}
            <span className="muted">({evalLabel(here)})</span>
            {info.clocks?.[move.ply - 1] != null && (
              <span className="muted" data-testid="move-clock">
                {' '}
                · {formatMoveClock(info.clocks[move.ply - 1] ?? 0)} à la pendule
              </span>
            )}
          </p>
          {move.explanation && (
            <p data-testid="explanation">
              <ExplainText
                text={move.explanation.text}
                onSquare={(sq) => setHoverSquare(sq as Square | null)}
              />
            </p>
          )}
          {visual?.line && visual.line.length > 0 && (
            <Button
              size="s"
              data-testid="show-line"
              onClick={() => showLine(move, visual.line ?? [])}
            >
              <IconPlay size={16} />
              Voir la ligne
            </Button>
          )}
          {isError(move) && (info.userColor === null || move.color === info.userColor) && (
            <div className="replay">
              <Button size="s" data-testid="replay" onClick={() => void replay(move)}>
                <IconRetry size={16} />
                Rejouer d'ici contre le bot
              </Button>
              <select
                value={replayLevel}
                aria-label="Niveau du bot"
                onChange={(e) => setReplayLevel(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((l) => (
                  <option key={l} value={l}>
                    Niveau {l}
                  </option>
                ))}
              </select>
              {replayError && <span className="error"> {replayError}</span>}
            </div>
          )}
          {move.classification !== 'best' &&
            move.explanation?.kind !== 'generic' &&
            before?.bestMoveSan && (
              <p className="muted">
                Meilleur : <span className="best-move">{san(before.bestMoveSan)}</span>
              </p>
            )}
        </>
      ) : (
        <p className="muted">
          Position initiale. Utilise ◀ ▶ (ou les flèches du clavier) pour parcourir la partie, et
          joue un coup sur l'échiquier pour explorer une variante.
        </p>
      )}
    </div>
  );

  const chart = (
    <EvalChart evals={review.evals} cursor={ply} onSelect={setCursor} marks={chartMarks} />
  );

  if (mode.kind === 'guided') {
    return (
      <AnalysisBoard
        controller={ctl}
        evals={review.evals}
        moveClasses={review.moves.map((m) => m.classification)}
        orientation={info.userColor ?? 'w'}
        arrows={arrows}
        marks={marks}
        lockMainline
        guided
        names={{ w: info.white, b: info.black }}
        panelTop={
          <GuidedPanel
            info={info}
            review={review}
            moments={moments}
            index={mode.index}
            onIndex={showMoment}
            onSquare={(sq) => setHoverSquare(sq as Square | null)}
            {...(quizOn && info.userColor
              ? {
                  quiz: {
                    score: quizScore(moments, info.userColor, quizResults),
                    result: moments[mode.index] ? quizResults[moments[mode.index]!.ply] : undefined,
                  },
                }
              : {})}
            onShowLine={(m, line) => showLine(m, line)}
            onRetry={(m) => startLearn([m])}
            onLearn={() => startLearn(learnMoves)}
            onExit={() => {
              dropTempLine();
              exitMode();
            }}
            chart={chart}
          />
        }
      />
    );
  }

  return (
    <AnalysisBoard
      controller={ctl}
      evals={review.evals}
      moveClasses={review.moves.map((m) => m.classification)}
      {...(info.clocks ? { clocks: info.clocks } : {})}
      orientation={info.userColor ?? 'w'}
      arrows={arrows}
      marks={marks}
      lockMainline
      names={{ w: info.white, b: info.black }}
      panelTop={
        <>
          <div className="turn-banner">
            {info.white} – {info.black} · {info.result}
            <Badge>{VARIANT_LABEL[info.variant]}</Badge>
            <Badge>{SOURCE_LABEL[info.source]}</Badge>
          </div>
          {info.url && (
            <a className="muted" href={info.url} target="_blank" rel="noreferrer">
              Voir la partie d'origine
            </a>
          )}
          <div className="mode-launch">
            <Button variant="primary" data-testid="start-guided" onClick={startGuided}>
              <IconPlay size={18} />
              Revue guidée
            </Button>
            <Button
              data-testid="start-learn"
              disabled={info.userColor === null}
              title={
                info.userColor === null
                  ? 'Camp inconnu dans cette partie'
                  : 'Rejoue tes erreurs et gaffes'
              }
              onClick={() => startLearn(learnMoves)}
            >
              <IconTarget size={18} />
              Apprends de tes erreurs
            </Button>
            <label
              className="quiz-toggle"
              title={
                info.userColor === null
                  ? 'Camp inconnu dans cette partie'
                  : 'Devine ton coup avant l’explication du coach'
              }
            >
              <input
                type="checkbox"
                data-testid="quiz-toggle"
                checked={quizOn && info.userColor !== null}
                disabled={info.userColor === null}
                onChange={(e) => updateSettings({ quiz: e.target.checked })}
              />
              Mode quiz
            </label>
          </div>
          <div className="accuracy-row">{(['w', 'b'] as const).map(accuracyCard)}</div>
          {chart}
          {card}
          <div className="nav">
            <button
              disabled={!prevKey}
              onClick={() => prevKey && setCursor(prevKey.ply)}
              title="Erreur précédente"
            >
              ◀ !?
            </button>
            <button
              disabled={!nextKey}
              data-testid="next-mistake"
              onClick={() => nextKey && setCursor(nextKey.ply)}
              title="Erreur suivante"
            >
              !? ▶
            </button>
          </div>
        </>
      }
      panelBottom={
        info.userColor && (
          <>
            <RepertoireNote
              moves={review.moves.map((m) => m.san)}
              color={info.userColor}
              initialFen={review.positions[0]}
              onSelect={setCursor}
            />
            <CoachSummary moves={review.moves} color={info.userColor} onSelect={setCursor} />
          </>
        )
      }
    />
  );
}
