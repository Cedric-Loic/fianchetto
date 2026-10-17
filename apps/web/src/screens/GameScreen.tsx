import { useEffect, useState } from 'react';
import type { Color, GameResult, Square, ViewerGameState } from '@sq/shared';
import { Board } from '../game/Board';
import { MoveList } from '../game/MoveList';
import { PlayerBar } from '../game/PlayerBar';
import { send } from '../lib/net';
import { publicPositionAt } from '../lib/position';
import { useGame } from '../lib/store';

const SIDE: Record<Color, string> = { w: 'Blancs', b: 'Noirs' };

const REASONS: Record<GameResult['reason'], string> = {
  checkmate: 'par échec et mat',
  resignation: 'par abandon',
  timeout: 'au temps',
  stalemate: 'par pat',
  'insufficient-material': 'par manque de matériel',
  'timeout-vs-insufficient-material': 'temps écoulé, matériel insuffisant',
  'fifty-move-rule': 'par la règle des 50 coups',
  'threefold-repetition': 'par triple répétition',
  agreement: 'par accord mutuel',
};

function resultText(result: GameResult, state: ViewerGameState): string {
  if (result.winner === null) return `Partie nulle ${REASONS[result.reason]}`;
  return `${state.players[result.winner].name} (${SIDE[result.winner]}) gagne ${REASONS[result.reason]}`;
}

/** Écran de partie hot-seat : plateau, barres joueur, coups, actions, révélation de fin. */
export function GameScreen({ state, onLeave }: { state: ViewerGameState; onLeave: () => void }) {
  const board = state.board;
  const { receivedAt, toast, peek, clearToast, setPeekHeld } = useGame();
  const [orientation, setOrientation] = useState<Color>('w');
  // Position consultée dans l'historique ; oubliée dès qu'un nouveau coup arrive.
  const [nav, setNav] = useState<{ ply: number; base: number } | null>(null);
  const [showEnd, setShowEnd] = useState(true);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(clearToast, 1800);
    return () => clearTimeout(id);
  }, [toast, clearToast]);

  const plyCount = board?.moves.length ?? 0;
  const cursor = nav !== null && nav.base === plyCount ? nav.ply : null;
  const setCursor = (ply: number | null) => setNav(ply === null ? null : { ply, base: plyCount });

  if (!board) return null;
  const ended = state.phase === 'ended';
  const live = cursor === null || cursor === plyCount;
  const shownPly = cursor ?? plyCount;
  const pieces = live ? board.pieces : publicPositionAt(board.moves, shownPly);
  const lastMove = shownPly > 0 ? board.moves[shownPly - 1] : null;
  const king = pieces.find((p) => p.type === 'k' && p.color === board.turn);
  const checkSquare = live && board.inCheck && king ? king.square : null;

  const crowns: Square[] = [];
  if (ended && board.reveal && live) {
    for (const c of ['w', 'b'] as const) {
      const sq = board.reveal.secrets[c].finalSquare;
      if (sq) crowns.push(sq);
    }
  } else if (!ended && live && peek?.square) {
    crowns.push(peek.square);
  }

  const bottom = orientation;
  const top: Color = orientation === 'w' ? 'b' : 'w';
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

  const holdStart = () => {
    setPeekHeld(true);
    send({ type: 'peek-secret' });
  };
  const holdEnd = () => setPeekHeld(false);

  return (
    <div className="game">
      <div className="board-column">
        {bar(top)}
        <div className="board-wrap">
          <Board
            pieces={pieces}
            orientation={orientation}
            movable={!ended && live ? board.turn : null}
            lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
            checkSquare={checkSquare}
            crowns={crowns}
            onMove={(from, to, promotion) =>
              send({
                type: 'move',
                clientMoveId: crypto.randomUUID(),
                move: promotion ? { from, to, promotion } : { from, to },
              })
            }
          />
          {toast && <div className="toast">{toast}</div>}
        </div>
        {bar(bottom)}
      </div>

      <aside className="panel side-panel">
        <div className="turn-banner">
          {ended
            ? 'Partie terminée'
            : `Au tour de ${state.players[board.turn].name} (${SIDE[board.turn]})${board.inCheck ? ' — échec !' : ''}`}
        </div>
        <MoveList moves={board.moves} cursor={shownPly} onSelect={setCursor} />
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
          <button title="Retourner le plateau" onClick={() => setOrientation(top)}>
            ⇅
          </button>
        </div>

        {!ended && (
          <>
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
            {state.drawOffer !== null ? (
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
                <button onClick={() => send({ type: 'offer-draw', color: board.turn })}>
                  ½ Nulle
                </button>
                <button
                  onClick={() =>
                    window.confirm(`${state.players[board.turn].name} abandonne ?`) &&
                    send({ type: 'resign', color: board.turn })
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
      </aside>

      {ended && board.result && board.reveal && showEnd && (
        <div className="modal-backdrop" onClick={() => setShowEnd(false)}>
          <div className="modal" data-testid="end-modal" onClick={(e) => e.stopPropagation()}>
            <h2>{resultText(board.result, state)}</h2>
            <h3>Les dames secrètes</h3>
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
