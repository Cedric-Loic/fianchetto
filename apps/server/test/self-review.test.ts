import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SelfReviewResponseSchema, ThinkingProfileSchema, type ThinkingProfile } from '@sq/shared';
import { GameStore } from '../src/persistence/db.js';
import { testServer } from './client.js';

const CREDENTIALS = { username: 'cedric', password: 'motdepasse' };

const hotseat = (variant: 'classic' | 'secret-queen') => ({
  mode: 'hotseat',
  variant,
  timeControl: 'untimed',
  whiteName: 'A',
  blackName: 'B',
});

/** Serveur de test, joueur connecté, et une partie classique terminée (mat du lion : 4 demi-coups). */
async function server() {
  const s = await testServer();
  await s.http('POST', '/api/auth/register', CREDENTIALS);
  const create = async (variant: 'classic' | 'secret-queen') =>
    ((await s.http('POST', '/api/games', hotseat(variant))).json as { gameId: string }).gameId;
  const finished = async () => {
    const gameId = await create('classic');
    const c = await s.ws();
    c.send({ type: 'join', gameId });
    await c.until((x) => x.phase === 'playing');
    for (const [i, m] of ['f2f3', 'e7e5', 'g2g4', 'd8h4'].entries()) {
      c.send({
        type: 'move',
        clientMoveId: String(i),
        move: { from: m.slice(0, 2), to: m.slice(2, 4) },
      });
      await c.until((x) => x.board?.moves.length === i + 1);
    }
    await c.until((x) => x.phase === 'ended');
    c.socket.close();
    return gameId;
  };
  return { ...s, create, finished };
}

const SELF = (id: string) => `/api/reviews/${id}/self`;
const moments = (...m: [number, string][]) => ({
  moments: m.map(([ply, flaw]) => ({ ply, flaw })),
});

describe('revue réflexive', () => {
  it('compte requis : 401 sans session', async () => {
    const anonymous = await testServer();
    expect((await anonymous.http('GET', SELF('x'))).status).toBe(401);
    expect((await anonymous.http('POST', SELF('x'), moments([1, 'hope-chess']))).status).toBe(401);
    expect((await anonymous.http('GET', '/api/coach/thinking')).status).toBe(401);
    await anonymous.app.close();
  });

  it('partie en cours refusée (409) et partie inconnue ou d’un autre joueur (404)', async () => {
    const { app, http, create } = await server();
    // Secret Queen en cours : rien n'est lisible ni enregistrable avant la fin.
    const running = await create('secret-queen');
    const early = await http('POST', SELF(running), moments([1, 'hope-chess']));
    expect(early.status).toBe(409);
    expect(JSON.stringify(early.json)).not.toMatch(/fen|secret/i);
    expect((await http('GET', SELF(running))).status).toBe(409);
    expect((await http('POST', SELF('inconnue'), moments([1, 'hope-chess']))).status).toBe(404);
    const profile = (await http('GET', '/api/coach/thinking')).json as ThinkingProfile;
    expect(profile.reviews).toBe(0);
    await app.close();
  });

  it('enregistre, relit et remplace (un second envoi efface le premier)', async () => {
    const { app, http, finished } = await server();
    const id = await finished();
    expect(SelfReviewResponseSchema.parse((await http('GET', SELF(id))).json)).toEqual({
      selfReview: null,
    });

    const first = await http(
      'POST',
      SELF(id),
      moments([3, 'no-threat-check'], [1, 'vague-plan'], [3, 'no-threat-check']),
    );
    expect(first.status).toBe(200);
    const parsed = SelfReviewResponseSchema.parse(first.json);
    expect(parsed.selfReview?.gameId).toBe(id);
    // Triés par demi-coup, doublon exact ignoré.
    expect(parsed.selfReview?.moments).toEqual([
      { ply: 1, flaw: 'vague-plan' },
      { ply: 3, flaw: 'no-threat-check' },
    ]);

    await http('POST', SELF(id), moments([4, 'time-pressure']));
    const again = SelfReviewResponseSchema.parse((await http('GET', SELF(id))).json);
    expect(again.selfReview?.moments).toEqual([{ ply: 4, flaw: 'time-pressure' }]);
    await app.close();
  });

  it('corps invalide : 0 ou 4 moments, défaut inconnu, demi-coup hors de la partie', async () => {
    const { app, http, finished } = await server();
    const id = await finished(); // 4 demi-coups
    expect((await http('POST', SELF(id), { moments: [] })).status).toBe(400);
    expect(
      (
        await http(
          'POST',
          SELF(id),
          moments([1, 'hope-chess'], [2, 'hope-chess'], [3, 'hope-chess'], [4, 'hope-chess']),
        )
      ).status,
    ).toBe(400);
    expect((await http('POST', SELF(id), moments([1, 'inconnu']))).status).toBe(400);
    expect((await http('POST', SELF(id), moments([5, 'hope-chess']))).status).toBe(400);
    expect((await http('POST', SELF(id), moments([0, 'hope-chess']))).status).toBe(400);
    expect((await http('POST', SELF(id), moments([4, 'hope-chess']))).status).toBe(200);
    await app.close();
  });

  it('une partie terminée d’un autre joueur est introuvable (404)', async () => {
    const { app, http, finished } = await server();
    const id = await finished();
    await http('POST', '/api/auth/register', { username: 'autre', password: 'motdepasse' });
    expect((await http('GET', SELF(id))).status).toBe(404);
    expect((await http('POST', SELF(id), moments([1, 'hope-chess']))).status).toBe(404);
    await app.close();
  });

  it('profil de pensée : compte les défauts de toutes les revues', async () => {
    const { app, http, finished } = await server();
    const empty = ThinkingProfileSchema.parse((await http('GET', '/api/coach/thinking')).json);
    expect(empty).toMatchObject({ reviews: 0, top: null });
    expect(Object.values(empty.counts).every((n) => n === 0)).toBe(true);

    const a = await finished();
    const b = await finished();
    await http('POST', SELF(a), moments([1, 'hope-chess'], [2, 'vague-plan']));
    await http('POST', SELF(b), moments([3, 'vague-plan'], [4, 'time-pressure']));
    const profile = ThinkingProfileSchema.parse((await http('GET', '/api/coach/thinking')).json);
    expect(profile.reviews).toBe(2);
    expect(profile.counts).toMatchObject({
      'hope-chess': 1,
      'vague-plan': 2,
      'time-pressure': 1,
      'no-threat-check': 0,
    });
    expect(profile.top).toBe('vague-plan');

    // Remplacer une revue retire ses anciens défauts du profil.
    await http('POST', SELF(b), moments([3, 'hope-chess']));
    const after = (await http('GET', '/api/coach/thinking')).json as ThinkingProfile;
    expect(after.counts['vague-plan']).toBe(1);
    expect(after.counts['hope-chess']).toBe(2);
    expect(after.top).toBe('hope-chess');
    await app.close();
  });

  it('partie importée : acceptée jusqu’à son nombre de demi-coups', async () => {
    const { app, http } = await server();
    await http('POST', '/api/imports/pgn', {
      pgn: '[White "cedric"]\n[Black "x"]\n\n1. e4 e5 2. Nf3 *',
    });
    const [game] = ((await http('GET', '/api/imports')).json as { games: { id: string }[] }).games;
    const id = game?.id ?? '';
    expect((await http('POST', SELF(id), moments([4, 'hope-chess']))).status).toBe(400);
    expect((await http('POST', SELF(id), moments([3, 'hope-chess']))).status).toBe(200);
    expect((await http('GET', SELF(id))).status).toBe(200);
    await app.close();
  });

  it('migration idempotente et persistance de la revue', () => {
    const dir = mkdtempSync(join(tmpdir(), 'self-review-'));
    try {
      const path = join(dir, 'test.db');
      const first = new GameStore(path, { initialRating: 1500 });
      first.createUser({ id: 'u1', username: 'u1', passwordHash: 'x' });
      first.saveSelfReview('u1', 'g1', [{ ply: 2, flaw: 'stopped-early' }], 1000);
      first.close();
      const second = new GameStore(path, { initialRating: 1500 }); // tables déjà créées
      expect(second.getSelfReview('u1', 'g1')).toEqual({
        moments: [{ ply: 2, flaw: 'stopped-early' }],
        createdAt: 1000,
      });
      expect(second.thinkingCounts('u1')).toEqual({ reviews: 1, counts: { 'stopped-early': 1 } });
      expect(second.getSelfReview('u1', 'autre')).toBeUndefined();
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
