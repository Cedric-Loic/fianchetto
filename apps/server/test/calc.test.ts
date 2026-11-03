import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CalcAnswerResponseSchema,
  CalcNextResponseSchema,
  CalcStepResponseSchema,
  type CalcAnswerResponse,
  type CalcProblem,
  type SkillsResponse,
} from '@sq/shared';
import { CalcService } from '../src/calc/service.js';
import { LearningService } from '../src/coach/learning.js';
import { GameStore } from '../src/persistence/db.js';
import { importPuzzles } from '../src/puzzles/importer.js';
import { testServer } from './client.js';

const DAY = 86_400_000;
const FIXTURE = new URL('./fixtures/puzzles.csv', import.meta.url).pathname;

/*
 * Base de test : les puzzles de la fixture (T0001 mat en 1, T0002 gain d'une tour en 2 coups,
 * T0003 gain d'un cavalier, T0004 mat en 1 avec un second mat possible) plus T0005 : une solution
 * de 3 coups du joueur sans aucune prise (bilan « matériel égal »).
 */
const LONG =
  'T0009,4k3/8/8/8/8/8/4P3/4K3 b - - 0 1,e8d8 e2e4 d8e8 e4e5 e8d8 e5e6,1500,75,90,500,long,,';
let dir: string;
let puzzlesPath: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sq-calc-'));
  const csv = join(dir, 'puzzles.csv');
  writeFileSync(csv, `${readFileSync(FIXTURE, 'utf8').trimEnd()}\n${LONG}\n`);
  puzzlesPath = join(dir, 'puzzles.db');
  await importPuzzles({ file: csv, dbPath: puzzlesPath });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function server() {
  const s = await testServer({ puzzlesPath });
  await s.http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
  const answer = async (id: string, line: string[], choice: number, hints?: number) =>
    s.http('POST', `/api/calc/${id}/answer`, { line, answer: choice, ...(hints ? { hints } : {}) });
  return { ...s, answer };
}

describe('calcul : accès et tirage', () => {
  it('compte requis, profondeur invalide refusée', async () => {
    const anonymous = await testServer({ puzzlesPath });
    expect((await anonymous.http('GET', '/api/calc/next?depth=1')).status).toBe(401);
    expect(
      (await anonymous.http('POST', '/api/calc/T0001/step', { line: [], uci: 'a1a8' })).status,
    ).toBe(401);
    expect(
      (await anonymous.http('POST', '/api/calc/T0001/answer', { line: [], answer: 0 })).status,
    ).toBe(401);
    await anonymous.app.close();

    const { app, http } = await server();
    expect((await http('GET', '/api/calc/next?depth=0')).status).toBe(400);
    expect((await http('GET', '/api/calc/next?depth=4')).status).toBe(400);
    expect((await http('GET', '/api/calc/next?depth=x')).status).toBe(400);
    expect((await http('POST', '/api/calc/inconnu/step', { line: [], uci: 'a1a8' })).status).toBe(
      404,
    );
    expect((await http('POST', '/api/calc/inconnu/answer', { line: [], answer: 0 })).status).toBe(
      404,
    );
    await app.close();
  });

  it('next : une solution d’exactement `depth` coups, technique selon la profondeur', async () => {
    const { app, http } = await server();
    const one = CalcNextResponseSchema.parse((await http('GET', '/api/calc/next?depth=1')).json);
    expect(['T0001', 'T0003', 'T0004']).toContain(one.problem?.id);
    expect(one.problem).toMatchObject({ depth: 1, plies: 1, technique: 'forced' });

    const two = CalcNextResponseSchema.parse((await http('GET', '/api/calc/next?depth=2')).json);
    expect(two.problem).toMatchObject({
      id: 'T0002',
      depth: 2,
      plies: 3,
      technique: 'candidates',
      color: 'w',
      // Position où le joueur doit jouer : après le coup d'amorce h7h6.
      fen: 'r3k3/8/7p/1N6/8/8/8/4K3 w - - 0 2',
    });
    expect(two.problem?.question.options).toHaveLength(5);

    const three = CalcNextResponseSchema.parse((await http('GET', '/api/calc/next?depth=3')).json);
    expect(three.problem).toMatchObject({ id: 'T0009', plies: 5, technique: 'long' });
    // Sans paramètre : profondeur 1.
    expect(
      ((await http('GET', '/api/calc/next')).json as { problem: CalcProblem }).problem.depth,
    ).toBe(1);
    await app.close();
  });

  it('sans base de puzzles : problem null', async () => {
    const s = await testServer({ puzzlesPath: join(dir, 'vide.db') });
    await s.http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    expect((await s.http('GET', '/api/calc/next?depth=2')).json).toEqual({ problem: null });
    await s.app.close();
  });

  it('aucune solution avant /answer', async () => {
    const { app, http } = await server();
    const next = await http('GET', '/api/calc/next?depth=2');
    const text = JSON.stringify(next.json);
    expect(text).not.toMatch(/solution|b5c7|c7a8|Nc7|Nxa8|correct/i);
    const step = await http('POST', '/api/calc/T0002/step', { line: [], uci: 'b5c7' });
    expect(Object.keys(step.json as object).sort()).toEqual(['legal', 'san']);
    await app.close();
  });
});

describe('calcul : légalité des pas', () => {
  it('rejoue la ligne depuis la position du problème', async () => {
    const { app, http } = await server();
    const step = async (line: string[], uci: string) =>
      CalcStepResponseSchema.parse(
        (await http('POST', '/api/calc/T0002/step', { line, uci })).json,
      );
    expect(await step([], 'b5c7')).toEqual({ legal: true, san: 'Nc7+' });
    expect(await step([], 'e1e5')).toEqual({ legal: false, san: '' }); // illégal
    expect(await step(['b5c7'], 'e8d7')).toEqual({ legal: true, san: 'Kd7' });
    expect(await step(['b5c7'], 'a8a7')).toEqual({ legal: false, san: '' }); // reste en échec
    expect(await step(['b5c7', 'e8d7'], 'c7a8')).toEqual({ legal: true, san: 'Nxa8' });
    // Ligne déjà complète (3 demi-coups) : plus de coup. Ligne illégale en amont : refusée.
    expect((await step(['b5c7', 'e8d7', 'c7a8'], 'a8c7')).legal).toBe(false);
    expect((await step(['a1a1', 'e8d7'], 'c7a8')).legal).toBe(false);
    // Coup du mauvais camp : c'est au joueur (Blancs) de jouer en premier.
    expect((await step([], 'e8d7')).legal).toBe(false);
    // Corps invalide.
    expect((await http('POST', '/api/calc/T0002/step', { line: [], uci: 'zz' })).status).toBe(400);
    await app.close();
  });
});

describe('calcul : jugement', () => {
  it('ligne exacte et bonne réponse (bilan matériel : on gagne une tour)', async () => {
    const { app, answer } = await server();
    const res = await answer('T0002', ['b5c7', 'e8d7', 'c7a8'], 4);
    expect(res.status).toBe(200);
    const body = CalcAnswerResponseSchema.parse(res.json);
    expect(body).toMatchObject({ lineCorrect: true, answerCorrect: true, correctAnswer: 4 });
    expect(body.solution.map((s) => s.san)).toEqual(['Nc7+', 'Kd7', 'Nxa8']);
    expect(body.explanation).toContain('2.Nc7+');
    await app.close();
  });

  it('ligne exacte mais mauvaise réponse', async () => {
    const { app, answer } = await server();
    const body = (await answer('T0002', ['b5c7', 'e8d7', 'c7a8'], 1)).json as CalcAnswerResponse;
    expect(body).toMatchObject({ lineCorrect: true, answerCorrect: false, correctAnswer: 4 });
    await app.close();
  });

  it('ligne fausse : solution révélée, réponse jugée sur la ligne saisie', async () => {
    const { app, answer } = await server();
    // 1.Nd6+ Kd7 : aucune prise, bilan inchangé (matériel égal ?) : on avait -3, on a -3.
    const body = (await answer('T0002', ['b5d6', 'e8d7', 'd6b7'], 1)).json as CalcAnswerResponse;
    expect(body.lineCorrect).toBe(false);
    expect(body.solution.map((s) => s.uci)).toEqual(['b5c7', 'e8d7', 'c7a8']);
    expect(body.explanation).toContain('La bonne ligne était');
    // Ligne trop courte ou vide : fausse aussi.
    expect(((await answer('T0002', ['b5c7'], 4)).json as CalcAnswerResponse).lineCorrect).toBe(
      false,
    );
    expect(((await answer('T0002', [], 4)).json as CalcAnswerResponse).lineCorrect).toBe(false);
    // Réplique adverse différente de la solution : fausse.
    expect(
      ((await answer('T0002', ['b5c7', 'e8e7', 'c7a8'], 4)).json as CalcAnswerResponse).lineCorrect,
    ).toBe(false);
    await app.close();
  });

  it('mat : question « mat ou non », tout coup qui mate est accepté', async () => {
    const { app, http, answer } = await server();
    expect(
      CalcNextResponseSchema.parse((await http('GET', '/api/calc/next?depth=1')).json).problem
        ?.question.options,
    ).toBeDefined();
    // T0004 : la solution est Ra8#, mais Rc8# mate aussi.
    const alt = (await answer('T0004', ['c1c8'], 0)).json as CalcAnswerResponse;
    expect(alt).toMatchObject({ lineCorrect: true, answerCorrect: true, correctAnswer: 0 });
    const main = (await answer('T0004', ['a1a8'], 1)).json as CalcAnswerResponse;
    expect(main).toMatchObject({ lineCorrect: true, answerCorrect: false, correctAnswer: 0 });
    // Un coup légal qui ne mate pas : ligne fausse, et le roi n'est pas mat (réponse « Non »).
    const quiet = (await answer('T0004', ['a1a2'], 1)).json as CalcAnswerResponse;
    expect(quiet).toMatchObject({ lineCorrect: false, answerCorrect: true, correctAnswer: 1 });
    // Indice de réponse hors des options (2 options : « Oui », « Non »).
    expect((await answer('T0004', ['a1a8'], 2)).status).toBe(400);
    await app.close();
  });

  it('bilan matériel : pièce mineure gagnée, matériel égal en 3 coups', async () => {
    const { app, answer } = await server();
    // T0003 : Bxe5 prend un cavalier (+3).
    expect((await answer('T0003', ['c3e5'], 3)).json as CalcAnswerResponse).toMatchObject({
      lineCorrect: true,
      answerCorrect: true,
      correctAnswer: 3,
    });
    // T0009 (profondeur 3, 5 demi-coups) : aucune prise.
    const line = ['e2e4', 'd8e8', 'e4e5', 'e8d8', 'e5e6'];
    expect((await answer('T0009', line, 1)).json as CalcAnswerResponse).toMatchObject({
      lineCorrect: true,
      answerCorrect: true,
      correctAnswer: 1,
    });
    await app.close();
  });
});

describe('calcul : coach (compétence et cartes de révision)', () => {
  it('la compétence « calculation » reçoit une preuve par réponse', async () => {
    const { app, http, answer } = await server();
    const level = async () =>
      ((await http('GET', '/api/coach/skills')).json as SkillsResponse).skills.find(
        (s) => s.id === 'calculation',
      );
    const before = await level();
    await answer('T0002', ['b5c7', 'e8d7', 'c7a8'], 4);
    await answer('T0004', ['a1a8'], 0);
    const after = await level();
    expect(after?.evidence).toBe((before?.evidence ?? 0) + 2);
    expect(after?.level).toBeGreaterThan(before?.level ?? 0);
    await app.close();
  });

  it('une ligne fausse crée une carte « calc » à demain ; une réussite n’en crée pas', async () => {
    const { app, http, answer } = await server();
    await answer('T0002', ['b5c7', 'e8d7', 'c7a8'], 4);
    await answer('T0004', ['a1a8'], 0);
    expect(((await http('GET', '/api/reviews/cards')).json as { total: number }).total).toBe(0);
    await answer('T0002', ['b5d6'], 4);
    const cards = (await http('GET', '/api/reviews/cards')).json as { total: number };
    expect(cards.total).toBe(1);
    await app.close();
  });

  describe('cartes et horloge simulée', () => {
    function setup() {
      const store = new GameStore(':memory:', { initialRating: 1500, puzzlesPath });
      store.createUser({ id: 'u1', username: 'u1', passwordHash: 'x' });
      let now = 1_800_000_000_000;
      const learning = new LearningService(store, { phaseOf: () => 1, now: () => now });
      const calc = new CalcService(store, learning, () => now);
      return { store, learning, calc, advance: (ms: number) => (now += ms) };
    }

    it('échec : carte à J+1, convertie en position ; réussite quand elle est due : étape suivante', () => {
      const { learning, calc, advance } = setup();
      const t2 = calc.find('T0002');
      if (!t2) throw new Error('T0002 introuvable');
      calc.answer('u1', t2, ['b5d6'], 4, 0);
      expect(learning.cards('u1')).toMatchObject({ due: [], total: 1 });
      // La révision due est resservie en priorité, à sa profondeur.
      advance(DAY + 1000);
      const [card] = learning.cards('u1').due;
      expect(card).toMatchObject({
        source: 'calc',
        ref: 'T0002',
        skill: 'calculation',
        step: 0,
        fen: 'r3k3/8/7p/1N6/8/8/8/4K3 w - - 0 2',
      });
      expect(card?.prompt).toContain('3 demi-coup');
      expect(calc.next('u1', 2).problem?.id).toBe('T0002');
      expect(calc.next('u1', 1).problem?.id).not.toBe('T0002');

      calc.answer('u1', t2, ['b5c7', 'e8d7', 'c7a8'], 4, 0);
      expect(learning.cards('u1').due).toEqual([]);
      advance(2 * DAY); // étape 1 : J+3
      expect(learning.cards('u1').due).toHaveLength(0);
      advance(DAY + 1000);
      expect(learning.cards('u1').due[0]?.step).toBe(1);
    });

    it('réussite avec indice : la carte repart de l’étape 0 ; nouvel échec aussi', () => {
      const { learning, calc, advance } = setup();
      const t2 = calc.find('T0002');
      if (!t2) throw new Error('T0002 introuvable');
      const good = ['b5c7', 'e8d7', 'c7a8'];
      calc.answer('u1', t2, ['b5d6'], 4, 0);
      advance(DAY + 1000);
      calc.answer('u1', t2, good, 4, 0); // étape 1
      advance(3 * DAY + 1000);
      expect(learning.cards('u1').due[0]?.step).toBe(1);
      calc.answer('u1', t2, good, 4, 1); // indice consulté
      advance(DAY + 1000);
      expect(learning.cards('u1').due[0]?.step).toBe(0);
      calc.answer('u1', t2, ['b5d6'], 4, 0); // nouvel échec
      advance(DAY + 1000);
      expect(learning.cards('u1').due[0]?.step).toBe(0);
      expect(learning.skills('u1').find((s) => s.id === 'calculation')?.evidence).toBe(4);
    });
  });
});
