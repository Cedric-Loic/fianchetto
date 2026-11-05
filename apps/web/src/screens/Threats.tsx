import { useEffect, useRef, useState } from 'react';
import {
  PUZZLE_THEME_LABELS,
  type DisplayedPiece,
  type Square,
  type ThreatAnswerResponse,
  type ThreatProblem,
  type ThreatStats,
} from '@sq/shared';
import { Board, type BoardMark } from '../game/Board';
import { api } from '../lib/api';
import { carryIds, piecesFromFen } from '../lib/fen';
import { useBoardHistory, useNavKeys } from '../lib/navKeys';
import { useSession } from '../lib/session';
import { playSound } from '../lib/sound';
import { BoardLayout } from '../ui/BoardLayout';
import { Button } from '../ui/Button';
import { EmptyState, LoginRequired } from '../ui/EmptyState';
import { SideBadge } from '../ui/SideBadge';
import { Loading } from '../ui/Spinner';
import { SIDE } from './labels';

/*
 * « Trouve la menace » (Heisman, Looking for Trouble) : tu viens de jouer ; l'adversaire a le
 * trait. Désigne le coup qui te ferait mal : clique la pièce adverse, puis sa case d'arrivée.
 * Le plateau ne bouge pas ; le serveur juge et révèle la menace et sa suite.
 */

const MISSING_DB_MESSAGE = "La base de puzzles n'est pas installée : pnpm puzzles:import";
const LINE_STEP_MS = 800;

type Load =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; problem: ThreatProblem };

export function Threats() {
  const user = useSession((s) => s.user);
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [stats, setStats] = useState<ThreatStats | null>(null);

  const next = async () => {
    setLoad({ status: 'loading' });
    const res = await api.threatNext();
    if (!res.ok) return setLoad({ status: 'error' });
    setStats(res.data.stats);
    setLoad(
      res.data.problem ? { status: 'ready', problem: res.data.problem } : { status: 'missing' },
    );
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- premier chargement
    if (user) void next();
  }, [user]);

  if (!user) {
    return <LoginRequired title="Trouve la menace" text="Connecte-toi pour suivre tes progrès." />;
  }
  if (load.status === 'loading') return <Loading label="Recherche d’une position…" />;
  if (load.status !== 'ready') {
    return (
      <div className="page" data-testid="threats-empty">
        <section className="panel page-panel">
          <a href="#/train" className="back-link">
            ← S’entraîner
          </a>
          <h2>Trouve la menace</h2>
          {load.status === 'missing' ? (
            <EmptyState icon="♞" title={MISSING_DB_MESSAGE} testId="threats-missing" />
          ) : (
            <p className="error" role="alert">
              Impossible de charger une position. Vérifie que le serveur tourne, puis réessaie.
            </p>
          )}
        </section>
      </div>
    );
  }
  return (
    <ThreatView
      key={load.problem.id}
      problem={load.problem}
      stats={stats}
      onStats={setStats}
      onNext={() => void next()}
    />
  );
}

function ThreatView(props: {
  problem: ThreatProblem;
  stats: ThreatStats | null;
  onStats: (s: ThreatStats) => void;
  onNext: () => void;
}) {
  const { problem } = props;
  const opponent = problem.color === 'w' ? 'b' : 'w';
  const [pieces, setPieces] = useState<DisplayedPiece[]>(() => piecesFromFen(problem.fen));
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>({
    from: problem.lastMove.from as Square,
    to: problem.lastMove.to as Square,
  });
  const [from, setFrom] = useState<Square | null>(null);
  const [to, setTo] = useState<Square | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ThreatAnswerResponse | null>(null);
  const [replayed, setReplayed] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) clearTimeout(t);
    };
  }, []);

  const owner = (sq: Square) => pieces.find((p) => p.square === sq)?.color ?? null;
  const onSquare = (sq: Square) => {
    if (result || busy) return;
    setNotice(null);
    if (owner(sq) === opponent) {
      // Une pièce adverse : (re)choix de la pièce qui menace.
      setFrom(sq === from ? null : sq);
      setTo(null);
      return;
    }
    if (from) setTo(sq === to ? null : sq);
    else setNotice(`Commence par une pièce des ${SIDE[opponent]}.`);
  };

  const validate = async () => {
    if (!from || !to) return;
    setBusy(true);
    const res = await api.threatAnswer(problem.id, `${from}${to}`);
    setBusy(false);
    if (!res.ok) {
      if (res.status === 422) {
        setNotice('Ce coup n’est pas possible pour l’adversaire : choisis-en un autre.');
        setTo(null);
      } else setNotice('Le serveur ne répond pas : réessaie.');
      return;
    }
    setResult(res.data);
    props.onStats(res.data.stats);
    playSound(res.data.correct ? 'success' : 'failure');
  };

  const replay = () => {
    if (!result || replayed) return;
    setReplayed(true);
    result.line.forEach((step, i) =>
      timers.current.push(
        setTimeout(
          () => {
            setPieces((prev) => carryIds(prev, piecesFromFen(step.fen), step.uci));
            setLastMove({
              from: step.uci.slice(0, 2) as Square,
              to: step.uci.slice(2, 4) as Square,
            });
          },
          LINE_STEP_MS * (i + 1),
        ),
      ),
    );
  };

  const history = useBoardHistory({ pieces, lastMove }, problem.id);
  useNavKeys(history.nav);
  const threat = result?.line[0];
  const marks: BoardMark[] = result
    ? []
    : [
        ...(from ? [{ square: from, kind: 'pick' as const }] : []),
        ...(to ? [{ square: to, kind: 'pick' as const }] : []),
      ];
  const arrows =
    threat && !replayed && history.isLive
      ? [
          {
            from: threat.uci.slice(0, 2) as Square,
            to: threat.uci.slice(2, 4) as Square,
            kind: 'threat' as const,
          },
        ]
      : [];
  const motifs = result?.themes.map((t) => PUZZLE_THEME_LABELS[t] ?? t) ?? [];

  return (
    <BoardLayout
      className="exercise threats"
      testId="threats"
      toPlay={<SideBadge color={problem.color} />}
      board={
        <Board
          pieces={history.frame.pieces}
          orientation={problem.color}
          movable={null}
          lastMove={history.frame.lastMove}
          squareMarks={marks}
          arrows={arrows}
          {...(result ? {} : { onSquareClick: onSquare })}
        />
      }
      side={
        <>
          <a href="#/train" className="back-link">
            ← S’entraîner
          </a>
          <div className="puzzle-stats-row">
            <h2>Trouve la menace</h2>
            {props.stats && (
              <span className="muted" data-testid="threats-stats">
                Série : {props.stats.streak} · {props.stats.correct} / {props.stats.attempts}
              </span>
            )}
          </div>
          <p>
            <strong>
              Tu viens de jouer {problem.lastMove.san}. Quel coup des {SIDE[opponent]} te ferait mal
              ?
            </strong>
          </p>
          <p className="muted">
            Clique la pièce adverse qui menace, puis la case où elle irait. Cherche d’abord les
            échecs, les prises et les attaques.
          </p>
          {!result && (
            <>
              <p data-testid="threats-choice">
                {from ? (
                  <>
                    Pièce : <strong>{from}</strong>
                    {to ? (
                      <>
                        {' '}
                        → <strong>{to}</strong>
                      </>
                    ) : (
                      ' → case d’arrivée ?'
                    )}
                  </>
                ) : (
                  <span className="muted">Aucune pièce choisie.</span>
                )}
              </p>
              {notice && (
                <p className="error" role="alert" data-testid="threats-notice">
                  {notice}
                </p>
              )}
              <Button
                variant="primary"
                disabled={!from || !to || busy}
                onClick={() => void validate()}
                data-testid="threats-validate"
              >
                Valider
              </Button>
            </>
          )}
          {result && (
            <div
              className={`move-card puzzle-status ${result.correct ? 'solved' : 'failed'}`}
              data-testid="threats-result"
              aria-live="polite"
            >
              <p className={result.correct ? 'win' : 'loss'}>
                {result.correct ? '✓ Bien vu !' : '✗ Ce n’était pas ça.'}
              </p>
              <p>{result.explanation}</p>
              {motifs.length > 0 && <p className="muted">Motifs : {motifs.join(', ')}</p>}
              <p className="muted">Puzzle {problem.rating}</p>
            </div>
          )}
          {result && (
            <div className="btn-row">
              <Button onClick={replay} disabled={replayed} data-testid="threats-replay">
                Voir la suite
              </Button>
              <Button variant="primary" onClick={props.onNext} data-testid="threats-next">
                Position suivante
              </Button>
            </div>
          )}
        </>
      }
    />
  );
}
