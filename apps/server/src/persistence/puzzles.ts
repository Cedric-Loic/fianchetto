import type Database from 'better-sqlite3';
import type { Glicko } from '@sq/coach';
import type { PuzzleSource } from '@sq/shared';

/*
 * Puzzles : la base Lichess vit dans un fichier SQLite séparé (`data/puzzles.db`, rempli une
 * fois par `pnpm puzzles:import`), attaché à la base principale sous le nom `bank`. Les données
 * de l'utilisateur (classement, tentatives, révisions, puzzles tirés de ses erreurs) sont dans la
 * base principale.
 */

/** Schéma de la base de puzzles (aussi utilisé par le script d'import). */
export function bankSchema(prefix: string): string {
  return `
    CREATE TABLE IF NOT EXISTS ${prefix}puzzles (
      id         TEXT PRIMARY KEY,
      fen        TEXT NOT NULL,
      moves      TEXT NOT NULL,
      rating     INTEGER NOT NULL,
      deviation  INTEGER NOT NULL,
      popularity INTEGER NOT NULL,
      plays      INTEGER NOT NULL,
      -- Thèmes séparés et entourés d'espaces (« fork pin ») pour la recherche par LIKE.
      themes     TEXT NOT NULL,
      game_url   TEXT
    );
    CREATE INDEX IF NOT EXISTS ${prefix}puzzles_rating ON puzzles (rating);`;
}

export interface BankPuzzle {
  id: string;
  fen: string;
  /** Coups UCI séparés par des espaces : coup adverse, puis solution. */
  moves: string;
  rating: number;
  deviation: number;
  themes: string;
  gameUrl: string | null;
}

export interface OwnPuzzle {
  id: string;
  userId: string;
  gameId: string;
  ply: number;
  fen: string;
  moves: string;
  evalCp: number | null;
  mate: number | null;
  kind: string | null;
  label: string;
  url: string | null;
}

/** Intervalles de révision (jours) après chaque réussite d'un puzzle raté. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 21] as const;
const DAY = 24 * 3600 * 1000;

const BANK_SELECT = `SELECT id, fen, moves, rating, deviation, themes, game_url AS gameUrl
  FROM bank.puzzles`;
const OWN_SELECT = `SELECT id, user_id AS userId, game_id AS gameId, ply, fen, moves,
  eval_cp AS evalCp, mate, kind, label, url FROM own_puzzles`;

export class PuzzleStore {
  readonly #db: Database.Database;

  constructor(db: Database.Database, bankPath: string) {
    this.#db = db;
    db.prepare(`ATTACH DATABASE ? AS bank`).run(bankPath);
    db.exec(bankSchema('bank.'));
    db.exec(`
      CREATE TABLE IF NOT EXISTS puzzle_ratings (
        user_id    TEXT PRIMARY KEY REFERENCES users(id),
        rating     REAL NOT NULL,
        deviation  REAL NOT NULL,
        volatility REAL NOT NULL
      );
      CREATE TABLE IF NOT EXISTS puzzle_attempts (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id   TEXT NOT NULL REFERENCES users(id),
        source    TEXT NOT NULL,
        puzzle_id TEXT NOT NULL,
        success   INTEGER NOT NULL,
        rated     INTEGER NOT NULL,
        themes    TEXT NOT NULL,
        at        INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS puzzle_attempts_user ON puzzle_attempts (user_id, puzzle_id);
      CREATE TABLE IF NOT EXISTS puzzle_schedule (
        user_id   TEXT NOT NULL REFERENCES users(id),
        source    TEXT NOT NULL,
        puzzle_id TEXT NOT NULL,
        step      INTEGER NOT NULL,
        due_at    INTEGER NOT NULL,
        PRIMARY KEY (user_id, source, puzzle_id)
      );
      CREATE TABLE IF NOT EXISTS own_puzzles (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id),
        game_id    TEXT NOT NULL,
        ply        INTEGER NOT NULL,
        fen        TEXT NOT NULL,
        moves      TEXT NOT NULL,
        eval_cp    INTEGER,
        mate       INTEGER,
        kind       TEXT,
        label      TEXT NOT NULL,
        url        TEXT,
        created_at INTEGER NOT NULL,
        UNIQUE (user_id, game_id, ply)
      );
      CREATE TABLE IF NOT EXISTS own_puzzle_sources (
        user_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        PRIMARY KEY (user_id, game_id)
      );`);
  }

  // --- Base Lichess ------------------------------------------------------------------------

  bankSize(): number {
    return (this.#db.prepare(`SELECT COUNT(*) AS n FROM bank.puzzles`).get() as { n: number }).n;
  }

  getLichess(id: string): BankPuzzle | undefined {
    return this.#db.prepare(`${BANK_SELECT} WHERE id = ?`).get(id) as BankPuzzle | undefined;
  }

  /** Puzzle au hasard dans une fourchette de classement, jamais tenté par l'utilisateur. */
  pickLichess(
    userId: string,
    range: { min: number; max: number },
    theme: string | null,
  ): BankPuzzle | undefined {
    return this.#db
      .prepare(
        `${BANK_SELECT} WHERE rating BETWEEN @min AND @max
           AND (@theme IS NULL OR themes LIKE '% ' || @theme || ' %')
           AND id NOT IN (SELECT puzzle_id FROM puzzle_attempts
                          WHERE user_id = @userId AND source = 'lichess')
         ORDER BY RANDOM() LIMIT 1`,
      )
      .get({ ...range, theme, userId }) as BankPuzzle | undefined;
  }

  // --- Classement et tentatives --------------------------------------------------------------

  glicko(userId: string): Glicko | undefined {
    return this.#db
      .prepare(`SELECT rating, deviation, volatility FROM puzzle_ratings WHERE user_id = ?`)
      .get(userId) as Glicko | undefined;
  }

  setGlicko(userId: string, g: Glicko): void {
    this.#db
      .prepare(
        `INSERT INTO puzzle_ratings (user_id, rating, deviation, volatility)
         VALUES (@userId, @rating, @deviation, @volatility)
         ON CONFLICT(user_id) DO UPDATE SET rating = @rating, deviation = @deviation,
           volatility = @volatility`,
      )
      .run({ userId, ...g });
  }

  recordAttempt(a: {
    userId: string;
    source: PuzzleSource;
    puzzleId: string;
    success: boolean;
    rated: boolean;
    themes: string;
  }): void {
    this.#db
      .prepare(
        `INSERT INTO puzzle_attempts (user_id, source, puzzle_id, success, rated, themes, at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        a.userId,
        a.source,
        a.puzzleId,
        a.success ? 1 : 0,
        a.rated ? 1 : 0,
        a.themes,
        Date.now(),
      );
  }

  attempts(userId: string): { source: string; success: number; themes: string }[] {
    return this.#db
      .prepare(`SELECT source, success, themes FROM puzzle_attempts WHERE user_id = ?`)
      .all(userId) as { source: string; success: number; themes: string }[];
  }

  // --- Révisions (répétition espacée) ----------------------------------------------------------

  /** Puzzle raté : à revoir demain (et l'étape de révision repart de zéro). */
  scheduleFailure(userId: string, source: PuzzleSource, puzzleId: string, now = Date.now()): void {
    this.#db
      .prepare(
        `INSERT INTO puzzle_schedule (user_id, source, puzzle_id, step, due_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(user_id, source, puzzle_id) DO UPDATE SET step = 0, due_at = excluded.due_at`,
      )
      .run(userId, source, puzzleId, now + DAY);
  }

  /** Puzzle à revoir réussi : intervalle suivant, ou fin des révisions après le dernier. */
  scheduleSuccess(userId: string, source: PuzzleSource, puzzleId: string, now = Date.now()): void {
    const row = this.#db
      .prepare(
        `SELECT step FROM puzzle_schedule WHERE user_id = ? AND source = ? AND puzzle_id = ?`,
      )
      .get(userId, source, puzzleId) as { step: number } | undefined;
    if (!row) return;
    const step = row.step + 1;
    const days = REVIEW_INTERVALS_DAYS[step];
    if (days === undefined) {
      this.#db
        .prepare(`DELETE FROM puzzle_schedule WHERE user_id = ? AND source = ? AND puzzle_id = ?`)
        .run(userId, source, puzzleId);
      return;
    }
    this.#db
      .prepare(
        `UPDATE puzzle_schedule SET step = ?, due_at = ?
         WHERE user_id = ? AND source = ? AND puzzle_id = ?`,
      )
      .run(step, now + days * DAY, userId, source, puzzleId);
  }

  /** Révisions dues, les plus anciennes d'abord. */
  due(userId: string, now = Date.now()): { source: PuzzleSource; puzzleId: string }[] {
    return this.#db
      .prepare(
        `SELECT source, puzzle_id AS puzzleId FROM puzzle_schedule
         WHERE user_id = ? AND due_at <= ? ORDER BY due_at`,
      )
      .all(userId, now) as { source: PuzzleSource; puzzleId: string }[];
  }

  // --- Mes erreurs ---------------------------------------------------------------------------

  addOwn(p: Omit<OwnPuzzle, 'id'> & { id: string }): void {
    this.#db
      .prepare(
        `INSERT OR IGNORE INTO own_puzzles (id, user_id, game_id, ply, fen, moves, eval_cp, mate,
           kind, label, url, created_at)
         VALUES (@id, @userId, @gameId, @ply, @fen, @moves, @evalCp, @mate, @kind, @label, @url,
           @now)`,
      )
      .run({ ...p, now: Date.now() });
  }

  getOwn(id: string): OwnPuzzle | undefined {
    return this.#db.prepare(`${OWN_SELECT} WHERE id = ?`).get(id) as OwnPuzzle | undefined;
  }

  /** Un de mes puzzles : jamais réussi d'abord (jamais tenté en priorité), au hasard ensuite. */
  pickOwn(userId: string): OwnPuzzle | undefined {
    return this.#db
      .prepare(
        `${OWN_SELECT} o WHERE user_id = @userId
         ORDER BY
           EXISTS (SELECT 1 FROM puzzle_attempts a WHERE a.user_id = @userId
                   AND a.source = 'mine' AND a.puzzle_id = o.id AND a.success = 1),
           EXISTS (SELECT 1 FROM puzzle_attempts a WHERE a.user_id = @userId
                   AND a.source = 'mine' AND a.puzzle_id = o.id),
           RANDOM()
         LIMIT 1`,
      )
      .get({ userId }) as OwnPuzzle | undefined;
  }

  countOwn(userId: string): number {
    return (
      this.#db.prepare(`SELECT COUNT(*) AS n FROM own_puzzles WHERE user_id = ?`).get(userId) as {
        n: number;
      }
    ).n;
  }

  isSourceSynced(userId: string, gameId: string): boolean {
    return (
      this.#db
        .prepare(`SELECT 1 FROM own_puzzle_sources WHERE user_id = ? AND game_id = ?`)
        .get(userId, gameId) !== undefined
    );
  }

  markSourceSynced(userId: string, gameId: string): void {
    this.#db
      .prepare(`INSERT OR IGNORE INTO own_puzzle_sources (user_id, game_id) VALUES (?, ?)`)
      .run(userId, gameId);
  }
}
