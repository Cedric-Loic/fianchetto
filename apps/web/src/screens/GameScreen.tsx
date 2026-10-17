import { useEffect, useState } from 'react';
import type { AnalysisResponse, Color, GameResult, Square, ViewerGameState } from '@sq/shared';
import { EvalBar, EvalChart } from '../game/Analysis';
import { evalLabel, evalValue } from '../lib/eval';
import { api } from '../lib/api';
import { piecesFromFen } from '../lib/fen';
import { applyLocalMoves, type LocalMove } from '../lib/virtual';
import { Board } from '../game/Board';
import { MoveList } from '../game/MoveList';
import { PlayerBar } from '../game/PlayerBar';
import { send } from '../lib/net';
import { publicPositionAt } from '../lib/position';
import { useGame } from '../lib/store';
import { useSession } from '../lib/session';
import { REASONS, SIDE, VARIANT_LABEL } from './labels';
import { useSettings } from '../lib/settings';

function resultText(result: GameResult, state: ViewerGameState): string {
  if (result.winner === null) return `Partie nulle ${REASONS[result.reason]}`;
  return `${state.players[result.winner].name} (${SIDE[result.winner]}) gagne ${REASONS[result.reason]}`;
}

/**
 * Écran de partie (classique ou Secret Queen, à deux ou contre le bot) : plateau, barres joueur,
 * coups, actions, révélation de fin (Secret Queen).
 */
export function GameScreen({ state, onLeave }: { state: ViewerGameState; onLeave: () => void }) {
  const board = state.board;
  const { receivedAt, toast, peek, clearToast, setPeekHeld, rejections, focus, setFocus } =
    useGame();
  const me = state.viewer === 'public' ? null : state.viewer;
  const isBot = state.mode === 'bot';
  const classic = state.variant === 'classic';
  const user = useSession((s) => s.user);
  const [orientation, setOrientation] = useState<Color>(me ?? 'w');
  // Position consultée dans l'historique ; oubliée dès qu'un nouveau coup arrive.
  const [nav, setNav] = useState<{ ply: number; base: number } | null>(null);
  const [showEnd, setShowEnd] = useState(true);
  // Premoves (mode bot) : file de coups préparés pendant le tour du bot. `rej` mémorise le
  // compteur de refus : un refus (premove devenu illégal) annule toute la file.
  const [queue, setQueue] = useState<{ list: LocalMove[]; rej: number }>({ list: [], rej: 0 });
  const premoves = queue.rej === rejections ? queue.list : [];
  // Coup joué affiché tout de suite (sans attendre le serveur), oublié au snapshot suivant ou
  // au refus.
  const [pendingState, setPending] = useState<{
    move: LocalMove;
    base: number;
    rej: number;
  } | null>(null);
  const autoFlip = useSettings((s) => s.autoFlip);
  const showLegalMoves = useSettings((s) => s.showLegalMoves);
  // Analyse après la fin : positions réelles, évaluation, meilleur coup.
  const [analysis, setAnalysis] = useState<AnalysisResponse | 'loading' | 'error' | null>(null);
  const analysing = analysis !== null && analysis !== 'loading' && analysis !== 'error';

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clearToast, 1800);
    return () => clearTimeout(id);
  }, [toast, clearToast]);

  const plyCount = board?.moves.length ?? 0;
  const cursor = nav !== null && nav.base === plyCount ? nav.ply : null;
  const setCursor = (ply: number | null) => setNav(ply === null ? null : { ply, base: plyCount });

  const pending =
    pendingState && pendingState.base === plyCount && pendingState.rej === rejections
      ? pendingState.move
      : null;
  const play = (move: LocalMove) => {
    setPending({ move, base: plyCount, rej: rejections });
    send({ type: 'move', clientMoveId: crypto.randomUUID(), move });
  };

  // À mon tour, le premier premove part (un refus reçoit le message générique, comme un coup,
  // et annule les suivants).
  const myTurn = board?.turn === me && state.phase === 'playing';
  const nextPremove = myTurn && !pending ? premoves[0] : undefined;
  useEffect(() => {
    if (!nextPremove) return;
    /* eslint-disable react-hooks/set-state-in-effect -- chaque premove n'est envoyé qu'une fois */
    setPending({ move: nextPremove, base: plyCount, rej: rejections });
    setQueue((q) => ({ list: q.list.slice(1), rej: q.rej }));
    /* eslint-enable react-hooks/set-state-in-effect */
    send({ type: 'move', clientMoveId: crypto.randomUUID(), move: nextPremove });
  }, [nextPremove, plyCount, rejections]);

  // Mode concentration : Échap ou sortie du plein écran ramène à l'affichage classique.
  useEffect(() => {
    if (!focus) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setFocus(false);
    const onFs = () => !document.fullscreenElement && setFocus(false);
    window.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [focus, setFocus]);
  const enterFocus = () => {
    setFocus(true);
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  const exitFocus = () => {
    setFocus(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  };

  if (!board) return null;
  const ended = state.phase === 'ended';
  const live = cursor === null || cursor === plyCount;
  const shownPly = cursor ?? plyCount;
  const reveal = board.reveal;
  const realFens = reveal
    ? [reveal.realInitialFen, ...reveal.plies.map((p) => p.realFenAfter)]
    : [];
  const showReal = analysing && realFens.length > shownPly;
  const pieces = showReal
    ? piecesFromFen(realFens[shownPly] ?? '')
    : live
      ? applyLocalMoves(board.pieces, [...(pending ? [pending] : []), ...premoves])
      : publicPositionAt(board.moves, shownPly);
  // Ma dame secrète suit l'affichage local (coup en attente, premoves).
  const ownSecretId = board.ownSecret?.pieceId;
  const ownSecretSquare = ownSecretId
    ? (pieces.find((p) => p.id === ownSecretId)?.square ?? null)
    : null;
  const lastMove = shownPly > 0 ? board.moves[shownPly - 1] : null;
  const king = pieces.find((p) => p.type === 'k' && p.color === board.turn);
  const checkSquare = live && board.inCheck && king ? king.square : null;

  const crowns: Square[] = [];
  if (showReal && reveal) {
    // Analyse : on marque où se trouvent les deux dames secrètes à cette position.
    const atPly = publicPositionAt(board.moves, shownPly);
    for (const c of ['w', 'b'] as const) {
      const piece = atPly.find((p) => p.id === reveal.secrets[c].pieceId);
      if (piece) crowns.push(piece.square);
    }
  } else if (ended && board.reveal && live) {
    for (const c of ['w', 'b'] as const) {
      const sq = board.reveal.secrets[c].finalSquare;
      if (sq) crowns.push(sq);
    }
  } else if (!ended && live && peek?.square) {
    crowns.push(peek.square);
  } else if (!ended && live && isBot && ownSecretSquare) {
    // Mode bot : marqueur discret et permanent sur MA dame secrète (moi seul le vois).
    crowns.push(ownSecretSquare);
  }
  // Mon camp peut jouer (mode bot : seulement à mon tour ; hot-seat : le camp au trait).
  const movable =
    ended || !live || pending ? null : isBot ? (board.turn === me ? me : null) : board.turn;
  const actor = isBot ? (me ?? 'w') : board.turn;

  // Hot-seat : option « retourner le plateau vers le camp au trait ».
  const view: Color = !isBot && autoFlip && !ended ? board.turn : orientation;
  const bottom = view;
  const top: Color = view === 'w' ? 'b' : 'w';
  const bar = (color: Color) => (
    <PlayerBar
      color={color}
      player={state.players[color]}
      capturedByMe={board.captured[color === 'w' ? 'b' : 'w']}
      captured={board.captured}
      clock={
        state.clock
          ? {
              ms: state.clock.remainingMs[color],
              running: state.clock.running === color,
              receivedAt,
            }
          : null
      }
      active={!ended && board.turn === color}
    />
  );

  const current = analysing ? analysis.plies[shownPly] : undefined;
  const best = current?.bestMoveUci;
  const bestArrow = best
    ? { from: best.slice(0, 2) as Square, to: best.slice(2, 4) as Square }
    : null;
  const startAnalysis = () => {
    setAnalysis('loading');
    void api.analysis(state.gameId).then((a) => setAnalysis(a ?? 'error'));
  };

  const holdStart = () => {
    setPeekHeld(true);
    send({ type: 'peek-secret' });
  };
  const holdEnd = () => setPeekHeld(false);

  const boardElement = (
    <Board
      extraArrows={bestArrow ? [bestArrow] : []}
      pieces={pieces}
      orientation={view}
      premoveColor={isBot && !ended && live && (board.turn !== me || pending) ? me : null}
      premoves={premoves}
      onPremove={(m) => setQueue({ list: [...premoves, m], rej: rejections })}
      onCancelPremove={() => setQueue({ list: [], rej: rejections })}
      movable={movable}
      legalMoves={classic && showLegalMoves && live ? board.legalMoves : null}
      ownSecretSquare={isBot ? ownSecretSquare : null}
      lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
      checkSquare={checkSquare}
      crowns={crowns}
      onMove={(from, to, promotion) => play(promotion ? { from, to, promotion } : { from, to })}
    />
  );

  if (focus) {
    // Mode concentration : l'échiquier seul (et les pendules si la partie en a).
    const slimClock = (color: Color) =>
      state.clock && (
        <div className="focus-clock">
          <span>{state.players[color].name}</span>
          {bar(color)}
        </div>
      );
    return (
      <div className="focus-overlay" data-testid="focus">
        <button
          className="focus-close"
          title="Quitter le mode concentration (Échap)"
          onClick={exitFocus}
        >
          ✕
        </button>
        <div className="focus-board">
          {slimClock(top)}
          <div className="board-wrap">
            {boardElement}
            {toast && <div className="toast">{toast}</div>}
          </div>
          {slimClock(bottom)}
        </div>
      </div>
    );
  }

  return (
    <div className="game">
      {analysing && <EvalBar value={evalValue(current)} />}
      <div className="board-column">
        {bar(top)}
        <div className="board-wrap">
          {boardElement}
          {toast && <div className="toast">{toast}</div>}
        </div>
        {bar(bottom)}
      </div>

      <aside className="panel side-panel">
        <div className="turn-banner">
          {ended
            ? 'Partie terminée'
            : `Au tour de ${state.players[board.turn].name} (${SIDE[board.turn]})${board.inCheck ? ' — échec !' : ''}`}
          <span className="variant-badge">{VARIANT_LABEL[state.variant]}</span>
          {state.rated && <span className="rated-badge">Classée</span>}
        </div>
        {analysing && (
          <div className="analysis-panel" data-testid="analysis">
            <EvalChart analysis={analysis} cursor={shownPly} onSelect={setCursor} />
            <p>
              Évaluation : <strong>{evalLabel(current)}</strong>
              {current?.bestMoveSan && (
                <>
                  {' '}
                  · meilleur coup : <span className="best-move">{current.bestMoveSan}</span>
                </>
              )}
            </p>
          </div>
        )}
        <MoveList
          moves={board.moves}
          labels={analysing ? reveal?.plies.map((p) => p.realSan) : undefined}
          cursor={shownPly}
          onSelect={setCursor}
        />
        <div className="nav">
          <button title="Début" onClick={() => setCursor(0)}>
            ⏮
          </button>
          <button title="Précédent" onClick={() => setCursor(Math.max(0, shownPly - 1))}>
            ◀
          </button>
          <button title="Suivant" onClick={() => setCursor(Math.min(plyCount, shownPly + 1))}>
            ▶
          </button>
          <button title="Fin" onClick={() => setCursor(null)}>
            ⏭
          </button>
          <button title="Mode concentration" data-testid="focus-button" onClick={enterFocus}>
            ⛶
          </button>
          <button title="Retourner le plateau" onClick={() => setOrientation(top)}>
            ⇅
          </button>
        </div>

        {!ended && (
          <>
            {!isBot && !classic && (
              <button
                className="peek"
                data-testid="peek"
                onPointerDown={holdStart}
                onPointerUp={holdEnd}
                onPointerLeave={holdEnd}
                onPointerCancel={holdEnd}
              >
                Voir ma dame secrète ({SIDE[board.turn]}) — maintenir
              </button>
            )}
            {state.drawOffer !== null && isBot ? (
              <div className="draw-offer">Nulle proposée, en attente de la réponse…</div>
            ) : state.drawOffer !== null ? (
              <div className="draw-offer">
                <p>
                  {state.players[state.drawOffer].name} propose la nulle.{' '}
                  {state.players[state.drawOffer === 'w' ? 'b' : 'w'].name} :
                </p>
                <button onClick={() => send({ type: 'answer-draw', accept: true })}>
                  Accepter
                </button>
                <button onClick={() => send({ type: 'answer-draw', accept: false })}>
                  Refuser
                </button>
              </div>
            ) : (
              <div className="actions">
                <button onClick={() => send({ type: 'offer-draw', color: actor })}>½ Nulle</button>
                <button
                  onClick={() =>
                    window.confirm(`${state.players[actor].name} abandonne ?`) &&
                    send({ type: 'resign', color: actor })
                  }
                >
                  ⚑ Abandonner
                </button>
              </div>
            )}
          </>
        )}
        {ended && (
          <div className="actions">
            <button className="primary" onClick={() => send({ type: 'offer-rematch' })}>
              Revanche
            </button>
            <button onClick={onLeave}>Nouvelle partie</button>
          </div>
        )}
        {ended && (
          <div className="actions">
            {!analysing && (
              <button onClick={startAnalysis} disabled={analysis === 'loading'}>
                {analysis === 'loading' ? 'Analyse en cours…' : '🔍 Analyser la partie'}
              </button>
            )}
            {analysing && <button onClick={() => setAnalysis(null)}>Vue publique</button>}
            <a className="button" href={`/api/games/${state.gameId}/pgn`} download="partie.pgn">
              ⬇ PGN
            </a>
          </div>
        )}
        {analysis === 'error' && <p className="error">Analyse impossible.</p>}
      </aside>

      {ended && board.result && (classic || board.reveal) && showEnd && (
        <div className="modal-backdrop" onClick={() => setShowEnd(false)}>
          <div className="modal" data-testid="end-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{resultText(board.result, state)}</h2>
            {state.rated && me && user && state.players[me].rating !== null && (
              <p className="elo-change" data-testid="elo-change">
                Elo {VARIANT_LABEL[state.variant]} : {state.players[me].rating} →{' '}
                <strong>{user.ratings[state.variant].rating}</strong>
              </p>
            )}
            {board.reveal && <h3>Les dames secrètes</h3>}
            {(['w', 'b'] as const).map((c) => {
              const s = board.reveal?.secrets[c];
              if (!s) return null;
              return (
                <p key={c} data-testid={`reveal-${c}`}>
                  {state.players[c].name} ({SIDE[c]}) : le pion de{' '}
                  <strong>{s.initialSquare}</strong>
                  {s.finalSquare
                    ? `, aujourd'hui en ${s.finalSquare}`
                    : ', capturé en cours de partie'}
                </p>
              );
            })}
            <div className="actions">
              <button className="primary" onClick={() => send({ type: 'offer-rematch' })}>
                Revanche
              </button>
              <button onClick={() => setShowEnd(false)}>Voir le plateau</button>
              <button onClick={onLeave}>Nouvelle partie</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
