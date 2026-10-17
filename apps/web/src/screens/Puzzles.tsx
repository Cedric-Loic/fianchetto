import { useEffect, useEffectEvent, useRef, useState } from 'react';
import {
  PUZZLE_THEME_LABELS,
  PUZZLE_THEMES,
  type DisplayedPiece,
  type LegalMove,
  type PuzzleAttempt,
  type PuzzleMode,
  type PuzzleStats,
  type PuzzleStep,
  type Square,
} from '@sq/shared';
import { Board } from '../game/Board';
import { usePremoves } from '../game/usePremoves';
import { api } from '../lib/api';
import { carryIds, piecesFromFen } from '../lib/fen';
import { useSession } from '../lib/session';
import { useSettings } from '../lib/settings';
import { applyLocalMoves, type LocalMove } from '../lib/virtual';
import { SIDE } from './labels';

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
};

const STEP_DELAY = 450;

/**
 * Puzzles : base Lichess au niveau ou par thème, révisions des puzzles ratés, positions tirées de
 * mes erreurs. Le serveur valide chaque coup ; l'écran affiche les positions reçues.
 */
export function Puzzles(props: { initialMode?: PuzzleMode; initialTheme?: string | null }) {
  const user = useSession((s) => s.user);
  const showLegalMoves = useSettings((s) => s.showLegalMoves);
  const [mode, setMode] = useState<PuzzleMode>(props.initialMode ?? 'rated');
  const [theme, setTheme] = useState<string | null>(props.initialTheme ?? null);
  const [round, setRound] = useState(0);
  const [stats, setStats] = useState<PuzzleStats | null>(null);
  const [attempt, setAttempt] = useState<PuzzleAttempt | null>(null);
  const [pieces, setPieces] = useState<DisplayedPiece[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [legal, setLegal] = useState<LegalMove[]>([]);
  const [progress, setProgress] = useState(false);
  const [solution, setSolution] = useState<PuzzleStep[] | null>(null);
  const [ratingChange, setRatingChange] = useState<{ before: number; after: number } | null>(null);
  const [hint, setHint] = useState<Square | null>(null);
  const [busy, setBusy] = useState(false);
  /** Mon coup envoyé, affiché tout de suite en attendant la réponse du serveur. */
  const [pending, setPending] = useState<LocalMove | null>(null);
  // Premoves pendant la réponse adverse : file vidée à chaque nouveau puzzle et à la fin du
  // puzzle (réussi ou raté).
  const premoveOn = useSettings((s) => s.premoves);
  const queue = usePremoves(`${attempt?.attemptId ?? ''}:${phase}`, premoveOn);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const apply = (step: PuzzleStep) => {
    setPieces((prev) => carryIds(prev, piecesFromFen(step.fen), step.uci));
    setLastMove({ from: step.uci.slice(0, 2) as Square, to: step.uci.slice(2, 4) as Square });
  };

  // Statistiques (classement puzzle, disponibilités), rafraîchies à chaque puzzle terminé.
  useEffect(() => {
    if (user) void api.puzzleStats().then(setStats);
  }, [user, round, phase]);

  // Puzzle suivant : position de départ, puis coup adverse animé.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    for (const t of timers.current) clearTimeout(t);
    timers.current = [];
    void api.puzzleNext(mode, mode === 'theme' ? theme : null).then((res) => {
      if (cancelled) return;
      setSolution(null);
      setRatingChange(null);
      setHint(null);
      setProgress(false);
      if (!res.ok) {
        setAttempt(null);
        setPhase(res.error === 'NO_BANK' ? 'no-bank' : 'empty');
        return;
      }
      const a = res.data.attempt;
      setAttempt(a);
      setPieces(piecesFromFen(a.fenBefore));
      setLastMove(null);
      setLegal(a.legalMoves);
      setPhase('playing');
      setBusy(true);
      later(() => {
        apply(a.setup);
        setBusy(false);
      }, 500);
    });
    return () => {
      cancelled = true;
    };
  }, [user, mode, theme, round]);

  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
    },
    [],
  );

  const onMove = async (move: LocalMove) => {
    if (!attempt || phase !== 'playing' || busy) return;
    setBusy(true);
    setHint(null);
    setPending(move);
    const res = await api.puzzleMove(
      attempt.attemptId,
      `${move.from}${move.to}${move.promotion ?? ''}`,
    );
    setPending(null);
    if (!res || res.status === 'illegal') {
      // Coup (ou premove) refusé : la pièce revient, les premoves suivants n'ont plus de sens.
      queue.clear();
      setBusy(false);
      return;
    }
    const [mine, reply] = res.steps;
    if (mine) apply(mine);
    if (res.status === 'failed') {
      setSolution(res.solution);
      setRatingChange(res.rating);
      setPhase('failed');
      setBusy(false);
      return;
    }
    setProgress(true);
    const finish = () => {
      setLegal(res.legalMoves);
      if (res.status === 'solved') {
        setRatingChange(res.rating);
        setPhase('solved');
      }
      setBusy(false);
    };
    if (reply) {
      later(() => {
        apply(reply);
        finish();
      }, STEP_DELAY);
    } else finish();
  };

  // Quand la position redevient jouable, le premier premove part comme un coup normal (jugé par
  // le serveur : un mauvais coup fait rater le puzzle, un coup illégal vide la file).
  const playable = phase === 'playing' && !busy && attempt !== null;
  const nextPremove = playable ? queue.next : undefined;
  const playPremove = useEffectEvent((move: LocalMove) => {
    queue.shift();
    void onMove(move);
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- chaque premove ne part qu'une fois
    if (nextPremove) playPremove(nextPremove);
  }, [nextPremove]);

  const showSolution = () => {
    if (!solution) return;
    setBusy(true);
    solution.forEach((step, i) => later(() => apply(step), (i + 1) * 700));
    later(() => setBusy(false), (solution.length + 1) * 700);
    setSolution([]);
  };

  const askHint = () => {
    if (!attempt) return;
    void api.puzzleHint(attempt.attemptId).then((h) => h && setHint(h.from as Square));
  };

  if (!user) {
    return (
      <div className="page">
        <div className="panel page-panel">
          <h2>Puzzles</h2>
          <p className="muted">Connecte-toi pour suivre ton classement puzzle.</p>
          <a className="button primary" href="#/login">
            Se connecter
          </a>
        </div>
      </div>
    );
  }

  const ended = phase === 'solved' || phase === 'failed';
  const color = attempt?.color ?? 'w';
  const themeOfDay = stats?.themeOfDay ?? 'fork';
  const delta = ratingChange ? ratingChange.after - ratingChange.before : null;

  return (
    <div className="game puzzles">
      <div className="board-column">
        <div className="board-wrap">
          <Board
            pieces={applyLocalMoves(pieces, [...(pending ? [pending] : []), ...queue.premoves])}
            orientation={color}
            movable={playable ? color : null}
            premoveColor={premoveOn && phase === 'playing' && busy ? color : null}
            premoves={queue.premoves}
            onPremove={queue.add}
            onCancelPremove={queue.clear}
            legalMoves={showLegalMoves && phase === 'playing' ? legal : null}
            lastMove={lastMove}
            highlighted={hint}
            onMove={(from, to, promotion) =>
              void onMove(promotion ? { from, to, promotion } : { from, to })
            }
          />
        </div>
      </div>

      <aside className="panel side-panel">
        <div className="turn-banner">
          Puzzles
          {stats && (
            <span className="variant-badge" data-testid="puzzle-rating">
              Classement {stats.rating} (±{stats.deviation})
            </span>
          )}
        </div>
        {stats && (
          <p className="muted">
            {stats.solved} réussis sur {stats.attempts}
          </p>
        )}
        <div className="tabs" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.mode}
              role="tab"
              aria-selected={m.mode === mode}
              data-testid={`puzzle-mode-${m.mode}`}
              className={m.mode === mode ? 'tc selected' : 'tc'}
              onClick={() => setMode(m.mode)}
            >
              {m.label}
              {m.mode === 'review' && stats ? ` (${stats.available.due})` : ''}
              {m.mode === 'mine' && stats ? ` (${stats.available.mine})` : ''}
            </button>
          ))}
        </div>
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
          {phase === 'loading' && <p className="muted">Chargement…</p>}
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
              ✓ Réussi !{delta !== null && ` Classement ${delta >= 0 ? '+' : ''}${delta}`}
            </p>
          )}
          {phase === 'failed' && (
            <p className="loss">
              ✗ Ce n'est pas le bon coup.
              {delta !== null && ` Classement ${delta}`} Ce puzzle reviendra dans tes révisions.
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
            <button onClick={askHint} disabled={busy}>
              💡 Indice
            </button>
          )}
          {phase === 'failed' && solution && solution.length > 0 && (
            <button onClick={showSolution} data-testid="show-solution">
              Voir la solution
            </button>
          )}
          {(ended || phase === 'playing') && (
            <button
              className={ended ? 'primary' : ''}
              data-testid="next-puzzle"
              disabled={busy}
              onClick={() => {
                queue.clear();
                setRound((r) => r + 1);
              }}
            >
              {ended ? 'Puzzle suivant ▶' : 'Passer'}
            </button>
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
      </aside>
    </div>
  );
}
