import { describe, expect, it } from 'vitest';
import type {
  CheckMoveResponse,
  HintResponse,
  MoveIntent,
  ReviewResponse,
  UserPublic,
} from '@sq/shared';
import type { BotDriver } from '../src/bot/driver.js';
import { testServer } from './client.js';

/** Faux bot : joue la liste donnée ; `hold` le fait attendre jusqu'à `release()`. */
function scripted(moves: MoveIntent[], hold = false) {
  let index = 0;
  let release: () => void = () => undefined;
  const calls: number[] = [];
  const bot: BotDriver = {
    chooseSecret: () => 'a7',
    chooseMove: async (obs) => {
      calls.push(obs.state.board?.moves.length ?? 0);
      if (hold) await new Promise<void>((r) => (release = r));
      return moves[index++] ?? { from: 'a7', to: 'a6' };
    },
    shouldAcceptDraw: () => Promise.resolve(false),
    dispose: () => undefined,
  };
  return { bot, calls, release: () => release() };
}

async function trainingServer(bot: BotDriver) {
  const server = await testServer({ createBot: () => bot });
  await server.http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
  const create = async (extra: object = {}) =>
    server.http('POST', '/api/games', {
      mode: 'bot',
      variant: 'classic',
      level: 3,
      timeControl: 'blitz-3+2',
      color: 'w',
      training: true,
      ...extra,
    });
  return { ...server, create };
}

describe('parties d’entraînement', () => {
  it('non classée, sans pendule ; options invalides refusées', async () => {
    const { bot } = scripted([]);
    const { app, ws, create } = await trainingServer(bot);
    const { gameId } = (await create()).json as { gameId: string };
    const c = await ws();
    c.send({ type: 'join', gameId });
    const s = await c.until((x) => x.phase === 'playing');
    expect(s).toMatchObject({ training: true, rated: false, timeControl: 'untimed', clock: null });

    expect((await create({ variant: 'secret-queen' })).status).toBe(400);
    expect((await create({ training: false, fen: '8/8/8/8/8/8/8/K6k w - - 0 1' })).status).toBe(
      400,
    );
    expect((await create({ fen: 'pas une fen' })).status).toBe(400);
    await app.close();
  });

  it('reprise de coups : après la réponse du bot, et pendant sa réflexion', async () => {
    const script = scripted(
      [
        { from: 'e7', to: 'e5' },
        { from: 'd7', to: 'd5' },
        { from: 'g8', to: 'f6' },
      ],
      true,
    );
    const { app, ws, create } = await trainingServer(script.bot);
    const { gameId } = (await create()).json as { gameId: string };
    const c = await ws();
    c.send({ type: 'join', gameId });
    await c.until((x) => x.phase === 'playing');

    c.send({ type: 'move', clientMoveId: '1', move: { from: 'e2', to: 'e4' } });
    await c.until((x) => x.board?.moves.length === 1);
    script.release();
    await c.until((x) => x.board?.moves.length === 2);
    // Reprise après la réponse : les deux demi-coups disparaissent.
    c.send({ type: 'takeback' });
    let s = await c.until((x) => x.board?.moves.length === 0);
    expect(s.board?.turn).toBe('w');

    // Reprise pendant la réflexion du bot : son coup arrive trop tard et est ignoré.
    c.send({ type: 'move', clientMoveId: '2', move: { from: 'd2', to: 'd4' } });
    await c.until((x) => x.board?.moves.length === 1);
    c.send({ type: 'takeback' });
    await c.until((x) => x.board?.moves.length === 0);
    script.release();
    await new Promise((r) => setTimeout(r, 100));
    s = await c.until(() => true);
    expect(s.board?.moves).toHaveLength(0);
    // Le jeu reprend normalement.
    c.send({ type: 'move', clientMoveId: '3', move: { from: 'g1', to: 'f3' } });
    await c.until((x) => x.board?.moves.length === 1);
    await new Promise((r) => setTimeout(r, 50));
    script.release();
    s = await c.until((x) => x.board?.moves.length === 2);
    expect(s.board?.moves.map((m) => m.san)).toEqual(['Nf3', 'Nf6']);
    await app.close();
  });

  it('indices, garde-fou (Stockfish), puis revue d’office et Elo inchangé', async () => {
    const { bot } = scripted([]);
    const { app, http, ws, create, review } = await trainingServer(bot);
    // Coup du berger : les Blancs (le joueur) ont le trait, Qxf7# est mat en 1.
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    const created = (await create({ fen, color: 'b' })).json as { gameId: string };
    const c = await ws();
    c.send({ type: 'join', gameId: created.gameId });
    const s = await c.until((x) => x.phase === 'playing');
    // Le joueur prend le camp qui a le trait dans la FEN (et non la couleur demandée).
    expect(s.viewer).toBe('w');
    expect(s.initialFen).toBe(fen);

    const hint = async (level: number) =>
      (await http('POST', `/api/games/${created.gameId}/hint`, { level })).json as HintResponse;
    expect((await hint(1)).text).toContain('mat en 1');
    expect(await hint(2)).toMatchObject({ level: 2, from: 'h5' });
    expect(await hint(3)).toMatchObject({ level: 3, from: 'h5', to: 'f7' });

    const check = async (uci: string) =>
      (await http('POST', `/api/games/${created.gameId}/check-move`, { uci }))
        .json as CheckMoveResponse;
    // Gaffe : Qg4 ?? est prise par le cavalier f6 ; le mat, lui, ne déclenche rien.
    expect((await check('h5g4')).warning).toBe('La dame jouée en g4 est en prise : Nxg4 la gagne.');
    expect((await check('h5f7')).warning).toBeNull();

    c.send({ type: 'move', clientMoveId: '1', move: { from: 'h5', to: 'f7' } });
    await c.until((x) => x.phase === 'ended');
    expect((await http('POST', `/api/games/${created.gameId}/hint`, { level: 1 })).status).toBe(
      409,
    );
    const me = (await http('GET', '/api/auth/me')).json as UserPublic;
    expect(me.ratings.classic).toEqual({ rating: 1200, gamesPlayed: 0 });
    // Revue lancée d'office à la fin de la partie.
    const info = (await http('GET', `/api/reviews/${created.gameId}`)).json as ReviewResponse;
    expect(info.state.status).not.toBe('none');
    expect((await review(created.gameId)).moves).toHaveLength(1);
    await app.close();
  }, 60_000);

  it('indices et garde-fou refusés hors entraînement (dont Secret Queen)', async () => {
    const { bot } = scripted([]);
    const { app, http, ws } = await trainingServer(bot);
    for (const variant of ['classic', 'secret-queen']) {
      const { gameId } = (
        await http('POST', '/api/games', {
          mode: 'bot',
          variant,
          level: 3,
          timeControl: 'untimed',
          color: 'w',
        })
      ).json as { gameId: string };
      const c = await ws();
      c.send({ type: 'join', gameId });
      await c.until(() => true);
      expect((await http('POST', `/api/games/${gameId}/hint`, { level: 3 })).status).toBe(409);
      expect((await http('POST', `/api/games/${gameId}/check-move`, { uci: 'e2e4' })).status).toBe(
        409,
      );
      c.socket.close();
    }
    await app.close();
  });
});
