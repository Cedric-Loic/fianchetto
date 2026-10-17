import { describe, expect, it } from 'vitest';
import { SQUARES, type BotObservation, type MoveIntent, type UserPublic } from '@sq/shared';
import { WorkerBot, type BotDriver } from '../src/bot/driver.js';
import { testServer } from './client.js';

/** Joue des coups humains au hasard jusqu'à ce que l'un soit accepté. */
async function humanMove(
  client: Awaited<ReturnType<Awaited<ReturnType<typeof testServer>>['ws']>>,
  color: 'w' | 'b',
  random: () => number,
) {
  const before = client.state()?.board?.moves.length ?? 0;
  for (let i = 0; i < 3000; i++) {
    const from = SQUARES[Math.floor(random() * 64)];
    const to = SQUARES[Math.floor(random() * 64)];
    client.send({ type: 'move', clientMoveId: String(i), move: { from, to, promotion: 'q' } });
    await new Promise((r) => setTimeout(r, 2));
    const s = client.state();
    if (s?.phase === 'ended' || (s?.board?.moves.length ?? 0) > before) break;
    if (s?.board?.turn !== color) break;
  }
}

function rng(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

describe('parties classées contre le bot (Stockfish dans un worker)', () => {
  it('une partie contre chacun des 5 niveaux met à jour l’Elo', async () => {
    // Bot sans temps de réflexion simulé : le test reste rapide.
    const { app, http, ws } = await testServer({
      createBot: (level) => new WorkerBot(level, { humanPace: false }),
    });
    const reg = await http('POST', '/api/auth/register', {
      username: 'cedric',
      password: 'motdepasse',
    });
    expect(reg.status).toBe(200);
    let rating = (reg.json as UserPublic).rating;
    expect(rating).toBe(1200);

    for (const level of [1, 2, 3, 4, 5]) {
      const created = await http('POST', '/api/games', {
        mode: 'bot',
        level,
        timeControl: 'untimed',
        color: 'w',
      });
      const { gameId } = created.json as { gameId: string };
      const client = await ws();
      client.send({ type: 'join', gameId });
      let s = await client.until((x) => x.phase === 'secret-selection');
      expect(s.viewer).toBe('w');
      expect(s.selection?.ready.b).toBe(true); // le bot a déjà choisi
      client.send({ type: 'lock-secret', square: 'e2' });
      await client.until((x) => x.phase === 'playing');

      const random = rng(level);
      for (let n = 0; n < 4; n++) {
        await humanMove(client, 'w', random);
        // Le bot répond.
        s = await client.until((x) => x.phase === 'ended' || x.board?.turn === 'w');
        if (s.phase === 'ended') break;
      }
      expect(s.board?.moves.length ?? 0).toBeGreaterThanOrEqual(2);
      if (s.phase !== 'ended') client.send({ type: 'resign' });
      s = await client.until((x) => x.phase === 'ended');
      expect(s.board?.reveal).not.toBeNull();
      client.socket.close();

      const me = (await http('GET', '/api/auth/me')).json as UserPublic;
      expect(me.rating).not.toBe(rating);
      expect(me.gamesPlayed).toBe(level);
      rating = me.rating;
    }
    const profile = (await http('GET', '/api/profile/cedric')).json as {
      history: { rated: boolean; ratingAfter: number }[];
    };
    expect(profile.history).toHaveLength(5);
    expect(profile.history.every((h) => h.rated)).toBe(true);
    const board = (await http('GET', '/api/leaderboard')).json as {
      entries: { username: string }[];
    };
    expect(board.entries[0]?.username).toBe('cedric');
    await app.close();
  }, 300_000);
});

describe('isolation du bot', () => {
  /**
   * Faux bot qui enregistre chaque observation reçue et joue un script fixe. Deux parties avec
   * des secrets humains différents et les mêmes coups doivent lui donner des observations
   * identiques : le bot ne peut donc pas connaître le secret humain.
   */
  async function observationsFor(humanSecret: 'e2' | 'b2') {
    const seen: BotObservation[] = [];
    const script: MoveIntent[] = [
      { from: 'g8', to: 'f6' },
      { from: 'b8', to: 'c6' },
      { from: 'h7', to: 'h6' },
    ];
    const fake: BotDriver = {
      chooseSecret: () => 'a7',
      chooseMove: (obs) => {
        seen.push(JSON.parse(JSON.stringify(obs)) as BotObservation);
        return Promise.resolve(script[seen.length - 1] ?? { from: 'a7', to: 'a6' });
      },
      shouldAcceptDraw: () => Promise.resolve(false),
      dispose: () => undefined,
    };
    const { app, http, ws } = await testServer({ createBot: () => fake });
    await http('POST', '/api/auth/register', { username: 'iso', password: 'motdepasse' });
    const { gameId } = (
      await http('POST', '/api/games', {
        mode: 'bot',
        level: 3,
        timeControl: 'untimed',
        color: 'w',
      })
    ).json as { gameId: string };
    const client = await ws();
    client.send({ type: 'join', gameId });
    await client.until((x) => x.phase === 'secret-selection');
    client.send({ type: 'lock-secret', square: humanSecret });
    await client.until((x) => x.phase === 'playing');
    for (const [i, move] of [
      { from: 'd2', to: 'd4' },
      { from: 'c2', to: 'c4' },
      { from: 'g1', to: 'f3' },
    ].entries()) {
      client.send({ type: 'move', clientMoveId: String(i), move });
      await client.until((x) => x.board?.moves.length === 2 * (i + 1));
    }
    client.socket.close();
    await app.close();
    return { seen, gameId };
  }

  it('les observations du bot sont identiques quel que soit le secret humain', async () => {
    const a = await observationsFor('e2');
    const b = await observationsFor('b2');
    const normalize = (obs: BotObservation[], id: string) =>
      JSON.stringify(obs).replaceAll(id, 'GAME');
    expect(a.seen).toHaveLength(3);
    expect(normalize(a.seen, a.gameId)).toBe(normalize(b.seen, b.gameId));
    for (const obs of a.seen) {
      expect(obs.state.viewer).toBe('b');
      expect(obs.state.board?.ownSecret?.pieceId).toBe('bpa7');
      expect(obs.state.board?.reveal).toBeNull();
    }
  });
});
