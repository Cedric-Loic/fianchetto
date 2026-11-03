import { describe, expect, it } from 'vitest';
import {
  CoachAnswerResponseSchema,
  CoachPromptResponseSchema,
  SkillsResponseSchema,
} from '@sq/shared';
import type { BotDriver } from '../src/bot/driver.js';
import { testServer } from './client.js';

const idleBot: BotDriver = {
  chooseSecret: () => 'a7',
  chooseMove: () => new Promise(() => undefined),
  shouldAcceptDraw: () => Promise.resolve(false),
  dispose: () => undefined,
};

// Tour des Blancs. Menace : le cavalier b3 attaque la tour a1 non défendue.
const THREAT = '4k3/8/8/8/8/1n6/8/R3K3 w - - 0 1';
// Occasion : le cavalier noir a3 est en prise de la tour a1 et ne menace rien.
const CHANCE = '4k3/8/8/8/8/n7/8/R3K3 w - - 0 1';
const QUIET = '4k3/8/8/8/8/8/8/R3K3 w - - 0 1';

async function setup() {
  const server = await testServer({ createBot: () => idleBot });
  await server.http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
  const create = async (extra: object = {}) => {
    const res = await server.http('POST', '/api/games', {
      mode: 'bot',
      variant: 'classic',
      level: 3,
      timeControl: 'untimed',
      color: 'w',
      training: true,
      ...extra,
    });
    const { gameId } = res.json as { gameId: string };
    const c = await server.ws();
    c.send({ type: 'join', gameId });
    await c.until((x) => x.phase === 'playing');
    return { gameId, c };
  };
  return { ...server, create };
}

describe('parties coachées', () => {
  it('question présente ou absente, sans fuite des cases', async () => {
    const { app, http, create } = await setup();
    const threat = await create({ fen: THREAT });
    const raw = await http('POST', `/api/games/${threat.gameId}/coach-prompt`, {});
    const body = CoachPromptResponseSchema.parse(raw.json);
    expect(body.prompt).toMatchObject({ ply: 0, kind: 'threat' });
    expect(JSON.stringify(raw.json)).not.toMatch(/a1|b3/);
    expect(Object.keys(body.prompt ?? {}).sort()).toEqual(['kind', 'ply', 'question']);

    const chance = await create({ fen: CHANCE });
    const c = CoachPromptResponseSchema.parse(
      (await http('POST', `/api/games/${chance.gameId}/coach-prompt`, {})).json,
    );
    expect(c.prompt?.kind).toBe('chance');

    const quiet = await create({ fen: QUIET });
    expect((await http('POST', `/api/games/${quiet.gameId}/coach-prompt`, {})).json).toEqual({
      prompt: null,
    });
    await app.close();
  });

  it('réponse juste ou fausse, preuve de compétence, ply périmé', async () => {
    const { app, http, create } = await setup();
    const { gameId } = await create({ fen: THREAT });
    const url = `/api/games/${gameId}/coach-answer`;

    expect((await http('POST', url, { ply: 3, squares: ['a1'] })).status).toBe(409);
    expect((await http('POST', url, { ply: 0 })).status).toBe(400);

    const wrong = CoachAnswerResponseSchema.parse(
      (await http('POST', url, { ply: 0, squares: ['e1'] })).json,
    );
    expect(wrong).toMatchObject({ correct: false, squares: ['a1'] });
    expect(wrong.explanation).not.toBe('');

    const right = CoachAnswerResponseSchema.parse(
      (await http('POST', url, { ply: 0, squares: ['a1'] })).json,
    );
    expect(right.correct).toBe(true);

    // Seule la première réponse compte : un échec, pas de réussite en plus.
    const skills = SkillsResponseSchema.parse((await http('GET', '/api/coach/skills')).json);
    const threats = skills.skills.find((s) => s.id === 'threats');
    expect(threats).toBeDefined();
    expect(threats).toMatchObject({ evidence: 1 });

    // Position sans question : réponse périmée.
    const quiet = await create({ fen: QUIET });
    expect(
      (await http('POST', `/api/games/${quiet.gameId}/coach-answer`, { ply: 0, squares: [] }))
        .status,
    ).toBe(409);
    await app.close();
  });

  it('refusé hors entraînement classique, hors du tour du joueur, sans compte', async () => {
    const { app, http, create } = await setup();
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
      expect((await http('POST', `/api/games/${gameId}/coach-prompt`, {})).status).toBe(409);
      expect(
        (await http('POST', `/api/games/${gameId}/coach-answer`, { ply: 0, squares: [] })).status,
      ).toBe(409);
    }
    // Après le coup du joueur, c'est au bot : rien à demander.
    const { gameId, c } = await create({ fen: THREAT });
    c.send({ type: 'move', clientMoveId: '1', move: { from: 'e1', to: 'e2' } });
    await c.until((x) => x.board?.moves.length === 1);
    expect((await http('POST', `/api/games/${gameId}/coach-prompt`, {})).status).toBe(409);
    await app.close();

    const anon = await testServer({ createBot: () => idleBot });
    expect((await anon.http('POST', '/api/games/x/coach-prompt', {})).status).toBe(401);
    expect(
      (await anon.http('POST', '/api/games/x/coach-answer', { ply: 0, squares: [] })).status,
    ).toBe(401);
    await anon.app.close();
  });
});
