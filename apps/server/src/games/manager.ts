import { randomUUID } from 'node:crypto';
import type { TimeControlId } from '@sq/shared';
import type { GameStore } from '../persistence/db.js';
import { GameSession } from './session.js';

/**
 * Registre des parties. Chaque changement d'état est sauvegardé dans SQLite ; au démarrage,
 * les parties non terminées sont reprises.
 */
export class GameManager {
  readonly #games = new Map<string, GameSession>();
  readonly #store: GameStore | null;

  constructor(store: GameStore | null = null) {
    this.#store = store;
    for (const saved of store?.loadUnfinished() ?? []) {
      const session = GameSession.restore(saved.record, saved.secrets, this.#hooks());
      this.#games.set(session.id, session);
    }
  }

  #hooks() {
    return {
      // Revanche : couleurs inversées, nouveau choix des pions secrets.
      onRematch: (previous: GameSession) =>
        this.createHotseat({
          timeControl: previous.timeControl,
          whiteName: previous.players.b.name,
          blackName: previous.players.w.name,
        }).id,
      onChange: (session: GameSession) => {
        const { record, secrets } = session.toRecord();
        this.#store?.save(record, secrets);
      },
    };
  }

  createHotseat(options: {
    timeControl: TimeControlId;
    whiteName: string;
    blackName: string;
  }): GameSession {
    const session = new GameSession({ id: randomUUID(), ...options, ...this.#hooks() });
    this.#games.set(session.id, session);
    const { record, secrets } = session.toRecord();
    this.#store?.save(record, secrets);
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
