import { describe, expect, it } from 'vitest';
import type { ReviewResponse } from '@sq/shared';
import { GameSession, type Participant } from '../src/games/session.js';
import { testServer } from './client.js';

const player = { rating: null, isBot: false, botLevel: null };

function classicSession(timeControl: 'blitz-3+2' | 'untimed', clockNow: { t: number }) {
  return new GameSession({
    id: 'g1',
    variant: 'classic',
    mode: 'hotseat',
    timeControl,
    players: { w: { name: 'A', ...player }, b: { name: 'B', ...player } },
    now: () => clockNow.t,
    onRematch: () => 'next',
  });
}

describe('pendule enregistrée pour la revue (temps de réflexion)', () => {
  it('une entrée par demi-coup, cohérente avec l’incrément', () => {
    const clockNow = { t: 1_000_000 };
    const session = classicSession('blitz-3+2', clockNow);
    const participant: Participant = { viewer: 'public', send: () => undefined };
    const play = (from: string, to: string, thinkMs: number) => {
      clockNow.t += thinkMs;
      session.handle(participant, {
        type: 'move',
        clientMoveId: String(clockNow.t),
        move: { from, to } as never,
      });
    };
    expect(session.plyClocks()).toBeNull(); // pas terminée

    play('e2', 'e4', 5_000); // la pendule démarre après ce coup : pas de décompte, pas d'incrément
    play('e7', 'e5', 4_000); // noirs : 180 s - 4 s + 2 s
    play('g1', 'f3', 10_000); // blancs : 180 s - 10 s + 2 s
    play('b8', 'c6', 1_000);
    session.handle(participant, { type: 'resign', color: 'b' } as never);

    expect(session.plyCount).toBe(4);
    expect(session.plyClocks()).toEqual([180_000, 178_000, 172_000, 179_000]);
  });

  it('partie sans pendule : pas de temps', () => {
    const clockNow = { t: 1_000_000 };
    const session = classicSession('untimed', clockNow);
    const participant: Participant = { viewer: 'public', send: () => undefined };
    session.handle(participant, {
      type: 'move',
      clientMoveId: '1',
      move: { from: 'e2', to: 'e4' },
    });
    session.handle(participant, { type: 'resign', color: 'b' } as never);
    expect(session.plyClocks()).toBeNull();
  });

  it('survit à la sauvegarde ; une ancienne partie sans temps donne null', () => {
    const clockNow = { t: 1_000_000 };
    const session = classicSession('blitz-3+2', clockNow);
    const participant: Participant = { viewer: 'public', send: () => undefined };
    session.handle(participant, {
      type: 'move',
      clientMoveId: '1',
      move: { from: 'e2', to: 'e4' },
    });
    session.handle(participant, { type: 'resign', color: 'b' } as never);
    const { record, secrets } = session.toRecord();
    expect(record.plyClocksMs).toEqual([180_000]);
    const hooks = { onRematch: () => 'n', now: () => clockNow.t };
    const restored = GameSession.restore(record, secrets.expose(), hooks);
    expect(restored.plyClocks()).toEqual([180_000]);
    const { plyClocksMs: _omit, ...legacy } = record;
    const old = GameSession.restore(legacy, secrets.expose(), hooks);
    expect(old.plyClocks()).toBeNull();
  });

  it('la route de revue expose clocks pour une partie locale cronométrée terminée', async () => {
    const { app, http, ws } = await testServer();
    const timed = await http('POST', '/api/games', {
      mode: 'hotseat',
      variant: 'classic',
      timeControl: 'blitz-3+2',
      whiteName: 'A',
      blackName: 'B',
    });
    const untimed = await http('POST', '/api/games', {
      mode: 'hotseat',
      variant: 'classic',
      timeControl: 'untimed',
      whiteName: 'A',
      blackName: 'B',
    });
    const ids = [
      (timed.json as { gameId: string }).gameId,
      (untimed.json as { gameId: string }).gameId,
    ];
    for (const gameId of ids) {
      const client = await ws();
      client.send({ type: 'join', gameId });
      await client.until((s) => s.phase === 'playing');
      client.send({ type: 'move', clientMoveId: 'a', move: { from: 'e2', to: 'e4' } });
      await client.until((s) => (s.board?.moves.length ?? 0) === 1);
      client.send({ type: 'move', clientMoveId: 'b', move: { from: 'e7', to: 'e5' } });
      await client.until((s) => (s.board?.moves.length ?? 0) === 2);
      client.send({ type: 'resign' });
      await client.until((s) => s.phase === 'ended');
      client.socket.close();
    }
    const withClock = (await http('GET', `/api/reviews/${ids[0]}`)).json as ReviewResponse;
    expect(withClock.info.clocks).toHaveLength(2);
    expect(withClock.info.clocks?.[0]).toBe(180_000);
    expect(withClock.info.clocks?.[1]).toBeLessThanOrEqual(182_000);
    const noClock = (await http('GET', `/api/reviews/${ids[1]}`)).json as ReviewResponse;
    expect(noClock.info.clocks ?? null).toBeNull();
    await app.close();
  });
});
