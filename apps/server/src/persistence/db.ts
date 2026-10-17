import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { Color, Square } from '@sq/shared';
import { Secret } from '@sq/shared/secret';
import type { PersistedGame } from '@sq/engine';
import type { SessionRecord, SessionSecrets } from '../games/session.js';

/**
 * Stockage SQLite des parties (reprise après redémarrage du serveur).
 *
 * Le secret (choix des pions, coups rejoués par le moteur) est écrit dans la colonne dédiée
 * `secret_state`, uniquement ici (seul dossier serveur autorisé à appeler `expose()`), et n'est
 * jamais loggé. Limite assumée : l'administrateur local peut lire la base (docs/SECURITY.md).
 */
export class GameStore {
  readonly #db: Database.Database;

  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.#db = new Database(path);
    this.#db.pragma('journal_mode = WAL');
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id           TEXT PRIMARY KEY,
        record       TEXT NOT NULL,
        secret_state TEXT NOT NULL,
        phase        TEXT NOT NULL,
        updated_at   INTEGER NOT NULL
      )`);
  }

  save(record: SessionRecord, secrets: Secret<SessionSecrets>): void {
    const { selection, game } = secrets.expose();
    const secretJson = JSON.stringify({ selection, game: game ? game.expose() : null });
    this.#db
      .prepare(
        `INSERT INTO games (id, record, secret_state, phase, updated_at)
         VALUES (@id, @record, @secret, @phase, @now)
         ON CONFLICT(id) DO UPDATE SET record = @record, secret_state = @secret,
           phase = @phase, updated_at = @now`,
      )
      .run({
        id: record.id,
        record: JSON.stringify(record),
        secret: secretJson,
        phase: record.phase,
        now: Date.now(),
      });
  }

  /** Parties à reprendre au démarrage : toutes celles qui ne sont pas terminées. */
  loadUnfinished(): {
    record: SessionRecord;
    secrets: { selection: Partial<Record<Color, Square>>; game: Secret<PersistedGame> | null };
  }[] {
    const rows = this.#db
      .prepare(`SELECT record, secret_state FROM games WHERE phase != 'ended'`)
      .all() as { record: string; secret_state: string }[];
    return rows.map((row) => {
      const secret = JSON.parse(row.secret_state) as {
        selection: Partial<Record<Color, Square>>;
        game: PersistedGame | null;
      };
      return {
        record: JSON.parse(row.record) as SessionRecord,
        secrets: {
          selection: secret.selection,
          game: secret.game ? new Secret(secret.game) : null,
        },
      };
    });
  }

  close(): void {
    this.#db.close();
  }
}
