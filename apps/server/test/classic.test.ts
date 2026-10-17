import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type {
  AnalysisResponse,
  BotObservation,
  LeaderboardResponse,
  ProfileResponse,
  UserPublic,
} from '@sq/shared';
import type { BotDriver } from '../src/bot/driver.js';
import { testServer } from './client.js';

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

const hotseat = (timeControl = 'untimed') => ({
  mode: 'hotseat',
  variant: 'classic',
  timeControl,
  whiteName: 'A',
  blackName: 'B',
});

describe('variante classique', () => {
  it('à deux : pas de choix secret, coups légaux, mat, analyse et PGN standard', async () => {
    const { app, http, ws } = await testServer();
    const { gameId } = (await http('POST', '/api/games', hotseat())).json as { gameId: string };
    const c = await ws();
    c.send({ type: 'join', gameId });
    let s = await c.until((x) => x.phase === 'playing');
    expect(s.variant).toBe('classic');
    expect(s.selection).toBeNull();
    expect(s.board?.legalMoves).toHaveLength(20);
    expect(s.board?.ownSecret).toBeNull();

    // Le mat du lion : 1. f3 e5 2. g4 Qh4#.
    const line = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
    for (const [i, m] of line.entries()) {
      c.send({
        type: 'move',
        clientMoveId: String(i),
        move: { from: m.slice(0, 2), to: m.slice(2, 4) },
      });
      s = await c.until((x) => x.board?.moves.length === i + 1);
    }
    expect(s.phase).toBe('ended');
    expect(s.board?.result).toEqual({ winner: 'b', reason: 'checkmate' });
    expect(s.board?.moves.map((m) => m.san)).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
    expect(s.board?.reveal).toBeNull();
    expect(s.board?.legalMoves).toBeNull();

    const port = (app.server.address() as { port: number }).port;
    const pgn = await (await fetch(`http://127.0.0.1:${port}/api/games/${gameId}/pgn`)).text();
    expect(pgn).toContain('[Event "Fianchetto, partie classique"]');
    expect(pgn).toContain('1. f3 e5 2. g4 Qh4# 0-1');
    expect(pgn).not.toContain('FEN');

    const analysis = (await http('GET', `/api/games/${gameId}/analysis`)).json as AnalysisResponse;
    expect(analysis.plies).toHaveLength(5);
    expect(analysis.plies[4]?.evalCp).toBe(-10_000);
    await app.close();
  }, 60_000);

  it('la pendule ne démarre qu’après le premier coup des Blancs', async () => {
    const { app, http, ws } = await testServer();
    const { gameId } = (await http('POST', '/api/games', hotseat('blitz-3+2'))).json as {
      gameId: string;
    };
    const c = await ws();
    c.send({ type: 'join', gameId });
    let s = await c.until((x) => x.phase === 'playing');
    expect(s.clock?.running).toBeNull();
    await new Promise((r) => setTimeout(r, 120));
    c.send({ type: 'move', clientMoveId: '1', move: { from: 'e2', to: 'e4' } });
    s = await c.until((x) => x.board?.moves.length === 1);
    expect(s.clock?.running).toBe('b');
    // Aucun temps décompté aux Blancs, et pas d'incrément offert avant le départ.
    expect(s.clock?.remainingMs.w).toBe(180_000);
    await app.close();
  });

  it('contre le bot : le bot blanc joue d’abord, Elo classique séparé de Secret Queen', async () => {
    const seen: BotObservation[] = [];
    const fake: BotDriver = {
      chooseSecret: () => 'a7',
      chooseMove: (obs) => {
        seen.push(obs);
        return Promise.resolve({ from: 'e2', to: 'e4' });
      },
      shouldAcceptDraw: () => Promise.resolve(false),
      dispose: () => undefined,
    };
    const { app, http, ws } = await testServer({ createBot: () => fake });
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    const { gameId } = (
      await http('POST', '/api/games', {
        mode: 'bot',
        variant: 'classic',
        level: 3,
        timeControl: 'untimed',
        color: 'b',
      })
    ).json as { gameId: string };
    const c = await ws();
    c.send({ type: 'join', gameId });
    let s = await c.until((x) => x.board?.moves.length === 1);
    expect(s.viewer).toBe('b');
    expect(s.board?.moves[0]?.san).toBe('e4');
    expect(seen[0]?.state.variant).toBe('classic');
    expect(seen[0]?.state.board?.ownSecret).toBeNull();

    c.send({ type: 'resign' });
    s = await c.until((x) => x.phase === 'ended');
    expect(s.rated).toBe(true);
    const me = (await http('GET', '/api/auth/me')).json as UserPublic;
    expect(me.ratings.classic.gamesPlayed).toBe(1);
    expect(me.ratings.classic.rating).toBeLessThan(1200);
    expect(me.ratings['secret-queen']).toEqual({ rating: 1200, gamesPlayed: 0 });

    const profile = (await http('GET', '/api/profile/cedric')).json as ProfileResponse;
    expect(profile.history[0]?.variant).toBe('classic');
    expect(profile.history[0]?.ratingBefore).toBe(1200);
    const classic = (await http('GET', '/api/leaderboard?variant=classic'))
      .json as LeaderboardResponse;
    expect(classic.variant).toBe('classic');
    expect(classic.entries[0]?.rating).toBe(me.ratings.classic.rating);
    const sq = (await http('GET', '/api/leaderboard')).json as LeaderboardResponse;
    expect(sq.variant).toBe('secret-queen');
    expect(sq.entries[0]?.rating).toBe(1200);
    await app.close();
  });

  it('une partie classique en cours reprend après un redémarrage', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sq-'));
    dirs.push(dir);
    const dbPath = join(dir, 'test.db');
    let server = await testServer({ dbPath });
    const { gameId } = (await server.http('POST', '/api/games', hotseat('blitz-5+0'))).json as {
      gameId: string;
    };
    let c = await server.ws();
    c.send({ type: 'join', gameId });
    await c.until((x) => x.phase === 'playing');
    c.send({ type: 'move', clientMoveId: '1', move: { from: 'g1', to: 'f3' } });
    const before = await c.until((x) => x.board?.moves.length === 1);
    await server.app.close();

    server = await testServer({ dbPath });
    c = await server.ws();
    c.send({ type: 'join', gameId });
    const after = await c.until((x) => x.board?.moves.length === 1);
    expect(after.variant).toBe('classic');
    expect(after.board?.moves).toEqual(before.board?.moves);
    expect(after.clock?.running).toBe('b');
    await server.app.close();
  });
});
