import { useEffect, useState } from 'react';
import {
  WOODPECKER_MAX_CYCLES,
  WOODPECKER_SIZES,
  type PuzzleAttempt,
  type WoodpeckerState,
} from '@sq/shared';
import { PuzzlePlay } from '../game/PuzzlePlay';
import { api } from '../lib/api';
import { formatClock } from '../lib/drills';
import { useSession } from '../lib/session';
import { BoardLayout } from '../ui/BoardLayout';
import { Button } from '../ui/Button';
import { EmptyState, LoginRequired } from '../ui/EmptyState';
import { ProgressBar } from '../ui/ProgressBar';
import { SideBadge } from '../ui/SideBadge';
import { Loading } from '../ui/Spinner';

/*
 * Méthode Woodpecker (Smith et Tikkanen, d'après les « 7 cercles » de de la Maza) : un lot fixe
 * de puzzles faciles, refait en cycles ; à chaque cycle, l'objectif est de mettre deux fois moins
 * de temps. Le serveur garde le lot, la position dans le cycle et le temps cumulé.
 */

const MISSING_DB_MESSAGE = "La base de puzzles n'est pas installée : pnpm puzzles:import";

type Set = NonNullable<WoodpeckerState['set']>;

export function Woodpecker() {
  const user = useSession((s) => s.user);
  const [state, setState] = useState<WoodpeckerState | null>(null);
  const [attempt, setAttempt] = useState<PuzzleAttempt | null>(null);
  const [result, setResult] = useState<boolean | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const loadAttempt = async () => {
    setResult(null);
    const res = await api.puzzleNext('woodpecker', null);
    setAttempt(res.ok ? res.data.attempt : null);
  };

  useEffect(() => {
    if (!user) return;
    void api.woodpecker().then((s) => {
      setState(s);
      if (s?.set && !s.set.finished) void loadAttempt();
    });
  }, [user]);

  const start = async (size: number) => {
    const s = await api.woodpeckerStart(size);
    if (!s) return;
    setState(s);
    void loadAttempt();
  };
  const reset = async () => {
    setConfirmReset(false);
    setAttempt(null);
    setState(await api.woodpeckerReset());
  };
  const onDone = (success: boolean) => {
    setResult(success);
    void api.woodpecker().then(setState);
  };

  if (!user) {
    return <LoginRequired title="Woodpecker" text="Connecte-toi pour suivre tes cycles." />;
  }
  if (!state) return <Loading label="Chargement…" />;

  const set = state.set;
  if (!set || set.finished) {
    return (
      <WoodpeckerIntro
        bank={state.bank}
        finished={set?.finished ? set : null}
        onStart={(size) => void start(size)}
      />
    );
  }

  // Juste après le dernier puzzle d'un cycle, la position revient à 0 : bilan du cycle terminé.
  const justClosed = result !== null && set.position === 0 ? set.history.at(-1) : undefined;

  return (
    <BoardLayout
      className="woodpecker"
      testId="woodpecker"
      toPlay={attempt && <SideBadge color={attempt.color} />}
      board={
        attempt ? (
          <PuzzlePlay
            key={attempt.attemptId}
            attempt={attempt}
            showSolution
            onDone={(o) => onDone(o.success)}
          />
        ) : (
          <Loading label="Puzzle suivant…" />
        )
      }
      side={
        <>
          <a href="#/train" className="back-link">
            ← S’entraîner
          </a>
          <div className="puzzle-stats-row">
            <h2>
              Woodpecker · cycle {set.cycle} / {WOODPECKER_MAX_CYCLES}
            </h2>
          </div>
          <ProgressBar
            done={set.position}
            total={set.size}
            label={`Puzzle ${Math.min(set.position + 1, set.size)} sur ${set.size}`}
          />
          <p className="muted" data-testid="woodpecker-progress">
            {set.position} / {set.size} faits · {set.solved} réussis · temps du cycle{' '}
            {formatClock(set.ms)}
            {set.targetMs !== null && <> · objectif {formatClock(set.targetMs)}</>}
          </p>
          <div className="move-card" data-testid="woodpecker-status" aria-live="polite">
            {result === null && <p>À toi : trouve la combinaison. Vite, mais juste.</p>}
            {result === true && <p className="win">✓ Réussi.</p>}
            {result === false && <p className="loss">✗ Raté : regarde la solution.</p>}
            {justClosed && (
              <p data-testid="woodpecker-cycle-done">
                <strong>
                  Cycle {justClosed.cycle} terminé en {formatClock(justClosed.ms)}
                </strong>{' '}
                ({justClosed.solved} / {justClosed.total} réussis). Objectif du cycle suivant :{' '}
                {formatClock(justClosed.ms / 2)}.
              </p>
            )}
          </div>
          {result !== null && (
            <Button
              variant="primary"
              onClick={() => void loadAttempt()}
              data-testid="woodpecker-next"
            >
              Puzzle suivant
            </Button>
          )}
          <CycleHistory set={set} />
          {confirmReset ? (
            <div className="btn-row">
              <span>Abandonner ce lot ?</span>
              <Button
                size="s"
                variant="danger"
                onClick={() => void reset()}
                data-testid="woodpecker-reset-confirm"
              >
                Oui, abandonner
              </Button>
              <Button size="s" variant="outline" onClick={() => setConfirmReset(false)}>
                Non
              </Button>
            </div>
          ) : (
            <Button
              size="s"
              variant="outline"
              onClick={() => setConfirmReset(true)}
              data-testid="woodpecker-reset"
            >
              Abandonner le lot
            </Button>
          )}
        </>
      }
    />
  );
}

function CycleHistory({ set }: { set: Set }) {
  if (set.history.length === 0) return null;
  return (
    <table className="table" data-testid="woodpecker-history">
      <caption className="muted">Cycles terminés</caption>
      <thead>
        <tr>
          <th scope="col">Cycle</th>
          <th scope="col">Réussis</th>
          <th scope="col">Temps</th>
        </tr>
      </thead>
      <tbody>
        {set.history.map((c) => (
          <tr key={c.cycle}>
            <td>{c.cycle}</td>
            <td>
              {c.solved} / {c.total}
            </td>
            <td>{formatClock(c.ms)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function WoodpeckerIntro(props: {
  bank: boolean;
  finished: Set | null;
  onStart: (size: number) => void;
}) {
  return (
    <div className="page" data-testid="woodpecker-intro">
      <section className="panel page-panel">
        <a href="#/train" className="back-link">
          ← S’entraîner
        </a>
        <h2>Méthode Woodpecker</h2>
        <p>
          Tu résous un <strong>lot fixe</strong> de puzzles un peu sous ton niveau, puis tu{' '}
          <strong>recommences le même lot</strong>, en essayant de mettre deux fois moins de temps à
          chaque cycle (jusqu’à {WOODPECKER_MAX_CYCLES} cycles). Les motifs finissent par se voir
          d’un coup d’œil : c’est le but.
        </p>
        <p className="muted">
          Méthode de Hans Tikkanen et Axel Smith (<em>The Woodpecker Method</em>), d’après les « 7
          cercles » de Michael de la Maza. Ces puzzles ne comptent pas pour ton classement.
        </p>
        {props.finished && (
          <div className="move-card" data-testid="woodpecker-finished">
            <p className="win">
              <strong>Lot terminé : {props.finished.history.length} cycles.</strong>
            </p>
            <p className="muted">
              Premier cycle {formatClock(props.finished.history[0]?.ms ?? 0)}, dernier{' '}
              {formatClock(props.finished.history.at(-1)?.ms ?? 0)}.
            </p>
          </div>
        )}
        {props.bank ? (
          <div className="quick-grid">
            {WOODPECKER_SIZES.map((size) => (
              <div key={size} className="panel quick-card">
                <h3>{size} puzzles</h3>
                <p className="muted">{SIZE_HINT[size]}</p>
                <Button
                  size="s"
                  variant="primary"
                  className="stretched"
                  data-testid={`woodpecker-start-${size}`}
                  onClick={() => props.onStart(size)}
                >
                  {props.finished ? 'Nouveau lot' : 'Commencer'}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon="♞" title={MISSING_DB_MESSAGE} testId="woodpecker-missing" />
        )}
      </section>
    </div>
  );
}

const SIZE_HINT: Record<number, string> = {
  25: 'Pour découvrir : un cycle en une séance.',
  50: 'Un cycle en deux ou trois séances.',
  100: 'Le format conseillé pour progresser.',
  200: 'Le plus complet : plusieurs semaines.',
};
