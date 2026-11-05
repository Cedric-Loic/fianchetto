import type Database from 'better-sqlite3';
import type { WoodpeckerCycle } from '@sq/shared';
import type { BankPuzzle } from './puzzles.js';

/*
 * Entraînement rapide (étape 17) : tentatives « Trouve la menace », lot Woodpecker en cours et
 * séries contre la montre. Les puzzles eux-mêmes viennent de la base Lichess attachée (`bank`).
 */

const BANK_SELECT = `SELECT id, fen, moves, rating, deviation, themes, game_url AS gameUrl
  FROM bank.puzzles`;

export interface WoodpeckerRow {
  puzzleIds: string[];
  cycle: number;
  position: number;
  solved: number;
  ms: number;
  history: WoodpeckerCycle[];
}

export class DrillStore {
  readonly #db: Database.Database;

  constructor(db: Database.Database) {
    this.#db = db;
    db.exec(`
      CREATE TABLE IF NOT EXISTS threat_attempts (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id   TEXT NOT NULL REFERENCES users(id),
        puzzle_id TEXT NOT NULL,
        correct   INTEGER NOT NULL,
        at        INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS threat_attempts_user ON threat_attempts (user_id, at);
      CREATE TABLE IF NOT EXISTS woodpecker_sets (
        user_id    TEXT PRIMARY KEY REFERENCES users(id),
        puzzle_ids TEXT NOT NULL,
        cycle      INTEGER NOT NULL,
        position   INTEGER NOT NULL,
        solved     INTEGER NOT NULL,
        ms         INTEGER NOT NULL,
        history    TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rush_runs (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES users(id),
        minutes INTEGER NOT NULL,
        score   INTEGER NOT NULL,
        errors  INTEGER NOT NULL,
        at      INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS rush_runs_user ON rush_runs (user_id, at);`);
  }

  // --- Trouve la menace --------------------------------------------------------------------

  /** Puzzle au hasard dans la fourchette, jamais servi en « menace » si possible (`fresh`). */
  pickThreat(
    userId: string,
    range: { min: number; max: number },
    fresh: boolean,
  ): BankPuzzle | undefined {
    return this.#db
      .prepare(
        `${BANK_SELECT} WHERE rating BETWEEN @min AND @max
           AND (@fresh = 0 OR id NOT IN (SELECT puzzle_id FROM threat_attempts
                                         WHERE user_id = @userId))
         ORDER BY RANDOM() LIMIT 1`,
      )
      .get({ ...range, fresh: fresh ? 1 : 0, userId }) as BankPuzzle | undefined;
  }

  recordThreat(userId: string, puzzleId: string, correct: boolean, at: number): void {
    this.#db
      .prepare(`INSERT INTO threat_attempts (user_id, puzzle_id, correct, at) VALUES (?, ?, ?, ?)`)
      .run(userId, puzzleId, correct ? 1 : 0, at);
  }

  threatAttempts(userId: string): { puzzleId: string; correct: boolean; at: number }[] {
    const rows = this.#db
      .prepare(
        `SELECT puzzle_id AS puzzleId, correct, at FROM threat_attempts
         WHERE user_id = ? ORDER BY at, id`,
      )
      .all(userId) as { puzzleId: string; correct: number; at: number }[];
    return rows.map((r) => ({ ...r, correct: r.correct === 1 }));
  }

  // --- Woodpecker ----------------------------------------------------------------------------

  /** `count` puzzles distincts au hasard dans la fourchette (moins si la base n'en a pas assez). */
  pickMany(range: { min: number; max: number }, count: number): BankPuzzle[] {
    return this.#db
      .prepare(`${BANK_SELECT} WHERE rating BETWEEN @min AND @max ORDER BY RANDOM() LIMIT @count`)
      .all({ ...range, count }) as BankPuzzle[];
  }

  woodpecker(userId: string): WoodpeckerRow | null {
    const row = this.#db
      .prepare(
        `SELECT puzzle_ids AS puzzleIds, cycle, position, solved, ms, history
         FROM woodpecker_sets WHERE user_id = ?`,
      )
      .get(userId) as
      | {
          puzzleIds: string;
          cycle: number;
          position: number;
          solved: number;
          ms: number;
          history: string;
        }
      | undefined;
    if (!row) return null;
    return {
      ...row,
      puzzleIds: JSON.parse(row.puzzleIds) as string[],
      history: JSON.parse(row.history) as WoodpeckerCycle[],
    };
  }

  saveWoodpecker(userId: string, row: WoodpeckerRow, now: number): void {
    this.#db
      .prepare(
        `INSERT INTO woodpecker_sets (user_id, puzzle_ids, cycle, position, solved, ms, history,
           created_at) VALUES (@userId, @puzzleIds, @cycle, @position, @solved, @ms, @history, @now)
         ON CONFLICT(user_id) DO UPDATE SET puzzle_ids = @puzzleIds, cycle = @cycle,
           position = @position, solved = @solved, ms = @ms, history = @history`,
      )
      .run({
        userId,
        puzzleIds: JSON.stringify(row.puzzleIds),
        cycle: row.cycle,
        position: row.position,
        solved: row.solved,
        ms: Math.round(row.ms),
        history: JSON.stringify(row.history),
        now,
      });
  }

  deleteWoodpecker(userId: string): void {
    this.#db.prepare(`DELETE FROM woodpecker_sets WHERE user_id = ?`).run(userId);
  }

  // --- Contre la montre ----------------------------------------------------------------------

  recordRush(userId: string, run: { minutes: number; score: number; errors: number }, at: number) {
    this.#db
      .prepare(`INSERT INTO rush_runs (user_id, minutes, score, errors, at) VALUES (?, ?, ?, ?, ?)`)
      .run(userId, run.minutes, run.score, run.errors, at);
  }

  rushRuns(userId: string): { minutes: number; score: number; at: number }[] {
    return this.#db
      .prepare(
        `SELECT minutes, score, at FROM rush_runs WHERE user_id = ? ORDER BY at DESC, id DESC`,
      )
      .all(userId) as { minutes: number; score: number; at: number }[];
  }
}
