import { useEffect, useState } from 'react';
import {
  GENERIC_ILLEGAL_MOVE_MESSAGE,
  type Color,
  type HintResponse,
  type Square,
  type ViewerGameState,
} from '@sq/shared';
import { api } from '../lib/api';
import { applyLocalMoves, type LocalMove } from '../lib/virtual';
import { Board } from '../game/Board';
import { usePremoves } from '../game/usePremoves';
import { MoveList, MoveStrip } from '../game/MoveList';
import { MOBILE_QUERY, useMediaQuery } from '../lib/media';
import { PlayerBar } from '../game/PlayerBar';
import { send } from '../lib/net';
import { publicPositionAt } from '../lib/position';
import { piecesFromFen } from '../lib/fen';
import { useGame } from '../lib/store';
import { useSession } from '../lib/session';
import { SIDE, VARIANT_LABEL } from './labels';
import { useSettings } from '../lib/settings';
import { useSan } from '../lib/notation';
import { EndDialog } from '../game/EndDialog';
import { moveAnnouncement } from '../game/outcome';
import { GameActions, ResignDialog } from '../game/GameActions';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import {
  IconBulb,
  IconChart,
  IconClose,
  IconDownload,
  IconDraw,
  IconExpand,
  IconFlag,
  IconFirst,
  IconFlip,
  IconLast,
  IconNext,
  IconPrev,
  IconRetry,
  IconTrophy,
  IconUndo,
} from '../ui/icons';

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
  const [confirmResign, setConfirmResign] = useState(false);
  const justEnded = useGame((s) => s.lastCause?.kind === 'game-ended');
  const san = useSan();
  // Premoves (mode bot, pas à deux sur l'écran) : file de coups préparés pendant le tour du bot.
  // Un refus (premove devenu illégal) change le compteur de refus et annule toute la file.
  const premoveOn = useSettings((s) => s.premoves);
  const queue = usePremoves(rejections, premoveOn && isBot);
  const premoves = queue.premoves;
  // Coup joué affiché tout de suite (sans attendre le serveur), oublié au snapshot suivant ou
  // au refus.
  const [pendingState, setPending] = useState<{
    move: LocalMove;
    base: number;
    rej: number;
  } | null>(null);
  const autoFlip = useSettings((s) => s.autoFlip);
  const showLegalMoves = useSettings((s) => s.showLegalMoves);
  const guardOn = useSettings((s) => s.trainingGuard);
  // Entraînement : indice de la position courante (niveau 1 à 3), et coup en attente de
  // confirmation après un avertissement du garde-fou.
  const [hint, setHint] = useState<{ ply: number; data: HintResponse } | null>(null);
  const [guard, setGuard] = useState<{ move: LocalMove; warning: string; ply: number } | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  // Téléphone : bande de coups sous le plateau et barre d'actions fixe en bas.
  const mobile = useMediaQuery(MOBILE_QUERY);

  useEffect(() => {
    if (!toast) return;
    // Les messages de connexion restent plus longtemps que le refus de coup.
    const id = setTimeout(clearToast, toast === GENERIC_ILLEGAL_MOVE_MESSAGE ? 1800 : 4000);
    return () => clearTimeout(id);
  }, [toast, clearToast]);

  const plyCount = board?.moves.length ?? 0;
  const cursor = nav !== null && nav.base === plyCount ? nav.ply : null;
  const setCursor = (ply: number | null) => setNav(ply === null ? null : { ply, base: plyCount });

  const pending =
    pendingState && pendingState.base === plyCount && pendingState.rej === rejections
      ? pendingState.move
      : null;
  const commit = (move: LocalMove) => {
    setPending({ move, base: plyCount, rej: rejections });
    send({ type: 'move', clientMoveId: crypto.randomUUID(), move });
  };
  const play = (move: LocalMove) => {
    if (!state.training || !guardOn) return commit(move);
    // Garde-fou : le coup est affiché pendant la vérification, annulé s'il faut confirmer.
    setPending({ move, base: plyCount, rej: rejections });
    setChecking(true);
    const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
    void api.checkMove(state.gameId, uci).then((res) => {
      setChecking(false);
      if (res?.warning) {
        setPending(null);
        setGuard({ move, warning: res.warning, ply: plyCount });
      } else {
        send({ type: 'move', clientMoveId: crypto.randomUUID(), move });
      }
    });
  };
  const currentHint = hint && hint.ply === plyCount ? hint.data : null;
  const askHint = () => {
    const level = currentHint ? Math.min(3, currentHint.level + 1) : 1;
    void api.hint(state.gameId, level).then((data) => {
      if (data) setHint({ ply: plyCount, data });
    });
  };

  // À mon tour, le premier premove part (un refus reçoit le message générique, comme un coup,
  // et annule les suivants).
  const myTurn = board?.turn === me && state.phase === 'playing';
  const nextPremove = myTurn && !pending ? queue.next : undefined;
  const shiftPremove = queue.shift;
  useEffect(() => {
    if (!nextPremove) return;
    /* eslint-disable react-hooks/set-state-in-effect -- chaque premove n'est envoyé qu'une fois */
    setPending({ move: nextPremove, base: plyCount, rej: rejections });
    shiftPremove();
    /* eslint-enable react-hooks/set-state-in-effect */
    send({ type: 'move', clientMoveId: crypto.randomUUID(), move: nextPremove });
  }, [nextPremove, plyCount, rejections, shiftPremove]);

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
  const pieces = live
    ? applyLocalMoves(board.pieces, [...(pending ? [pending] : []), ...premoves])
    : publicPositionAt(
        board.moves,
        shownPly,
        state.initialFen ? piecesFromFen(state.initialFen) : undefined,
      );
  // Ma dame secrète suit l'affichage local (coup en attente, premoves).
  const ownSecretId = board.ownSecret?.pieceId;
  const ownSecretSquare = ownSecretId
    ? (pieces.find((p) => p.id === ownSecretId)?.square ?? null)
    : null;
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
  } else if (!ended && live && isBot && ownSecretSquare) {
    // Mode bot : marqueur discret et permanent sur MA dame secrète (moi seul le vois).
    crowns.push(ownSecretSquare);
  }
  // Mon camp peut jouer (mode bot : seulement à mon tour ; hot-seat : le camp au trait).
  const movable =
    ended || !live || pending || checking || guard
      ? null
      : isBot
        ? board.turn === me
          ? me
          : null
        : board.turn;
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

  const holdStart = () => {
    setPeekHeld(true);
    send({ type: 'peek-secret' });
  };
  const holdEnd = () => setPeekHeld(false);

  const boardElement = (
    <Board
      pieces={pieces}
      orientation={view}
      premoveColor={
        premoveOn && isBot && !ended && live && (board.turn !== me || pending) ? me : null
      }
      premoves={premoves}
      onPremove={queue.add}
      onCancelPremove={queue.clear}
      movable={movable}
      legalMoves={classic && showLegalMoves && live ? board.legalMoves : null}
      ownSecretSquare={isBot ? ownSecretSquare : null}
      lastMove={lastMove ? { from: lastMove.from, to: lastMove.to } : null}
      highlighted={live && currentHint?.from ? (currentHint.from as Square) : null}
      arrows={
        live && currentHint?.from && currentHint.to
          ? [{ from: currentHint.from as Square, to: currentHint.to as Square, kind: 'hint' }]
          : []
      }
      squareMarks={live && currentHint?.marks ? currentHint.marks : []}
      checkSquare={checkSquare}
      crowns={crowns}
      onMove={(from, to, promotion) => play(promotion ? { from, to, promotion } : { from, to })}
    />
  );

  const announce = lastMove && live ? moveAnnouncement(lastMove, shownPly, san) : '';
  const toastRegion = (
    <div className="toast-region" role="status" aria-live="polite">
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
  const actions = (compact: boolean) => (
    <GameActions
      state={state}
      actor={actor}
      compact={compact}
      onResign={() => setConfirmResign(true)}
    />
  );
  const overlays = (
    <>
      {/* Annonce du dernier coup pour les lecteurs d'écran. */}
      <p className="sr-only" aria-live="polite" data-testid="move-announce">
        {announce}
      </p>
      {confirmResign && !ended && (
        <ResignDialog state={state} actor={actor} onCancel={() => setConfirmResign(false)} />
      )}
      {guard && guard.ply === plyCount && (
        <Dialog
          title="Es-tu sûr ?"
          onClose={() => setGuard(null)}
          testId="guard"
          initialFocus="[data-autofocus]"
        >
          <p>{guard.warning}</p>
          <div className="actions">
            <Button variant="primary" data-autofocus onClick={() => setGuard(null)}>
              Je cherche un autre coup
            </Button>
            <Button
              onClick={() => {
                setGuard(null);
                commit(guard.move);
              }}
            >
              Jouer quand même
            </Button>
          </div>
        </Dialog>
      )}
      {ended && board.result && (classic || board.reveal) && showEnd && (
        <EndDialog
          state={state}
          result={board.result}
          ratingAfter={user ? user.ratings[state.variant].rating : null}
          justEnded={justEnded}
          onClose={() => setShowEnd(false)}
          onLeave={onLeave}
        />
      )}
    </>
  );

  if (focus) {
    // Mode concentration : l'échiquier seul (et les pendules si la partie en a), avec une barre
    // discrète d'actions sous le plateau.
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
          aria-label="Quitter le mode concentration"
          onClick={exitFocus}
        >
          <IconClose size={22} />
        </button>
        <div className="focus-board">
          {slimClock(top)}
          <div className="board-wrap">
            {boardElement}
            {toastRegion}
          </div>
          {slimClock(bottom)}
          <div className="focus-actions" data-testid="focus-actions">
            {ended ? (
              <div className="focus-actions-buttons">
                <Button size="s" variant="ghost" onClick={() => setShowEnd(true)}>
                  Résultat
                </Button>
                <Button size="s" variant="ghost" onClick={exitFocus}>
                  Quitter le mode concentration
                </Button>
              </div>
            ) : (
              actions(true)
            )}
          </div>
        </div>
        {overlays}
      </div>
    );
  }

  const turnText = ended
    ? 'Partie terminée'
    : isBot
      ? `${board.turn === me ? 'À toi de jouer' : 'Le bot réfléchit…'}${board.inCheck ? ' — échec !' : ''}`
      : `Au tour de ${state.players[board.turn].name} (${SIDE[board.turn]})${board.inCheck ? ' — échec !' : ''}`;

  // Barre d'actions du téléphone : navigation, plein écran, retourner, nulle et abandon (ou
  // résultat en fin de partie). Cibles d'au moins 44 px (styles.css).
  const mobileBar = (
    <nav className="mobile-actions" aria-label="Actions de la partie" data-testid="mobile-actions">
      {ended && (
        <button title="Début" aria-label="Début" onClick={() => setCursor(0)}>
          <IconFirst size={22} />
        </button>
      )}
      <button
        title="Précédent"
        aria-label="Précédent"
        onClick={() => setCursor(Math.max(0, shownPly - 1))}
      >
        <IconPrev size={22} />
      </button>
      <button
        title="Suivant"
        aria-label="Suivant"
        onClick={() => setCursor(Math.min(plyCount, shownPly + 1))}
      >
        <IconNext size={22} />
      </button>
      {ended && (
        <button title="Fin" aria-label="Fin" onClick={() => setCursor(null)}>
          <IconLast size={22} />
        </button>
      )}
      <button
        title="Plein écran"
        aria-label="Mode concentration"
        data-testid="focus-button"
        onClick={enterFocus}
      >
        <IconExpand size={22} />
      </button>
      <button
        title="Retourner le plateau"
        aria-label="Retourner le plateau"
        onClick={() => setOrientation(top)}
      >
        <IconFlip size={22} />
      </button>
      {ended ? (
        <button title="Résultat" aria-label="Résultat" onClick={() => setShowEnd(true)}>
          <IconTrophy size={22} />
        </button>
      ) : (
        <>
          <button
            title="Proposer nulle"
            aria-label="Proposer nulle"
            data-testid="offer-draw"
            disabled={state.drawOffer !== null}
            onClick={() => send({ type: 'offer-draw', color: actor })}
          >
            <IconDraw size={22} />
          </button>
          <button
            title="Abandonner"
            aria-label="Abandonner"
            data-testid="resign"
            onClick={() => setConfirmResign(true)}
          >
            <IconFlag size={22} />
          </button>
        </>
      )}
    </nav>
  );

  return (
    <div className={`game${mobile ? ' game-mobile' : ''}`}>
      <div className="board-column">
        {bar(top)}
        <div className="board-wrap">
          {boardElement}
          {toastRegion}
        </div>
        {bar(bottom)}
        {mobile && <MoveStrip moves={board.moves} cursor={shownPly} onSelect={setCursor} />}
      </div>

      <aside className="panel side-panel">
        <div className="turn-banner" data-testid="turn-banner">
          {turnText}
          <Badge>{VARIANT_LABEL[state.variant]}</Badge>
          {state.rated && <Badge tone="accent">Classée</Badge>}
          {state.training && <Badge tone="info">Entraînement</Badge>}
        </div>
        {!mobile && <MoveList moves={board.moves} cursor={shownPly} onSelect={setCursor} />}
        <div className="nav" hidden={mobile}>
          <button title="Début" aria-label="Début" onClick={() => setCursor(0)}>
            <IconFirst size={20} />
          </button>
          <button
            title="Précédent"
            aria-label="Précédent"
            onClick={() => setCursor(Math.max(0, shownPly - 1))}
          >
            <IconPrev size={20} />
          </button>
          <button
            title="Suivant"
            aria-label="Suivant"
            onClick={() => setCursor(Math.min(plyCount, shownPly + 1))}
          >
            <IconNext size={20} />
          </button>
          <button title="Fin" aria-label="Fin" onClick={() => setCursor(null)}>
            <IconLast size={20} />
          </button>
          <button
            title="Mode concentration"
            aria-label="Mode concentration"
            data-testid="focus-button"
            onClick={enterFocus}
          >
            <IconExpand size={20} />
          </button>
          <button
            title="Retourner le plateau"
            aria-label="Retourner le plateau"
            onClick={() => setOrientation(top)}
          >
            <IconFlip size={20} />
          </button>
        </div>

        {!ended && state.training && (
          <div className="training" data-testid="training-panel">
            <div className="actions">
              <Button onClick={askHint} disabled={board.turn !== me} data-testid="hint">
                <IconBulb size={18} />
                {currentHint && currentHint.level < 3 ? 'Indice suivant' : 'Indice'}
              </Button>
              <Button
                onClick={() => {
                  // Le coup affiché en attente et les premoves n'ont plus lieu d'être.
                  setPending(null);
                  queue.clear();
                  send({ type: 'takeback' });
                }}
                disabled={plyCount === 0}
                data-testid="takeback"
              >
                <IconUndo size={18} />
                Reprendre le coup
              </Button>
            </div>
            {currentHint && (
              <p className="hint-text" data-testid="hint-text">
                {currentHint.text}
              </p>
            )}
          </div>
        )}
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
            {/* Téléphone : nulle et abandon dans la barre du bas, sauf réponse à une offre. */}
            {(!mobile || state.drawOffer !== null) && actions(false)}
          </>
        )}
        {ended && (
          <div className="actions">
            <Button variant="primary" onClick={() => send({ type: 'offer-rematch' })}>
              <IconRetry size={18} />
              Revanche
            </Button>
            <Button onClick={onLeave}>Nouvelle partie</Button>
          </div>
        )}
        {ended && (
          <div className="actions">
            <Button href={`#/review/${state.gameId}`} data-testid="review-link">
              <IconChart size={18} />
              Revue de la partie
            </Button>
            <Button href={`/api/games/${state.gameId}/pgn`} download="partie.pgn">
              <IconDownload size={18} />
              PGN
            </Button>
          </div>
        )}
      </aside>
      {mobile && mobileBar}
      {overlays}
    </div>
  );
}
