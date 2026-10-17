import { randomInt } from 'node:crypto';
import {
  SECRET_SELECTION_MS,
  TIME_CONTROLS,
  opposite,
  pawnStartSquares,
  type ClientMessage,
  type Color,
  type GameEvent,
  type GameMode,
  type GamePhase,
  type GameResult,
  type PlayerInfo,
  type ServerMessage,
  type Square,
  type TimeControlId,
  type Viewer,
  type ViewerGameState,
} from '@sq/shared';
import { SecretQueenGame, projectForViewer, type PersistedGame } from '@sq/engine';
import { Secret } from '@sq/shared/secret';

/** Partie publique d'un enregistrement de partie (aucun secret) : colonnes ordinaires. */
export interface SessionRecord {
  id: string;
  mode: GameMode;
  timeControl: TimeControlId;
  whiteName: string;
  blackName: string;
  phase: GamePhase;
  chooser: Color;
  clockMs: Record<Color, number> | null;
  drawOffer: Color | null;
  rematchOffer: Color | null;
  nextGameId: string | null;
}

/** Partie secrète : choix déjà verrouillés et partie persistée. Colonne dédiée, jamais loggée. */
export interface SessionSecrets {
  selection: Partial<Record<Color, Square>>;
  game: Secret<PersistedGame> | null;
}

export interface SessionOptions {
  id: string;
  timeControl: TimeControlId;
  whiteName: string;
  blackName: string;
  now?: () => number;
  onRematch: (session: GameSession) => string;
  /** Appelé après chaque changement d'état (sauvegarde). */
  onChange?: (session: GameSession) => void;
}

/** Un client connecté à la partie : son camp de vue et sa fonction d'envoi. */
export interface Participant {
  viewer: Viewer;
  send: (message: ServerMessage) => void;
}

interface ClockData {
  remainingMs: Record<Color, number>;
  incrementMs: number;
  /** Instant (ms) où la pendule du camp au trait a démarré, `null` si arrêtée. */
  startedAt: number | null;
}

/**
 * Une partie côté serveur (étape 2 : hot-seat). Gère la phase de choix du secret, la pendule
 * autoritative, la nulle, l'abandon, la revanche, et diffuse à chaque client SA projection.
 *
 * Les choix secrets vivent dans `#secrets` (champ privé) puis dans le moteur ; ils ne sont
 * jamais loggés ni envoyés : seule `projectForViewer` produit ce qu'un client reçoit.
 */
export class GameSession {
  readonly id: string;
  readonly mode: GameMode = 'hotseat';
  readonly timeControl: TimeControlId;
  readonly players: Record<Color, PlayerInfo>;

  #phase: GamePhase = 'secret-selection';
  #secrets: Partial<Record<Color, Square>> = {};
  #chooser: Color = 'w';
  #handoffPending = true;
  #selectionDeadline: number | null = null;
  #selectionTimer: NodeJS.Timeout | null = null;
  #game: SecretQueenGame | null = null;
  #clock: ClockData | null;
  #flagTimer: NodeJS.Timeout | null = null;
  #drawOffer: Color | null = null;
  #drawBlocked: Record<Color, boolean> = { w: false, b: false };
  #rematchOffer: Color | null = null;
  #nextGameId: string | null = null;
  #participants = new Set<Participant>();
  readonly #now: () => number;
  readonly #onRematch: (session: GameSession) => string;

  readonly #onChange: ((session: GameSession) => void) | undefined;

  constructor(options: SessionOptions) {
    this.id = options.id;
    this.timeControl = options.timeControl;
    this.players = {
      w: { name: options.whiteName, rating: null, isBot: false, botLevel: null },
      b: { name: options.blackName, rating: null, isBot: false, botLevel: null },
    };
    this.#now = options.now ?? (() => Date.now());
    this.#onRematch = options.onRematch;
    this.#onChange = options.onChange;
    const tc = TIME_CONTROLS[options.timeControl];
    this.#clock =
      tc.initialMs === null
        ? null
        : {
            remainingMs: { w: tc.initialMs, b: tc.initialMs },
            incrementMs: tc.incrementMs,
            startedAt: null,
          };
  }

  get phase(): GamePhase {
    return this.#phase;
  }

  join(participant: Participant): void {
    this.#participants.add(participant);
    participant.send({ type: 'snapshot', state: this.stateFor(participant.viewer), cause: null });
  }

  leave(participant: Participant): void {
    this.#participants.delete(participant);
  }

  dispose(): void {
    this.#clearTimers();
    this.#participants.clear();
  }

  /** Traite un message d'un client. En hot-seat, le camp agissant est déduit du contexte. */
  handle(participant: Participant, message: ClientMessage): void {
    switch (message.type) {
      case 'join':
        return;
      case 'start-selection':
        return this.#startSelection();
      case 'lock-secret':
        return this.#lockSecret(message.square);
      case 'move':
        return this.#move(participant, message.clientMoveId, message.move);
      case 'resign':
        return this.#resign(message.color ?? this.#game?.turn ?? 'w');
      case 'offer-draw':
        return this.#offerDraw(message.color ?? this.#game?.turn ?? 'w');
      case 'answer-draw':
        return this.#answerDraw(message.accept);
      case 'offer-rematch':
        return this.#offerRematch(message.color ?? 'w');
      case 'peek-secret':
        return this.#peek(participant);
    }
  }

  // --- Phase de choix -------------------------------------------------------------------

  #startSelection(): void {
    if (this.#phase !== 'secret-selection' || !this.#handoffPending) return;
    this.#handoffPending = false;
    this.#selectionDeadline = this.#now() + SECRET_SELECTION_MS;
    const chooser = this.#chooser;
    this.#selectionTimer = setTimeout(() => this.#lockSecret(null, chooser), SECRET_SELECTION_MS);
    this.#broadcast(null);
  }

  /** Verrouille le choix du camp `chooser` ; `square === null` = tirage CSPRNG (temps écoulé). */
  #lockSecret(square: Square | null, expectedChooser?: Color): void {
    if (this.#phase !== 'secret-selection' || this.#handoffPending) return;
    const color = this.#chooser;
    if (expectedChooser !== undefined && expectedChooser !== color) return;
    const candidates = pawnStartSquares(color);
    if (square !== null && !candidates.includes(square)) return;
    const chosen = square ?? candidates[randomInt(candidates.length)];
    if (chosen === undefined) return;
    if (this.#selectionTimer) clearTimeout(this.#selectionTimer);
    this.#selectionTimer = null;
    this.#selectionDeadline = null;
    this.#secrets[color] = chosen;
    const lockedEvent: GameEvent = { kind: 'secret-locked', color };

    if (color === 'w') {
      this.#chooser = 'b';
      this.#handoffPending = true;
      this.#broadcast(lockedEvent);
      return;
    }
    const { w, b } = this.#secrets;
    if (w === undefined || b === undefined) return;
    this.#game = SecretQueenGame.create({ w, b });
    this.#phase = 'playing';
    this.#startClock();
    this.#broadcast({ kind: 'game-started' });
  }

  // --- Partie ---------------------------------------------------------------------------

  #move(
    participant: Participant,
    clientMoveId: string,
    intent: Parameters<SecretQueenGame['play']>[1],
  ): void {
    const game = this.#game;
    const reject = () => participant.send({ type: 'move-rejected', clientMoveId });
    if (this.#phase !== 'playing' || game === null) return reject();
    const color = game.turn;
    if (this.#checkFlag()) return reject();

    const outcome = game.play(color, intent);
    if (!outcome.ok) return reject();

    // Une proposition de nulle adverse en attente est déclinée par le coup joué.
    if (this.#drawOffer !== null && this.#drawOffer !== color) this.#drawOffer = null;
    if (this.#drawOffer === color) this.#drawOffer = null;
    this.#drawBlocked[color] = false;
    this.#switchClock(color);
    const event: GameEvent = { kind: 'move', move: outcome.move };
    if (outcome.result !== null) return this.#finish(outcome.result, event);
    this.#broadcast(event);
  }

  #resign(color: Color): void {
    if (this.#phase !== 'playing' || this.#game === null) return;
    this.#finish(this.#game.resign(color));
  }

  #offerDraw(color: Color): void {
    if (this.#phase !== 'playing' || this.#drawOffer !== null || this.#drawBlocked[color]) return;
    this.#drawOffer = color;
    this.#drawBlocked[color] = true;
    this.#broadcast({ kind: 'draw-offered', by: color });
  }

  #answerDraw(accept: boolean): void {
    const offer = this.#drawOffer;
    if (this.#phase !== 'playing' || offer === null || this.#game === null) return;
    this.#drawOffer = null;
    if (accept) return this.#finish(this.#game.agreeDraw());
    this.#broadcast({ kind: 'draw-declined', by: opposite(offer) });
  }

  #offerRematch(color: Color): void {
    if (this.#phase !== 'ended' || this.#nextGameId !== null) return;
    // Hot-seat : un seul écran, la revanche est créée immédiatement.
    this.#rematchOffer = color;
    this.#nextGameId = this.#onRematch(this);
    this.#broadcast({ kind: 'rematch-offered', by: color });
  }

  /** Hot-seat : case de la dame secrète du camp au trait, à la demande (bouton maintenu). */
  #peek(participant: Participant): void {
    if (this.mode !== 'hotseat' || this.#phase !== 'playing' || this.#game === null) return;
    const color = this.#game.turn;
    const own = projectForViewer(this.#game, color).ownSecret;
    participant.send({ type: 'secret-peek', color, square: own?.square ?? null });
  }

  #finish(result: GameResult, cause?: GameEvent): void {
    this.#phase = 'ended';
    this.#drawOffer = null;
    this.#stopClock();
    if (cause) this.#broadcast(cause);
    this.#broadcast({ kind: 'game-ended', result });
  }

  // --- Pendule autoritative ----------------------------------------------------------------

  #startClock(): void {
    if (!this.#clock) return;
    this.#clock.startedAt = this.#now();
    this.#armFlagTimer();
  }

  #switchClock(mover: Color): void {
    const clock = this.#clock;
    if (!clock || clock.startedAt === null) return;
    const elapsed = this.#now() - clock.startedAt;
    clock.remainingMs[mover] = Math.max(0, clock.remainingMs[mover] - elapsed) + clock.incrementMs;
    clock.startedAt = this.#now();
    this.#armFlagTimer();
  }

  #stopClock(): void {
    const clock = this.#clock;
    if (clock && clock.startedAt !== null && this.#game) {
      const side = this.#game.turn;
      clock.remainingMs[side] = Math.max(
        0,
        clock.remainingMs[side] - (this.#now() - clock.startedAt),
      );
      clock.startedAt = null;
    }
    if (this.#flagTimer) clearTimeout(this.#flagTimer);
    this.#flagTimer = null;
  }

  #armFlagTimer(): void {
    if (this.#flagTimer) clearTimeout(this.#flagTimer);
    const clock = this.#clock;
    if (!clock || !this.#game) return;
    const side = this.#game.turn;
    this.#flagTimer = setTimeout(() => this.#checkFlag(), clock.remainingMs[side] + 5);
  }

  /** Termine la partie si le camp au trait n'a plus de temps. Renvoie `true` si c'est le cas. */
  #checkFlag(): boolean {
    const clock = this.#clock;
    const game = this.#game;
    if (!clock || !game || clock.startedAt === null || this.#phase !== 'playing') return false;
    const side = game.turn;
    if (clock.remainingMs[side] - (this.#now() - clock.startedAt) > 0) {
      this.#armFlagTimer();
      return false;
    }
    this.#finish(game.flagFall(side));
    return true;
  }

  #clearTimers(): void {
    if (this.#selectionTimer) clearTimeout(this.#selectionTimer);
    if (this.#flagTimer) clearTimeout(this.#flagTimer);
  }

  // --- Projection et diffusion -------------------------------------------------------------

  #broadcast(cause: GameEvent | null): void {
    this.#onChange?.(this);
    for (const p of this.#participants) {
      p.send({ type: 'snapshot', state: this.stateFor(p.viewer), cause });
    }
  }

  // --- Persistance (reprise après redémarrage) ---------------------------------------------

  toRecord(): { record: SessionRecord; secrets: Secret<SessionSecrets> } {
    const now = this.#now();
    return {
      record: {
        id: this.id,
        mode: this.mode,
        timeControl: this.timeControl,
        whiteName: this.players.w.name,
        blackName: this.players.b.name,
        phase: this.#phase,
        chooser: this.#chooser,
        clockMs: this.#clock
          ? { w: this.#liveRemaining('w', now), b: this.#liveRemaining('b', now) }
          : null,
        drawOffer: this.#drawOffer,
        rematchOffer: this.#rematchOffer,
        nextGameId: this.#nextGameId,
      },
      secrets: new Secret({
        selection: { ...this.#secrets },
        game: this.#game ? this.#game.toPersisted() : null,
      }),
    };
  }

  /**
   * Recrée une partie sauvegardée. Pendant le choix, on revient à l'écran de passage du camp
   * qui choisissait ; en cours de partie, la pendule repart avec le temps sauvegardé (le temps
   * pendant lequel le serveur était arrêté n'est pas décompté).
   */
  static restore(
    record: SessionRecord,
    secrets: { selection: Partial<Record<Color, Square>>; game: Secret<PersistedGame> | null },
    options: Omit<SessionOptions, 'id' | 'timeControl' | 'whiteName' | 'blackName'>,
  ): GameSession {
    const session = new GameSession({
      ...options,
      id: record.id,
      timeControl: record.timeControl,
      whiteName: record.whiteName,
      blackName: record.blackName,
    });
    session.#phase = record.phase;
    session.#chooser = record.chooser;
    session.#secrets = { ...secrets.selection };
    session.#drawOffer = record.drawOffer;
    session.#rematchOffer = record.rematchOffer;
    session.#nextGameId = record.nextGameId;
    if (session.#clock && record.clockMs) session.#clock.remainingMs = { ...record.clockMs };
    if (secrets.game) session.#game = SecretQueenGame.restore(secrets.game);
    if (record.phase === 'playing') session.#startClock();
    return session;
  }

  /** Vue complète pour un spectateur : seule la projection du moteur décrit l'échiquier. */
  stateFor(viewer: Viewer): ViewerGameState {
    const now = this.#now();
    const clock = this.#clock;
    const running = this.#phase === 'playing' && this.#game ? this.#game.turn : null;
    return {
      gameId: this.id,
      mode: this.mode,
      viewer,
      phase: this.#phase,
      rated: false,
      timeControl: this.timeControl,
      players: this.players,
      selection:
        this.#phase === 'secret-selection'
          ? {
              chooser: this.#chooser,
              handoffPending: this.#handoffPending,
              remainingMs:
                this.#selectionDeadline === null
                  ? null
                  : Math.max(0, Math.round(this.#selectionDeadline - now)),
              ready: { w: this.#secrets.w !== undefined, b: this.#secrets.b !== undefined },
              ownLocked: null,
            }
          : null,
      board: this.#game ? projectForViewer(this.#game, viewer) : null,
      clock: clock
        ? {
            remainingMs: {
              w: Math.round(this.#liveRemaining('w', now)),
              b: Math.round(this.#liveRemaining('b', now)),
            },
            running: clock.startedAt === null ? null : running,
            incrementMs: clock.incrementMs,
          }
        : null,
      drawOffer: this.#drawOffer,
      rematch: { offeredBy: this.#rematchOffer, nextGameId: this.#nextGameId },
    };
  }

  #liveRemaining(color: Color, now: number): number {
    const clock = this.#clock;
    if (!clock) return 0;
    const base = clock.remainingMs[color];
    if (clock.startedAt === null || this.#game?.turn !== color || this.#phase !== 'playing') {
      return base;
    }
    return Math.max(0, base - (now - clock.startedAt));
  }
}
