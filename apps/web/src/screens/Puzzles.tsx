import { useEffect, useState } from 'react';
import {
  PUZZLE_THEME_LABELS,
  PUZZLE_THEMES,
  type PuzzleAttempt,
  type PuzzleMode,
  type PuzzleStats,
  type PuzzleStep,
  type Square,
} from '@sq/shared';
import { Board } from '../game/Board';
import { PuzzlePlay, type PuzzleResult } from '../game/PuzzlePlay';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useStreak } from '../lib/streak';
import { SIDE } from './labels';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { LoginRequired } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';
import { Tabs } from '../ui/Tabs';
import { BoardLayout } from '../ui/BoardLayout';
import { SideBadge } from '../ui/SideBadge';
import { IconBulb, IconNext } from '../ui/icons';
import { RatingDelta, StreakBadge } from '../ui/StreakBadge';

type Phase = 'loading' | 'playing' | 'solved' | 'failed' | 'empty' | 'no-bank';

const MODES: { mode: PuzzleMode; label: string }[] = [
  { mode: 'rated', label: 'Au niveau' },
  { mode: 'theme', label: 'Thème' },
  { mode: 'review', label: 'Révisions' },
  { mode: 'mine', label: 'Mes erreurs' },
];

/** Nom français d'un thème (base Lichess, ou type d'erreur pour mes puzzles). */
const themeLabel = (theme: string) => PUZZLE_THEME_LABELS[theme] ?? theme;

const EMPTY_MESSAGE: Record<PuzzleMode, string> = {
  rated: 'Aucun puzzle disponible à ton niveau.',
  theme: 'Aucun puzzle disponible pour ce thème.',
  review: 'Aucune révision due aujourd’hui : reviens demain, ou résous d’autres puzzles.',
  mine: 'Pas encore de puzzles tirés de tes parties : analyse des parties (menu Analyse).',
  rush: 'Aucun puzzle disponible.',
  woodpecker: 'Aucun lot Woodpecker en cours.',
};

/**
 * Puzzles : base Lichess au niveau ou par thème, révisions des puzzles ratés, positions tirées de
 * mes erreurs. Le serveur valide chaque coup ; l'écran affiche les positions reçues.
 */
export function Puzzles(props: { initialMode?: PuzzleMode; initialTheme?: string | null }) {
  const user = useSession((s) => s.user);
  const [mode, setMode] = useState<PuzzleMode>(props.initialMode ?? 'rated');
  const [theme, setTheme] = useState<string | null>(props.initialTheme ?? null);
  const [round, setRound] = useState(0);
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [attempt, setAttempt] = useState<PuzzleAttempt | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [progress, setProgress] = useState(false);
  const [solution, setSolution] = useState<PuzzleStep[] | null>(null);
  const [solutionShown, setSolutionShown] = useState(false);
  const [ratingChange, setRatingChange] = useState<{ before: number; after: number } | null>(null);
  const [hint, setHint] = useState<Square | null>(null);
  const [busy, setBusy] = useState(true);
  const record = useStreak((s) => s.record);

  // Statistiques (classement puzzle, disponibilités), rafraîchies à chaque puzzle terminé.
  useEffect(() => {
    if (user) void api.puzzleStats().then(setStats);
  }, [user, round, phase]);

  // Puzzle suivant (le plateau joue lui-même le coup adverse de départ).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void api.puzzleNext(mode, mode === 'theme' ? theme : null).then((res) => {
      if (cancelled) return;
      setSolution(null);
      setSolutionShown(false);
      setRatingChange(null);
      setHint(null);
      setProgress(false);
      if (!res.ok) {
        setAttempt(null);
        setPhase(res.error === 'NO_BANK' ? 'no-bank' : 'empty');
        return;
      }
      setAttempt(res.data.attempt);
      setPhase('playing');
    });
    return () => {
      cancelled = true;
    };
  }, [user, mode, theme, round]);

  const onDone = (result: PuzzleResult) => {
    record(result.success);
    setRatingChange(result.rating);
    if (!result.success) setSolution(result.solution);
    setPhase(result.success ? 'solved' : 'failed');
  };

  const askHint = () => {
    if (!attempt) return;
    void api.puzzleHint(attempt.attemptId).then((h) => h && setHint(h.from as Square));
  };

  if (!user) {
    return <LoginRequired title="Puzzles" text="Connecte-toi pour suivre ton classement puzzle." />;
  }

  const ended = phase === 'solved' || phase === 'failed';
  const color = attempt?.color ?? 'w';
  const themeOfDay = stats?.themeOfDay ?? 'fork';

  return (
    <BoardLayout
      className="puzzles"
      toPlay={attempt && <SideBadge color={color} />}
      board={
        attempt ? (
          <PuzzlePlay
            key={attempt.attemptId}
            attempt={attempt}
            premoves
            hint={hint}
            showSolution={solutionShown}
            onDone={onDone}
            onProgress={() => setProgress(true)}
            onBusyChange={(b) => {
              setBusy(b);
              // Un coup part : l'indice n'a plus lieu d'être.
              if (b) setHint(null);
            }}
          />
        ) : (
          <Board pieces={[]} orientation="w" movable={null} />
        )
      }
      side={
        <>
          <div className="turn-banner">
            Puzzles
            {stats && (
              <Badge tone="accent" testId="puzzle-rating">
                Classement {stats.rating} (±{stats.deviation})
              </Badge>
            )}
          </div>
          <div className="puzzle-stats-row">
            {stats && (
              <span className="muted">
                {stats.solved} réussis sur {stats.attempts}
              </span>
            )}
            <StreakBadge />
          </div>
          <Tabs
            label="Type de puzzles"
            value={mode}
            onChange={setMode}
            items={MODES.map((m) => ({
              id: m.mode,
              testId: `puzzle-mode-${m.mode}`,
              label: (
                <>
                  {m.label}
                  {m.mode === 'review' && stats ? ` (${stats.available.due})` : ''}
                  {m.mode === 'mine' && stats ? ` (${stats.available.mine})` : ''}
                </>
              ),
            }))}
          />
          {mode === 'theme' && (
            <label className="theme-select">
              Thème
              <select
                value={theme ?? themeOfDay}
                data-testid="puzzle-theme"
                onChange={(e) => setTheme(e.target.value)}
              >
                {Object.entries(PUZZLE_THEMES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                    {key === themeOfDay ? ' (thème du jour)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className={`move-card puzzle-status ${phase}`} data-testid="puzzle-status">
            {phase === 'loading' && <Loading inline label="Chargement du puzzle…" />}
            {phase === 'no-bank' && (
              <p>
                La base de puzzles Lichess n'est pas encore installée. Lance une fois{' '}
                <code>pnpm puzzles:import</code> (téléchargement d'environ 250 Mo, puis plus aucun
                accès réseau). En attendant : <strong>Révisions</strong> et{' '}
                <strong>Mes erreurs</strong>.
              </p>
            )}
            {phase === 'empty' && <p className="muted">{EMPTY_MESSAGE[mode]}</p>}
            {phase === 'playing' && (
              <p>
                {progress
                  ? '✓ Bien vu ! Continue.'
                  : `À toi : trouve le meilleur coup pour les ${SIDE[color]}.`}
              </p>
            )}
            {phase === 'solved' && (
              <p className="win">
                ✓ Réussi !{' '}
                {ratingChange && (
                  <RatingDelta before={ratingChange.before} after={ratingChange.after} />
                )}
              </p>
            )}
            {phase === 'failed' && (
              <p className="loss">
                ✗ Ce n'est pas le bon coup.{' '}
                {ratingChange && (
                  <RatingDelta before={ratingChange.before} after={ratingChange.after} />
                )}{' '}
                Ce puzzle reviendra dans tes révisions.
              </p>
            )}
            {ended && attempt && (
              <p className="muted">
                {attempt.rating !== null && `Puzzle ${attempt.rating} · `}
                {attempt.themes.map(themeLabel).join(', ')}
                {attempt.origin && (
                  <>
                    {' · '}
                    {attempt.origin.url ? (
                      <a href={attempt.origin.url} target="_blank" rel="noreferrer">
                        {attempt.origin.label}
                      </a>
                    ) : (
                      attempt.origin.label
                    )}
                  </>
                )}
              </p>
            )}
            {!ended && attempt?.origin && attempt.source === 'mine' && (
              <p className="muted">{attempt.origin.label}</p>
            )}
          </div>

          <div className="actions">
            {phase === 'playing' && (
              <Button variant="outline" onClick={askHint} disabled={busy} data-testid="puzzle-hint">
                <IconBulb size={18} />
                Indice
              </Button>
            )}
            {phase === 'failed' && solution && solution.length > 0 && !solutionShown && (
              <Button onClick={() => setSolutionShown(true)} data-testid="show-solution">
                Voir la solution
              </Button>
            )}
            {(ended || phase === 'playing') && (
              <Button
                variant={ended ? 'primary' : 'outline'}
                data-testid="next-puzzle"
                disabled={busy}
                onClick={() => setRound((r) => r + 1)}
              >
                {ended ? 'Puzzle suivant' : 'Passer'}
                <IconNext size={18} />
              </Button>
            )}
          </div>

          {stats && stats.themes.length > 0 && (
            <div className="theme-stats">
              <strong>Tes thèmes</strong>
              {stats.themes
                .filter((t) => t.theme in PUZZLE_THEMES)
                .slice(0, 8)
                .map((t) => (
                  <div key={t.theme} className="theme-row">
                    <span>{themeLabel(t.theme)}</span>
                    <span className="muted">
                      {Math.round((100 * t.solved) / t.attempts)} % ({t.attempts})
                    </span>
                  </div>
                ))}
            </div>
          )}
        </>
      }
    />
  );
}
