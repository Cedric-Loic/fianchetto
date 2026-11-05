import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PuzzleMoveResponseSchema,
  PuzzleNextResponseSchema,
  PuzzleStatsSchema,
  RushRecordsSchema,
  ThreatAnswerResponseSchema,
  ThreatNextResponseSchema,
  WoodpeckerStateSchema,
  type SkillsResponse,
} from '@sq/shared';
import { importPuzzles } from '../src/puzzles/importer.js';
import { testServer } from './client.js';

/*
 * Entraînement rapide (étape 17). Base de test : la fixture (T0001 mat en 1 Ta8#, T0002 fourchette
 * Cc7+ puis Cxa8, T0003 Fxe5 gagne un cavalier, T0004 mat en 1 avec deux tours : Ta8# ou Tc8#).
 */
const FIXTURE = new URL('./fixtures/puzzles.csv', import.meta.url).pathname;
/** Coups du joueur de chaque puzzle (les réponses adverses sont jouées par le serveur). */
const SOLUTIONS: Record<string, string[]> = {
  T0001: ['a1a8'],
  T0002: ['b5c7', 'c7a8'],
  T0003: ['c3e5'],
  T0004: ['a1a8'],
};
let dir: string;
let puzzlesPath: string;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'sq-drills-'));
  puzzlesPath = join(dir, 'puzzles.db');
  await importPuzzles({ file: FIXTURE, dbPath: puzzlesPath });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function server(withBank = true) {
  const s = await testServer(withBank ? { puzzlesPath } : {});
  await s.http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
  return s;
}

describe('Trouve la menace', () => {
  it('compte requis ; sans base : pas de problème', async () => {
    const anonymous = await testServer({ puzzlesPath });
    expect((await anonymous.http('GET', '/api/threats/next')).status).toBe(401);
    expect(
      (await anonymous.http('POST', '/api/threats/T0001/answer', { uci: 'a1a8' })).status,
    ).toBe(401);
    await anonymous.app.close();
    const { app, http } = await server(false);
    const next = ThreatNextResponseSchema.parse((await http('GET', '/api/threats/next')).json);
    expect(next.problem).toBeNull();
    await app.close();
  });

  it('position vue du camp qui vient de jouer ; la menace ne sort qu’avec la réponse', async () => {
    const { app, http } = await server();
    const next = ThreatNextResponseSchema.parse((await http('GET', '/api/threats/next')).json);
    const problem = next.problem;
    expect(problem).not.toBeNull();
    if (!problem) return;
    const threat = SOLUTIONS[problem.id]?.[0] ?? '';
    // Le coup d'amorce est le mien : c'est à l'adversaire de jouer.
    expect(problem.fen.split(' ')[1]).not.toBe(problem.color);
    expect(JSON.stringify(next)).not.toContain(threat);
    await app.close();
  });

  it('coup impossible : 422 ; mauvaise réponse puis bonne : verdict, suite, série', async () => {
    const { app, http } = await server();
    expect((await http('POST', '/api/threats/T0001/answer', { uci: 'a1b3' })).status).toBe(422);
    expect((await http('POST', '/api/threats/inconnu/answer', { uci: 'a1a8' })).status).toBe(404);

    const wrong = ThreatAnswerResponseSchema.parse(
      (await http('POST', '/api/threats/T0001/answer', { uci: 'a1a7' })).json,
    );
    expect(wrong.correct).toBe(false);
    expect(wrong.line[0]?.san).toBe('Ra8#');
    expect(wrong.themes).toContain('backRankMate');
    expect(wrong.themes).not.toContain('oneMove');
    expect(wrong.explanation).toContain('Ra8#');
    expect(wrong.stats).toEqual({ attempts: 1, correct: 0, streak: 0 });

    const right = ThreatAnswerResponseSchema.parse(
      (await http('POST', '/api/threats/T0001/answer', { uci: 'a1a8' })).json,
    );
    expect(right.correct).toBe(true);
    // Un autre mat est aussi une bonne réponse.
    const other = ThreatAnswerResponseSchema.parse(
      (await http('POST', '/api/threats/T0004/answer', { uci: 'c1c8' })).json,
    );
    expect(other.correct).toBe(true);
    expect(other.stats).toEqual({ attempts: 3, correct: 2, streak: 2 });

    // Preuves de la compétence « menaces ».
    const skills = (await http('GET', '/api/coach/skills')).json as SkillsResponse;
    const threats = skills.skills.find((s) => s.id === 'threats');
    expect(threats?.evidence).toBeGreaterThanOrEqual(3);
    await app.close();
  });
});

describe('Contre la montre', () => {
  it('puzzles non classés, absents des statistiques ; records par durée', async () => {
    const { app, http } = await server();
    const next = PuzzleNextResponseSchema.parse(
      (await http('POST', '/api/puzzles/next', { mode: 'rush', theme: null, index: 3 })).json,
    );
    expect(next.attempt.rated).toBe(false);
    const res = PuzzleMoveResponseSchema.parse(
      (await http('POST', `/api/puzzles/${next.attempt.attemptId}/move`, { uci: 'h2h3' })).json,
    );
    expect(['failed', 'illegal']).toContain(res.status);
    expect(res.rating).toBeNull();
    const stats = PuzzleStatsSchema.parse((await http('GET', '/api/puzzles/stats')).json);
    expect(stats.attempts).toBe(0);
    expect(stats.available.due).toBe(0);

    expect(
      (await http('POST', '/api/rush/result', { minutes: 4, score: 1, errors: 0 })).status,
    ).toBe(400);
    await http('POST', '/api/rush/result', { minutes: 3, score: 12, errors: 3 });
    await http('POST', '/api/rush/result', { minutes: 3, score: 9, errors: 3 });
    const records = RushRecordsSchema.parse(
      (await http('POST', '/api/rush/result', { minutes: 5, score: 20, errors: 2 })).json,
    );
    expect(records.best).toEqual({ 3: 12, 5: 20 });
    expect(records.recent.map((r) => r.score)).toEqual([20, 9, 12]);
    await app.close();
  });
});

describe('Woodpecker', () => {
  it('lot, cycle complet, objectif du cycle suivant, puis abandon', async () => {
    const { app, http } = await server();
    const empty = WoodpeckerStateSchema.parse((await http('GET', '/api/woodpecker')).json);
    expect(empty).toEqual({ set: null, bank: true });
    expect((await http('POST', '/api/woodpecker/start', { size: 30 })).status).toBe(400);

    // La base de test n'a que 4 puzzles : le lot en prend 4.
    const started = WoodpeckerStateSchema.parse(
      (await http('POST', '/api/woodpecker/start', { size: 25 })).json,
    );
    expect(started.set).toMatchObject({ size: 4, cycle: 1, position: 0, targetMs: null });

    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const { attempt } = PuzzleNextResponseSchema.parse(
        (await http('POST', '/api/puzzles/next', { mode: 'woodpecker', theme: null })).json,
      );
      expect(attempt.rated).toBe(false);
      seen.push(attempt.puzzleId);
      // Le premier puzzle est raté, les autres réussis.
      const solution = SOLUTIONS[attempt.puzzleId] ?? [];
      const wrong = attempt.legalMoves.find((m) => `${m.from}${m.to}` !== solution[0]);
      const moves = i === 0 && wrong ? [`${wrong.from}${wrong.to}`] : solution;
      for (const uci of moves) {
        await http('POST', `/api/puzzles/${attempt.attemptId}/move`, { uci });
      }
    }
    expect(new Set(seen).size).toBe(4);
    const after = WoodpeckerStateSchema.parse((await http('GET', '/api/woodpecker')).json);
    expect(after.set).toMatchObject({ cycle: 2, position: 0, solved: 0, finished: false });
    expect(after.set?.history).toHaveLength(1);
    expect(after.set?.history[0]).toMatchObject({ cycle: 1, total: 4 });
    expect(after.set?.targetMs).not.toBeNull();

    // Même ordre au cycle suivant.
    const again = PuzzleNextResponseSchema.parse(
      (await http('POST', '/api/puzzles/next', { mode: 'woodpecker', theme: null })).json,
    );
    expect(again.attempt.puzzleId).toBe(seen[0]);

    // Ni classement ni statistiques de puzzles.
    const stats = PuzzleStatsSchema.parse((await http('GET', '/api/puzzles/stats')).json);
    expect(stats.attempts).toBe(0);

    const reset = WoodpeckerStateSchema.parse((await http('POST', '/api/woodpecker/reset')).json);
    expect(reset.set).toBeNull();
    expect(
      (await http('POST', '/api/puzzles/next', { mode: 'woodpecker', theme: null })).status,
    ).toBe(404);
    await app.close();
  });
});
