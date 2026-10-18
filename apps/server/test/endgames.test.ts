import { describe, expect, it } from 'vitest';
import type {
  BotLevel,
  EndgameStartResponse,
  EndgamesResponse,
  EndgameSummary,
  MoveIntent,
} from '@sq/shared';
import type { BotDriver } from '../src/bot/driver.js';
import { testServer } from './client.js';

/** Faux bot : joue la liste donnée, puis rien de légal (la partie se termine avant). */
function scripted(moves: MoveIntent[]): BotDriver {
  let index = 0;
  return {
    chooseSecret: () => 'a7',
    chooseMove: () => Promise.resolve(moves[index++] ?? { from: 'a1', to: 'a2' }),
    shouldAcceptDraw: () => Promise.resolve(false),
    dispose: () => undefined,
  };
}

async function server(moves: MoveIntent[] = []) {
  const levels: BotLevel[] = [];
  const s = await testServer({
    createBot: (level) => {
      levels.push(level);
      return scripted(moves);
    },
  });
  await s.http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
  const list = async () =>
    ((await s.http('GET', '/api/endgames')).json as EndgamesResponse).endgames;
  const find = async (id: string) => (await list()).find((e) => e.id === id) as EndgameSummary;
  const start = async (id: string) =>
    ((await s.http('POST', `/api/endgames/${id}/start`)).json as EndgameStartResponse).gameId;
  return { ...s, levels, list, find, start };
}

describe('finales contre le bot', () => {
  it('liste réservée aux comptes ; finale inconnue refusée', async () => {
    const anonymous = await testServer();
    expect((await anonymous.http('GET', '/api/endgames')).status).toBe(401);
    expect((await anonymous.http('POST', '/api/endgames/lucena/start')).status).toBe(401);
    await anonymous.app.close();

    const { app, http, list } = await server();
    const endgames = await list();
    expect(endgames.length).toBeGreaterThanOrEqual(10);
    expect(endgames.find((e) => e.id === 'philidor')).toMatchObject({
      color: 'b',
      goal: 'draw',
      attempts: 0,
      passed: false,
    });
    expect((await http('POST', '/api/endgames/inconnue/start')).status).toBe(404);
    await app.close();
  });

  it('partie d’entraînement depuis la position, bot à pleine force ; abandon = échec', async () => {
    const { app, ws, levels, start, find } = await server([{ from: 'd8', to: 'e7' }]);
    const gameId = await start('lucena');
    const c = await ws();
    c.send({ type: 'join', gameId });
    const s = await c.until((x) => x.phase === 'playing');
    expect(s).toMatchObject({
      training: true,
      rated: false,
      viewer: 'w',
      initialFen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1',
    });
    expect(levels).toEqual([5]);
    // Le bot répond au premier coup du joueur.
    c.send({ type: 'move', clientMoveId: '1', move: { from: 'c1', to: 'd1' } });
    await c.until((x) => x.board?.moves.length === 2);
    c.send({ type: 'resign' });
    await c.until((x) => x.phase === 'ended');
    expect(await find('lucena')).toMatchObject({ attempts: 1, passed: false });
    await app.close();
  });

  it('tenir la nulle : la répétition réussit la finale', async () => {
    const bot: MoveIntent[] = [
      { from: 'a1', to: 'b1' },
      { from: 'b1', to: 'a1' },
      { from: 'a1', to: 'b1' },
      { from: 'b1', to: 'a1' },
    ];
    const { app, ws, start, find } = await server(bot);
    const gameId = await start('carre-rattraper');
    const c = await ws();
    c.send({ type: 'join', gameId });
    await c.until((x) => x.phase === 'playing');
    const mine: MoveIntent[] = [
      { from: 'd4', to: 'e4' },
      { from: 'e4', to: 'd4' },
      { from: 'd4', to: 'e4' },
      { from: 'e4', to: 'd4' },
    ];
    for (const [i, move] of mine.entries()) {
      c.send({ type: 'move', clientMoveId: String(i), move });
      await c.until((x) => x.board?.moves.length === 2 * i + 2 || x.phase === 'ended');
    }
    const s = await c.until((x) => x.phase === 'ended');
    expect(s.board?.result).toEqual({ winner: null, reason: 'threefold-repetition' });
    expect(await find('carre-rattraper')).toMatchObject({ attempts: 1, passed: true });
    await app.close();
  });
});
