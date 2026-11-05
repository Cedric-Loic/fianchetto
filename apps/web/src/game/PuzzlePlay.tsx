import { useEffect, useEffectEvent, useRef, useState } from 'react';
import type { DisplayedPiece, LegalMove, PuzzleAttempt, PuzzleStep, Square } from '@sq/shared';
import { api } from '../lib/api';
import { carryIds, piecesFromFen } from '../lib/fen';
import { useBoardHistory, useNavKeys } from '../lib/navKeys';
import { useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';
import { applyLocalMoves, type LocalMove } from '../lib/virtual';
import { Board } from './Board';
import { usePremoves } from './usePremoves';

const SETUP_DELAY = 500;
const STEP_DELAY = 450;
const SOLUTION_STEP = 700;

export interface PuzzleResult {
  success: boolean;
  /** Variation du classement puzzle (puzzle classé), sinon `null`. */
  rating: { before: number; after: number } | null;
  /** Après un échec : la solution depuis la position courante. */
  solution: PuzzleStep[];
}

/**
 * Un puzzle à jouer, commun aux puzzles, au contre-la-montre et à Woodpecker : coup adverse
 * animé, coups validés par le serveur (seul juge), premoves facultatifs, solution rejouée après un
 * échec quand `showSolution` est vrai. À remonter avec une `key` par tentative.
 * ← → ↑ ↓ : revoir les positions (le plateau n'est jouable qu'au présent).
 */
export function PuzzlePlay(props: {
  attempt: PuzzleAttempt;
  onDone: (result: PuzzleResult) => void;
  /** Rejouer la solution sur le plateau après un échec (peut devenir vrai plus tard). */
  showSolution?: boolean;
  /** Plateau figé (temps écoulé) : plus aucun coup. */
  frozen?: boolean;
  /** Case surlignée (indice : pièce à jouer). */
  hint?: Square | null;
  /** Premoves autorisés (si le réglage est actif). */
  premoves?: boolean;
  /** Bon coup, puzzle pas terminé. */
  onProgress?: () => void;
  /** Le plateau attend (coup adverse, réponse du serveur) ou redevient jouable. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const { attempt } = props;
  const showLegalMoves = useSettings((s) => s.showLegalMoves);
  const premoveSetting = useSettings((s) => s.premoves);
  const [pieces, setPieces] = useState<DisplayedPiece[]>(() => piecesFromFen(attempt.fenBefore));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [legal, setLegal] = useState<LegalMove[]>(attempt.legalMoves);
  const [phase, setPhase] = useState<'setup' | 'playing' | 'busy' | 'done'>('setup');
  const [pending, setPending] = useState<LocalMove | null>(null);
  const [solution, setSolution] = useState<PuzzleStep[] | null>(null);
  const [flash, setFlash] = useState<{
    square: Square;
    tone: 'success' | 'error';
    id: number;
  } | null>(null);
  const premoveOn = premoveSetting && props.premoves === true;
  // File de premoves vidée à la fin du puzzle.
  const queue = usePremoves(`${attempt.attemptId}:${phase === 'done'}`, premoveOn);
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

  // Solution rejouée une seule fois, dès qu'elle est demandée.
  const solutionShown = useRef(false);
  useEffect(() => {
    if (!props.showSolution || !solution || solutionShown.current) return;
    solutionShown.current = true;
    solution.forEach((s, i) => later(() => apply(s), SOLUTION_STEP * (i + 1)));
  }, [props.showSolution, solution]);

  const busy = phase === 'setup' || phase === 'busy';
  const notifyBusy = useEffectEvent((b: boolean) => props.onBusyChange?.(b));
  useEffect(() => notifyBusy(busy), [busy]);

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
      // Coup (ou premove) refusé : la pièce revient, les premoves suivants n'ont plus de sens.
      queue.clear();
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
      setSolution(res.solution ?? []);
      props.onDone({ success: false, rating: res.rating, solution: res.solution ?? [] });
      return;
    }
    const [mine, reply] = res.steps;
    if (mine) apply(mine);
    const finish = () => {
      setLegal(res.legalMoves);
      if (res.status === 'solved') {
        playSound('success');
        setPhase('done');
        props.onDone({ success: true, rating: res.rating, solution: [] });
      } else {
        setPhase('playing');
        props.onProgress?.();
      }
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
  const playable = phase === 'playing' && !props.frozen && live;

  // Position de nouveau jouable : le premier premove part comme un coup normal.
  const nextPremove = playable ? queue.next : undefined;
  const playPremove = useEffectEvent((move: LocalMove) => {
    queue.shift();
    void onMove(move);
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chaque premove ne part qu'une fois
    if (nextPremove) playPremove(nextPremove);
  }, [nextPremove]);

  const color = attempt.color;
  return (
    <Board
      pieces={
        live
          ? applyLocalMoves(pieces, [...(pending ? [pending] : []), ...queue.premoves])
          : history.frame.pieces
      }
      orientation={color}
      movable={playable ? color : null}
      premoveColor={premoveOn && busy && live ? color : null}
      premoves={live ? queue.premoves : []}
      onPremove={queue.add}
      onCancelPremove={queue.clear}
      legalMoves={showLegalMoves && playable ? legal : null}
      lastMove={history.frame.lastMove}
      highlighted={live && phase !== 'done' ? (props.hint ?? null) : null}
      flash={live ? flash : null}
      onMove={(from, to, promotion) =>
        void onMove(promotion ? { from, to, promotion } : { from, to })
      }
    />
  );
}
