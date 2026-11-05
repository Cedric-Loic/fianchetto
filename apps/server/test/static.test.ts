import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildServer } from '../src/app.js';

const root = mkdtempSync(join(tmpdir(), 'sq-web-'));
mkdirSync(join(root, 'assets'));
writeFileSync(join(root, 'index.html'), '<!doctype html><title>Fianchetto</title>');
writeFileSync(join(root, 'assets', 'index-abc123.js'), 'console.log(1)');
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('mode production : site compilé servi par le serveur', () => {
  it('index.html revalidé, fichiers à empreinte en cache long, API inchangée', async () => {
    const app = buildServer({ logLevel: 'silent', dbPath: ':memory:', webRoot: root });
    const index = await app.inject({ method: 'GET', url: '/' });
    expect(index.statusCode).toBe(200);
    expect(index.headers['content-type']).toContain('text/html');
    expect(index.headers['cache-control']).toBe('no-cache');
    const asset = await app.inject({ method: 'GET', url: '/assets/index-abc123.js' });
    expect(asset.statusCode).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect((await app.inject({ method: 'GET', url: '/api/auth/me' })).statusCode).toBe(401);
    // Rien hors du dossier du site.
    expect((await app.inject({ method: 'GET', url: '/../package.json' })).statusCode).toBe(404);
    await app.close();
  });

  it('sans dossier du site (pnpm dev) : aucune page servie', async () => {
    const app = buildServer({ logLevel: 'silent', dbPath: ':memory:' });
    expect((await app.inject({ method: 'GET', url: '/' })).statusCode).toBe(404);
    await app.close();
  });
});
