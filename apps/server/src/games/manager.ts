import { randomInt, randomUUID } from 'node:crypto';
import {
  opposite,
  type BotLevel,
  type Color,
  type GameConfig,
  type GameResult,
  type GameSummary,
  type PlayerInfo,
  type TimeControlId,
  type Variant,
} from '@sq/shared';
import { WorkerBot, type BotDriver } from '../bot/driver.js';
import { updateRating } from '../elo.js';
import type { GameStore } from '../persistence/db.js';
import { GameSession, type SessionLogger } from './session.js';

export interface ManagerOptions {
  store: GameStore;
  config: GameConfig;
  /** Fabrique de bots (remplaçable dans les tests). */
  createBot?: (level: BotLevel) => BotDriver;
  /** Après la fin d'une partie (par exemple : lancer sa revue). */
  afterEnd?: (session: GameSession) => void;
  /** Bot par défaut : temps de réflexion « humain » (défaut : oui). */
  botHumanPace?: boolean;
  /** Journal des parties (échecs du bot), sans donnée de jeu. */
  logger?: SessionLogger;
}

/** Demande de partie invalide (FEN, combinaison d'options). */
export class InvalidGameRequest extends Error {}

/**
 * Registre des parties. Chaque changement d'état est sauvegardé dans SQLite ; au démarrage,
 * les parties non terminées sont reprises. À la fin d'une partie contre le bot, l'Elo du joueur
 * DANS LA VARIANTE est mis à jour (toutes cadences, H6) et la partie entre dans son historique.
 */
export class GameManager {
  readonly #games = new Map<string, GameSession>();
  readonly #store: GameStore;
  readonly #config: GameConfig;
  readonly #createBot: (level: BotLevel) => BotDriver;
  readonly #afterEnd: ((session: GameSession) => void) | undefined;
  readonly #logger: SessionLogger | undefined;

  constructor(options: ManagerOptions) {
    this.#store = options.store;
    this.#config = options.config;
    const humanPace = options.botHumanPace ?? true;
    this.#createBot = options.createBot ?? ((level) => new WorkerBot(level, { humanPace }));
    this.#afterEnd = options.afterEnd;
    this.#logger = options.logger;
    for (const saved of this.#store.loadUnfinished()) {
      try {
        const level = saved.record.botColor
          ? saved.record.players[saved.record.botColor].botLevel
          : null;
        const session = GameSession.restore(saved.record, saved.secrets, {
          ...this.#hooks(),
          createBot: level ? () => this.#createBot(level) : null,
        });
        this.#games.set(session.id, session);
      } catch {
        // Enregistrement d'une ancienne version : ignoré.
      }
    }
  }

  get config(): GameConfig {
    return this.#config;
  }

  #hooks() {
    return {
      ...(this.#logger ? { logger: this.#logger } : {}),
      onRematch: (previous: GameSession) => this.#rematch(previous),
      onChange: (session: GameSession) => {
        const { record, secrets } = session.toRecord();
        this.#store.save(record, secrets);
      },
      onEnd: (session: GameSession, result: GameResult) => {
        this.#recordResult(session, result);
        this.#afterEnd?.(session);
      },
    };
  }

  #register(session: GameSession): GameSession {
    this.#games.set(session.id, session);
    const { record, secrets } = session.toRecord();
    this.#store.save(record, secrets);
    return session;
  }

  createHotseat(options: {
    variant: Variant;
    timeControl: TimeControlId;
    whiteName: string;
    blackName: string;
    ownerId?: string | null;
  }): GameSession {
    const player = (name: string): PlayerInfo => ({
      name,
      rating: null,
      isBot: false,
      botLevel: null,
    });
    return this.#register(
      new GameSession({
        id: randomUUID(),
        variant: options.variant,
        mode: 'hotseat',
        timeControl: options.timeControl,
        players: { w: player(options.whiteName), b: player(options.blackName) },
        ownerId: options.ownerId ?? null,
        ...this.#hooks(),
      }),
    );
  }

  createBotGame(options: {
    variant: Variant;
    userId: string;
    level: BotLevel;
    timeControl: TimeControlId;
    color: Color | 'random';
    /** Entraînement (classique) : non classée, sans pendule, indices, reprise de coups. */
    training?: boolean;
    /** Entraînement : position de départ ; le joueur a le trait. */
    fen?: string;
  }): GameSession {
    const user = this.#store.findUser(options.userId);
    const level = this.#config.botLevels.find((l) => l.level === options.level);
    if (!user || !level) throw new Error('Utilisateur ou niveau inconnu.');
    const training = options.training ?? false;
    if (training && options.variant !== 'classic') throw new InvalidGameRequest();
    if (options.fen !== undefined && !training) throw new InvalidGameRequest();
    const fenTurn = options.fen?.split(' ')[1];
    const human: Color =
      fenTurn === 'w' || fenTurn === 'b'
        ? fenTurn
        : options.color === 'random'
          ? randomInt(2) === 0
            ? 'w'
            : 'b'
          : options.color;
    const botColor = opposite(human);
    const { rating } = this.#store.ratingOf(user.id, options.variant);
    const players = {
      [human]: { name: user.username, rating, isBot: false, botLevel: null },
      [botColor]: { name: level.name, rating: level.elo, isBot: true, botLevel: level.level },
    } as Record<Color, PlayerInfo>;
    let created: GameSession;
    try {
      created = new GameSession({
        id: randomUUID(),
        variant: options.variant,
        training,
        initialFen: options.fen ?? null,
        mode: 'bot',
        // Entraînement : pas de pendule (on prend le temps de réfléchir, on reprend des coups).
        timeControl: training ? 'untimed' : options.timeControl,
        players,
        botColor,
        ownerId: user.id,
        createBot: () => this.#createBot(level.level),
        ...this.#hooks(),
      });
    } catch {
      throw new InvalidGameRequest();
    }
    const session = this.#register(created);
    session.start();
    return session;
  }

  /** Revanche : même variante, mêmes joueurs, couleurs inversées (nouveaux pions secrets). */
  #rematch(previous: GameSession): string {
    if (previous.mode === 'hotseat') {
      return this.createHotseat({
        variant: previous.variant,
        timeControl: previous.timeControl,
        whiteName: previous.players.b.name,
        blackName: previous.players.w.name,
        ownerId: previous.ownerId,
      }).id;
    }
    const botColor = previous.botColor ?? 'b';
    // Entraînement depuis une position : on rejoue la même position, du même côté.
    return this.createBotGame({
      variant: previous.variant,
      userId: previous.ownerId ?? '',
      level: previous.players[botColor].botLevel ?? 1,
      timeControl: previous.timeControl,
      color: botColor,
      training: previous.training,
      ...(previous.initialFen ? { fen: previous.initialFen } : {}),
    }).id;
  }

  #recordResult(session: GameSession, result: GameResult): void {
    const userId = session.ownerId;
    if (!userId) return;
    const user = this.#store.findUser(userId);
    if (!user) return;
    const color: Color = session.mode === 'bot' ? opposite(session.botColor ?? 'b') : 'w';
    const before = this.#store.ratingOf(user.id, session.variant);
    let ratingAfter: number | null = null;
    if (session.rated) {
      const opponentElo = session.players[opposite(color)].rating ?? this.#config.elo.initial;
      const score = result.winner === null ? 0.5 : result.winner === color ? 1 : 0;
      ratingAfter = updateRating(
        before.rating,
        opponentElo,
        score,
        before.gamesPlayed,
        this.#config.elo,
      );
      this.#store.setRating(user.id, session.variant, ratingAfter);
    }
    const summary: GameSummary = {
      gameId: session.id,
      variant: session.variant,
      mode: session.mode,
      rated: session.rated,
      timeControl: session.timeControl,
      color,
      opponentName: session.players[opposite(color)].name,
      winner: result.winner,
      reason: result.reason,
      ratingBefore: session.rated ? before.rating : null,
      ratingAfter,
      startedAt: session.startedAt,
      endedAt: new Date().toISOString(),
    };
    this.#store.saveResult(session.id, user.id, summary);
  }

  /** Partie en mémoire, ou partie terminée rechargée depuis SQLite (rejeu, analyse). */
  get(id: string): GameSession | undefined {
    const live = this.#games.get(id);
    if (live) return live;
    const saved = this.#store.load(id);
    if (!saved || saved.record.phase !== 'ended') return undefined;
    try {
      const session = GameSession.restore(saved.record, saved.secrets, this.#hooks());
      this.#games.set(id, session);
      return session;
    } catch {
      return undefined;
    }
  }

  disposeAll(): void {
    for (const game of this.#games.values()) game.dispose();
    this.#games.clear();
  }
}
