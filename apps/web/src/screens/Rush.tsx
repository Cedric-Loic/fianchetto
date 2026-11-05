import { useEffect, useRef, useState } from 'react';
import { RUSH_MAX_ERRORS, RUSH_MINUTES, type PuzzleAttempt, type RushRecords } from '@sq/shared';
import { PuzzlePlay } from '../game/PuzzlePlay';
import { api } from '../lib/api';
import { formatClock } from '../lib/drills';
import { useSession } from '../lib/session';
import { BoardLayout } from '../ui/BoardLayout';
import { Button } from '../ui/Button';
import { EmptyState, LoginRequired } from '../ui/EmptyState';
import { SideBadge } from '../ui/SideBadge';
import { Loading } from '../ui/Spinner';

/*
 * Contre la montre : puzzles de difficulté croissante, 3 ou 5 minutes, 3 erreurs au plus. Un
 * mauvais coup passe au puzzle suivant (pas de solution : la vitesse prime). La pendule est tenue
 * ici ; le serveur juge chaque coup et garde les records.
 */

const NEXT_DELAY_MS = 350;
const MISSING_DB_MESSAGE = "La base de puzzles n'est pas installée : pnpm puzzles:import";

type Run = {
  minutes: number;
  endsAt: number;
  index: number;
  score: number;
  errors: number;
  attempt: PuzzleAttempt | null;
};

export function Rush() {
  const user = useSession((s) => s.user);
  const [records, setRecords] = useState<RushRecords | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [over, setOver] = useState<{ minutes: number; score: number; record: boolean } | null>(
    null,
  );
  const [missing, setMissing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const ended = useRef(false);

  useEffect(() => {
    if (user) void api.rushRecords().then(setRecords);
  }, [user]);

  const fetchAttempt = async (index: number) => {
    const res = await api.puzzleNext('rush', null, index);
    if (!res.ok) {
      if (res.error === 'NO_BANK') setMissing(true);
      return null;
    }
    return res.data.attempt;
  };

  const finish = (r: Run) => {
    if (ended.current) return;
    ended.current = true;
    const best = records?.best[r.minutes as 3 | 5] ?? null;
    setOver({ minutes: r.minutes, score: r.score, record: best === null || r.score > best });
    setRun(null);
    void api
      .rushResult({ minutes: r.minutes as 3 | 5, score: r.score, errors: r.errors })
      .then((res) => res && setRecords(res));
  };

  // Pendule : rafraîchie toutes les 200 ms ; à zéro, la série s'arrête.
  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [run]);
  const remaining = run ? run.endsAt - now : 0;
  useEffect(() => {
    if (run && remaining <= 0) finish(run);
  });

  const start = async (minutes: number) => {
    setMissing(false);
    setOver(null);
    ended.current = false;
    const attempt = await fetchAttempt(0);
    if (!attempt) return;
    const t = Date.now();
    setNow(t);
    setRun({ minutes, endsAt: t + minutes * 60_000, index: 0, score: 0, errors: 0, attempt });
  };

  const onDone = (success: boolean) => {
    if (!run) return;
    const next: Run = {
      ...run,
      index: run.index + 1,
      score: run.score + (success ? 1 : 0),
      errors: run.errors + (success ? 0 : 1),
    };
    if (next.errors >= RUSH_MAX_ERRORS) {
      setRun(next);
      setTimeout(() => finish(next), NEXT_DELAY_MS);
      return;
    }
    setRun(next);
    setTimeout(() => {
      void fetchAttempt(next.index).then((attempt) => {
        if (ended.current) return;
        setRun((r) => (r ? { ...r, attempt } : r));
      });
    }, NEXT_DELAY_MS);
  };

  if (!user) {
    return <LoginRequired title="Contre la montre" text="Connecte-toi pour garder tes records." />;
  }

  if (run) {
    const attempt = run.attempt;
    return (
      <BoardLayout
        className="rush"
        testId="rush"
        toPlay={attempt && <SideBadge color={attempt.color} />}
        board={
          attempt ? (
            <PuzzlePlay
              key={attempt.attemptId}
              attempt={attempt}
              frozen={remaining <= 0}
              onDone={(o) => onDone(o.success)}
            />
          ) : (
            <Loading label="Puzzle suivant…" />
          )
        }
        side={
          <>
            <div className="puzzle-stats-row">
              <h2>Contre la montre · {run.minutes} min</h2>
              <div
                className={`clock running${remaining < 20_000 ? ' low' : ''}`}
                data-testid="rush-clock"
              >
                {formatClock(remaining)}
              </div>
            </div>
            <div className="rush-score">
              <span className="rush-points" data-testid="rush-score">
                {run.score}
              </span>
              <span className="muted">puzzles réussis</span>
            </div>
            <p
              aria-label={`${run.errors} erreur(s) sur ${RUSH_MAX_ERRORS}`}
              data-testid="rush-errors"
            >
              {Array.from({ length: RUSH_MAX_ERRORS }, (_, i) => (
                <span key={i} className={i < run.errors ? 'loss rush-strike' : 'muted rush-strike'}>
                  ✗
                </span>
              ))}
            </p>
            <p className="muted">
              Puzzle {run.index + 1} · la difficulté monte à chaque puzzle. Un mauvais coup compte
              une erreur et passe au suivant.
            </p>
            <Button variant="outline" onClick={() => finish(run)} data-testid="rush-stop">
              Arrêter la série
            </Button>
          </>
        }
      />
    );
  }

  return (
    <div className="page" data-testid="rush-menu">
      <section className="panel page-panel">
        <a href="#/train" className="back-link">
          ← S’entraîner
        </a>
        <h2>Contre la montre</h2>
        <p className="muted">
          Résous le plus de puzzles possible avant la fin du temps. Ils commencent faciles et
          deviennent de plus en plus durs ; trois erreurs arrêtent la série. Le but : voir les
          motifs tactiques de plus en plus vite. Ces puzzles ne comptent pas pour ton classement.
        </p>
        {over && (
          <div className="move-card" data-testid="rush-over" aria-live="polite">
            <p>
              <strong>
                {over.score} puzzle{over.score > 1 ? 's' : ''} en {over.minutes} min
              </strong>
              {over.record && over.score > 0 && <span className="win"> · Nouveau record !</span>}
            </p>
          </div>
        )}
        <div className="quick-grid">
          {RUSH_MINUTES.map((minutes) => (
            <div key={minutes} className="panel quick-card">
              <h3>{minutes} minutes</h3>
              <p className="muted" data-testid={`rush-best-${minutes}`}>
                Record : {records?.best[minutes] ?? '—'}
              </p>
              <Button
                size="s"
                variant="primary"
                className="stretched"
                data-testid={`rush-start-${minutes}`}
                onClick={() => void start(minutes)}
              >
                {over ? 'Rejouer' : 'Commencer'}
              </Button>
            </div>
          ))}
        </div>
        {missing && <EmptyState icon="♞" title={MISSING_DB_MESSAGE} testId="rush-missing" />}
      </section>
    </div>
  );
}
