import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import {
  VARIANTS,
  type Color,
  type GameReview,
  type GameSummary,
  type Rating,
  type Square,
  type UserPublic,
  type Variant,
} from '@sq/shared';
import { Secret } from '@sq/shared/secret';
import type { PersistedAny, SessionRecord, SessionSecrets } from '../games/session.js';

/**
 * Stockage SQLite des parties (reprise après redémarrage du serveur).
 *
 * Le secret (choix des pions, coups rejoués par le moteur) est écrit dans la colonne dédiée
 * `secret_state`, uniquement ici (seul dossier serveur autorisé à appeler `expose()`), et n'est
 * jamais loggé. Limite assumée : l'administrateur local peut lire la base (docs/SECURITY.md).
 */
export interface UserRow {
  id: string;
  username: string;
  passwordHash: string;
}

const USER_SELECT = `SELECT id, username, password_hash AS passwordHash FROM users`;

/** Partie importée (PGN ou chess.com) : le PGN complet et ses en-têtes utiles. */
export interface ImportedGameRow {
  id: string;
  userId: string;
  source: 'pgn' | 'chesscom';
  /** Clé anti-doublon : lien chess.com, ou empreinte du PGN. */
  externalId: string;
  pgn: string;
  white: string;
  black: string;
  whiteElo: number | null;
  blackElo: number | null;
  result: string;
  date: string | null;
  timeControl: string | null;
  userColor: Color | null;
  plies: number;
  url: string | null;
}

const IMPORTED_SELECT = `SELECT id, user_id AS userId, source, external_id AS externalId, pgn,
  white, black, white_elo AS whiteElo, black_elo AS blackElo, result, date,
  time_control AS timeControl, user_color AS userColor, plies, url FROM imported_games`;

export interface SavedGame {
  record: SessionRecord;
  secrets: { selection: Partial<Record<Color, Square>>; game: Secret<PersistedAny> | null };
}

export class GameStore {
  readonly #db: Database.Database;
  readonly #initialRating: number;

  /** `initialRating` : Elo d'un joueur qui n'a encore joué aucune partie classée de la variante. */
  constructor(path: string, options: { initialRating: number }) {
    this.#initialRating = options.initialRating;
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
      );
      -- users.rating et users.games_played : Elo unique d'avant la variante classique, lu
      -- seulement par la migration vers la table ratings ci-dessous.
      CREATE TABLE IF NOT EXISTS users (
        id            TEXT PRIMARY KEY,
        username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        rating        INTEGER NOT NULL,
        games_played  INTEGER NOT NULL DEFAULT 0,
        created_at    INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token      TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id),
        expires_at INTEGER NOT NULL
      );
      -- Ancienne analyse (étapes 4 à 6), remplacée par la revue : table laissée en place.
      CREATE TABLE IF NOT EXISTS analyses (
        game_id  TEXT PRIMARY KEY,
        analysis TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reviews (
        game_id    TEXT PRIMARY KEY,
        review     TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS imported_games (
        id          TEXT PRIMARY KEY,
        user_id     TEXT NOT NULL REFERENCES users(id),
        source      TEXT NOT NULL,
        external_id TEXT NOT NULL,
        pgn         TEXT NOT NULL,
        white       TEXT NOT NULL,
        black       TEXT NOT NULL,
        white_elo   INTEGER,
        black_elo   INTEGER,
        result      TEXT NOT NULL,
        date        TEXT,
        time_control TEXT,
        user_color  TEXT,
        plies       INTEGER NOT NULL,
        url         TEXT,
        created_at  INTEGER NOT NULL,
        UNIQUE (user_id, external_id)
      );
      CREATE TABLE IF NOT EXISTS results (
        game_id       TEXT PRIMARY KEY,
        user_id       TEXT NOT NULL REFERENCES users(id),
        summary       TEXT NOT NULL,
        ended_at      INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ratings (
        user_id      TEXT NOT NULL REFERENCES users(id),
        variant      TEXT NOT NULL,
        rating       INTEGER NOT NULL,
        games_played INTEGER NOT NULL,
        PRIMARY KEY (user_id, variant)
      );
      -- Migration : l'Elo unique d'avant la variante classique était celui de Secret Queen.
      INSERT OR IGNORE INTO ratings (user_id, variant, rating, games_played)
        SELECT id, 'secret-queen', rating, games_played FROM users WHERE games_played > 0;`);
  }

  // --- Comptes ---------------------------------------------------------------------------

  createUser(user: { id: string; username: string; passwordHash: string }): boolean {
    try {
      this.#db
        .prepare(
          `INSERT INTO users (id, username, password_hash, rating, created_at)
           VALUES (@id, @username, @passwordHash, @rating, @now)`,
        )
        .run({ ...user, rating: this.#initialRating, now: Date.now() });
      return true;
    } catch {
      return false; // pseudo déjà pris
    }
  }

  findUserByName(username: string): UserRow | undefined {
    return this.#db.prepare(`${USER_SELECT} WHERE username = ?`).get(username) as
      UserRow | undefined;
  }

  findUser(id: string): UserRow | undefined {
    return this.#db.prepare(`${USER_SELECT} WHERE id = ?`).get(id) as UserRow | undefined;
  }

  /** Elo d'un joueur dans une variante (Elo initial s'il n'y a encore joué aucune partie). */
  ratingOf(userId: string, variant: Variant): Rating {
    const row = this.#db
      .prepare(
        `SELECT rating, games_played AS gamesPlayed FROM ratings WHERE user_id = ? AND variant = ?`,
      )
      .get(userId, variant) as Rating | undefined;
    return row ?? { rating: this.#initialRating, gamesPlayed: 0 };
  }

  /** Enregistre le nouvel Elo après une partie classée de la variante. */
  setRating(userId: string, variant: Variant, rating: number): void {
    this.#db
      .prepare(
        `INSERT INTO ratings (user_id, variant, rating, games_played) VALUES (?, ?, ?, 1)
         ON CONFLICT(user_id, variant) DO UPDATE SET rating = excluded.rating,
           games_played = games_played + 1`,
      )
      .run(userId, variant, rating);
  }

  publicUser(user: UserRow): UserPublic {
    const ratings = Object.fromEntries(
      VARIANTS.map((variant) => [variant, this.ratingOf(user.id, variant)]),
    ) as UserPublic['ratings'];
    return { id: user.id, username: user.username, ratings };
  }

  /** Classement d'une variante : tous les comptes, Elo initial pour ceux qui n'y ont pas joué. */
  leaderboard(variant: Variant): (Rating & { username: string })[] {
    return this.#db
      .prepare(
        `SELECT u.username, COALESCE(r.rating, @initial) AS rating,
           COALESCE(r.games_played, 0) AS gamesPlayed
         FROM users u LEFT JOIN ratings r ON r.user_id = u.id AND r.variant = @variant
         ORDER BY rating DESC, u.username LIMIT 100`,
      )
      .all({ variant, initial: this.#initialRating }) as (Rating & { username: string })[];
  }

  createSession(token: string, userId: string, expiresAt: number): void {
    this.#db
      .prepare(`INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`)
      .run(token, userId, expiresAt);
  }

  sessionUser(token: string): UserRow | undefined {
    return this.#db
      .prepare(
        `SELECT u.id, u.username, u.password_hash AS passwordHash
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > ?`,
      )
      .get(token, Date.now()) as UserRow | undefined;
  }

  deleteSession(token: string): void {
    this.#db.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  }

  // --- Historique ------------------------------------------------------------------------

  saveResult(gameId: string, userId: string, summary: GameSummary): void {
    this.#db
      .prepare(
        `INSERT OR REPLACE INTO results (game_id, user_id, summary, ended_at) VALUES (?, ?, ?, ?)`,
      )
      .run(gameId, userId, JSON.stringify(summary), Date.now());
  }

  history(userId: string): GameSummary[] {
    const rows = this.#db
      .prepare(`SELECT summary FROM results WHERE user_id = ? ORDER BY ended_at DESC LIMIT 100`)
      .all(userId) as { summary: string }[];
    // Résumés antérieurs à la variante classique : Secret Queen.
    return rows.map(
      (r) => ({ variant: 'secret-queen', ...(JSON.parse(r.summary) as object) }) as GameSummary,
    );
  }

  /** Partie non terminée la plus récente d'un utilisateur (reprise après rafraîchissement). */
  activeGameOf(userId: string): string | null {
    const rows = this.#db
      .prepare(`SELECT id, record FROM games WHERE phase != 'ended' ORDER BY updated_at DESC`)
      .all() as { id: string; record: string }[];
    for (const row of rows) {
      const record = JSON.parse(row.record) as { ownerId?: string | null; mode?: string };
      if (record.ownerId === userId && record.mode === 'bot') return row.id;
    }
    return null;
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

  /** Une partie précise (par exemple terminée, pour le rejeu), quelle que soit sa phase. */
  load(id: string): SavedGame | undefined {
    const row = this.#db.prepare(`SELECT record, secret_state FROM games WHERE id = ?`).get(id) as
      { record: string; secret_state: string } | undefined;
    return row ? this.#parse(row) : undefined;
  }

  // --- Revues et parties importées (coach) ------------------------------------------------

  getReview(gameId: string): GameReview | undefined {
    const row = this.#db.prepare(`SELECT review FROM reviews WHERE game_id = ?`).get(gameId) as
      { review: string } | undefined;
    return row ? (JSON.parse(row.review) as GameReview) : undefined;
  }

  saveReview(gameId: string, review: GameReview): void {
    this.#db
      .prepare(`INSERT OR REPLACE INTO reviews (game_id, review, created_at) VALUES (?, ?, ?)`)
      .run(gameId, JSON.stringify(review), Date.now());
  }

  /** Enregistre une partie importée ; `false` si elle l'était déjà (même `externalId`). */
  addImported(game: ImportedGameRow): boolean {
    const result = this.#db
      .prepare(
        `INSERT OR IGNORE INTO imported_games (id, user_id, source, external_id, pgn, white, black,
           white_elo, black_elo, result, date, time_control, user_color, plies, url, created_at)
         VALUES (@id, @userId, @source, @externalId, @pgn, @white, @black, @whiteElo, @blackElo,
           @result, @date, @timeControl, @userColor, @plies, @url, @now)`,
      )
      .run({ ...game, now: Date.now() });
    return result.changes > 0;
  }

  /** Parties importées d'un utilisateur, les plus récentes d'abord. */
  listImported(userId: string): ImportedGameRow[] {
    return this.#db
      .prepare(
        `${IMPORTED_SELECT} WHERE user_id = ? ORDER BY COALESCE(date, '') DESC, created_at DESC`,
      )
      .all(userId) as ImportedGameRow[];
  }

  getImported(id: string): ImportedGameRow | undefined {
    return this.#db.prepare(`${IMPORTED_SELECT} WHERE id = ?`).get(id) as
      ImportedGameRow | undefined;
  }

  deleteImported(id: string, userId: string): boolean {
    const result = this.#db
      .prepare(`DELETE FROM imported_games WHERE id = ? AND user_id = ?`)
      .run(id, userId);
    if (result.changes > 0) this.#db.prepare(`DELETE FROM reviews WHERE game_id = ?`).run(id);
    return result.changes > 0;
  }

  /** Parties à reprendre au démarrage : toutes celles qui ne sont pas terminées. */
  loadUnfinished(): SavedGame[] {
    const rows = this.#db
      .prepare(`SELECT record, secret_state FROM games WHERE phase != 'ended'`)
      .all() as { record: string; secret_state: string }[];
    return rows.map((row) => this.#parse(row));
  }

  #parse(row: { record: string; secret_state: string }): SavedGame {
    const secret = JSON.parse(row.secret_state) as {
      selection: Partial<Record<Color, Square>>;
      game: PersistedAny | null;
    };
    return {
      record: JSON.parse(row.record) as SessionRecord,
      secrets: {
        selection: secret.selection,
        game: secret.game ? new Secret(secret.game) : null,
      },
    };
  }

  close(): void {
    this.#db.close();
  }
}
