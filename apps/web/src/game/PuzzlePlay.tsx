import { useEffect, useRef, useState } from 'react';
import type { DisplayedPiece, LegalMove, PuzzleAttempt, PuzzleStep, Square } from '@sq/shared';
import { api } from '../lib/api';
import { carryIds, piecesFromFen } from '../lib/fen';
import { useBoardHistory, useNavKeys } from '../lib/navKeys';
import { useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';
import { applyLocalMoves, type LocalMove } from '../lib/virtual';
import { Board } from './Board';

const SETUP_DELAY = 400;
const STEP_DELAY = 400;
const SOLUTION_STEP = 650;

export interface PuzzleOutcome {
  success: boolean;
}

/**
 * Un puzzle à jouer (entraînement rapide : contre la montre, Woodpecker) : coup adverse animé,
 * coups validés par le serveur, solution rejouée après un échec (`showSolution`). À remonter
 * avec une `key` par tentative. ← → ↑ ↓ : revoir les positions.
 */
export function PuzzlePlay(props: {
  attempt: PuzzleAttempt;
  onDone: (outcome: PuzzleOutcome) => void;
  showSolution?: boolean;
  /** Plateau figé (temps écoulé) : plus aucun coup. */
  frozen?: boolean;
}) {
  const { attempt } = props;
  const showLegalMoves = useSettings((s) => s.showLegalMoves);
  const [pieces, setPieces] = useState<DisplayedPiece[]>(() => piecesFromFen(attempt.fenBefore));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [legal, setLegal] = useState<LegalMove[]>(attempt.legalMoves);
  const [phase, setPhase] = useState<'setup' | 'playing' | 'busy' | 'done'>('setup');
  const [pending, setPending] = useState<LocalMove | null>(null);
  const [flash, setFlash] = useState<{
    square: Square;
    tone: 'success' | 'error';
    id: number;
  } | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const apply = (step: PuzzleStep) => {
    setPieces((prev) => carryIds(prev, piecesFromFen(step.fen), step.uci));
    setLastMove({ from: step.uci.slice(0, 2) as Square, to: step.uci.slice(2, 4) as Square });
  };

  // Coup adverse qui lance le puzzle.
  useEffect(() => {
    const t = setTimeout(() => {
      apply(attempt.setup);
      setPhase('playing');
    }, SETUP_DELAY);
    const pendingTimers = timers.current;
    return () => {
      clearTimeout(t);
      for (const id of pendingTimers) clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une fois par tentative (clé)
  }, []);

  const onMove = async (move: LocalMove) => {
    if (phase !== 'playing' || props.frozen) return;
    setPhase('busy');
    setPending(move);
    const res = await api.puzzleMove(
      attempt.attemptId,
      `${move.from}${move.to}${move.promotion ?? ''}`,
    );
    setPending(null);
    if (!res || res.status === 'illegal') {
      setPhase('playing');
      return;
    }
    const failed = res.status === 'failed';
    setFlash((f) => ({
      square: move.to,
      tone: failed ? 'error' : 'success',
      id: (f?.id ?? 0) + 1,
    }));
    if (failed) {
      playSound('failure');
      setPhase('done');
      if (props.showSolution) {
        (res.solution ?? []).forEach((s, i) => later(() => apply(s), SOLUTION_STEP * (i + 1)));
      }
      props.onDone({ success: false });
      return;
    }
    const [mine, reply] = res.steps;
    if (mine) apply(mine);
    const finish = () => {
      setLegal(res.legalMoves);
      if (res.status === 'solved') {
        playSound('success');
        setPhase('done');
        props.onDone({ success: true });
      } else setPhase('playing');
    };
    if (reply) {
      later(() => {
        apply(reply);
        finish();
      }, STEP_DELAY);
    } else finish();
  };

  const history = useBoardHistory({ pieces, lastMove }, attempt.attemptId);
  useNavKeys(history.nav);
  const live = history.isLive;
  const playing = phase === 'playing' && !props.frozen && live;

  return (
    <Board
      pieces={live ? applyLocalMoves(pieces, pending ? [pending] : []) : history.frame.pieces}
      orientation={attempt.color}
      movable={playing ? attempt.color : null}
      legalMoves={showLegalMoves && playing ? legal : null}
      lastMove={history.frame.lastMove}
      flash={live ? flash : null}
      onMove={(from, to, promotion) =>
        void onMove(promotion ? { from, to, promotion } : { from, to })
      }
    />
  );
}
