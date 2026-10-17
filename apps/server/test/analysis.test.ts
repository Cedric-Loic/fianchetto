import { describe, expect, it } from 'vitest';
import { testServer } from './client.js';

describe('analyse et export de la notation', () => {
  it('analyse refusée avant la fin ; notation publique pendant, réelle après', async () => {
    const { app, http, ws, review } = await testServer();
    const { gameId } = (
      await http('POST', '/api/games', {
        mode: 'hotseat',
        variant: 'secret-queen',
        timeControl: 'untimed',
        whiteName: 'A',
        blackName: 'B',
      })
    ).json as { gameId: string };
    const c = await ws();
    c.send({ type: 'join', gameId });
    for (const msg of [
      { type: 'start-selection' },
      { type: 'lock-secret', square: 'e2' },
      { type: 'start-selection' },
      { type: 'lock-secret', square: 'd7' },
    ]) {
      c.send(msg);
      await new Promise((r) => setTimeout(r, 30));
    }
    await c.until((s) => s.phase === 'playing');
    c.send({ type: 'move', clientMoveId: '1', move: { from: 'e2', to: 'h5' } });
    await c.until((s) => s.board?.moves.length === 1);

    expect((await http('GET', `/api/reviews/${gameId}`)).status).toBe(409);
    expect((await http('POST', `/api/reviews/${gameId}`)).status).toBe(409);
    const port = (app.server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/api/games/${gameId}/pgn`);
    const publicPgn = await res.text();
    expect(publicPgn).toContain('1. e2-h5');
    expect(publicPgn).not.toContain('FEN');
    expect(publicPgn).not.toContain('Qh5');

    c.send({ type: 'resign' });
    await c.until((s) => s.phase === 'ended');
    const realPgn = await (await fetch(`http://127.0.0.1:${port}/api/games/${gameId}/pgn`)).text();
    expect(realPgn).toContain('1. Qh5');
    expect(realPgn).toContain('[FEN "');

    // Revue sur les positions réelles : la dame secrète e2 joue « Qh5 ».
    const r = await review(gameId);
    expect(r.positions).toHaveLength(2);
    expect(r.moves.map((m) => m.san)).toEqual(['Qh5']);
    expect(r.moves[0]?.uci).toBe('e2h5');
    expect(r.evals[0]?.bestMoveSan).toBeTruthy();
    c.socket.close();
    await app.close();
  }, 60_000);
});
