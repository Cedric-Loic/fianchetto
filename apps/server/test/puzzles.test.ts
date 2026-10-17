import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as zlib from 'node:zlib';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { GameReview, PuzzleAttempt, PuzzleStats } from '@sq/shared';
import { GameStore } from '../src/persistence/db.js';
import { importPuzzles } from '../src/puzzles/importer.js';
import { PuzzleService } from '../src/puzzles/service.js';
import { importedRow } from '../src/review/imports.js';
import { testServer } from './client.js';

const FIXTURE = new URL('./fixtures/puzzles.csv', import.meta.url).pathname;
const dirs: string[] = [];
const tempDir = () => {
  const d = mkdtempSync(join(tmpdir(), 'sq-puz-'));
  dirs.push(d);
  return d;
};
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
afterEach(() => vi.restoreAllMocks());

/** Base de puzzles de test (4 puzzles retenus sur 7). */
async function bank(): Promise<string> {
  const dbPath = join(tempDir(), 'puzzles.db');
  await importPuzzles({ file: FIXTURE, dbPath });
  return dbPath;
}

function setup(puzzlesPath: string, evaluate = vi.fn().mockResolvedValue(null)) {
  const store = new GameStore(':memory:', { initialRating: 1200, puzzlesPath });
  store.createUser({ id: 'u1', username: 'cedric', passwordHash: 'x' });
  return { store, service: new PuzzleService(store, evaluate), evaluate };
}

function started(result: PuzzleAttempt | string): PuzzleAttempt {
  if (typeof result === 'string') throw new Error(result);
  return result;
}

describe('import de la base Lichess', () => {
  it('filtre qualité et classement, fichier CSV ou compressé zstd', async () => {
    const dir = tempDir();
    const progress: number[] = [];
    const kept = await importPuzzles({
      file: FIXTURE,
      dbPath: join(dir, 'a.db'),
      onProgress: (n) => progress.push(n),
    });
    expect(kept).toBe(4);
    expect(progress.at(-1)).toBe(4);

    // Une seule tranche de classement (700–749) : seul T0003.
    expect(
      await importPuzzles({
        file: FIXTURE,
        dbPath: join(dir, 'b.db'),
        minRating: 700,
        maxRating: 749,
      }),
    ).toBe(1);

    const zstd = (zlib as unknown as { zstdCompressSync?: (b: Buffer) => Buffer }).zstdCompressSync;
    if (zstd) {
      const compressed = join(dir, 'p.csv.zst');
      writeFileSync(compressed, zstd(readFileSync(FIXTURE)));
      expect(await importPuzzles({ file: compressed, dbPath: join(dir, 'c.db') })).toBe(4);
    }
  });
});

describe('puzzles Lichess', () => {
  it('échec : solution, classement en baisse, révision le lendemain', async () => {
    const { store, service } = setup(await bank());
    const a = started(service.next('u1', 'theme', 'fork'));
    expect(a).toMatchObject({ puzzleId: 'T0002', color: 'w', rating: 1000, rated: true });
    expect(a.setup.san).toBe('h6');
    expect(a.legalMoves.length).toBeGreaterThan(5);

    expect((await service.move('u1', a.attemptId, 'e1e5'))?.status).toBe('illegal');
    const wrong = await service.move('u1', a.attemptId, 'b5d6');
    expect(wrong?.status).toBe('failed');
    expect(wrong?.solution?.map((s) => s.san)).toEqual(['Nc7+', 'Kd7', 'Nxa8']);
    expect(wrong?.rating?.before).toBe(1500);
    expect(wrong?.rating?.after).toBeLessThan(1500);
    expect(store.puzzles.glicko('u1')?.rating).toBeLessThan(1500);

    // Révision : rien aujourd'hui, le puzzle revient demain, non classé.
    expect(service.next('u1', 'review', null)).toBe('NO_PUZZLE');
    const tomorrow = Date.now() + 25 * 3600 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(tomorrow);
    const again = started(service.next('u1', 'review', null));
    expect(again).toMatchObject({ puzzleId: 'T0002', rated: false });
    // Deux coups à trouver : « continue » après le premier, avec la réponse adverse.
    const first = await service.move('u1', again.attemptId, 'b5c7');
    expect(first?.status).toBe('continue');
    expect(first?.steps.map((s) => s.san)).toEqual(['Nc7+', 'Kd7']);
    const second = await service.move('u1', again.attemptId, 'c7a8');
    expect(second).toMatchObject({ status: 'solved', rating: null });
    // Étape suivante : dans 3 jours.
    expect(store.puzzles.due('u1', tomorrow)).toEqual([]);
    expect(store.puzzles.due('u1', tomorrow + 3 * 24 * 3600 * 1000 + 1)).toHaveLength(1);
  });

  it('réussite classée, autre mat accepté, indice, jamais deux fois le même puzzle', async () => {
    const { service } = setup(await bank());
    const seen = new Set<string>();
    for (let i = 0; i < 2; i++) {
      const a = started(service.next('u1', 'theme', 'mateIn1'));
      expect(seen.has(a.puzzleId)).toBe(false);
      seen.add(a.puzzleId);
      expect(service.hint('u1', a.attemptId)).toEqual({ from: 'a1' });
      // T0004 : Rc8# est aussi un mat (accepté) ; T0001 : Ra8#.
      const uci = a.puzzleId === 'T0004' ? 'c1c8' : 'a1a8';
      const res = await service.move('u1', a.attemptId, uci);
      expect(res?.status).toBe('solved');
      // Indice utilisé : la réussite n'est pas classée.
      expect(res?.rating).toBeNull();
    }
    expect(service.next('u1', 'theme', 'mateIn1')).toBe('NO_PUZZLE');
    // Au niveau (1500) : fenêtre élargie jusqu'au puzzle à 1000, la fourchette en deux coups.
    const plain = started(service.next('u1', 'rated', null));
    expect(plain.puzzleId).toBe('T0002');
    expect((await service.move('u1', plain.attemptId, 'b5c7'))?.status).toBe('continue');
    const solved = await service.move('u1', plain.attemptId, 'c7a8');
    expect(solved?.rating?.after).toBeGreaterThan(solved?.rating?.before ?? Infinity);

    const stats: PuzzleStats = service.stats('u1');
    expect(stats).toMatchObject({ attempts: 3, solved: 3, available: { lichess: 4, mine: 0 } });
    expect(stats.themes.find((t) => t.theme === 'mateIn1')).toEqual({
      theme: 'mateIn1',
      attempts: 2,
      solved: 2,
    });
    // Une tentative appartient à son seul utilisateur.
    expect(await service.move('autre', plain.attemptId, 'a1a8')).toBeNull();
  });

  it('base absente : NO_BANK (les révisions et mes erreurs restent possibles)', () => {
    const { service } = setup(join(tempDir(), 'vide.db'));
    expect(service.next('u1', 'rated', null)).toBe('NO_BANK');
    expect(service.next('u1', 'mine', null)).toBe('NO_PUZZLE');
  });
});

describe('puzzles tirés de mes erreurs', () => {
  /** Partie importée où les Blancs (moi) jouent 3. Nxe5 ?? au lieu de Bb5. */
  function withOwnGame(store: GameStore) {
    const row = importedRow('[White "cedric"]\n[Black "x"]\n\n1. e4 e5 2. Nf3 Nc6 3. Nxe5 *', {
      userId: 'u1',
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
    const move = (ply: number, san: string, uci: string, cls = 'best', winBefore = 52) => ({
      ply,
      color: ply % 2 === 1 ? 'w' : 'b',
      san,
      uci,
      classification: cls,
      winBefore,
      winAfter: 20,
      accuracy: 50,
      explanation: null,
    });
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
      counts: { w: {}, b: {} },
    } as unknown as GameReview;
    store.saveReview(row.id, review);
    return row.id;
  }

  it('le meilleur coup résout ; un coup presque aussi bon aussi ; un mauvais échoue', async () => {
    const evaluate = vi.fn();
    const { store, service } = setup(join(tempDir(), 'vide.db'), evaluate);
    const gameId = withOwnGame(store);
    expect(service.stats('u1').available.mine).toBe(1);

    let a = started(service.next('u1', 'mine', null));
    expect(a).toMatchObject({ source: 'mine', puzzleId: `${gameId}-5`, color: 'w', rated: false });
    expect(a.setup.san).toBe('Nc6');
    expect(a.origin?.label).toBe('Ta partie contre x, coup 3');
    expect(await service.move('u1', a.attemptId, 'f1b5')).toMatchObject({ status: 'solved' });

    // Autre coup : jugé par Stockfish (tolérance de 5 points de % de gain).
    a = started(service.next('u1', 'mine', null));
    evaluate.mockResolvedValueOnce({ evalCp: 25, mate: null, bestMoveUci: null, pv: [] });
    expect(await service.move('u1', a.attemptId, 'd2d4')).toMatchObject({ status: 'solved' });
    a = started(service.next('u1', 'mine', null));
    evaluate.mockResolvedValueOnce({ evalCp: -250, mate: null, bestMoveUci: null, pv: [] });
    const failed = await service.move('u1', a.attemptId, 'f3e5');
    expect(failed?.status).toBe('failed');
    expect(failed?.solution?.map((s) => s.san)).toEqual(['Bb5']);
  });
});

describe('routes', () => {
  it('réservées aux comptes ; base absente signalée', async () => {
    const { app, http } = await testServer();
    expect((await http('GET', '/api/puzzles/stats')).status).toBe(401);
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    const stats = (await http('GET', '/api/puzzles/stats')).json as PuzzleStats;
    expect(stats).toMatchObject({ rating: 1500, attempts: 0, available: { lichess: 0 } });
    const next = await http('POST', '/api/puzzles/next', { mode: 'rated' });
    expect(next).toEqual({ status: 404, json: { error: 'NO_BANK' } });
    expect((await http('POST', '/api/puzzles/next', { mode: 'x' })).status).toBe(400);
    expect((await http('POST', '/api/puzzles/inconnu/move', { uci: 'e2e4' })).status).toBe(404);
    await app.close();
  });

  it('partie complète d’un puzzle par HTTP', async () => {
    const { app, http } = await testServer({ puzzlesPath: await bank() });
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    const { attempt } = (
      await http('POST', '/api/puzzles/next', { mode: 'theme', theme: 'hangingPiece' })
    ).json as { attempt: PuzzleAttempt };
    expect(attempt.puzzleId).toBe('T0003');
    const res = (await http('POST', `/api/puzzles/${attempt.attemptId}/move`, { uci: 'c3e5' }))
      .json as { status: string };
    expect(res.status).toBe('solved');
    await app.close();
  });
});
