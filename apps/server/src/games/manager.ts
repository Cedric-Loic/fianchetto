import { randomUUID } from 'node:crypto';
import type { TimeControlId } from '@sq/shared';
import { GameSession } from './session.js';

/**
 * Registre des parties en mémoire (étape 2). La persistance SQLite arrive à l'étape 3.
 */
export class GameManager {
  readonly #games = new Map<string, GameSession>();

  createHotseat(options: {
    timeControl: TimeControlId;
    whiteName: string;
    blackName: string;
  }): GameSession {
    const session = new GameSession({
      id: randomUUID(),
      ...options,
      // Revanche : couleurs inversées, nouveau choix des pions secrets.
      onRematch: (previous) =>
        this.createHotseat({
          timeControl: previous.timeControl,
          whiteName: previous.players.b.name,
          blackName: previous.players.w.name,
        }).id,
    });
    this.#games.set(session.id, session);
    return session;
  }

  get(id: string): GameSession | undefined {
    return this.#games.get(id);
  }

  disposeAll(): void {
    for (const game of this.#games.values()) game.dispose();
    this.#games.clear();
  }
}
