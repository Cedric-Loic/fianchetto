import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startServer, type BotDriver } from '@sq/server';

/*
 * Partie coachée : POST /api/games/:id/coach-prompt et /coach-answer.
 * Réservées aux parties d'entraînement classiques contre le bot, jamais Secret Queen.
 * Les routes /api/coach/* et /api/reviews/cards ne contiennent aucune FEN de partie en cours.
 */

const FEN_RE = /[pnbrqkPNBRQK1-8]+(?:\/[pnbrqkPNBRQK1-8]+){7}\s[wb]\s/;

const bot: BotDriver = {
  chooseSecret: () => 'c7',
  chooseMove: () => Promise.resolve({ from: 'a7', to: 'a6' }),
  shouldAcceptDraw: () => Promise.resolve(false),
  dispose: () => undefined,
};

let dir: string;
let app: Awaited<ReturnType<typeof startServer>>;
let base: string;
let logs = '';
let alice = '';
let mallory = '';
const ids: Record<string, string> = {};

async function register(name: string): Promise<string> {
  const r = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: name, password: 'motdepasse' }),
  });
  return (r.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
}

async function create(cookie: string, body: object): Promise<string> {
  const r = await fetch(`${base}/api/games`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body),
  });
  return ((await r.json()) as { gameId: string }).gameId;
}

async function call(path: string, cookie: string | null, body: unknown = {}) {
  const r = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  return { status: r.status, text: await r.text() };
}

const prompt = (id: string, cookie: string | null) =>
  call(`/api/games/${id}/coach-prompt`, cookie, {});
const answer = (id: string, cookie: string | null, ply = 0) =>
  call(`/api/games/${id}/coach-answer`, cookie, { ply, squares: ['e4'] });

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sq-sec-coach-'));
  app = await startServer(0, {
    logLevel: 'debug',
    dbPath: join(dir, 'game.db'),
    logStream: { write: (line) => void (logs += line) },
    createBot: () => bot,
  });
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  alice = await register('alice');
  mallory = await register('mallory');
  const botGame = { mode: 'bot', level: 3, timeControl: 'untimed', color: 'w' };
  ids.sqBot = await create(alice, { ...botGame, variant: 'secret-queen' });
  ids.sqHot = await create(alice, {
    mode: 'hotseat',
    variant: 'secret-queen',
    timeControl: 'untimed',
    whiteName: 'A',
    blackName: 'B',
  });
  ids.classicRanked = await create(alice, { ...botGame, variant: 'classic', timeControl: '10+0' });
  ids.classicHot = await create(alice, {
    mode: 'hotseat',
    variant: 'classic',
    timeControl: 'untimed',
    whiteName: 'A',
    blackName: 'B',
  });
  ids.training = await create(alice, { ...botGame, variant: 'classic', training: true });
}, 60_000);

afterAll(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('partie coachée : refus hors entraînement classique', () => {
  for (const key of ['sqBot', 'sqHot', 'classicRanked', 'classicHot']) {
    it(`refus 409 sans information (${key})`, async () => {
      for (const res of [await prompt(ids[key]!, alice), await answer(ids[key]!, alice)]) {
        expect(res.status).toBe(409);
        expect(res.text).not.toMatch(FEN_RE);
        expect(res.text).not.toMatch(/"(squares|explanation|question|prompt|correct)"/);
      }
    });
  }

  it('aucun appel moteur pour une partie Secret Queen (pas de FEN dans les logs)', async () => {
    const before = logs.length;
    await prompt(ids.sqBot!, alice);
    await answer(ids.sqBot!, alice);
    await prompt(ids.sqHot!, alice);
    expect(logs.slice(before)).not.toMatch(FEN_RE);
  });
});

describe('partie coachée : propriété de la partie', () => {
  it('un autre utilisateur ou un anonyme est refusé, sans rien apprendre', async () => {
    for (const id of [ids.training!, ids.sqBot!]) {
      for (const who of [mallory, null]) {
        for (const res of [await prompt(id, who), await answer(id, who)]) {
          expect([401, 403, 404, 409]).toContain(res.status);
          expect(res.text).not.toMatch(FEN_RE);
          expect(res.text).not.toMatch(/"(squares|explanation|question)"/);
        }
      }
    }
  });
});

describe('partie coachée : contenu des réponses', () => {
  it('coach-prompt ne contient que ply, kind, question', async () => {
    const res = await prompt(ids.training!, alice);
    expect([200, 503]).toContain(res.status);
    if (res.status !== 200) return;
    const { prompt: p } = JSON.parse(res.text) as { prompt: Record<string, unknown> | null };
    if (p) expect(Object.keys(p).sort()).toEqual(['kind', 'ply', 'question']);
    expect(res.text).not.toMatch(FEN_RE);
    expect(res.text).not.toMatch(/"(explanation|expected|answer)"/);
  });

  it('coach-answer avec un ply périmé est refusé et ne révèle rien', async () => {
    for (const ply of [9999, 7, 1]) {
      const res = await answer(ids.training!, alice, ply);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.text).not.toMatch(/"(squares|explanation|correct)"/);
      expect(res.text).not.toMatch(FEN_RE);
    }
  });

  it('corps invalide : 400 sans fuite', async () => {
    const res = await call(`/api/games/${ids.training!}/coach-answer`, alice, { ply: -1 });
    expect(res.status).toBe(400);
  });
});

describe('routes /api/coach/* et /api/reviews/cards', () => {
  it('ne contiennent aucune FEN de partie en cours ni identifiant de pièce secrète', async () => {
    for (const path of [
      '/api/coach/skills',
      '/api/coach/curriculum',
      '/api/coach/session',
      '/api/coach/dashboard',
      '/api/reviews/cards',
    ]) {
      const r = await fetch(`${base}${path}`, { headers: { cookie: alice } });
      expect(r.status, path).toBeLessThan(500);
      const text = await r.text();
      expect(text, path).not.toMatch(FEN_RE);
      expect(text, path).not.toMatch(/secret|"reveal"|pieceId|selection/i);
      for (const id of Object.values(ids)) expect(text, path).not.toContain(id);
    }
  });
});
