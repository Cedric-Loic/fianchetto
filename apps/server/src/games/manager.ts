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
import { GameSession } from './session.js';

export interface ManagerOptions {
  store: GameStore;
  config: GameConfig;
  /** Fabrique de bots (remplaçable dans les tests). */
  createBot?: (level: BotLevel) => BotDriver;
}

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

  constructor(options: ManagerOptions) {
    this.#store = options.store;
    this.#config = options.config;
    this.#createBot = options.createBot ?? ((level) => new WorkerBot(level));
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
      onRematch: (previous: GameSession) => this.#rematch(previous),
      onChange: (session: GameSession) => {
        const { record, secrets } = session.toRecord();
        this.#store.save(record, secrets);
      },
      onEnd: (session: GameSession, result: GameResult) => this.#recordResult(session, result),
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
  }): GameSession {
    const user = this.#store.findUser(options.userId);
    const level = this.#config.botLevels.find((l) => l.level === options.level);
    if (!user || !level) throw new Error('Utilisateur ou niveau inconnu.');
    const human: Color =
      options.color === 'random' ? (randomInt(2) === 0 ? 'w' : 'b') : options.color;
    const botColor = opposite(human);
    const { rating } = this.#store.ratingOf(user.id, options.variant);
    const players = {
      [human]: { name: user.username, rating, isBot: false, botLevel: null },
      [botColor]: { name: level.name, rating: level.elo, isBot: true, botLevel: level.level },
    } as Record<Color, PlayerInfo>;
    const session = this.#register(
      new GameSession({
        id: randomUUID(),
        variant: options.variant,
        mode: 'bot',
        timeControl: options.timeControl,
        players,
        botColor,
        ownerId: user.id,
        createBot: () => this.#createBot(level.level),
        ...this.#hooks(),
      }),
    );
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
    return this.createBotGame({
      variant: previous.variant,
      userId: previous.ownerId ?? '',
      level: previous.players[botColor].botLevel ?? 1,
      timeControl: previous.timeControl,
      color: botColor,
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
    if (session.mode === 'bot') {
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
      rated: session.mode === 'bot',
      timeControl: session.timeControl,
      color,
      opponentName: session.players[opposite(color)].name,
      winner: result.winner,
      reason: result.reason,
      ratingBefore: session.mode === 'bot' ? before.rating : null,
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
