import { randomInt } from 'node:crypto';
import {
  SECRET_SELECTION_MS,
  TIME_CONTROLS,
  opposite,
  pawnStartSquares,
  type BotRejection,
  type ClientMessage,
  type Color,
  type GameEvent,
  type GameMode,
  type GamePhase,
  type GameResult,
  type MoveIntent,
  type PlayerInfo,
  type ServerMessage,
  type Square,
  type TimeControlId,
  type Variant,
  type Viewer,
  type ViewerBoardState,
  type ViewerGameState,
} from '@sq/shared';
import {
  ClassicGame,
  SecretQueenGame,
  projectClassic,
  projectForViewer,
  type PersistedClassicGame,
  type PersistedGame,
} from '@sq/engine';
import { Secret } from '@sq/shared/secret';
import type { BotDriver } from '../bot/driver.js';

/** Partie publique d'un enregistrement de partie (aucun secret) : colonnes ordinaires. */
export interface SessionRecord {
  id: string;
  /** Absent des enregistrements antérieurs à la variante classique : Secret Queen. */
  variant?: Variant;
  /** Partie d'entraînement (absent : non). */
  training?: boolean;
  /** Classique : position de départ si elle n'est pas standard. */
  initialFen?: string | null;
  mode: GameMode;
  timeControl: TimeControlId;
  players: Record<Color, PlayerInfo>;
  /** Mode bot : camp du bot et compte du joueur humain. */
  botColor: Color | null;
  ownerId: string | null;
  phase: GamePhase;
  chooser: Color;
  clockMs: Record<Color, number> | null;
  drawOffer: Color | null;
  rematchOffer: Color | null;
  nextGameId: string | null;
  startedAt: string;
}

/** Partie persistée, selon la variante. */
export type PersistedAny = PersistedGame | PersistedClassicGame;

/** Partie secrète : choix déjà verrouillés et partie persistée. Colonne dédiée, jamais loggée. */
export interface SessionSecrets {
  selection: Partial<Record<Color, Square>>;
  game: Secret<PersistedAny> | null;
}

/** Journal minimal d'une partie (pino en production). Jamais de donnée de jeu dedans. */
export interface SessionLogger {
  warn(details: Record<string, unknown>, message: string): void;
  error(details: Record<string, unknown>, message: string): void;
}

export interface SessionOptions {
  id: string;
  variant: Variant;
  /** Entraînement contre le bot (classique) : non classée, indices, reprise de coups. */
  training?: boolean;
  /** Classique : position de départ (FEN), sinon position standard. */
  initialFen?: string | null;
  /** Reprise : instant de début d'origine (ISO), sinon maintenant. */
  startedAt?: string;
  mode: GameMode;
  timeControl: TimeControlId;
  players: Record<Color, PlayerInfo>;
  botColor?: Color | null;
  ownerId?: string | null;
  /**
   * Mode bot : fabrique du bot (worker + Stockfish). Le bot n'est créé qu'au besoin : une partie
   * restaurée au démarrage ne lance son bot que lorsque le joueur revient.
   */
  createBot?: (() => BotDriver) | null;
  now?: () => number;
  onRematch: (session: GameSession) => string;
  /** Appelé après chaque changement d'état (sauvegarde). */
  onChange?: (session: GameSession) => void;
  /** Appelé une fois, à la fin de la partie (Elo, historique). */
  onEnd?: (session: GameSession, result: GameResult) => void;
  /** Journal (échecs du bot). Seuls l'identifiant de partie et des compteurs y sont écrits. */
  logger?: SessionLogger;
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

/** Nombre maximal de coups refusés d'affilée avant d'abandonner pour le bot (sécurité). */
const MAX_BOT_ATTEMPTS = 80;
/** Nouvelles tentatives (avec un bot recréé) quand le bot ne répond pas, avant de renoncer. */
export const BOT_RETRIES = 2;

/**
 * Une partie côté serveur, classique ou Secret Queen, hot-seat ou contre le bot. Gère la phase
 * de choix du secret (Secret Queen), la pendule autoritative, la nulle, l'abandon, la revanche,
 * et diffuse à chaque client SA projection.
 *
 * Classique : pas de phase de choix, la partie commence tout de suite et la pendule ne démarre
 * qu'après le premier coup des Blancs.
 *
 * Les choix secrets vivent dans `#secrets` (champ privé) puis dans le moteur ; ils ne sont
 * jamais loggés ni envoyés : seule `projectForViewer` produit ce qu'un client reçoit. Le bot ne
 * reçoit que sa propre projection et ses propres refus.
 */
export class GameSession {
  readonly id: string;
  readonly variant: Variant;
  readonly training: boolean;
  readonly initialFen: string | null;
  readonly mode: GameMode;
  readonly timeControl: TimeControlId;
  readonly players: Record<Color, PlayerInfo>;
  readonly botColor: Color | null;
  readonly ownerId: string | null;
  readonly startedAt: string;

  #phase: GamePhase = 'secret-selection';
  #secrets: Partial<Record<Color, Square>> = {};
  #chooser: Color = 'w';
  #handoffPending: boolean;
  #selectionDeadline: number | null = null;
  #selectionTimer: NodeJS.Timeout | null = null;
  #game: SecretQueenGame | ClassicGame | null = null;
  #clock: ClockData | null;
  #flagTimer: NodeJS.Timeout | null = null;
  #drawOffer: Color | null = null;
  #drawBlocked: Record<Color, boolean> = { w: false, b: false };
  #rematchOffer: Color | null = null;
  #nextGameId: string | null = null;
  #participants = new Set<Participant>();
  #bot: BotDriver | null;
  #botThinking = false;
  /**
   * Le bot a échoué plusieurs fois de suite : on ne le relance plus d'office (pas de boucle),
   * mais au prochain événement du joueur (message, reconnexion).
   */
  #botStalled = false;
  /** Incrémenté à chaque reprise de coup : un coup du bot calculé avant est ignoré. */
  #botGeneration = 0;
  /** Refus des coups du bot : renvoyés au bot seulement. */
  #botRejections: BotRejection[] = [];
  #ended = false;
  readonly #now: () => number;
  readonly #options: SessionOptions;

  constructor(options: SessionOptions) {
    this.id = options.id;
    this.variant = options.variant;
    this.training = options.training ?? false;
    this.initialFen = options.initialFen ?? null;
    this.mode = options.mode;
    this.timeControl = options.timeControl;
    this.players = options.players;
    this.botColor = options.botColor ?? null;
    this.ownerId = options.ownerId ?? null;
    this.startedAt = options.startedAt ?? new Date().toISOString();
    this.#bot = null;
    this.#options = options;
    this.#now = options.now ?? (() => Date.now());
    // Hot-seat : écran de passage avant chaque choix. Mode bot : choix immédiat.
    this.#handoffPending = options.mode === 'hotseat' && options.variant === 'secret-queen';
    if (options.variant === 'classic') {
      this.#phase = 'playing';
      this.#game = ClassicGame.create(this.initialFen ?? undefined);
    }
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

  /**
   * Mode bot, à la création. Secret Queen : le bot verrouille son pion et le chrono de 30 s de
   * l'humain démarre. Classique : le bot joue s'il a les Blancs.
   */
  start(): void {
    this.#ensureBot();
    if (this.variant === 'classic') return this.#maybeBotTurn();
    if (this.mode !== 'bot' || this.#phase !== 'secret-selection') return;
    const botColor = this.botColor ?? 'b';
    if (this.#secrets[botColor] === undefined) {
      // Bot pas encore disponible (création en échec) : même tirage uniforme (CSPRNG).
      const candidates = pawnStartSquares(botColor);
      this.#secrets[botColor] =
        this.#bot?.chooseSecret(candidates) ?? candidates[randomInt(candidates.length)];
    }
    this.#armSelectionTimer(opposite(botColor));
  }

  /** Partie classée : contre le bot, hors entraînement. */
  get rated(): boolean {
    return this.mode === 'bot' && !this.training;
  }

  get phase(): GamePhase {
    return this.#phase;
  }

  join(participant: Participant): void {
    this.#participants.add(participant);
    participant.send({ type: 'snapshot', state: this.stateFor(participant.viewer), cause: null });
    // Partie restaurée (ou bot en échec) : le bot se réveille quand le joueur revient.
    this.#wakeBot();
  }

  #ensureBot(): void {
    if (this.mode !== 'bot' || this.#bot || this.#phase === 'ended') return;
    try {
      this.#bot = this.#options.createBot?.() ?? null;
    } catch {
      this.#bot = null;
      this.#options.logger?.error({ gameId: this.id }, 'Création du bot impossible');
    }
  }

  /** Nouvelle tentative du bot après un échec, puis son tour s'il a le trait. */
  #wakeBot(): void {
    this.#botStalled = false;
    this.#ensureBot();
    this.#maybeBotTurn();
  }

  leave(participant: Participant): void {
    this.#participants.delete(participant);
  }

  dispose(): void {
    this.#clearTimers();
    this.#participants.clear();
    this.#disposeBot();
  }

  #disposeBot(): void {
    const bot = this.#bot;
    this.#bot = null;
    if (bot) void Promise.resolve(bot.dispose()).catch(() => undefined);
  }

  /**
   * Traite un message d'un client. En hot-seat, le camp agissant est le camp au trait (ou le
   * camp qui choisit) ; en mode bot, c'est le camp du participant.
   */
  handle(participant: Participant, message: ClientMessage): void {
    const actor = this.#actor(participant, message);
    if (this.#botStalled && participant.viewer !== 'public') this.#wakeBot();
    switch (message.type) {
      case 'join':
        return;
      case 'start-selection':
        return this.#startSelection();
      case 'lock-secret':
        if (actor) this.#lockSecret(actor, message.square);
        return;
      case 'move':
        return this.#humanMove(participant, actor, message.clientMoveId, message.move);
      case 'resign':
        if (actor) this.#resign(actor);
        return;
      case 'offer-draw':
        if (actor) this.#offerDraw(actor);
        return;
      case 'answer-draw':
        return this.#answerDraw(actor, message.accept);
      case 'offer-rematch':
        if (actor) this.#offerRematch(actor);
        return;
      case 'peek-secret':
        return this.#peek(participant);
      case 'takeback':
        return this.#takeback(actor);
    }
  }

  #actor(participant: Participant, message: ClientMessage): Color | null {
    if (this.mode === 'bot') return participant.viewer === 'public' ? null : participant.viewer;
    if (message.type === 'lock-secret') return this.#chooser;
    if ('color' in message && message.color) return message.color;
    return this.#game?.turn ?? 'w';
  }

  // --- Phase de choix -------------------------------------------------------------------

  #startSelection(): void {
    if (this.mode !== 'hotseat' || this.#phase !== 'secret-selection') return;
    if (!this.#handoffPending) return;
    this.#handoffPending = false;
    this.#armSelectionTimer(this.#chooser);
    this.#broadcast(null);
  }

  #armSelectionTimer(color: Color): void {
    this.#selectionDeadline = this.#now() + SECRET_SELECTION_MS;
    if (this.#selectionTimer) clearTimeout(this.#selectionTimer);
    this.#selectionTimer = setTimeout(() => this.#lockSecret(color, null), SECRET_SELECTION_MS);
  }

  /** Verrouille le choix de `color` ; `square === null` = tirage CSPRNG (temps écoulé). */
  #lockSecret(color: Color, square: Square | null): void {
    if (this.#phase !== 'secret-selection' || this.#secrets[color] !== undefined) return;
    if (this.mode === 'hotseat' && (this.#handoffPending || color !== this.#chooser)) return;
    if (this.mode === 'bot' && color === this.botColor) return;
    const candidates = pawnStartSquares(color);
    if (square !== null && !candidates.includes(square)) return;
    const chosen = square ?? candidates[randomInt(candidates.length)];
    if (chosen === undefined) return;
    if (this.#selectionTimer) clearTimeout(this.#selectionTimer);
    this.#selectionTimer = null;
    this.#selectionDeadline = null;
    this.#secrets[color] = chosen;

    const { w, b } = this.#secrets;
    if (w === undefined || b === undefined) {
      // Hot-seat : au tour des Noirs, après un nouvel écran de passage.
      this.#chooser = opposite(color);
      this.#handoffPending = true;
      this.#broadcast({ kind: 'secret-locked', color });
      return;
    }
    this.#game = SecretQueenGame.create({ w, b });
    this.#phase = 'playing';
    this.#startClock();
    this.#broadcast({ kind: 'game-started' });
  }

  // --- Partie ---------------------------------------------------------------------------

  #humanMove(
    participant: Participant,
    actor: Color | null,
    clientMoveId: string,
    intent: MoveIntent,
  ): void {
    const game = this.#game;
    const allowed =
      game !== null &&
      actor !== null &&
      actor !== this.botColor &&
      (this.mode === 'hotseat' || actor === game.turn);
    if (!allowed || !this.#applyMove(game.turn, intent)) {
      participant.send({ type: 'move-rejected', clientMoveId });
    }
  }

  /** Joue un coup pour `color`. Renvoie `false` (sans motif) s'il est refusé. */
  #applyMove(color: Color, intent: MoveIntent): boolean {
    const game = this.#game;
    if (this.#phase !== 'playing' || game === null || game.turn !== color) return false;
    if (this.#checkFlag()) return false;
    const outcome = game.play(color, intent);
    if (!outcome.ok) return false;

    // Un coup joué annule toute proposition de nulle en attente.
    this.#drawOffer = null;
    this.#drawBlocked[color] = false;
    this.#switchClock(color);
    const event: GameEvent = { kind: 'move', move: outcome.move };
    if (outcome.result !== null) this.#finish(outcome.result, event);
    else this.#broadcast(event);
    return true;
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
    if (this.#bot && this.botColor === opposite(color)) void this.#botAnswersDraw();
  }

  #answerDraw(actor: Color | null, accept: boolean): void {
    const offer = this.#drawOffer;
    if (this.#phase !== 'playing' || offer === null || this.#game === null) return;
    // Mode bot : seul l'adversaire de celui qui propose répond.
    if (this.mode === 'bot' && actor !== opposite(offer)) return;
    this.#drawOffer = null;
    if (accept) return this.#finish(this.#game.agreeDraw());
    this.#broadcast({ kind: 'draw-declined', by: opposite(offer) });
  }

  #offerRematch(color: Color): void {
    if (this.#phase !== 'ended' || this.#nextGameId !== null) return;
    // Hot-seat : un seul écran. Mode bot : le bot accepte toujours (§5).
    this.#rematchOffer = color;
    this.#nextGameId = this.#options.onRematch(this);
    this.#broadcast({ kind: 'rematch-offered', by: color });
  }

  /**
   * Entraînement : reprend le dernier coup du joueur (et la réponse du bot s'il a déjà joué).
   * Un coup du bot en cours de calcul est abandonné.
   */
  #takeback(actor: Color | null): void {
    const game = this.#game;
    if (!this.training || !(game instanceof ClassicGame) || this.#phase !== 'playing') return;
    if (actor === null || actor === this.botColor) return;
    const count = game.turn === actor ? 2 : 1;
    if (game.plyCount < count) return;
    const back = game.withoutLastMoves(count);
    if (back.turn !== actor) return;
    this.#game = back;
    this.#botGeneration++;
    this.#drawOffer = null;
    this.#botRejections = [];
    this.#broadcast(null);
  }

  /**
   * Entraînement : position où le joueur doit jouer (indices, garde-fou), sinon `null`. Jamais
   * en Secret Queen.
   */
  trainingPosition(): { fen: string; color: Color; ply: number } | null {
    const game = this.#game;
    if (!this.training || !(game instanceof ClassicGame) || this.#phase !== 'playing') return null;
    const human = this.botColor === null ? null : opposite(this.botColor);
    const fen = game.positions().at(-1);
    return human !== null && game.turn === human && fen
      ? { fen, color: human, ply: game.plyCount }
      : null;
  }

  /** Hot-seat : case de la dame secrète du camp au trait, à la demande (bouton maintenu). */
  #peek(participant: Participant): void {
    const game = this.#game;
    if (this.mode !== 'hotseat' || this.#phase !== 'playing') return;
    if (!(game instanceof SecretQueenGame)) return;
    const color = game.turn;
    const own = projectForViewer(game, color).ownSecret;
    participant.send({ type: 'secret-peek', color, square: own?.square ?? null });
  }

  #finish(result: GameResult, cause?: GameEvent): void {
    this.#phase = 'ended';
    this.#drawOffer = null;
    this.#stopClock();
    if (!this.#ended) {
      this.#ended = true;
      this.#options.onEnd?.(this, result);
    }
    if (cause) this.#broadcast(cause);
    this.#broadcast({ kind: 'game-ended', result });
    this.#disposeBot();
  }

  // --- Bot ------------------------------------------------------------------------------

  /** Observation du bot : sa projection (son secret seulement) et ses refus (§5). */
  #observation() {
    const botColor = this.botColor ?? 'b';
    return { botColor, state: this.stateFor(botColor), rejections: [...this.#botRejections] };
  }

  #maybeBotTurn(): void {
    const game = this.#game;
    if (!this.#bot || this.#botThinking || this.#botStalled) return;
    if (this.#phase !== 'playing' || !game) return;
    if (game.turn !== this.botColor) return;
    this.#botThinking = true;
    void this.#botPlay().finally(() => {
      this.#botThinking = false;
      this.#maybeBotTurn();
    });
  }

  async #botPlay(): Promise<void> {
    const color = this.botColor;
    const generation = this.#botGeneration;
    let failures = 0;
    for (let rejected = 0; rejected < MAX_BOT_ATTEMPTS;) {
      const bot = this.#bot;
      const game = this.#game;
      if (!bot || !game || color === null || this.#phase !== 'playing' || game.turn !== color) {
        return;
      }
      let move: MoveIntent;
      try {
        move = await bot.chooseMove(this.#observation());
      } catch {
        // Bot arrêté entre-temps (fin de partie, arrêt du serveur) : rien à signaler.
        if (this.#bot !== bot || generation !== this.#botGeneration) return;
        failures++;
        // Jamais l'erreur elle-même : elle pourrait citer le coup du bot (donc sa dame).
        this.#options.logger?.warn(
          { gameId: this.id, failures, retries: BOT_RETRIES },
          'Le bot n’a pas pu jouer',
        );
        if (failures > BOT_RETRIES) return this.#stallBot();
        // Worker ou Stockfish probablement morts : on repart d'un bot neuf.
        this.#disposeBot();
        this.#ensureBot();
        if (!this.#bot) return this.#stallBot();
        continue;
      }
      // Coup repris pendant la réflexion du bot : ce coup ne vaut plus.
      if (generation !== this.#botGeneration) return;
      const plies = game.plyCount;
      if (this.#applyMove(color, move)) return;
      if (this.#phase !== 'playing') return;
      this.#botRejections.push({ ply: plies, move });
      rejected++;
    }
    // Ne devrait jamais arriver (le monde réel n'est jamais éliminé) : le bot abandonne.
    if (color !== null) this.#resign(color);
  }

  /**
   * Le bot a échoué trop de fois : le joueur reçoit une erreur générique (aucune donnée de jeu)
   * et la partie reste en l'état. Le bot sera relancé au prochain message du joueur ou à sa
   * reconnexion ; d'ici là, le joueur peut aussi abandonner (ou gagner au temps).
   */
  #stallBot(): void {
    this.#botStalled = true;
    this.#disposeBot();
    this.#options.logger?.error({ gameId: this.id }, 'Bot indisponible : partie en attente');
    for (const p of this.#participants) {
      if (p.viewer !== 'public') p.send({ type: 'error', code: 'BOT_UNAVAILABLE' });
    }
  }

  async #botAnswersDraw(): Promise<void> {
    const bot = this.#bot;
    if (!bot) return;
    const accept = await bot.shouldAcceptDraw(this.#observation()).catch(() => false);
    if (this.#drawOffer !== null && this.botColor !== null) {
      this.#answerDraw(this.botColor, accept);
    }
  }

  // --- Pendule autoritative ----------------------------------------------------------------

  #startClock(): void {
    // Classique : la pendule ne démarre qu'après le premier coup des Blancs.
    if (!this.#clock || (this.variant === 'classic' && (this.#game?.plyCount ?? 0) === 0)) return;
    this.#clock.startedAt = this.#now();
    this.#armFlagTimer();
  }

  #switchClock(mover: Color): void {
    const clock = this.#clock;
    if (!clock) return;
    if (clock.startedAt === null) return this.#startClock();
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
    this.#options.onChange?.(this);
    for (const p of this.#participants) {
      p.send({ type: 'snapshot', state: this.stateFor(p.viewer), cause });
    }
    this.#maybeBotTurn();
  }

  // --- Persistance (reprise après redémarrage) ---------------------------------------------

  toRecord(): { record: SessionRecord; secrets: Secret<SessionSecrets> } {
    const now = this.#now();
    return {
      record: {
        id: this.id,
        variant: this.variant,
        training: this.training,
        initialFen: this.initialFen,
        mode: this.mode,
        timeControl: this.timeControl,
        players: this.players,
        botColor: this.botColor,
        ownerId: this.ownerId,
        phase: this.#phase,
        chooser: this.#chooser,
        clockMs: this.#clock
          ? { w: this.#liveRemaining('w', now), b: this.#liveRemaining('b', now) }
          : null,
        drawOffer: this.#drawOffer,
        rematchOffer: this.#rematchOffer,
        nextGameId: this.#nextGameId,
        startedAt: this.startedAt,
      },
      secrets: new Secret({
        selection: { ...this.#secrets },
        game: this.#game ? this.#game.toPersisted() : null,
      }),
    };
  }

  /**
   * Recrée une partie sauvegardée. Pendant le choix, on revient à l'écran de passage du camp
   * qui choisissait (hot-seat) ou on relance le chrono de choix (bot) ; en cours de partie, la
   * pendule repart avec le temps sauvegardé (arrêt du serveur non décompté).
   */
  static restore(
    record: SessionRecord,
    secrets: { selection: Partial<Record<Color, Square>>; game: Secret<PersistedAny> | null },
    options: Omit<
      SessionOptions,
      'id' | 'variant' | 'mode' | 'timeControl' | 'players' | 'botColor' | 'ownerId'
    >,
  ): GameSession {
    const variant = record.variant ?? 'secret-queen';
    const session = new GameSession({
      ...options,
      id: record.id,
      variant,
      training: record.training ?? false,
      initialFen: record.initialFen ?? null,
      startedAt: record.startedAt,
      mode: record.mode,
      timeControl: record.timeControl,
      players: record.players,
      botColor: record.botColor,
      ownerId: record.ownerId,
    });
    session.#phase = record.phase;
    session.#chooser = record.chooser;
    session.#secrets = { ...secrets.selection };
    session.#drawOffer = record.drawOffer;
    session.#rematchOffer = record.rematchOffer;
    session.#nextGameId = record.nextGameId;
    if (session.#clock && record.clockMs) session.#clock.remainingMs = { ...record.clockMs };
    if (secrets.game) {
      session.#game =
        variant === 'classic'
          ? ClassicGame.restore(secrets.game as Secret<PersistedClassicGame>)
          : SecretQueenGame.restore(secrets.game as Secret<PersistedGame>);
    }
    if (record.phase === 'playing') {
      session.#startClock();
    } else if (record.phase === 'secret-selection' && record.mode === 'bot') {
      // Le choix du bot est déjà sauvegardé : seul le chrono de l'humain repart.
      const botColor = record.botColor ?? 'b';
      if (session.#secrets[opposite(botColor)] === undefined) {
        session.#armSelectionTimer(opposite(botColor));
      }
    }
    return session;
  }

  /** Projection du moteur selon la variante : seule source de ce que voit un spectateur. */
  #project(viewer: Viewer): ViewerBoardState | null {
    const game = this.#game;
    if (game === null) return null;
    return game instanceof ClassicGame
      ? projectClassic(game, viewer)
      : projectForViewer(game, viewer);
  }

  /**
   * Partie réelle à analyser (revue du coach) : FEN réelles (position initiale puis une par
   * demi-coup) et coups joués en UCI et en SAN réelle. Uniquement une fois la partie terminée ;
   * en Secret Queen, tout vient de la révélation.
   */
  reviewInput(): { positions: string[]; moves: { uci: string; san: string }[] } | null {
    const game = this.#game;
    if (this.#phase !== 'ended' || game === null) return null;
    const board = this.#project('public');
    if (!board) return null;
    const uci = (m: (typeof board.moves)[number]) => `${m.from}${m.to}${m.promotion ?? ''}`;
    if (game instanceof ClassicGame) {
      return {
        positions: game.positions(),
        moves: board.moves.map((m) => ({ uci: uci(m), san: m.san })),
      };
    }
    const reveal = board.reveal;
    if (!reveal) return null;
    return {
      positions: [reveal.realInitialFen, ...reveal.plies.map((p) => p.realFenAfter)],
      moves: board.moves.map((m, i) => ({ uci: uci(m), san: reveal.plies[i]?.realSan ?? m.san })),
    };
  }

  /** Vue complète pour un spectateur : seule la projection du moteur décrit l'échiquier. */
  stateFor(viewer: Viewer): ViewerGameState {
    const now = this.#now();
    const clock = this.#clock;
    const running = this.#phase === 'playing' && this.#game ? this.#game.turn : null;
    return {
      gameId: this.id,
      variant: this.variant,
      mode: this.mode,
      viewer,
      phase: this.#phase,
      rated: this.rated,
      training: this.training,
      initialFen: this.initialFen,
      timeControl: this.timeControl,
      players: this.players,
      selection:
        this.#phase === 'secret-selection'
          ? {
              chooser: this.mode === 'hotseat' ? this.#chooser : null,
              handoffPending: this.#handoffPending,
              remainingMs:
                this.#selectionDeadline === null
                  ? null
                  : Math.max(0, Math.round(this.#selectionDeadline - now)),
              ready: { w: this.#secrets.w !== undefined, b: this.#secrets.b !== undefined },
              ownLocked: viewer === 'public' ? null : (this.#secrets[viewer] ?? null),
            }
          : null,
      board: this.#project(viewer),
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
