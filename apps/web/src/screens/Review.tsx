import { useEffect, useState } from 'react';
import type {
  Color,
  ExplanationKind,
  MoveClass,
  ReviewMove,
  ReviewResponse,
  Square,
} from '@sq/shared';
import { EvalBar, EvalChart } from '../game/Analysis';
import { CLASS_COLOR, CLASS_LABEL, CLASS_SYMBOL } from '../lib/classes';
import { Board } from '../game/Board';
import { api } from '../lib/api';
import { evalLabel, evalValue } from '../lib/eval';
import { piecesFromFen } from '../lib/fen';
import { SIDE, VARIANT_LABEL } from './labels';

const ERRORS: readonly MoveClass[] = ['inaccuracy', 'mistake', 'blunder'];
const SOURCE_LABEL = { local: 'Partie locale', pgn: 'Import PGN', chesscom: 'chess.com' } as const;

const isError = (m: ReviewMove) => ERRORS.includes(m.classification);

/** Liste des coups de la revue, avec le symbole de chaque classe. */
function ReviewMoveList(props: {
  moves: readonly ReviewMove[];
  cursor: number;
  onSelect: (ply: number) => void;
}) {
  const rows = [];
  for (let i = 0; i < props.moves.length; i += 2) {
    rows.push(
      <div className="move-row" key={i}>
        <span className="move-number">{i / 2 + 1}.</span>
        {[props.moves[i], props.moves[i + 1]].map((m, k) =>
          m ? (
            <button
              key={m.ply}
              className={`move${props.cursor === m.ply ? ' current' : ''}`}
              onClick={() => props.onSelect(m.ply)}
            >
              {m.san}
              {m.classification !== 'good' && m.classification !== 'excellent' && (
                <span className="class-symbol" style={{ color: CLASS_COLOR[m.classification] }}>
                  {' '}
                  {CLASS_SYMBOL[m.classification]}
                </span>
              )}
            </button>
          ) : (
            <span key={`empty-${k}`} className="move" />
          ),
        )}
      </div>,
    );
  }
  return (
    <div className="move-list" data-testid="move-list">
      {rows}
    </div>
  );
}

/**
 * Revue de partie (coach) : analyse Stockfish de chaque coup, classe, explication des erreurs,
 * précision des deux camps, courbe d'évaluation, meilleur coup en flèche. Partie locale
 * terminée ou importée ; l'analyse se fait en arrière-plan sur le serveur.
 */
/** Conseil du coach selon l'erreur la plus fréquente de la partie. */
const TIPS: Record<ExplanationKind, string> = {
  'hanging-piece':
    'Avant chaque coup, vérifie que la pièce jouée, et celles qu’elle protégeait, restent défendues.',
  'allowed-mate':
    'Après ton coup envisagé, regarde les échecs possibles de l’adversaire : ton roi est-il en sécurité ?',
  'allowed-fork':
    'Repère les cases d’où un cavalier ou un pion adverse attaquerait deux de tes pièces à la fois.',
  'material-loss':
    'Avant de jouer, cherche les prises et menaces de l’adversaire après ton coup (routine « échecs, prises, menaces »).',
  'missed-mate': 'À chaque coup, cherche d’abord tes échecs : un mat se cache parfois derrière.',
  'missed-fork':
    'Cherche les coups qui attaquent deux cibles à la fois : fourchettes, échecs doubles.',
  'missed-material':
    'Avant de jouer, vérifie si une pièce adverse est en prise : prends ce qu’on te donne.',
  generic:
    'Compare deux ou trois coups candidats avant de jouer, surtout dans les positions tendues.',
};

/** Les 3 plus grosses erreurs du joueur et un conseil (bilan du coach). */
function CoachSummary(props: {
  moves: readonly ReviewMove[];
  color: Color;
  onSelect: (ply: number) => void;
}) {
  const errors = props.moves.filter((m) => m.color === props.color && isError(m));
  const key = [...errors]
    .sort((a, b) => b.winBefore - b.winAfter - (a.winBefore - a.winAfter))
    .slice(0, 3)
    .sort((a, b) => a.ply - b.ply);
  const kinds = new Map<ExplanationKind, number>();
  for (const m of errors) {
    if (m.explanation) kinds.set(m.explanation.kind, (kinds.get(m.explanation.kind) ?? 0) + 1);
  }
  const main = [...kinds.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return (
    <div className="move-card" data-testid="coach-summary">
      <p>
        <strong>Bilan du coach</strong>
      </p>
      {key.length === 0 ? (
        <p>Aucune erreur notable de ta part : bravo ! Essaie un niveau de bot au-dessus.</p>
      ) : (
        <>
          {key.map((m) => (
            <p key={m.ply} className="key-moment">
              <button className="link" onClick={() => props.onSelect(m.ply)}>
                {Math.ceil(m.ply / 2)}
                {m.color === 'w' ? '.' : '…'} {m.san} {CLASS_SYMBOL[m.classification]}
              </button>{' '}
              {m.explanation?.text}
            </p>
          ))}
          {main && (
            <p data-testid="coach-tip">
              <strong>Conseil :</strong> {TIPS[main]}
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function Review({ id }: { id: string }) {
  const [data, setData] = useState<ReviewResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [replayLevel, setReplayLevel] = useState(4);
  const [replayError, setReplayError] = useState<string | null>(null);

  // Chargement, lancement de l'analyse si besoin, puis suivi de sa progression.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let res = await api.review(id);
      const status = res.ok ? res.data.state.status : null;
      if (status === 'none' || (attempt > 0 && status === 'error')) res = await api.startReview(id);
      while (!cancelled) {
        if (!res.ok) {
          setFailure(
            res.status === 409 ? "La partie n'est pas encore terminée." : 'Partie introuvable.',
          );
          return;
        }
        setData(res.data);
        const current = res.data.state.status;
        if (current !== 'queued' && current !== 'running') return;
        await new Promise((resolve) => setTimeout(resolve, 700));
        if (cancelled) return;
        res = await api.review(id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const review = data?.state.status === 'done' ? data.state.review : null;
  const total = review?.moves.length ?? 0;

  // Flèches du clavier : coup précédent / suivant.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setCursor((c) => Math.max(0, c - 1));
      if (e.key === 'ArrowRight') setCursor((c) => Math.min(total, c + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  if (failure) return <div className="loading">{failure}</div>;
  if (!data) return <div className="loading">Chargement…</div>;
  const { info, state } = data;

  if (state.status !== 'done' || !review) {
    const progress = state.status === 'running' ? Math.round(state.progress * 100) : 0;
    return (
      <div className="page">
        <div className="panel page-panel review-wait" data-testid="review-progress">
          <h2>
            Revue : {info.white} – {info.black}
          </h2>
          {state.status === 'error' ? (
            <>
              <p className="error">L'analyse a échoué.</p>
              <button onClick={() => setAttempt((a) => a + 1)}>Réessayer</button>
            </>
          ) : (
            <>
              <p>
                {state.status === 'running'
                  ? `Analyse Stockfish en cours… ${progress} %`
                  : 'En attente : d’autres parties sont en cours d’analyse…'}
              </p>
              <div className="progress">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const ply = Math.min(cursor, total);
  const move = ply > 0 ? review.moves[ply - 1] : undefined;
  const before = ply > 0 ? review.evals[ply - 1] : undefined;
  const here = review.evals[ply];
  const pieces = piecesFromFen(review.positions[ply] ?? '');
  const base: Color = info.userColor ?? 'w';
  const orientation: Color = flipped ? (base === 'w' ? 'b' : 'w') : base;
  const arrow = (uci: string) => ({
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
  });
  // Meilleur coup à la place du coup joué (s'il n'était pas déjà le meilleur).
  const bestArrow =
    move && move.classification !== 'best' && before?.bestMoveUci
      ? [arrow(before.bestMoveUci)]
      : [];
  const marks = review.moves.filter(isError).map((m) => ({ ply: m.ply, cls: m.classification }));
  // Moments clés : erreurs du joueur (ou des deux camps si son camp est inconnu).
  const keyMoves = review.moves.filter(
    (m) => isError(m) && (info.userColor === null || m.color === info.userColor),
  );
  const prevKey = [...keyMoves].reverse().find((m) => m.ply < ply);
  const nextKey = keyMoves.find((m) => m.ply > ply);
  const name = (c: Color) => (c === 'w' ? info.white : info.black);

  /** Entraînement depuis la position d'avant l'erreur, côté du joueur qui s'est trompé. */
  const replay = async (m: ReviewMove) => {
    setReplayError(null);
    const res = await api.createGame({
      mode: 'bot',
      variant: 'classic',
      level: replayLevel,
      color: m.color,
      timeControl: 'untimed',
      training: true,
      fen: review.positions[m.ply - 1],
    });
    if (res) location.hash = `#/game/${res.gameId}`;
    else setReplayError('Connecte-toi pour rejouer contre le bot.');
  };

  const accuracyCard = (c: Color) => (
    <div className="accuracy-card" data-testid={`accuracy-${c}`} key={c}>
      <span className="muted">
        {name(c)} ({SIDE[c]})
      </span>
      <strong>{review.accuracy[c] === null ? '—' : `${review.accuracy[c]} %`}</strong>
      <span className="counts">
        {(['blunder', 'mistake', 'inaccuracy'] as const).map((cls) => (
          <span key={cls} style={{ color: CLASS_COLOR[cls] }} title={CLASS_LABEL[cls]}>
            {review.counts[c][cls]} {CLASS_SYMBOL[cls]}
          </span>
        ))}
      </span>
    </div>
  );

  return (
    <div className="game review">
      <EvalBar value={evalValue(here)} />
      <div className="board-column">
        <div className="player-bar simple">{name(orientation === 'w' ? 'b' : 'w')}</div>
        <div className="board-wrap">
          <Board
            pieces={pieces}
            orientation={orientation}
            movable={null}
            lastMove={move ? arrow(move.uci) : null}
            extraArrows={bestArrow}
          />
        </div>
        <div className="player-bar simple">{name(orientation)}</div>
      </div>

      <aside className="panel side-panel">
        <div className="turn-banner">
          {info.white} – {info.black} · {info.result}
          <span className="variant-badge">{VARIANT_LABEL[info.variant]}</span>
          <span className="variant-badge">{SOURCE_LABEL[info.source]}</span>
        </div>
        {info.url && (
          <a className="muted" href={info.url} target="_blank" rel="noreferrer">
            Voir la partie d'origine
          </a>
        )}
        <div className="accuracy-row">{(['w', 'b'] as const).map(accuracyCard)}</div>
        <EvalChart evals={review.evals} cursor={ply} onSelect={setCursor} marks={marks} />
        {info.userColor && (
          <CoachSummary moves={review.moves} color={info.userColor} onSelect={setCursor} />
        )}

        <div className="move-card" data-testid="move-card">
          {move ? (
            <>
              <p>
                <strong>
                  {Math.ceil(move.ply / 2)}
                  {move.color === 'w' ? '.' : '…'} {move.san}
                </strong>{' '}
                <span
                  className="class-badge"
                  style={{ background: CLASS_COLOR[move.classification] }}
                >
                  {CLASS_LABEL[move.classification]}
                </span>{' '}
                <span className="muted">({evalLabel(here)})</span>
              </p>
              {move.explanation && <p data-testid="explanation">{move.explanation.text}</p>}
              {isError(move) && (info.userColor === null || move.color === info.userColor) && (
                <div className="replay">
                  <button data-testid="replay" onClick={() => void replay(move)}>
                    ↺ Rejouer d'ici contre le bot
                  </button>
                  <select
                    value={replayLevel}
                    aria-label="Niveau du bot"
                    onChange={(e) => setReplayLevel(Number(e.target.value))}
                  >
                    {[1, 2, 3, 4, 5].map((l) => (
                      <option key={l} value={l}>
                        Niveau {l}
                      </option>
                    ))}
                  </select>
                  {replayError && <span className="error"> {replayError}</span>}
                </div>
              )}
              {move.classification !== 'best' &&
                move.explanation?.kind !== 'generic' &&
                before?.bestMoveSan && (
                  <p className="muted">
                    Meilleur : <span className="best-move">{before.bestMoveSan}</span>
                  </p>
                )}
            </>
          ) : (
            <p className="muted">
              Position initiale. Utilise ◀ ▶ (ou les flèches du clavier) pour parcourir la partie.
            </p>
          )}
        </div>

        <div className="nav">
          <button
            disabled={!prevKey}
            onClick={() => prevKey && setCursor(prevKey.ply)}
            title="Erreur précédente"
          >
            ◀ !?
          </button>
          <button
            disabled={!nextKey}
            data-testid="next-mistake"
            onClick={() => nextKey && setCursor(nextKey.ply)}
            title="Erreur suivante"
          >
            !? ▶
          </button>
        </div>
        <ReviewMoveList moves={review.moves} cursor={ply} onSelect={setCursor} />
        <div className="nav">
          <button title="Début" onClick={() => setCursor(0)}>
            ⏮
          </button>
          <button title="Précédent" onClick={() => setCursor(Math.max(0, ply - 1))}>
            ◀
          </button>
          <button title="Suivant" onClick={() => setCursor(Math.min(total, ply + 1))}>
            ▶
          </button>
          <button title="Fin" onClick={() => setCursor(total)}>
            ⏭
          </button>
          <button title="Retourner le plateau" onClick={() => setFlipped(!flipped)}>
            ⇅
          </button>
        </div>
      </aside>
    </div>
  );
}
