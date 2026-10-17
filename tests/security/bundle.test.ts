import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

/*
 * Bundle JS de production (ce que reçoit le navigateur) : il ne doit contenir ni le moteur de
 * règles, ni le bot, ni Stockfish, ni le type Secret. Sans moteur, le client ne peut rien
 * recalculer : il n'affiche que la vue envoyée par le serveur.
 */
const WEB = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const out = mkdtempSync(join(tmpdir(), 'sq-bundle-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

function buildAndRead(): string {
  // Binaire de Vite : le dossier du paquet est déduit de son package.json.
  const pkg = createRequire(join(WEB, 'package.json')).resolve('vite/package.json');
  const vite = join(pkg, '..', 'bin', 'vite.js');
  execFileSync(process.execPath, [vite, 'build', '--outDir', out, '--logLevel', 'error'], {
    cwd: WEB,
  });
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name));
      else if (/\.(js|html|css)$/.test(e.name)) files.push(readFileSync(join(dir, e.name), 'utf8'));
    }
  };
  walk(out);
  return files.join('\n');
}

describe('bundle de production du client', () => {
  it('ne contient ni moteur, ni bot, ni Secret, ni Stockfish, ni source map', () => {
    const bundle = buildAndRead();
    expect(bundle.length).toBeGreaterThan(10_000);
    const forbidden = [
      'nodejs.util.inspect.custom', // classe Secret<T>
      '[REDACTED]',
      'Spectateur invalide', // projection du moteur
      'Partie persistée invalide', // moteur
      'Invalid FEN', // chess.js
      'stockfish',
      'secret_state', // colonne SQLite
      'sourceMappingURL',
    ];
    for (const marker of forbidden) expect(bundle, marker).not.toContain(marker);
  }, 120_000);
});
