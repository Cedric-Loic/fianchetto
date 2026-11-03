import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { afterAll, describe, expect, it } from 'vitest';
import type { UciLine } from '@sq/bot';
import type { GameReview, PuzzleAttempt, UserPublic } from '@sq/shared';
import type { BotDriver } from '../src/bot/driver.js';
import { GameStore } from '../src/persistence/db.js';
import { importedRow } from '../src/review/imports.js';
import { ReviewService, type ReviewEngine } from '../src/review/service.js';
import { testServer } from './client.js';

const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'sq-engine-'));
  dirs.push(d);
  return d;
};
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

/**
 * Faux Stockfish : premier coup légal, évaluation nulle. `control.dead` : chaque recherche fait
 * mourir le moteur (rejet, `alive` passe à faux), comme un processus Stockfish qui s'arrête.
 */
function fakeEngines() {
  const control = { dead: false, created: 0, quits: 0 };
  const create = (): ReviewEngine => {
    control.created++;
    let alive = true;
    return {
      get alive() {
        return alive;
      },
      analyze: (fen: string) => {
        if (control.dead) {
          alive = false;
          return Promise.reject(new Error('Stockfish arrêté'));
        }
        const [move] = new Chess(fen).moves({ verbose: true });
        const uci = move ? `${move.from}${move.to}${move.promotion ?? ''}` : '';
        const line: UciLine = { move: uci, score: 0, mate: null, pv: [uci], depth: 10 };
        return Promise.resolve([line]);
      },
      quit: () => {
        control.quits++;
        alive = false;
      },
    };
  };
  return { control, create };
}

const idleBot: BotDriver = {
  chooseSecret: () => 'a7',
  chooseMove: () => Promise.resolve({ from: 'a7', to: 'a6' }),
  shouldAcceptDraw: () => Promise.resolve(false),
  dispose: () => undefined,
};

/** Partie importée où les Blancs (moi) jouent 3. Nxe5 ?? au lieu de Bb5, avec sa revue. */
function seedOwnGame(dbPath: string, userId: string): string {
  const store = new GameStore(dbPath, { initialRating: 1200 });
  const row = importedRow('[White "cedric"]\n[Black "x"]\n\n1. e4 e5 2. Nf3 Nc6 3. Nxe5 *', {
    userId,
    source: 'pgn',
    names: ['cedric'],
  });
  if (!row) throw new Error('PGN');
  store.addImported(row);
  const ev = (bestMoveUci: string, evalCp = 30) => ({
    evalCp,
    mate: null,
    bestMoveUci,
    bestMoveSan: null,
  });
  const move = (ply: number, san: string, uci: string, cls = 'best') => ({
    ply,
    color: ply % 2 === 1 ? 'w' : 'b',
    san,
    uci,
    classification: cls,
    winBefore: 52,
    winAfter: 20,
    accuracy: 50,
    explanation: null,
  });
  const counts = { best: 0, excellent: 0, good: 0, inaccuracy: 0, mistake: 0, blunder: 0 };
  const review = {
    positions: [
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
      'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
      'r1bqkbnr/pppp1ppp/2n5/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3',
    ],
    evals: [ev('e2e4'), ev('e7e5'), ev('g1f3'), ev('b8c6'), ev('f1b5'), ev('c6e5', -250)],
    moves: [
      move(1, 'e4', 'e2e4'),
      move(2, 'e5', 'e7e5'),
      move(3, 'Nf3', 'g1f3'),
      move(4, 'Nc6', 'b8c6'),
      move(5, 'Nxe5', 'f3e5', 'blunder'),
    ],
    accuracy: { w: 80, b: 100 },
    counts: { w: { ...counts, blunder: 1 }, b: counts },
  } as unknown as GameReview;
  store.saveReview(row.id, review);
  store.close();
  return row.id;
}

describe('moteur indisponible : 503 ENGINE_UNAVAILABLE', () => {
  it('entraînement (indice, garde-fou), puzzles de mes erreurs, « apprends de tes erreurs »', async () => {
    const engines = fakeEngines();
    engines.control.dead = true;
    const dbPath = join(tempDir(), 'base.db');
    const { app, http } = await testServer({
      dbPath,
      createBot: () => idleBot,
      createReviewEngine: engines.create,
    });
    const me = (
      await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' })
    ).json as UserPublic;
    const imported = seedOwnGame(dbPath, me.id);

    // Entraînement : le joueur a les Blancs, donc le trait.
    const { gameId } = (
      await http('POST', '/api/games', {
        mode: 'bot',
        variant: 'classic',
        level: 3,
        timeControl: 'untimed',
        color: 'w',
        training: true,
      })
    ).json as { gameId: string };
    const unavailable = { error: 'ENGINE_UNAVAILABLE' };
    expect(await http('POST', `/api/games/${gameId}/hint`, { level: 1 })).toEqual({
      status: 503,
      json: unavailable,
    });
    expect(await http('POST', `/api/games/${gameId}/check-move`, { uci: 'e2e4' })).toEqual({
      status: 503,
      json: unavailable,
    });

    // Puzzle tiré de ma partie : un autre coup que la solution est jugé par Stockfish.
    const { attempt } = (await http('POST', '/api/puzzles/next', { mode: 'mine' })).json as {
      attempt: PuzzleAttempt;
    };
    expect(attempt.source).toBe('mine');
    const puzzleMove = () =>
      http('POST', `/api/puzzles/${attempt.attemptId}/move`, { uci: 'd2d4' });
    expect(await puzzleMove()).toEqual({ status: 503, json: unavailable });

    // « Apprends de tes erreurs » sur la revue enregistrée.
    const retry = () => http('POST', `/api/reviews/${imported}/retry`, { ply: 5, uci: 'd2d4' });
    expect(await retry()).toEqual({ status: 503, json: unavailable });
    // Moteur mort à chaque fois : il est recréé à chaque demande.
    expect(engines.control.created).toBeGreaterThanOrEqual(4);

    // Le moteur revient : les mêmes demandes aboutissent (la tentative de puzzle a survécu).
    engines.control.dead = false;
    expect((await http('POST', `/api/games/${gameId}/check-move`, { uci: 'e2e4' })).status).toBe(
      200,
    );
    expect((await puzzleMove()).status).toBe(200);
    expect((await retry()).status).toBe(200);
    await app.close();
  });
});

describe('service de revue', () => {
  const memoryStore = () => new GameStore(':memory:', { initialRating: 1200 });

  it('evaluate : moteur mort → null, puis moteur recréé', async () => {
    const engines = fakeEngines();
    const service = new ReviewService(memoryStore(), { createEngine: engines.create });
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    engines.control.dead = true;
    expect(await service.evaluate(fen)).toBeNull();
    engines.control.dead = false;
    expect(await service.evaluate(fen)).toMatchObject({ evalCp: 0 });
    expect(engines.control.created).toBe(2);
    service.dispose();
  });

  it('arrêt du moteur après inactivité', async () => {
    const engines = fakeEngines();
    const service = new ReviewService(memoryStore(), { createEngine: engines.create, idleMs: 30 });
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    await service.evaluate(fen);
    expect(engines.control.quits).toBe(0);
    await new Promise((r) => setTimeout(r, 80));
    expect(engines.control.quits).toBe(1);
    // Nouvelle demande : un nouveau moteur.
    await service.evaluate(fen);
    expect(engines.control.created).toBe(2);
    service.dispose();
  });

  it('les échecs de revue sont oubliés après un délai', async () => {
    const engines = fakeEngines();
    const service = new ReviewService(memoryStore(), {
      createEngine: engines.create,
      errorTtlMs: 40,
    });
    service.request('perdue', () => null);
    await new Promise((r) => setTimeout(r, 5));
    expect(service.status('perdue')).toEqual({ status: 'error' });
    await new Promise((r) => setTimeout(r, 80));
    expect(service.status('perdue')).toEqual({ status: 'none' });
    service.dispose();
  });
});
