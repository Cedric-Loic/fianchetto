import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { CoachDashboard, ImportedGamesResponse, PuzzleAttempt } from '@sq/shared';
import { importPuzzles } from '../src/puzzles/importer.js';
import { testServer } from './client.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const today = new Date();
const pgnDate = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;
const PGN = `[Event "Live Chess"]
[Date "${pgnDate}"]
[White "moi_cc"]
[Black "rival"]
[Result "0-1"]
[WhiteElo "980"]
[TimeControl "900+10"]

1. e4 e5 2. Nf3 Nc6 3. Nxe5 Nxe5 4. d4 Nc6 5. d5 Nb4 6. a3 Qh4 7. axb4 Qxe4+ 0-1
`;

describe('tableau de bord du coach', () => {
  it('réservé aux comptes ; agrège parties, puzzles et leçons de la semaine', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sq-coach-'));
    dirs.push(dir);
    const puzzlesPath = join(dir, 'p.db');
    await importPuzzles({
      file: new URL('./fixtures/puzzles.csv', import.meta.url).pathname,
      dbPath: puzzlesPath,
    });
    const { app, http, review } = await testServer({ puzzlesPath });
    expect((await http('GET', '/api/coach/dashboard')).status).toBe(401);
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });

    let d = (await http('GET', '/api/coach/dashboard')).json as CoachDashboard;
    expect(d.phase.current).toBe(1);
    expect(d.recommendations[0]?.href).toBe('#/analyse');

    await http('POST', '/api/imports/pgn', { pgn: PGN, as: 'moi_cc' });
    const { games } = (await http('GET', '/api/imports')).json as ImportedGamesResponse;
    await review(games[0]?.id ?? '');
    const { attempt } = (
      await http('POST', '/api/puzzles/next', { mode: 'theme', theme: 'hangingPiece' })
    ).json as { attempt: PuzzleAttempt };
    await http('POST', `/api/puzzles/${attempt.attemptId}/move`, { uci: 'c3e5' });
    await http('POST', '/api/lessons/routine/result', { correct: 3 });

    d = (await http('GET', '/api/coach/dashboard')).json as CoachDashboard;
    expect(Object.fromEntries(d.week.tasks.map((t) => [t.id, t.done]))).toEqual({
      puzzles: 1,
      'slow-games': 1,
      reviews: 1,
      lesson: 1,
    });
    expect(d.weaknesses.games).toBe(1);
    expect(d.weaknesses.kinds[0]?.kind).toBe('hanging-piece');
    expect(d.curves.find((c) => c.id === 'chesscom-rapid')?.points).toEqual([
      { date: games[0]?.date, value: 980 },
    ]);
    expect(d.curves.find((c) => c.id === 'puzzle')?.points).toHaveLength(1);
    expect(d.phase.criteria.find((c) => c.label.startsWith('Leçons'))?.value).toBe('1 / 10');
    // Étape 13 : partie lente (30 min estimées), leçon (20), revue consultée (10), puzzle chronométré.
    await http('GET', `/api/reviews/${games[0]?.id ?? ''}`);
    d = (await http('GET', '/api/coach/dashboard')).json as CoachDashboard;
    expect(d.streak.todayPuzzles).toBe(1);
    expect(d.streak.todayMinutes).toBeGreaterThanOrEqual(60);
    expect(d.streak.todayMinutes).toBeLessThanOrEqual(62);
    expect(d.themeOfDay).toBe(
      ((await http('GET', '/api/puzzles/stats')).json as { themeOfDay: string }).themeOfDay,
    );
    await app.close();
  }, 60_000);
});
