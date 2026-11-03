import { useEffect, useRef, useState } from 'react';
import type { BoardArrow, Color, GameReview, ReviewMove, Square } from '@sq/shared';
import { morphPieces } from '../analysis/pieces';
import { AnalysisTree } from '../analysis/tree';
import { Board, type BoardMark } from '../game/Board';
import { api } from '../lib/api';
import { CLASS_LABEL, CLASS_SYMBOL, classCss } from '../lib/classes';
import { piecesFromFen } from '../lib/fen';
import { playSound } from '../lib/sound';
import { useSan } from '../lib/notation';
import { BoardLayout } from '../ui/BoardLayout';
import { Button } from '../ui/Button';
import { IconBulb, IconNext, IconRetry } from '../ui/icons';
import { ModeBanner } from './ModeBanner';

/** Délai entre deux demi-coups de la réfutation, puis avant le retour à la position. */
export const REFUTATION_STEP_MS = 650;
export const REFUTATION_PAUSE_MS = 900;
/** Longueur de la réfutation montrée après un coup faux (demi-coups, coup proposé exclu). */
const REFUTATION_PLIES = 3;
/** Mode quiz : durée d'affichage du verdict « bien joué » avant la révélation du coach. */
const QUIZ_PAUSE_MS = 1100;

type Phase = 'play' | 'checking' | 'right' | 'wrong';
/** Bilan d'une position : trouvée du premier coup, trouvée ensuite, ou ratée / passée. */
type Outcome = 'first' | 'later' | 'missed';

interface Feedback {
  tone: 'ok' | 'bad' | 'info';
  text: string;
}

const moveNumber = (m: ReviewMove) => `${Math.ceil(m.ply / 2)}${m.color === 'w' ? '' : ' (Noirs)'}`;

/**
 * « Apprends de tes erreurs » : pour chaque erreur ou gaffe, la position AVANT le coup, orientée
 * du côté du joueur ; il propose un autre coup, jugé par le serveur (`best` / `good` / `wrong`).
 * Coup faux : la réfutation est jouée (3 demi-coups au plus) puis la position revient.
 */
export function LearnMistakes(props: {
  reviewId: string;
  review: GameReview;
  /** Positions à retravailler (coups joués à remplacer), dans l'ordre. */
  moves: readonly ReviewMove[];
  orientation: Color;
  onExit: () => void;
  /**
   * Mode quiz : une seule position, sans rappel du coup joué ni solution ; la réponse (juste,
   * fausse ou « Je ne sais pas ») est rendue au parent, qui révèle ensuite le coach.
   */
  quiz?: { progress: string; score: string; onAnswered: (found: boolean) => void };
}) {
  const { quiz } = props;
  const { review, moves } = props;
  const san = useSan();
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const move = moves[index];
  const startFen = move ? (review.positions[move.ply - 1] ?? '') : '';
  const best = move ? review.evals[move.ply - 1] : undefined;

  const [fen, setFen] = useState(startFen);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [phase, setPhase] = useState<Phase>('play');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  /** Coup faux, indice ou solution : la position ne compte plus « du premier coup ». */
  const [tainted, setTainted] = useState(false);
  const [hint, setHint] = useState(false);
  const [solution, setSolution] = useState(false);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  /** Incrémenté à chaque changement d'exercice : les réponses en retard sont ignorées. */
  const session = useRef(0);

  const clearTimers = () => {
    for (const t of timers.current) clearTimeout(t);
    timers.current.clear();
  };
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) clearTimeout(t);
    };
  }, []);
  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.current.delete(t);
      fn();
    }, ms);
    timers.current.add(t);
  };

  // Pièces affichées : identifiants conservés d'une position à l'autre (animation des coups).
  const [display, setDisplay] = useState(() => ({ fen, pieces: piecesFromFen(fen) }));
  let pieces = display.pieces;
  if (display.fen !== fen) {
    pieces = morphPieces(display.pieces, piecesFromFen(fen));
    setDisplay({ fen, pieces });
  }

  const goTo = (next: number) => {
    clearTimers();
    session.current++;
    const m = moves[next];
    setIndex(next);
    setFen(m ? (review.positions[m.ply - 1] ?? '') : '');
    setLastMove(null);
    setPhase('play');
    setFeedback(null);
    setTainted(false);
    setHint(false);
    setSolution(false);
  };
  const record = (outcome: Outcome) =>
    setOutcomes((o) => {
      const copy = [...o];
      copy[index] = outcome;
      return copy;
    });
  const restart = () => {
    setOutcomes([]);
    goTo(0);
  };

  const sound = (san: string) =>
    playSound(/[+#]/.test(san) ? 'check' : san.includes('x') ? 'capture' : 'move');
  const squaresOf = (uci: string) => ({
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
  });

  const onMove = (from: Square, to: Square, promotion?: string) => {
    if (!move || phase !== 'play') return;
    const uci = `${from}${to}${promotion ?? ''}`;
    // Coups légaux calculés localement (position publique d'une partie terminée).
    const tree = new AnalysisTree(startFen);
    const id = tree.play(tree.rootId, uci);
    if (!id) return playSound('illegal');
    const played = tree.get(id);
    setFen(played.fen);
    setLastMove({ from, to });
    sound(played.san ?? '');
    setPhase('checking');
    setFeedback(null);
    const token = session.current;
    void api.retryMove(props.reviewId, move.ply, played.uci ?? uci).then((res) => {
      // L'exercice a changé entre-temps (Passer, Recommencer) : réponse ignorée.
      if (session.current !== token) return;
      if (!res) {
        setFen(startFen);
        setLastMove(null);
        setPhase('play');
        setFeedback({ tone: 'info', text: 'Le moteur ne répond pas : réessaie dans un instant.' });
        return;
      }
      if (res.verdict !== 'wrong') {
        playSound('start');
        setFen(res.fen);
        setPhase('right');
        record(tainted ? 'later' : 'first');
        const preferred =
          res.verdict === 'good' && best?.bestMoveSan && best.bestMoveSan !== res.san
            ? ` Le moteur préférait ${san(best.bestMoveSan)}.`
            : '';
        setFeedback({ tone: 'ok', text: `✓ Bien joué : ${san(res.san)}.${preferred}` });
        if (quiz) later(() => quiz.onAnswered(true), QUIZ_PAUSE_MS);
        return;
      }
      setTainted(true);
      setPhase('wrong');
      setFeedback({ tone: 'bad', text: `✗ Pas mieux : ${san(res.san)}. Regarde la réponse…` });
      const ids = tree.playLine(id, res.line.slice(0, REFUTATION_PLIES));
      ids.forEach((nodeId, i) => {
        later(
          () => {
            const node = tree.get(nodeId);
            setFen(node.fen);
            if (node.uci) setLastMove(squaresOf(node.uci));
            sound(node.san ?? '');
          },
          REFUTATION_STEP_MS * (i + 1),
        );
      });
      later(
        () => {
          if (quiz) return quiz.onAnswered(false);
          setFen(startFen);
          setLastMove(null);
          setPhase('play');
          setFeedback({ tone: 'bad', text: `✗ ${san(res.san)} n'est pas mieux. Cherche encore.` });
        },
        REFUTATION_STEP_MS * ids.length + REFUTATION_PAUSE_MS,
      );
    });
  };

  const total = moves.length;
  const finished = index >= total;
  const found = outcomes.filter((o) => o === 'first').length;

  const banner = (
    <ModeBanner
      title={quiz ? 'Mode quiz' : 'Apprends de tes erreurs'}
      progress={quiz ? quiz.progress : finished ? `${total} / ${total}` : `${index + 1} / ${total}`}
      onExit={props.onExit}
    />
  );

  if (total === 0 || finished || !move) {
    return (
      <BoardLayout
        className="review learn-mode"
        testId="learn-mode"
        board={<Board pieces={pieces} orientation={props.orientation} movable={null} />}
        side={
          <>
            {banner}
            <div className="move-card learn-card" data-testid="learn-summary">
              {total === 0 ? (
                <p>Aucune erreur ni gaffe à retravailler dans cette partie : bravo !</p>
              ) : (
                <>
                  <p className="learn-score">
                    Trouvés du premier coup : <strong data-testid="learn-score">{found}</strong> /{' '}
                    {total}
                  </p>
                  <p className="muted">
                    Les positions ratées reviennent dans tes puzzles « Mes erreurs ».
                  </p>
                </>
              )}
            </div>
            <div className="actions">
              {total > 0 && (
                <Button onClick={restart}>
                  <IconRetry size={18} />
                  Recommencer
                </Button>
              )}
              <Button href="#/puzzles/mine">Mes erreurs</Button>
              <Button variant="primary" onClick={props.onExit}>
                Retour à la revue
              </Button>
            </div>
          </>
        }
      />
    );
  }

  const bestUci = best?.bestMoveUci ?? null;
  const arrows: BoardArrow[] =
    solution && bestUci && phase !== 'right' ? [{ ...squaresOf(bestUci), kind: 'best' }] : [];
  const marks: BoardMark[] =
    hint && bestUci && phase === 'play'
      ? [{ square: squaresOf(bestUci).from, kind: 'target' }]
      : [];

  // Solution : meilleur coup et suite du moteur, en SAN (4 demi-coups).
  let solutionSan: string[] = [];
  if (solution && bestUci) {
    const tree = new AnalysisTree(startFen);
    const line = best?.pv && best.pv.length > 0 ? best.pv : [bestUci];
    solutionSan = tree.playLine(tree.rootId, line.slice(0, 4)).map((id) => tree.get(id).san ?? '');
  }

  const showHint = () => {
    setHint(true);
    setTainted(true);
  };
  const showSolution = () => {
    setSolution(true);
    setTainted(true);
  };
  const next = () => {
    if (phase !== 'right') record('missed');
    goTo(index + 1);
  };
  const shown = new AnalysisTree(fen);
  const checkSquare = shown.checkSquare(shown.rootId);

  return (
    <BoardLayout
      className="review learn-mode"
      testId="learn-mode"
      board={
        <Board
          pieces={pieces}
          orientation={props.orientation}
          movable={phase === 'play' ? move.color : null}
          onMove={onMove}
          lastMove={lastMove}
          checkSquare={checkSquare}
          arrows={arrows}
          squareMarks={marks}
        />
      }
      side={
        <>
          {banner}
          <div className="move-card learn-card" data-testid="learn-card">
            {quiz && (
              <p className="muted" data-testid="quiz-score">
                {quiz.score}
              </p>
            )}
            {!quiz && (
              <p className="muted learn-context">
                Coup {moveNumber(move)} — tu as joué{' '}
                <strong>
                  {san(move.san)} {CLASS_SYMBOL[move.classification]}
                </strong>{' '}
                <span className={`class-badge ${classCss(move.classification)}`}>
                  {CLASS_LABEL[move.classification]}
                </span>
              </p>
            )}
            <p className="learn-prompt" data-testid="learn-prompt">
              {quiz ? (
                <>
                  Quel coup jouerais-tu ici ?
                  {move.color === 'w' ? ' (Blancs au trait)' : ' (Noirs au trait)'}
                </>
              ) : (
                <>
                  Trouve un meilleur coup que <strong>{san(move.san)}</strong>
                  {move.color === 'w' ? ' (Blancs au trait)' : ' (Noirs au trait)'}.
                </>
              )}
            </p>
            {phase === 'checking' && <p className="muted">Vérification…</p>}
            {feedback && (
              <p className={`learn-feedback ${feedback.tone}`} data-testid="learn-feedback">
                {feedback.text}
              </p>
            )}
            {hint && phase === 'play' && !solution && (
              <p className="muted" data-testid="learn-hint">
                Indice : joue la pièce marquée.
              </p>
            )}
            {solution && solutionSan.length > 0 && (
              <p data-testid="learn-solution">
                Solution : <strong className="best-move">{san(solutionSan[0] ?? '')}</strong>
                {solutionSan.length > 1 && (
                  <span className="muted"> puis {solutionSan.slice(1).map(san).join(' ')}</span>
                )}
              </p>
            )}
          </div>
          <div className="actions">
            {quiz ? (
              <>
                <Button
                  data-testid="learn-hint-button"
                  disabled={phase !== 'play' || hint || !bestUci}
                  onClick={showHint}
                >
                  <IconBulb size={18} />
                  Indice
                </Button>
                <Button
                  data-testid="quiz-skip"
                  disabled={phase !== 'play'}
                  onClick={() => quiz.onAnswered(false)}
                >
                  Je ne sais pas
                  <IconNext size={18} />
                </Button>
              </>
            ) : phase === 'right' ? (
              <Button variant="primary" data-testid="learn-next" onClick={next}>
                {index + 1 < total ? 'Suivant' : 'Voir le score'}
                {index + 1 < total && <IconNext size={18} />}
              </Button>
            ) : (
              <>
                <Button
                  data-testid="learn-hint-button"
                  disabled={phase !== 'play' || hint || solution || !bestUci}
                  onClick={showHint}
                >
                  <IconBulb size={18} />
                  Indice
                </Button>
                <Button
                  data-testid="learn-solution-button"
                  disabled={phase !== 'play' || solution || !bestUci}
                  onClick={showSolution}
                >
                  Voir la solution
                </Button>
                <Button data-testid="learn-skip" onClick={next}>
                  Passer
                  <IconNext size={18} />
                </Button>
              </>
            )}
          </div>
          {!quiz && (
            <p className="muted learn-note">
              Les positions ratées reviennent dans tes puzzles « Mes erreurs ».
            </p>
          )}
        </>
      }
    />
  );
}
