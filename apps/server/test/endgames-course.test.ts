import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  EndgameHintResponseSchema,
  type EndgameStartResponse,
  type EndgamesResponse,
  type EndgameSummary,
  type MoveIntent,
  type SkillsResponse,
} from '@sq/shared';
import { endgameById, type Endgame } from '@sq/coach';
import type { GameReview } from '@sq/shared';
import { importedRow } from '../src/review/imports.js';
import { LearningService } from '../src/coach/learning.js';
import { GameStore } from '../src/persistence/db.js';
import type { BotDriver } from '../src/bot/driver.js';
import { testServer } from './client.js';

const DAY = 86_400_000;

/*
 * Cours de finales : limite de coups, indices, cartes de révision et preuves de compétence.
 * Le contenu du coach est réécrit ailleurs : on fixe ici les champs utiles de `carre-rattraper`
 * (nulle par répétition en 4 coups du joueur) et on les restaure ensuite.
 */
const ID = 'carre-rattraper';
const HINTS = ['Idée : reste dans le carré.', 'Case : e4.', 'Coup : Re4.'];
let original: Endgame;

beforeAll(() => {
  original = { ...(endgameById(ID) as Endgame) };
  Object.assign(endgameById(ID) as Endgame, { maxMoves: 3, hints: HINTS, skill: 'rook-endgames' });
});
afterAll(() => {
  const target = endgameById(ID) as Endgame;
  for (const key of ['maxMoves', 'hints', 'skill'] as const) delete target[key];
  Object.assign(target, original);
});

function scripted(moves: MoveIntent[]): BotDriver {
  let index = 0;
  return {
    chooseSecret: () => 'a7',
    chooseMove: () => Promise.resolve(moves[index++] ?? { from: 'a1', to: 'a2' }),
    shouldAcceptDraw: () => Promise.resolve(false),
    dispose: () => undefined,
  };
}

const BOT: MoveIntent[] = [
  { from: 'a1', to: 'b1' },
  { from: 'b1', to: 'a1' },
  { from: 'a1', to: 'b1' },
  { from: 'b1', to: 'a1' },
];
const MINE: MoveIntent[] = [
  { from: 'd4', to: 'e4' },
  { from: 'e4', to: 'd4' },
  { from: 'd4', to: 'e4' },
  { from: 'e4', to: 'd4' },
];

async function server() {
  const s = await testServer({ createBot: () => scripted(BOT) });
  await s.http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
  const find = async () =>
    ((await s.http('GET', '/api/endgames')).json as EndgamesResponse).endgames.find(
      (e) => e.id === ID,
    ) as EndgameSummary;
  /** Joue la finale jusqu'à la nulle par répétition (4 coups du joueur). */
  const playRepetition = async () => {
    const gameId = (
      (await s.http('POST', `/api/endgames/${ID}/start`)).json as EndgameStartResponse
    ).gameId;
    const c = await s.ws();
    c.send({ type: 'join', gameId });
    await c.until((x) => x.phase === 'playing');
    for (const [i, move] of MINE.entries()) {
      c.send({ type: 'move', clientMoveId: String(i), move });
      await c.until((x) => x.board?.moves.length === 2 * i + 2 || x.phase === 'ended');
    }
    await c.until((x) => x.phase === 'ended');
  };
  return { ...s, find, playRepetition };
}

describe('cours de finales : liste et indices', () => {
  it('la liste donne stage, maxMoves, nombre d’indices et compétence, sans texte', async () => {
    const { app, http, find } = await server();
    const e = await find();
    expect(e).toMatchObject({
      stage: 1,
      maxMoves: 3,
      hints: 3,
      skill: 'rook-endgames',
      due: false,
    });
    expect(JSON.stringify((await http('GET', '/api/endgames')).json)).not.toContain('Idée');
    await app.close();
  });

  it('route hint : un seul indice, au niveau demandé', async () => {
    const { app, http } = await server();
    const res = await http('POST', `/api/endgames/${ID}/hint`, { level: 2 });
    expect(res.status).toBe(200);
    expect(EndgameHintResponseSchema.parse(res.json)).toEqual({ hint: HINTS[1] });
    expect((await http('POST', `/api/endgames/inconnue/hint`, { level: 1 })).status).toBe(404);
    expect((await http('POST', `/api/endgames/${ID}/hint`, { level: 4 })).status).toBe(400);
    expect((await http('POST', `/api/endgames/${ID}/hint`, {})).status).toBe(400);
    await app.close();
  });

  it('route hint : 401 sans compte', async () => {
    const anonymous = await testServer();
    expect((await anonymous.http('POST', `/api/endgames/${ID}/hint`, { level: 1 })).status).toBe(
      401,
    );
    await anonymous.app.close();
  });
});

describe('cours de finales : jugement', () => {
  it('trop de coups : nulle obtenue mais échec ; carte créée, finale à rejouer demain', async () => {
    const { app, http, find, playRepetition } = await server();
    await playRepetition(); // 4 coups pour 3 autorisés
    expect(await find()).toMatchObject({ attempts: 1, passed: false, due: false });
    const cards = (await http('GET', '/api/reviews/cards')).json as { total: number };
    expect(cards.total).toBe(1); // carte créée, due demain
    const skills = (await http('GET', '/api/coach/skills')).json as SkillsResponse;
    const rook = skills.skills.find((s) => s.id === 'rook-endgames');
    expect(rook?.evidence).toBe(1);
    expect(rook?.level).toBeLessThan(50);
    await app.close();
  });

  it('dans la limite : réussite, preuve positive, aucune carte créée', async () => {
    Object.assign(endgameById(ID) as Endgame, { maxMoves: 4 });
    try {
      const { app, http, find, playRepetition } = await server();
      await playRepetition();
      expect(await find()).toMatchObject({ attempts: 1, passed: true });
      expect(((await http('GET', '/api/reviews/cards')).json as { total: number }).total).toBe(0);
      const skills = (await http('GET', '/api/coach/skills')).json as SkillsResponse;
      const rook = skills.skills.find((s) => s.id === 'rook-endgames');
      expect(rook?.evidence).toBe(1);
      expect(rook?.level).toBeGreaterThan(50);
      await app.close();
    } finally {
      Object.assign(endgameById(ID) as Endgame, { maxMoves: 3 });
    }
  });

  it('un indice consulté pendant l’essai est enregistré avec la tentative', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'endgames-'));
    const dbPath = join(dir, 'test.db');
    const s = await testServer({ dbPath, createBot: () => scripted(BOT) });
    try {
      const reg = await s.http('POST', '/api/auth/register', {
        username: 'cedric',
        password: 'motdepasse',
      });
      const userId = (reg.json as { id: string }).id;
      await s.http('POST', `/api/endgames/${ID}/hint`, { level: 3 }); // avant l'essai : oublié
      const gameId = (
        (await s.http('POST', `/api/endgames/${ID}/start`)).json as EndgameStartResponse
      ).gameId;
      await s.http('POST', `/api/endgames/${ID}/hint`, { level: 2 });
      const c = await s.ws();
      c.send({ type: 'join', gameId });
      await c.until((x) => x.phase === 'playing');
      c.send({ type: 'resign' });
      await c.until((x) => x.phase === 'ended');
      const store = new GameStore(dbPath, { initialRating: 1500 });
      expect(store.endgameAttempts(userId)).toMatchObject([
        { endgameId: ID, success: false, hints: 2, moves: 0 },
      ]);
    } finally {
      await s.app.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('cours de finales : cartes de révision', () => {
  function setup() {
    const store = new GameStore(':memory:', { initialRating: 1500 });
    store.createUser({ id: 'u1', username: 'u1', passwordHash: 'x' });
    let now = 1_800_000_000_000;
    const learning = new LearningService(store, { phaseOf: () => 1, now: () => now });
    return { store, learning, advance: (ms: number) => (now += ms) };
  }

  it('échec : carte à J+1 ; réussite quand elle est due : étape suivante (1/3/7 jours)', () => {
    const { learning, advance } = setup();
    learning.recordEndgame('u1', ID, false, 0, 4);
    expect(learning.cards('u1')).toMatchObject({ due: [], total: 1 });
    expect(learning.dueEndgames('u1').size).toBe(0);

    advance(DAY + 1000);
    expect(learning.dueEndgames('u1')).toEqual(new Set([ID]));
    const [card] = learning.cards('u1').due;
    expect(card).toMatchObject({ source: 'endgame', ref: ID, skill: 'rook-endgames', step: 0 });
    expect(card?.fen).toBe(original.fen);
    expect(card?.prompt).toContain(original.title);

    learning.recordEndgame('u1', ID, true, 0, 3);
    expect(learning.cards('u1').due).toEqual([]);
    advance(2 * DAY); // étape 1 : J+3
    expect(learning.cards('u1').due).toHaveLength(0);
    advance(DAY + 1000);
    expect(learning.cards('u1').due[0]?.step).toBe(1);
  });

  it('réussite sans carte : aucune carte ; réussite avec indice : la carte ne progresse pas', () => {
    const { learning, advance } = setup();
    learning.recordEndgame('u1', ID, true, 0, 3);
    expect(learning.cards('u1').total).toBe(0);

    learning.recordEndgame('u1', ID, false, 0, 4);
    advance(DAY + 1000);
    learning.recordEndgame('u1', ID, true, 0, 3); // étape 1
    advance(3 * DAY + 1000);
    expect(learning.cards('u1').due[0]?.step).toBe(1);
    learning.recordEndgame('u1', ID, true, 2, 3); // avec indice : retour à l'étape 0
    advance(DAY + 1000);
    expect(learning.cards('u1').due[0]?.step).toBe(0);
  });

  it('nouvel échec : la carte repart de l’étape 0 ; compétence alimentée par chaque tentative', () => {
    const { learning, advance } = setup();
    learning.recordEndgame('u1', ID, false, 0, 4);
    advance(DAY + 1000);
    learning.recordEndgame('u1', ID, true, 0, 3);
    advance(3 * DAY + 1000);
    learning.recordEndgame('u1', ID, false, 0, 4);
    advance(DAY + 1000);
    expect(learning.cards('u1').due[0]?.step).toBe(0);
    const rook = learning.skills('u1').find((s) => s.id === 'rook-endgames');
    expect(rook?.evidence).toBe(3);
    expect(learning.skills('u1').find((s) => s.id === 'pawn-endgames')?.evidence).toBe(0);
  });

  it('endgame-conversion : finales de tours si des tours restent, sinon finales de pions', () => {
    const { store, learning } = setup();
    const counts = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 1, blunder: 0 };
    const game = (fen: string, pgn: string) => {
      const row = importedRow(pgn, { userId: 'u1', source: 'pgn', names: ['cedric'] });
      if (!row) throw new Error('PGN illisible');
      store.addImported(row);
      store.saveReview(row.id, {
        positions: [fen, fen],
        moves: [
          {
            ply: 1,
            color: 'w',
            san: 'Kd2',
            uci: 'd1d2',
            classification: 'mistake',
            winBefore: 90,
            winAfter: 40,
            accuracy: 20,
            explanation: { kind: 'endgame-conversion', text: 'x' },
          },
        ],
        evals: [],
        accuracy: { w: 50, b: 50 },
        counts: { w: counts, b: counts },
      } as unknown as GameReview);
    };
    game('8/8/8/8/8/2k5/R7/3K4 w - - 0 1', '[White "cedric"]\n[Black "x"]\n\n1. e4 e5 *');
    const evidence = (id: string) => learning.skills('u1').find((s) => s.id === id)?.evidence;
    expect(evidence('rook-endgames')).toBe(1);
    expect(evidence('pawn-endgames')).toBe(0);

    game('8/8/8/8/8/2k5/P7/3K4 w - - 0 1', '[White "cedric"]\n[Black "y"]\n\n1. e4 e5 *');
    expect(evidence('rook-endgames')).toBe(1);
    expect(evidence('pawn-endgames')).toBe(1);
  });
});
