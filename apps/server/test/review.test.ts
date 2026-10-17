import { describe, expect, it } from 'vitest';
import type { ImportedGamesResponse, ImportResult, ReviewResponse } from '@sq/shared';
import type { JsonFetcher } from '../src/review/chesscom.js';
import { testServer } from './client.js';

const PGN = `[Event "Live Chess"]
[Site "Chess.com"]
[Date "2026.10.01"]
[White "cedric_cc"]
[Black "rival"]
[Result "0-1"]
[WhiteElo "1000"]
[BlackElo "1010"]
[TimeControl "180+2"]

1. f3 e5 2. g4 Qh4# 0-1

[Event "Deuxième"]
[Date "2026.10.02"]
[White "rival"]
[Black "cedric_cc"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0

[Event "Cassée"]

1. e4 e9 *
`;

/** Faux serveur chess.com : deux archives mensuelles, une partie de variante à ignorer. */
function fakeChessCom(): { fetcher: JsonFetcher; calls: string[] } {
  const calls: string[] = [];
  const base = 'https://api.chess.com/pub/player/cedric_cc/games';
  const game = (n: number, rules = 'chess') => ({
    url: `https://www.chess.com/game/live/${n}`,
    rules,
    pgn: `[Event "Live"]\n[White "cedric_cc"]\n[Black "x${n}"]\n[Result "*"]\n\n1. d4 d5 2. c4 *`,
  });
  const routes: Record<string, unknown> = {
    [`${base}/archives`]: { archives: [`${base}/2026/09`, `${base}/2026/10`] },
    [`${base}/2026/09`]: { games: [game(1), game(2)] },
    [`${base}/2026/10`]: { games: [game(3), game(4, 'chess960'), game(5)] },
  };
  const fetcher: JsonFetcher = (url) => {
    calls.push(url);
    if (url.includes('inconnu'))
      return Promise.resolve({ status: 404, json: () => Promise.resolve({}) });
    if (url.includes('panne')) return Promise.reject(new Error('réseau'));
    const body = routes[url];
    return Promise.resolve({ status: body ? 200 : 500, json: () => Promise.resolve(body ?? {}) });
  };
  return { fetcher, calls };
}

describe('import et revue de parties', () => {
  it('PGN : plusieurs parties, doublons, parties illisibles, camp de l’utilisateur', async () => {
    const { app, http, review } = await testServer();
    expect((await http('POST', '/api/imports/pgn', { pgn: PGN })).status).toBe(401);
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });

    const first = (await http('POST', '/api/imports/pgn', { pgn: PGN, as: 'cedric_cc' }))
      .json as ImportResult;
    expect(first).toEqual({ imported: 2, duplicates: 0, invalid: 1 });
    const again = (await http('POST', '/api/imports/pgn', { pgn: PGN, as: 'cedric_cc' }))
      .json as ImportResult;
    expect(again).toEqual({ imported: 0, duplicates: 2, invalid: 1 });

    let list = (await http('GET', '/api/imports')).json as ImportedGamesResponse;
    expect(list.games.map((g) => [g.date, g.userColor, g.plies])).toEqual([
      ['2026-10-02', 'b', 7],
      ['2026-10-01', 'w', 4],
    ]);
    expect(list.games[1]).toMatchObject({ whiteElo: 1000, timeControl: '180+2', review: 'none' });

    // Revue d'une partie importée : informations et explications.
    const id = list.games[1]?.id ?? '';
    const r = await review(id);
    expect(r.moves[2]?.explanation?.kind).toBe('allowed-mate');
    const info = ((await http('GET', `/api/reviews/${id}`)).json as ReviewResponse).info;
    expect(info).toMatchObject({ source: 'pgn', white: 'cedric_cc', userColor: 'w' });

    // Analyse par lot : la seconde partie ; statistiques du camp de l'utilisateur.
    expect((await http('POST', '/api/imports/review-all')).json).toEqual({ queued: 1 });
    await review(list.games[0]?.id ?? '');
    list = (await http('GET', '/api/imports')).json as ImportedGamesResponse;
    expect(list.games.every((g) => g.review === 'done')).toBe(true);
    expect(list.games[1]?.stats?.blunder).toBeGreaterThanOrEqual(1);

    expect((await http('DELETE', `/api/imports/${id}`)).status).toBe(200);
    expect((await http('GET', `/api/reviews/${id}`)).status).toBe(404);
    expect((await http('DELETE', `/api/imports/${id}`)).status).toBe(404);
    await app.close();
  }, 60_000);

  it('les parties importées d’un compte sont invisibles pour un autre', async () => {
    const owner = await testServer();
    await owner.http('POST', '/api/auth/register', { username: 'proprio', password: 'motdepasse' });
    await owner.http('POST', '/api/imports/pgn', { pgn: PGN });
    const id =
      ((await owner.http('GET', '/api/imports')).json as ImportedGamesResponse).games[0]?.id ?? '';
    // Second client sur le même serveur, autre compte.
    const port = (owner.app.server.address() as { port: number }).port;
    const reg = await fetch(`http://127.0.0.1:${port}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'intrus', password: 'motdepasse' }),
    });
    const cookie = (reg.headers.get('set-cookie') ?? '').split(';')[0] ?? '';
    for (const method of ['GET', 'POST', 'DELETE']) {
      const path = method === 'DELETE' ? `/api/imports/${id}` : `/api/reviews/${id}`;
      const res = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { cookie } });
      expect(res.status, method).toBe(404);
    }
    await owner.app.close();
  });

  it('chess.com : parties récentes, variantes ignorées, erreurs', async () => {
    const { fetcher, calls } = fakeChessCom();
    const { app, http } = await testServer({ chessComFetcher: fetcher });
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });

    const res = (await http('POST', '/api/imports/chesscom', { username: 'Cedric_CC', max: 3 }))
      .json as ImportResult;
    expect(res).toEqual({ imported: 3, duplicates: 0, invalid: 0 });
    // Archive la plus récente d'abord ; on s'arrête dès que le compte est atteint.
    expect(calls).toHaveLength(3);
    const list = (await http('GET', '/api/imports')).json as ImportedGamesResponse;
    expect(list.games.map((g) => g.url).sort()).toEqual([
      'https://www.chess.com/game/live/2',
      'https://www.chess.com/game/live/3',
      'https://www.chess.com/game/live/5',
    ]);
    expect(list.games.every((g) => g.source === 'chesscom' && g.userColor === 'w')).toBe(true);

    const again = (await http('POST', '/api/imports/chesscom', { username: 'cedric_cc', max: 3 }))
      .json as ImportResult;
    expect(again.duplicates).toBe(3);
    expect(
      (await http('POST', '/api/imports/chesscom', { username: 'inconnu', max: 5 })).status,
    ).toBe(404);
    expect(
      (await http('POST', '/api/imports/chesscom', { username: 'panne', max: 5 })).status,
    ).toBe(502);
    expect((await http('POST', '/api/imports/chesscom', { username: 'a b', max: 5 })).status).toBe(
      400,
    );
    await app.close();
  });
});
