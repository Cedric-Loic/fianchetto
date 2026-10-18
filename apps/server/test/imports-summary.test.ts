import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterAll, describe, expect, it } from 'vitest';
import type { GameReview, ImportedGamesResponse } from '@sq/shared';
import { GameStore } from '../src/persistence/db.js';
import { testServer } from './client.js';

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

const PGN = `[White "cedric"]
[Black "rival"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0

[White "autre"]
[Black "cedric"]
[Result "*"]

1. d4 d5 *
`;

const counts = (inaccuracy: number, mistake: number, blunder: number) => ({
  best: 1,
  excellent: 1,
  good: 1,
  inaccuracy,
  mistake,
  blunder,
});

/** Revue minimale : seuls la précision et les comptes servent à la liste. */
const review = (accuracy: number, c: ReturnType<typeof counts>) =>
  ({
    positions: [],
    evals: [],
    moves: [],
    accuracy: { w: accuracy, b: 50 },
    counts: { w: c, b: counts(9, 9, 9) },
  }) as unknown as GameReview;

describe('liste des parties importées : statistiques résumées', () => {
  it('migration des anciennes revues, statistiques lues dans la colonne', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sq-imports-'));
    dirs.push(dir);
    const dbPath = join(dir, 'base.db');
    const login = { username: 'cedric', password: 'motdepasse' };

    let server = await testServer({ dbPath });
    await server.http('POST', '/api/auth/register', login);
    await server.http('POST', '/api/imports/pgn', { pgn: PGN });
    let { games } = (await server.http('GET', '/api/imports')).json as ImportedGamesResponse;
    const mate = games.find((g) => g.plies === 7);
    const other = games.find((g) => g.plies === 2);
    if (!mate || !other) throw new Error('import');
    await server.app.close();

    // Base d'avant la migration : pas de colonne `summary`, une revue enregistrée.
    const raw = new Database(dbPath);
    raw.exec(`ALTER TABLE reviews DROP COLUMN summary`);
    raw
      .prepare(`INSERT INTO reviews (game_id, review, created_at) VALUES (?, ?, ?)`)
      .run(mate.id, JSON.stringify(review(77.5, counts(2, 1, 0))), Date.now());
    raw.close();

    server = await testServer({ dbPath });
    await server.http('POST', '/api/auth/login', login);
    ({ games } = (await server.http('GET', '/api/imports')).json as ImportedGamesResponse);
    expect(games.find((g) => g.id === mate.id)).toMatchObject({
      review: 'done',
      userColor: 'w',
      stats: { accuracy: 77.5, inaccuracy: 2, mistake: 1, blunder: 0 },
    });
    expect(games.find((g) => g.id === other.id)).toMatchObject({ review: 'none', stats: null });

    // La liste lit la colonne résumée, pas la revue complète.
    const db = new Database(dbPath);
    const stored = db.prepare(`SELECT summary FROM reviews WHERE game_id = ?`).get(mate.id) as {
      summary: string;
    };
    expect(JSON.parse(stored.summary)).toEqual({
      accuracy: { w: 77.5, b: 50 },
      counts: {
        w: { inaccuracy: 2, mistake: 1, blunder: 0 },
        b: { inaccuracy: 9, mistake: 9, blunder: 9 },
      },
    });
    db.prepare(`UPDATE reviews SET summary = ? WHERE game_id = ?`).run(
      JSON.stringify({
        accuracy: { w: 12, b: 50 },
        counts: { w: { inaccuracy: 0, mistake: 0, blunder: 7 }, b: counts(0, 0, 0) },
      }),
      mate.id,
    );
    db.close();
    ({ games } = (await server.http('GET', '/api/imports')).json as ImportedGamesResponse);
    expect(games.find((g) => g.id === mate.id)?.stats).toEqual({
      accuracy: 12,
      inaccuracy: 0,
      mistake: 0,
      blunder: 7,
    });

    // Une nouvelle revue enregistre aussitôt son résumé (camp de l'utilisateur : Noirs).
    const store = new GameStore(dbPath, { initialRating: 1200 });
    store.saveReview(other.id, review(60, counts(1, 0, 0)));
    store.close();
    ({ games } = (await server.http('GET', '/api/imports')).json as ImportedGamesResponse);
    expect(games.find((g) => g.id === other.id)).toMatchObject({
      review: 'done',
      userColor: 'b',
      stats: { accuracy: 50, inaccuracy: 9, mistake: 9, blunder: 9 },
    });
    await server.app.close();
  });
});
