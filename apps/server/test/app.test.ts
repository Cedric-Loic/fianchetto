import { describe, expect, it } from 'vitest';
import { buildServer, startServer } from '../src/app.js';

describe('serveur (squelette)', () => {
  it('répond sur /api/health', async () => {
    const app = buildServer({ logLevel: 'silent' });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
    await app.close();
  });

  it("n'écoute que sur 127.0.0.1", async () => {
    const app = await startServer(0, { logLevel: 'silent' });
    const address = app.server.address();
    expect(typeof address === 'object' && address !== null ? address.address : address).toBe(
      '127.0.0.1',
    );
    await app.close();
  });
});
