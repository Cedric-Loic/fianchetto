import { create } from 'zustand';
import { playSound } from './sound';
import {
  GENERIC_ILLEGAL_MOVE_MESSAGE,
  type Color,
  type GameEvent,
  type ServerMessage,
  type Square,
  type ViewerGameState,
} from '@sq/shared';

/**
 * Store de l'interface : uniquement la vue reçue du serveur et de l'état d'affichage local.
 * Rien n'est persisté dans le navigateur.
 */
interface GameStore {
  state: ViewerGameState | null;
  lastCause: GameEvent | null;
  /** Instant de réception du dernier snapshot (pour faire tourner les pendules localement). */
  receivedAt: number;
  toast: string | null;
  /** Nombre de coups refusés reçus (sert à annuler l'affichage optimiste et les premoves). */
  rejections: number;
  /** Mode concentration : seul l'échiquier est affiché. */
  focus: boolean;
  setFocus: (focus: boolean) => void;
  /** Hot-seat : case de la dame secrète du camp au trait, seulement pendant le maintien. */
  peek: { color: Color; square: Square | null } | null;
  peekHeld: boolean;
  receive: (message: ServerMessage) => void;
  setPeekHeld: (held: boolean) => void;
  /**
   * Message abandonné faute de connexion : toast clair ; pour un coup, l'affichage optimiste
   * et les premoves sont annulés (même mécanisme qu'un refus, sans son ni message de refus).
   */
  sendFailed: (wasMove: boolean) => void;
  clearToast: () => void;
  reset: () => void;
}

/** Son associé à un événement public (échec > prise > coup). */
function soundFor(cause: GameEvent | null): void {
  if (!cause) return;
  if (cause.kind === 'game-started') return playSound('start');
  if (cause.kind === 'game-ended') return playSound('end');
  if (cause.kind !== 'move') return;
  if (cause.move.check) return playSound('check');
  playSound(cause.move.capture ? 'capture' : 'move');
}

export const useGame = create<GameStore>((set, get) => ({
  state: null,
  lastCause: null,
  receivedAt: 0,
  toast: null,
  rejections: 0,
  focus: false,
  setFocus(focus) {
    set({ focus });
  },
  peek: null,
  peekHeld: false,
  receive(message) {
    switch (message.type) {
      case 'snapshot': {
        soundFor(message.cause);
        const turn = message.state.board?.turn ?? null;
        const peek = get().peek;
        // Le marqueur disparaît au changement de trait, même si le bouton reste enfoncé.
        const keepPeek = peek !== null && peek.color === turn && message.state.phase === 'playing';
        set({
          state: message.state,
          lastCause: message.cause,
          receivedAt: performance.now(),
          peek: keepPeek ? peek : null,
          peekHeld: keepPeek ? get().peekHeld : false,
        });
        return;
      }
      case 'move-rejected':
        playSound('illegal');
        set({ toast: GENERIC_ILLEGAL_MOVE_MESSAGE, rejections: get().rejections + 1 });
        return;
      case 'secret-peek':
        if (get().peekHeld) set({ peek: { color: message.color, square: message.square } });
        return;
      case 'error':
        set({ toast: message.code === 'GAME_NOT_FOUND' ? 'Partie introuvable.' : 'Erreur.' });
        return;
    }
  },
  setPeekHeld(held) {
    set(held ? { peekHeld: true } : { peekHeld: false, peek: null });
  },
  sendFailed(wasMove) {
    set({
      toast: wasMove
        ? 'Connexion au serveur perdue : coup non envoyé.'
        : 'Connexion au serveur perdue : action non envoyée.',
      rejections: wasMove ? get().rejections + 1 : get().rejections,
    });
  },
  clearToast() {
    set({ toast: null });
  },
  reset() {
    set({ state: null, lastCause: null, toast: null, peek: null, peekHeld: false });
  },
}));
