import { useCallback, useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import type { Color, DisplayedPiece, LegalMove, PuzzleStep, Square } from '@sq/shared';
import { Board } from '../game/Board';
import { usePremoves } from '../game/usePremoves';
import { carryIds, piecesFromFen } from '../lib/fen';
import { useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';
import { useStreak } from '../lib/streak';
import { applyLocalMoves, type LocalMove } from '../lib/virtual';
import { BoardLayout } from '../ui/BoardLayout';
import { SideBadge } from '../ui/SideBadge';
import { Button } from '../ui/Button';

/**
 * Lecteur d'exercices commun (leçons, et demain finales, calcul, examens) : il affiche la
 * position et la consigne, relaie les réponses au jugement du serveur (callbacks asynchrones) et
 * rend les indices progressifs, le retour et l'explication. Il ne connaît aucune règle d'échecs.
 */

/** Description d'un exercice, indépendante de sa source. */
export interface ExerciseSpec {
  /** `move` : trouve le coup ; `choice` : QCM ; `squares` : désigne les cases. */
  kind: 'move' | 'choice' | 'squares';
  fen: string;
  /** Camp qui joue (plateau orienté de son côté). */
  color: Color;
  prompt: string;
  /** Nombre d'indices progressifs disponibles (0 à 3). */
  hints: number;
  /** `move` : coups jouables au départ. */
  legalMoves?: LegalMove[];
  /** `choice` : libellés des réponses proposées. */
  choices?: string[];
}

/** Réponse envoyée au jugement. */
export type ExerciseAnswer =
  | { kind: 'move'; step: number; uci: string }
  | { kind: 'squares'; squares: Square[] }
  | { kind: 'choice'; choice: number };

/** Verdict du serveur. `illegal` : coup refusé, la pièce revient (sans motif). */
export interface ExerciseVerdict {
  status: 'continue' | 'solved' | 'failed' | 'illegal';
  /** `move` : mon coup, puis la réplique éventuelle. */
  steps?: PuzzleStep[];
  legalMoves?: LegalMove[];
  /** `move` : solution à rejouer après un échec. */
  solution?: PuzzleStep[] | null;
  /** `squares` : bonnes cases ; `choice` : indice de la bonne réponse (après un échec). */
  correct?: Square[] | number | null;
  explanation: string | null;
}

export interface ExercisePlayerProps {
  spec: ExerciseSpec;
  /** Juge une réponse ; `hintsUsed` = indices consultés avant elle. `null` : serveur injoignable. */
  judge: (answer: ExerciseAnswer, hintsUsed: number) => Promise<ExerciseVerdict | null>;
  /** Texte de l'indice de niveau 1 à 3. */
  hint: (level: number) => Promise<string | null>;
  /** Appelé une fois, à la fin de l'exercice ; `firstTry` : réussi sans erreur ni indice. */
  onDone: (firstTry: boolean) => void;
  /** Panneau latéral : en-tête (retour, titre) et suite (bouton suivant). */
  header: ReactNode;
  footer: ReactNode;
}

/** Indices progressifs : textes cumulés, demandés un à un. */
function useHints(hint: ExercisePlayerProps['hint'], available: number) {
  const [texts, setTexts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const ask = useCallback(async () => {
    if (loading || texts.length >= available) return;
    setLoading(true);
    const text = await hint(texts.length + 1);
    setLoading(false);
    if (text !== null) setTexts((t) => (t.length === texts.length ? [...t, text] : t));
  }, [loading, texts.length, available, hint]);
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

type Phase = 'playing' | 'solved' | 'failed';

/** Cartouche de retour (réussi, raté, explication). */
function Status(props: {
  phase: Phase;
  playing: ReactNode;
  failed: ReactNode;
  explanation: string | null;
}) {
  const { phase } = props;
  return (
    <div className={`move-card puzzle-status ${phase}`} data-testid="exercise-status">
      {phase === 'playing' && props.playing}
      {phase === 'solved' && <p className="win">✓ Réussi !</p>}
      {phase === 'failed' && props.failed}
      {props.explanation && <p data-testid="exercise-explanation">{props.explanation}</p>}
    </div>
  );
}

/** Exercice « désigne les cases » : sélection multiple, validation par le serveur. */
function SquaresExercise(props: ExercisePlayerProps) {
  const { spec } = props;
  const [picked, setPicked] = useState<Square[]>([]);
  const [phase, setPhase] = useState<Phase>('playing');
  const [correct, setCorrect] = useState<Square[]>([]);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const record = useStreak((s) => s.record);
  const hints = useHints(props.hint, spec.hints);
  const playing = phase === 'playing';

  const toggle = (sq: Square) => {
    if (!playing || busy) return;
    setPicked((p) => (p.includes(sq) ? p.filter((x) => x !== sq) : p.length < 8 ? [...p, sq] : p));
  };
  const validate = async () => {
    if (!playing || busy || picked.length === 0) return;
    setBusy(true);
    const res = await props.judge({ kind: 'squares', squares: picked }, hints.texts.length);
    setBusy(false);
    if (!res) return;
    setExplanation(res.explanation);
    const ok = res.status === 'solved';
    setCorrect(Array.isArray(res.correct) ? res.correct : []);
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
      toPlay={<SideBadge color={spec.color} />}
      board={
        <Board
          pieces={piecesFromFen(spec.fen)}
          orientation={spec.color}
          movable={null}
          onSquareClick={toggle}
          squareMarks={marks}
        />
      }
      side={
        <>
          {props.header}
          <p>
            <strong>{spec.prompt}</strong>
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
            <Status
              phase={phase}
              playing={null}
              failed={
                <p className="loss">✗ Pas tout à fait. Les bonnes cases sont marquées en vert.</p>
              }
              explanation={explanation}
            />
          )}
          {props.footer}
        </>
      }
    />
  );
}

/** Exercice à choix multiple : plateau fixe, une réponse à cliquer. */
function ChoiceExercise(props: ExercisePlayerProps) {
  const { spec } = props;
  const [phase, setPhase] = useState<Phase>('playing');
  const [chosen, setChosen] = useState<number | null>(null);
  const [right, setRight] = useState<number | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const record = useStreak((s) => s.record);
  const hints = useHints(props.hint, spec.hints);
  const playing = phase === 'playing';

  const answer = async (choice: number) => {
    if (!playing || busy) return;
    setBusy(true);
    setChosen(choice);
    const res = await props.judge({ kind: 'choice', choice }, hints.texts.length);
    setBusy(false);
    if (!res || res.status === 'illegal' || res.status === 'continue') {
      setChosen(null);
      return;
    }
    const ok = res.status === 'solved';
    setRight(ok ? choice : typeof res.correct === 'number' ? res.correct : null);
    setExplanation(res.explanation);
    setPhase(ok ? 'solved' : 'failed');
    playSound(ok ? 'success' : 'failure');
    record(ok);
    props.onDone(ok && hints.texts.length === 0);
  };

  return (
    <BoardLayout
      className="exercise"
      testId="exercises"
      toPlay={<SideBadge color={spec.color} />}
      board={<Board pieces={piecesFromFen(spec.fen)} orientation={spec.color} movable={null} />}
      side={
        <>
          {props.header}
          <p>
            <strong>{spec.prompt}</strong>
          </p>
          <div className="choice-list" role="group" aria-label="Réponses">
            {(spec.choices ?? []).map((label, i) => (
              <Button
                key={i}
                variant={
                  right === i
                    ? 'primary'
                    : chosen === i && phase === 'failed'
                      ? 'outline'
                      : 'secondary'
                }
                disabled={!playing || busy}
                aria-pressed={chosen === i}
                onClick={() => void answer(i)}
                data-testid={`choice-${i}`}
              >
                {label}
              </Button>
            ))}
          </div>
          <HintPanel hints={hints} active={playing} />
          {!playing && (
            <Status
              phase={phase}
              playing={null}
              failed={<p className="loss">✗ Ce n'est pas ça. La bonne réponse est en évidence.</p>}
              explanation={explanation}
            />
          )}
          {props.footer}
        </>
      }
    />
  );
}

/** Un exercice « trouve le coup » : le serveur valide chaque coup. */
function MoveExercise(props: ExercisePlayerProps) {
  const { spec } = props;
  const showLegalMoves = useSettings((s) => s.showLegalMoves);
  const [pieces, setPieces] = useState<DisplayedPiece[]>(() => piecesFromFen(spec.fen));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [legal, setLegal] = useState<LegalMove[]>(spec.legalMoves ?? []);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('playing');
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
  const hints = useHints(props.hint, spec.hints);
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
    const res = await props.judge(
      { kind: 'move', step, uci: `${move.from}${move.to}${move.promotion ?? ''}` },
      hints.texts.length,
    );
    setPending(null);
    if (!res || res.status === 'illegal') {
      // Coup (ou premove) refusé : la pièce revient, les premoves suivants sont annulés.
      queue.clear();
      setBusy(false);
      refused.current += 1;
      if (refused.current === 2 && hints.texts.length === 0 && spec.hints > 0) {
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
    const [mine, reply] = res.steps ?? [];
    if (mine) apply(mine);
    const finish = () => {
      setLegal(res.legalMoves ?? []);
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
      toPlay={<SideBadge color={spec.color} />}
      board={
        <Board
          pieces={applyLocalMoves(pieces, [...(pending ? [pending] : []), ...queue.premoves])}
          orientation={spec.color}
          movable={playable ? spec.color : null}
          premoveColor={premoveOn && phase === 'playing' && busy ? spec.color : null}
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
            <strong>{spec.prompt}</strong>
          </p>
          <Status
            phase={phase}
            playing={<p>{progress ? '✓ Bien vu ! Continue.' : 'À toi de jouer.'}</p>}
            failed={<p className="loss">✗ Ce n'est pas ça. Voici la solution.</p>}
            explanation={explanation}
          />
          <HintPanel hints={hints} active={phase === 'playing'} />
          {props.footer}
        </>
      }
    />
  );
}

/** Lecteur d'exercices : choisit l'écran selon le format. À remonter avec une `key` par exercice. */
export function ExercisePlayer(props: ExercisePlayerProps) {
  if (props.spec.kind === 'squares') return <SquaresExercise {...props} />;
  if (props.spec.kind === 'choice') return <ChoiceExercise {...props} />;
  return <MoveExercise {...props} />;
}
