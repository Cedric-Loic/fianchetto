import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type {
  CoachDashboard,
  ImportedGamesResponse,
  PuzzleAttempt,
  ReviewResponse,
} from '@sq/shared';
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

1. e4 {[%clk 0:15:05]} e5 {[%clk 0:15:08]} 2. Nf3 {[%clk 0:14:50]} Nc6 {[%clk 0:15:00]}
3. Nxe5 {[%clk 0:01:00]} Nxe5 {[%clk 0:14:55]} 4. d4 {[%clk 0:00:50]} Nc6 {[%clk 0:14:50]}
5. d5 {[%clk 0:00:40]} Nb4 {[%clk 0:14:45]} 6. a3 {[%clk 0:00:30]} Qh4 {[%clk 0:14:40]}
7. axb4 {[%clk 0:00:20]} Qxe4+ {[%clk 0:14:35]} 0-1
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
    await http('POST', '/api/lessons/routine/result', { correct: 6 });

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
    // Lot 4d : pendule relue dans le PGN ; dès le coup 4, les Blancs ont moins de 90 s (10 %).
    const reviewed = (await http('GET', `/api/reviews/${games[0]?.id ?? ''}`))
      .json as ReviewResponse;
    expect(reviewed.info.clocks?.slice(0, 3)).toEqual([905_000, 908_000, 890_000]);
    expect(reviewed.info.clocks).toHaveLength(14);
    const done = reviewed.state.status === 'done' ? reviewed.state.review : null;
    const late = (done?.moves ?? []).filter(
      (m) => m.color === 'w' && m.ply >= 7 && ['mistake', 'blunder'].includes(m.classification),
    ).length;
    expect(d.weaknesses.clock).toMatchObject({ games: 1, lowTime: late });
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
