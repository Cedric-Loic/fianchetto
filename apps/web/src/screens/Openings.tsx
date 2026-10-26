import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  Color,
  DisplayedPiece,
  OpeningDeviation,
  OpeningDeviationResponse,
  OpeningDrill,
  OpeningLineSummary,
  OpeningNextResponse,
  OpeningsResponse,
  Square,
} from '@sq/shared';
import { Board } from '../game/Board';
import { request } from '../lib/api';
import { carryIds, piecesFromFen } from '../lib/fen';
import { useSan } from '../lib/notation';
import { useSession } from '../lib/session';
import { useSettings } from '../lib/settings';
import { playSound } from '../lib/sound';
import { SIDE } from './labels';
import { BoardLayout } from '../ui/BoardLayout';
import { Button } from '../ui/Button';
import { LoginRequired } from '../ui/EmptyState';
import { Loading } from '../ui/Spinner';
import { IconNext, IconPlay, IconRetry } from '../ui/icons';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const DAY = 24 * 3600 * 1000;

/** Appel REST : données, ou `null` en cas d'échec. */
async function get<T>(method: string, path: string, body?: unknown): Promise<T | null> {
  const res = await request<T>(method, path, body);
  return res.ok ? res.data : null;
}

/** Ligne en notation numérotée (« 1. e4 e5 2. Cf3 »). */
function lineText(moves: readonly string[], san: (s: string) => string): string {
  return moves.map((m, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${san(m)}` : san(m))).join(' ');
}

function statusLabel(line: OpeningLineSummary): string {
  if (line.status === 'new') return 'Nouvelle';
  if (line.due) return 'À réviser';
  const days = Math.max(1, Math.ceil(((line.dueAt ?? 0) - Date.now()) / DAY));
  return `${line.status === 'learned' ? '✓ Apprise' : 'En cours'} · dans ${days} j`;
}

/**
 * Entraînement sur une ligne : le joueur joue les coups de son camp, l'adversaire répond seul.
 * Au premier écart, le bon coup est montré puis la ligne recommence ; la révision compte comme
 * échouée (répétition espacée), elle n'est notée qu'une fois.
 */
function OpeningTrainer(props: {
  drill: OpeningDrill;
  /** Première erreur sur la ligne. */
  onFail: () => void;
  /** Ligne jouée jusqu'au bout ; `clean` : sans aucune erreur. */
  onComplete: (clean: boolean) => void;
  /** Panneau latéral : retour au répertoire, puis actions (recommencer, ligne suivante). */
  header: ReactNode;
  footer: ReactNode;
}) {
  const { line, steps } = props.drill;
  const san = useSan();
  const showLegalMoves = useSettings((s) => s.showLegalMoves);
  const [pieces, setPieces] = useState<DisplayedPiece[]>(() => piecesFromFen(START_FEN));
  const [ply, setPly] = useState(0);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [flash, setFlash] = useState<{
    square: Square;
    tone: 'success' | 'error';
    id: number;
  } | null>(null);
  /** Coup attendu après une erreur (SAN). */
  const [mistake, setMistake] = useState<string | null>(null);
  const [phase, setPhase] = useState<'playing' | 'showing' | 'done'>('playing');
  /** Une erreur a déjà été commise sur cette ligne (révision échouée). */
  const failed = useRef(false);
  const [hadError, setHadError] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      for (const t of timers.current) clearTimeout(t);
    },
    [],
  );
  const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const myTurn = (p: number) => (p % 2 === 0 ? 'w' : 'b') === line.color;

  const apply = (index: number) => {
    const step = steps[index];
    if (!step) return;
    setPieces((prev) => carryIds(prev, piecesFromFen(step.fen), step.uci));
    setLastMove({ from: step.uci.slice(0, 2) as Square, to: step.uci.slice(2, 4) as Square });
  };

  /** Après le coup `index` : réponse adverse automatique, ou fin de la ligne. */
  const advance = (index: number) => {
    const next = index + 1;
    if (next >= steps.length) {
      setPly(next);
      setPhase('done');
      playSound('success');
      props.onComplete(!failed.current);
      return;
    }
    if (myTurn(next)) {
      setPly(next);
      return;
    }
    setPly(next);
    later(() => {
      apply(next);
      advance(next);
    }, 450);
  };

  const restart = () => {
    setPieces(piecesFromFen(START_FEN));
    setLastMove(null);
    setPly(0);
    setPhase('playing');
    if (!myTurn(0)) {
      later(() => {
        apply(0);
        advance(0);
      }, 450);
    }
  };

  // Les Noirs : l'adversaire joue le premier coup.
  useEffect(() => {
    if (!myTurn(0)) {
      const t = setTimeout(() => {
        apply(0);
        advance(0);
      }, 450);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule fois, au montage
  }, []);

  const onMove = (from: Square, to: Square) => {
    const step = steps[ply];
    if (phase !== 'playing' || !step || !myTurn(ply)) return;
    // Coup illégal : la pièce revient, sans compter d'erreur.
    if (!step.legalMoves.some((m) => m.from === from && m.to === to)) return;
    if (step.uci.slice(0, 4) === `${from}${to}`) {
      setFlash((f) => ({ square: to, tone: 'success', id: (f?.id ?? 0) + 1 }));
      setMistake(null);
      apply(ply);
      advance(ply);
      return;
    }
    // Erreur : on montre le coup joué, puis le bon coup, puis la ligne recommence.
    playSound('failure');
    setFlash((f) => ({ square: to, tone: 'error', id: (f?.id ?? 0) + 1 }));
    setPieces((prev) =>
      prev
        .filter((p) => p.square !== to)
        .map((p) => (p.square === from ? { ...p, square: to } : p)),
    );
    setMistake(step.san);
    if (!failed.current) {
      failed.current = true;
      setHadError(true);
      props.onFail();
    }
    setPhase('showing');
    const at = ply;
    later(() => {
      const before = steps[at - 1];
      setPieces(piecesFromFen(before ? before.fen : START_FEN));
      apply(at);
    }, 700);
    later(restart, 2600);
  };

  const played = steps.slice(0, ply).map((s) => s.san);
  return (
    <BoardLayout
      className="exercise"
      testId="opening-trainer"
      board={
        <Board
          pieces={pieces}
          orientation={line.color}
          movable={phase === 'playing' && myTurn(ply) && ply < steps.length ? line.color : null}
          legalMoves={showLegalMoves && phase === 'playing' ? (steps[ply]?.legalMoves ?? []) : null}
          lastMove={lastMove}
          flash={flash}
          onMove={(from, to) => onMove(from, to)}
        />
      }
      side={
        <>
          {props.header}
          <p>
            <strong>{line.title}</strong>
          </p>
          <p className="muted">
            Avec les {SIDE[line.color]} · {line.group}
          </p>
          <p>{line.idea}</p>
          <p className="muted" data-testid="opening-played">
            {played.length > 0 ? lineText(played, san) : 'Position initiale.'}
          </p>
          <div
            className={`move-card puzzle-status ${phase === 'done' ? 'solved' : phase === 'showing' ? 'failed' : 'playing'}`}
            data-testid="opening-status"
          >
            {phase === 'playing' && (
              <p>
                {mistake
                  ? 'On recommence la ligne : à toi.'
                  : myTurn(ply)
                    ? `À toi : coup ${Math.floor(ply / 2) + 1} sur ${Math.ceil(steps.length / 2)}.`
                    : 'L’adversaire joue…'}
              </p>
            )}
            {phase === 'showing' && mistake && (
              <p className="loss" data-testid="opening-mistake">
                ✗ Le répertoire joue {san(mistake)}. On recommence la ligne.
              </p>
            )}
            {phase === 'done' && (
              <p className="win" data-testid="opening-done">
                {hadError
                  ? '✓ Ligne terminée. Elle reviendra demain.'
                  : '✓ Ligne réussie sans faute !'}
              </p>
            )}
          </div>
          {props.footer}
        </>
      }
    />
  );
}

/** Carte d'un camp : lignes groupées par famille, avec leur état de révision. */
function SideCard(props: {
  color: Color;
  lines: OpeningLineSummary[];
  busy: boolean;
  onTrain: (id: string) => void;
}) {
  const san = useSan();
  const groups = [...new Set(props.lines.map((l) => l.group))];
  const learned = props.lines.filter((l) => l.status === 'learned').length;
  return (
    <div className="panel page-panel" data-testid={`openings-${props.color}`}>
      <h3>Avec les {SIDE[props.color]}</h3>
      <p className="muted">
        {learned} ligne{learned > 1 ? 's' : ''} apprise{learned > 1 ? 's' : ''} sur{' '}
        {props.lines.length}.
      </p>
      {groups.map((group) => (
        <div key={group} className="lesson-phase">
          <h4>{group}</h4>
          <div className="lesson-list">
            {props.lines
              .filter((l) => l.group === group)
              .map((l) => (
                <div key={l.id} className="lesson-card" data-testid={`opening-${l.id}`}>
                  <span className="lesson-body">
                    <strong>{l.title}</strong>
                    <span className="muted">{lineText(l.moves, san)}</span>
                    <span>{l.idea}</span>
                  </span>
                  <span className={`lesson-status${l.status === 'learned' ? ' win' : ''}`}>
                    {statusLabel(l)}
                  </span>
                  <Button
                    size="s"
                    variant={l.due ? 'primary' : 'secondary'}
                    disabled={props.busy}
                    onClick={() => props.onTrain(l.id)}
                    data-testid={`opening-train-${l.id}`}
                  >
                    <IconPlay size={16} />
                    Réviser
                  </Button>
                </div>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Répertoire d'ouvertures : partie italienne avec les Blancs, 1…e5 et 1…d5 avec les Noirs,
 * révisés en répétition espacée (1, 3, 7 puis 21 jours, comme les puzzles).
 */
export function Openings() {
  const user = useSession((s) => s.user);
  const [data, setData] = useState<OpeningsResponse | null>(null);
  const [drill, setDrill] = useState<OpeningDrill | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = () =>
    void get<OpeningsResponse>('GET', '/api/openings').then((r) => r && setData(r));
  useEffect(() => {
    if (user) void get<OpeningsResponse>('GET', '/api/openings').then((r) => r && setData(r));
  }, [user]);

  if (!user) {
    return <LoginRequired title="Ouvertures" text="Connecte-toi pour suivre ta progression." />;
  }
  if (data === null) return <Loading label="Chargement du répertoire…" />;

  const open = (next: OpeningDrill | null) => {
    setDrill(next);
    setFinished(false);
    setAttempt((a) => a + 1);
  };
  const train = async (id: string) => {
    setBusy(true);
    setError(null);
    const next = await get<OpeningDrill>('GET', `/api/openings/${id}`);
    setBusy(false);
    if (next) open(next);
    else setError('Impossible de charger la ligne.');
  };
  const reviewNext = async () => {
    setBusy(true);
    setError(null);
    const res = await get<OpeningNextResponse>('GET', '/api/openings/next');
    setBusy(false);
    if (!res) setError('Impossible de charger la ligne.');
    else if (!res.drill) {
      setDrill(null);
      reload();
    } else open(res.drill);
  };
  // Révision notée une seule fois : échec à la première erreur, réussite si la ligne est sans faute.
  const record = (id: string, success: boolean) =>
    void get('POST', `/api/openings/${id}/result`, { success }).then(reload);

  if (drill) {
    return (
      <OpeningTrainer
        key={attempt}
        drill={drill}
        onFail={() => record(drill.line.id, false)}
        onComplete={(clean) => {
          if (clean) record(drill.line.id, true);
          setFinished(true);
        }}
        header={
          <Button variant="link" onClick={() => (setDrill(null), reload())}>
            ← Répertoire
          </Button>
        }
        footer={
          <div className="actions">
            <Button onClick={() => open(drill)} data-testid="opening-again">
              <IconRetry size={18} />
              Recommencer
            </Button>
            {finished ? (
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => void reviewNext()}
                data-testid="opening-next"
              >
                Ligne suivante
                <IconNext size={18} />
              </Button>
            ) : null}
          </div>
        }
      />
    );
  }

  const byColor = (c: Color) => data.lines.filter((l) => l.color === c);
  return (
    <div className="page">
      <div className="panel page-panel">
        <a href="#/lessons" className="back-link">
          ← Leçons
        </a>
        <h2>Répertoire d’ouvertures</h2>
        <p className="muted">
          Joue les coups de ton camp, l’adversaire répond tout seul. Une ligne réussie revient après
          1, 3, 7 puis 21 jours ; une erreur la fait revenir le lendemain.
        </p>
        <p data-testid="openings-due">
          {data.due > 0
            ? `${data.due} ligne${data.due > 1 ? 's' : ''} à réviser aujourd’hui.`
            : 'Aucune ligne due aujourd’hui.'}
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <Button
          variant="primary"
          disabled={busy}
          onClick={() => void reviewNext()}
          data-testid="openings-review"
        >
          <IconPlay size={18} />
          {data.due > 0 ? 'Réviser les lignes dues' : 'Apprendre une nouvelle ligne'}
        </Button>
      </div>
      <SideCard color="w" lines={byColor('w')} busy={busy} onTrain={(id) => void train(id)} />
      <SideCard color="b" lines={byColor('b')} busy={busy} onTrain={(id) => void train(id)} />
    </div>
  );
}

/**
 * Revue : comparaison de la partie avec le répertoire du joueur (partie depuis la position
 * initiale seulement). Rien n'est affiché si la partie suit le répertoire ou n'y entre pas.
 */
export function RepertoireNote(props: {
  moves: readonly string[];
  color: Color;
  initialFen: string | undefined;
  onSelect: (ply: number) => void;
}) {
  const san = useSan();
  const [deviation, setDeviation] = useState<OpeningDeviation | null>(null);
  const standard = props.initialFen?.split(' ')[0] === START_FEN.split(' ')[0];
  const key = props.moves.slice(0, 40).join(' ');
  useEffect(() => {
    if (!standard) return;
    let live = true;
    void get<OpeningDeviationResponse>('POST', '/api/openings/deviation', {
      moves: key ? key.split(' ') : [],
      color: props.color,
    }).then((r) => live && setDeviation(r?.deviation ?? null));
    return () => {
      live = false;
    };
  }, [key, props.color, standard]);

  if (!standard || !deviation) return null;
  // L'adversaire sort dès son premier coup : la partie n'est jamais entrée dans le répertoire.
  if (deviation.by === 'opponent' && deviation.ply <= 2) return null;
  const number = `${deviation.moveNumber}${deviation.ply % 2 === 1 ? '.' : '…'}`;
  const expected = deviation.expected.map(san).join(' ou ');
  return (
    <div className="move-card" data-testid="repertoire-note">
      {deviation.by === 'player' ? (
        <p>
          <strong>
            Sorti du répertoire au coup{' '}
            <Button variant="link" onClick={() => props.onSelect(deviation.ply)}>
              {number} {san(deviation.played)}
            </Button>
          </strong>{' '}
          : le répertoire jouait {expected}. <a href="#/openings">Réviser mes ouvertures</a>
        </p>
      ) : (
        <p className="muted">
          Ton adversaire a quitté le répertoire au coup {number} {san(deviation.played)} (le
          répertoire prévoyait {expected}) : à partir de là, joue avec les principes.
        </p>
      )}
    </div>
  );
}
