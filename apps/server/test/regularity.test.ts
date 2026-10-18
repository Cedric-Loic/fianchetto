import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import Fastify from 'fastify';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { LESSONS, PHASE_THEMES, themeOfDay } from '@sq/coach';
import type { GameReview, GameSummary, PuzzleAttempt } from '@sq/shared';
import { Secret } from '@sq/shared/secret';
import { CoachService } from '../src/coach/routes.js';
import { loadConfig } from '../src/config.js';
import type { GameSession, SessionRecord, SessionSecrets } from '../src/games/session.js';
import { GameStore } from '../src/persistence/db.js';
import { importPuzzles } from '../src/puzzles/importer.js';
import { PuzzleService } from '../src/puzzles/service.js';
import { importedRow } from '../src/review/imports.js';
import { registerTrainingRoutes } from '../src/training/routes.js';
import type { TrainingService } from '../src/training/service.js';

const FIXTURE = new URL('./fixtures/puzzles.csv', import.meta.url).pathname;
const { botLevels } = loadConfig();
const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'sq-reg-'));
  dirs.push(d);
  return d;
};
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

async function bank(): Promise<string> {
  const dbPath = join(tempDir(), 'puzzles.db');
  await importPuzzles({ file: FIXTURE, dbPath });
  return dbPath;
}

function setup(puzzlesPath: string, now?: () => number) {
  const store = new GameStore(':memory:', { initialRating: 1200, puzzlesPath });
  store.createUser({ id: 'u1', username: 'cedric', passwordHash: 'x' });
  const coach = new CoachService(store, botLevels);
  const puzzles = new PuzzleService(store, vi.fn().mockResolvedValue(null), {
    themeOfDay: (userId) => coach.themeOfDay(userId),
    ...(now ? { now } : {}),
  });
  coach.attach(puzzles);
  return { store, coach, puzzles };
}

function started(result: PuzzleAttempt | string): PuzzleAttempt {
  if (typeof result === 'string') throw new Error(result);
  return result;
}

/** Joueur qui remplit les critères de la phase 1 : il est en phase 2. */
function promoteToPhase2(store: GameStore): void {
  for (const l of LESSONS.filter((x) => x.phase === 1)) {
    store.saveLessonResult('u1', l.id, l.exercises.length);
  }
  for (let i = 0; i < 150; i++) {
    store.puzzles.recordAttempt({
      userId: 'u1',
      source: 'lichess',
      puzzleId: `P${i}`,
      success: true,
      rated: false,
      themes: ' fork ',
    });
  }
  // Thème faible (20 % de réussite sur 5) : il entre dans la rotation pondérée.
  for (let i = 0; i < 5; i++) {
    store.puzzles.recordAttempt({
      userId: 'u1',
      source: 'lichess',
      puzzleId: `Q${i}`,
      success: i === 0,
      rated: false,
      themes: ' pin ',
    });
  }
  const clean = { inaccuracy: 0, mistake: 0, blunder: 0 };
  for (let i = 1; i <= 5; i++) {
    const row = importedRow(`[Date "2026.01.0${i}"]\n[White "cedric"]\n[Black "x"]\n\n1. e4 e5 *`, {
      userId: 'u1',
      source: 'pgn',
      names: ['cedric'],
    });
    if (!row) throw new Error('PGN illisible');
    store.addImported(row);
    store.saveReview(row.id, {
      counts: { w: clean, b: clean },
      accuracy: { w: 90, b: 80 },
      moves: [],
      positions: [],
    } as unknown as GameReview);
  }
}

describe('migration et durée des tentatives de puzzle', () => {
  it('ajoute la colonne duration_ms à une base existante sans perdre les tentatives', async () => {
    const dir = tempDir();
    const path = join(dir, 'old.db');
    const old = new Database(path);
    old.exec(`CREATE TABLE puzzle_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, source TEXT NOT NULL,
      puzzle_id TEXT NOT NULL, success INTEGER NOT NULL, rated INTEGER NOT NULL,
      themes TEXT NOT NULL, at INTEGER NOT NULL);
      INSERT INTO puzzle_attempts (user_id, source, puzzle_id, success, rated, themes, at)
      VALUES ('u1', 'lichess', 'T0001', 1, 1, ' fork ', 1000);`);
    old.close();
    const store = new GameStore(path, { initialRating: 1200, puzzlesPath: await bank() });
    expect(store.puzzles.attempts('u1')).toEqual([
      {
        source: 'lichess',
        success: 1,
        themes: ' fork ',
        at: 1000,
        ratingAfter: null,
        durationMs: null,
      },
    ]);
    store.close();
    const check = new Database(path);
    const columns = check.prepare(`PRAGMA table_info(puzzle_attempts)`).all() as { name: string }[];
    expect(columns.map((c) => c.name)).toEqual(expect.arrayContaining(['duration_ms']));
    check.close();
  });

  it('enregistre le temps passé entre l’affichage et la fin de la tentative', async () => {
    let clock = 1_000_000;
    const { store, puzzles, coach } = setup(await bank(), () => clock);
    const a = started(puzzles.next('u1', 'theme', 'fork'));
    clock += 42_000;
    await puzzles.move('u1', a.attemptId, 'b5d6');
    expect(store.puzzles.attempts('u1')).toMatchObject([{ success: 0, durationMs: 42_000 }]);
    // Durée réelle reprise par le tableau de bord (minutes, puzzles du jour).
    clock = Date.now();
    const b = started(puzzles.next('u1', 'theme', 'hangingPiece'));
    clock += 180_000;
    await puzzles.move('u1', b.attemptId, 'c3e5');
    const d = coach.dashboard('u1', new Date(clock));
    expect(d.streak.todayPuzzles).toBeGreaterThanOrEqual(1);
    expect(d.streak.todayMinutes).toBeGreaterThanOrEqual(3);
  });
});

describe('thème du jour du coach', () => {
  it('phase 1 sans données : thème du coach, servi par les puzzles « thème »', async () => {
    const { puzzles, coach } = setup(await bank());
    const expected = themeOfDay({ phase: 1, weakThemes: [], date: new Date() });
    expect(PHASE_THEMES[1]).toContain(expected);
    expect(puzzles.stats('u1').themeOfDay).toBe(expected);
    expect(coach.dashboard('u1').themeOfDay).toBe(expected);
  });

  it('phase 2 : thèmes de la phase et thèmes faibles, comme le tableau de bord', async () => {
    const { store, puzzles, coach } = setup(await bank());
    promoteToPhase2(store);
    const d = coach.dashboard('u1');
    expect(d.phase.current).toBe(2);
    expect(d.weaknesses.weakThemes.map((t) => t.theme)).toContain('pin');
    const expected = themeOfDay({
      phase: 2,
      weakThemes: d.weaknesses.weakThemes,
      date: new Date(),
    });
    expect(puzzles.stats('u1').themeOfDay).toBe(expected);
    expect(d.themeOfDay).toBe(expected);
    expect([...PHASE_THEMES[2], 'pin']).toContain(expected);
  });

  it('mode « thème » sans thème précis : le fournisseur du thème du jour est utilisé', async () => {
    const store = new GameStore(':memory:', { initialRating: 1200, puzzlesPath: await bank() });
    store.createUser({ id: 'u1', username: 'cedric', passwordHash: 'x' });
    const provider = vi.fn().mockReturnValue('fork');
    const puzzles = new PuzzleService(store, vi.fn().mockResolvedValue(null), {
      themeOfDay: provider,
    });
    expect(started(puzzles.next('u1', 'theme', null)).puzzleId).toBe('T0002');
    expect(provider).toHaveBeenCalledWith('u1');
  });
});

describe('tableau de bord : nouvelles entrées', () => {
  it('durée des parties, séances de leçon et d’analyse, niveau de bot conseillé', async () => {
    const { store, coach } = setup(await bank());
    const end = Date.now();
    const game = (i: number, winner: 'w' | 'b' | null, opponentName: string): GameSummary => ({
      gameId: `g${i}`,
      variant: 'classic',
      mode: 'bot',
      rated: true,
      timeControl: 'untimed',
      color: 'w',
      opponentName,
      winner,
      reason: winner ? 'checkmate' : 'stalemate',
      ratingBefore: null,
      ratingAfter: null,
      startedAt: new Date(end - 40 * 60_000 - i).toISOString(),
      endedAt: new Date(end - i).toISOString(),
    });
    // Trois victoires contre « Amateur » (niveau 2) : un cran au-dessus.
    for (let i = 0; i < 3; i++) store.saveResult(`g${i}`, 'u1', game(i, 'w', 'Amateur'));
    let d = coach.dashboard('u1', new Date(end));
    expect(d.suggestedBotLevel).toBe(3);
    // 3 parties lentes de 40 min chacune.
    expect(d.streak.todayMinutes).toBe(120);

    store.saveLessonResult('u1', LESSONS[0]?.id ?? '', 1);
    store.recordActivity('u1', 'analysis', 'g0', end);
    store.recordActivity('u1', 'analysis', 'g0', end); // même partie, même jour : une séance
    d = coach.dashboard('u1', new Date(end));
    expect(d.streak.todayMinutes).toBe(120 + 20 + 10);
    expect(d.streak.todayDone).toBe(true);
    expect(d.blitzLocked).toBe(false);
    expect(d.guard).toBe('always');
  });
});

describe('garde-fou dégressif', () => {
  const save = (store: GameStore, id: string, startedAt: string) =>
    store.save(
      { id, ownerId: 'u1', training: true, startedAt, phase: 'playing' } as SessionRecord,
      new Secret<SessionSecrets>({ selection: {}, game: null }),
    );

  it('phase 1 : toujours ; phase 2 : une partie d’entraînement sur deux', async () => {
    const { store, coach } = setup(await bank());
    save(store, 'a', '2026-01-01T10:00:00.000Z');
    save(store, 'b', '2026-01-02T10:00:00.000Z');
    expect(coach.guardActiveFor('b', 'u1', '2026-01-02T10:00:00.000Z')).toBe(true);

    const p2 = setup(await bank());
    promoteToPhase2(p2.store);
    save(p2.store, 'a', '2026-01-01T10:00:00.000Z');
    save(p2.store, 'b', '2026-01-02T10:00:00.000Z');
    save(p2.store, 'c', '2026-01-03T10:00:00.000Z');
    expect(p2.coach.guardActiveFor('a', 'u1', '2026-01-01T10:00:00.000Z')).toBe(true);
    expect(p2.coach.guardActiveFor('b', 'u1', '2026-01-02T10:00:00.000Z')).toBe(false);
    expect(p2.coach.guardActiveFor('c', 'u1', '2026-01-03T10:00:00.000Z')).toBe(true);
  });

  it('check-move ne consulte pas le moteur quand le garde-fou est coupé pour la partie', async () => {
    const checkMove = vi.fn().mockResolvedValue('Gaffe');
    const session = {
      mode: 'bot',
      trainingPosition: () => ({ fen: '8/8/8/8/8/8/8/K6k w - - 0 1', color: 'w' }),
    } as unknown as GameSession;
    for (const active of [false, true]) {
      const app = Fastify();
      registerTrainingRoutes(
        app,
        { checkMove } as unknown as TrainingService,
        () => ({ session }),
        () => active,
      );
      const res = await app.inject({
        method: 'POST',
        url: '/api/games/x/check-move',
        payload: { uci: 'a1a2' },
      });
      expect(res.json()).toEqual({ warning: active ? 'Gaffe' : null });
      await app.close();
    }
    expect(checkMove).toHaveBeenCalledTimes(1);
  });
});
