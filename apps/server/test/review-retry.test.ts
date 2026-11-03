import { describe, expect, it } from 'vitest';
import type { ImportedGamesResponse, RetryMoveResponse } from '@sq/shared';
import { testServer } from './client.js';

const PGN = `[Event "Mat du lion"]
[White "cedric"]
[Black "rival"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1

[Event "Sans revue"]
[White "cedric"]
[Black "rival"]
[Result "*"]

1. d4 d5 *
`;

describe('apprends de tes erreurs', () => {
  it('best / good / wrong / illégal / revue absente', async () => {
    const { app, http, review } = await testServer();
    await http('POST', '/api/auth/register', { username: 'cedric', password: 'motdepasse' });
    await http('POST', '/api/imports/pgn', { pgn: PGN });
    const { games } = (await http('GET', '/api/imports')).json as ImportedGamesResponse;
    const mate = games.find((g) => g.plies === 4)?.id ?? '';
    const unreviewed = games.find((g) => g.plies === 2)?.id ?? '';
    const r = await review(mate);
    const retry = (id: string, body: object) => http('POST', `/api/reviews/${id}/retry`, body);

    // Demi-coup 4 : les Noirs ont un mat en 1 (Qh4#).
    const best = await retry(mate, { ply: 4, uci: 'd8h4' });
    expect(best.status).toBe(200);
    expect(best.json).toEqual({
      verdict: 'best',
      san: 'Qh4#',
      fen: r.positions[4] ?? '',
      line: [],
    } satisfies RetryMoveResponse);

    // Un coup qui laisse passer le mat : faux, avec une réfutation du point de vue blanc.
    const wrong = (await retry(mate, { ply: 4, uci: 'b8c6' })).json as RetryMoveResponse;
    expect(wrong.verdict).toBe('wrong');
    expect(wrong.san).toBe('Nc6');
    expect(wrong.line.length).toBeGreaterThan(0);
    expect(wrong.line.length).toBeLessThanOrEqual(8);

    // Premier coup : un coup d'ouverture sain, autre que celui du moteur, est « bon ».
    const engineFirst = r.evals[0]?.bestMoveUci;
    const alternative = ['e2e4', 'd2d4', 'g1f3', 'c2c4'].find((m) => m !== engineFirst) ?? '';
    const good = (await retry(mate, { ply: 1, uci: alternative })).json as RetryMoveResponse;
    expect(good.verdict).toBe('good');

    expect((await retry(mate, { ply: 4, uci: 'e2e4' })).status).toBe(400);
    expect((await retry(mate, { ply: 5, uci: 'e1f2' })).status).toBe(400);
    expect((await retry(mate, { ply: 4 })).status).toBe(400);
    expect((await retry('inconnue', { ply: 1, uci: 'e2e4' })).status).toBe(404);
    expect((await retry(unreviewed, { ply: 1, uci: 'e2e4' })).status).toBe(409);
    await app.close();
  }, 60_000);

  it('partie Secret Queen en cours : refus', async () => {
    const { app, http } = await testServer();
    const { gameId } = (
      await http('POST', '/api/games', {
        mode: 'hotseat',
        variant: 'secret-queen',
        timeControl: 'untimed',
        whiteName: 'A',
        blackName: 'B',
      })
    ).json as { gameId: string };
    expect(
      (await http('POST', `/api/reviews/${gameId}/retry`, { ply: 1, uci: 'e2e4' })).status,
    ).toBe(409);
    await app.close();
  });
});
