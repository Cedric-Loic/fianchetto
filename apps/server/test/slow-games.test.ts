import { describe, expect, it } from 'vitest';
import {
  DailySessionResponseSchema,
  type BotObservation,
  type GameSummary,
  type MoveIntent,
  type UserPublic,
} from '@sq/shared';
import type { BotDriver } from '../src/bot/driver.js';
import { LearningService } from '../src/coach/learning.js';
import { GameStore } from '../src/persistence/db.js';
import { testServer } from './client.js';

const DAY = 86_400_000;

/** Bot factice qui ne réfléchit pas : le test ne dépend pas de Stockfish. */
const fakeBot = (): BotDriver => ({
  chooseSecret: () => 'a7',
  chooseMove: (_obs: BotObservation): Promise<MoveIntent> =>
    Promise.resolve({ from: 'a7', to: 'a6' }),
  shouldAcceptDraw: () => Promise.resolve(false),
  dispose: () => undefined,
});

const botGame = (variant: 'classic' | 'secret-queen', timeControl: string) => ({
  mode: 'bot',
  variant,
  level: 2,
  timeControl,
  color: 'w',
});

describe('parties lentes (15+10, 30+0)', () => {
  it('acceptées contre le bot (classique et Secret Queen), refusées en hot-seat', async () => {
    const { app, http } = await testServer({ createBot: fakeBot });
    // Hot-seat sans compte : refusé (400) pour les deux cadences lentes.
    for (const timeControl of ['rapid-15+10', 'classical-30+0']) {
      for (const variant of ['classic', 'secret-queen']) {
        const res = await http('POST', '/api/games', {
          mode: 'hotseat',
          variant,
          timeControl,
          whiteName: 'A',
          blackName: 'B',
        });
        expect(res.status).toBe(400);
      }
    }
    // Une cadence normale reste acceptée en hot-seat.
    expect(
      (
        await http('POST', '/api/games', {
          mode: 'hotseat',
          variant: 'classic',
          timeControl: 'rapid-10+0',
          whiteName: 'A',
          blackName: 'B',
        })
      ).status,
    ).toBe(200);

    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    for (const timeControl of ['rapid-15+10', 'classical-30+0']) {
      for (const variant of ['classic', 'secret-queen'] as const) {
        const res = await http('POST', '/api/games', botGame(variant, timeControl));
        expect(res.status).toBe(200);
      }
    }
    await app.close();
  });

  it('jamais classée : Elo inchangé, résumé non classé, hors profil classé', async () => {
    const { app, http, ws } = await testServer({ createBot: fakeBot });
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    const before = ((await http('GET', '/api/auth/me')).json as UserPublic).ratings;

    for (const [variant, timeControl] of [
      ['classic', 'rapid-15+10'],
      ['secret-queen', 'classical-30+0'],
    ] as const) {
      const { gameId } = (await http('POST', '/api/games', botGame(variant, timeControl)).then(
        (r) => r.json,
      )) as { gameId: string };
      const client = await ws();
      client.send({ type: 'join', gameId });
      if (variant === 'secret-queen') {
        await client.until((s) => s.phase === 'secret-selection');
        client.send({ type: 'lock-secret', square: 'e2' });
      }
      const playing = await client.until((s) => s.phase === 'playing');
      // La pendule suit la cadence lente (partie à pendule, pas un entraînement).
      expect(playing.timeControl).toBe(timeControl);
      expect(playing.rated).toBe(false);
      client.send({ type: 'resign' });
      await client.until((s) => s.phase === 'ended');
      client.socket.close();
    }

    const me = (await http('GET', '/api/auth/me')).json as UserPublic;
    expect(me.ratings).toEqual(before);
    const profile = (await http('GET', '/api/profile/cedric')).json as { history: GameSummary[] };
    expect(profile.history).toHaveLength(2);
    for (const h of profile.history) {
      expect(h.rated).toBe(false);
      expect(h.ratingBefore).toBeNull();
      expect(h.ratingAfter).toBeNull();
    }
    const board = (await http('GET', '/api/leaderboard')).json as {
      entries: { gamesPlayed: number }[];
    };
    expect(board.entries.every((e) => e.gamesPlayed === 0)).toBe(true);
    await app.close();
  });
});

describe('séance du jour : partie lente de la semaine', () => {
  function setup() {
    const store = new GameStore(':memory:', { initialRating: 1200 });
    store.createUser({ id: 'u1', username: 'u1', passwordHash: 'x' });
    const now = 1_800_000_000_000;
    const learning = new LearningService(store, { phaseOf: () => 1, now: () => now });
    const play = (timeControl: GameSummary['timeControl'], ageMs: number, mode = 'bot') => {
      const endedAt = new Date(now - ageMs).toISOString();
      store.saveResult(`g-${timeControl}-${ageMs}-${mode}`, 'u1', {
        gameId: `g-${timeControl}-${ageMs}-${mode}`,
        variant: 'classic',
        mode,
        rated: false,
        timeControl,
        color: 'w',
        opponentName: 'Bot',
        winner: null,
        reason: 'resignation',
        ratingBefore: null,
        ratingAfter: null,
        startedAt: endedAt,
        endedAt,
      } as GameSummary);
    };
    return { learning, play };
  }

  it('proposée en priorité sans partie lente depuis 7 jours, puis plus du tout', () => {
    const { learning, play } = setup();
    const expected = {
      label: 'Partie lente de la semaine (15 | 10, avec la routine de réflexion)',
      href: '#/?slow=1',
    };
    expect(learning.session('u1').followUp).toEqual(expected);

    // Parties rapides ou anciennes : ne comptent pas.
    play('rapid-10+0', DAY);
    play('rapid-15+10', 8 * DAY);
    expect(learning.session('u1').followUp).toEqual(expected);

    // Partie lente cette semaine : la séance revient à l'étape de finale (ou rien).
    play('rapid-15+10', 3 * DAY);
    const after = learning.session('u1').followUp;
    expect(after?.href).not.toBe('#/?slow=1');
    expect(after === null || after.label.startsWith('Finale')).toBe(true);
  });

  it('la route /api/coach/session sert la partie lente à un nouveau joueur', async () => {
    const { app, http } = await testServer();
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    const session = DailySessionResponseSchema.parse(
      (await http('GET', '/api/coach/session')).json,
    ).session;
    expect(session.followUp?.href).toBe('#/?slow=1');
    await app.close();
  });
});
