import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/*
 * Bundle JS de production (ce que reçoit le navigateur) : il ne doit contenir ni le moteur de
 * règles, ni le bot, ni Stockfish, ni le type Secret. Sans moteur, le client ne peut rien
 * recalculer : il n'affiche que la vue envoyée par le serveur.
 *
 * Exception (DECISIONS.md, étape 12) : chess.js est admis pour l'exploration de positions
 * publiques (Revue, Analyse), uniquement dans `apps/web/src/analysis/tree.ts`, chargé à la
 * demande. Il ne doit jamais se trouver dans le chunk d'entrée, ni dans ses dépendances
 * statiques, ni dans le code de l'écran de partie.
 */
const WEB = fileURLToPath(new URL('../../apps/web/', import.meta.url));
const SRC = join(WEB, 'src');
const out = mkdtempSync(join(tmpdir(), 'sq-bundle-'));
afterAll(() => rmSync(out, { recursive: true, force: true }));

/** Messages d'erreur propres à chess.js (validation de FEN). */
const CHESSJS_MARKERS = ['Invalid FEN', 'must contain six space-delimited fields'];
/** data-testid présents uniquement dans `screens/GameScreen.tsx`. */
const GAMESCREEN_MARKERS = ['focus-button', 'training-panel'];

/** Fichiers produits, indexés par chemin relatif au dossier de sortie (`assets/x.js`). */
let files = new Map<string, string>();

function build(): Map<string, string> {
  // Binaire de Vite : le dossier du paquet est déduit de son package.json.
  const pkg = createRequire(join(WEB, 'package.json')).resolve('vite/package.json');
  const vite = join(pkg, '..', 'bin', 'vite.js');
  execFileSync(process.execPath, [vite, 'build', '--outDir', out, '--logLevel', 'error'], {
    cwd: WEB,
  });
  const result = new Map<string, string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, e.name);
      if (e.isDirectory()) walk(path);
      else if (/\.(js|html|css)$/.test(e.name))
        result.set(relative(out, path).split('\\').join('/'), readFileSync(path, 'utf8'));
    }
  };
  walk(out);
  return result;
}

const hasChessJs = (code: string) => CHESSJS_MARKERS.some((m) => code.includes(m));
const jsChunks = () => [...files.keys()].filter((f) => f.endsWith('.js'));

/*
 * Imports statiques d'un chunk : `import{…}from"./x.js"` ou `import"./x.js"`. Les imports
 * dynamiques (`import(\`./x.js\`)`) sont exclus : ce sont précisément les chunks à la demande.
 */
function staticImports(chunk: string): string[] {
  const code = files.get(chunk) ?? '';
  const dir = chunk.includes('/') ? chunk.slice(0, chunk.lastIndexOf('/') + 1) : '';
  const found: string[] = [];
  for (const m of code.matchAll(/(?:\bfrom|\bimport)\s*["']\.\/([^"']+\.js)["']/g))
    found.push(dir + m[1]);
  return found;
}

/** Fermeture des imports statiques depuis des chunks de départ (inclus). */
function staticClosure(roots: string[]): Set<string> {
  const seen = new Set<string>();
  const stack = [...roots];
  while (stack.length > 0) {
    const c = stack.pop() as string;
    if (seen.has(c)) continue;
    seen.add(c);
    for (const dep of staticImports(c)) stack.push(dep);
  }
  return seen;
}

/** Chunks chargés d'emblée par index.html : script d'entrée et modulepreload. */
function entryChunks(): string[] {
  const html = files.get('index.html') ?? '';
  const refs = [...html.matchAll(/(?:src|href)="\/([^"]+\.js)"/g)].map((m) => m[1] as string);
  return refs;
}

describe('bundle de production du client', () => {
  beforeAll(() => {
    files = build();
  }, 120_000);

  it('ne contient ni moteur, ni bot, ni Secret, ni Stockfish, ni source map', () => {
    const bundle = [...files.values()].join('\n');
    expect(bundle.length).toBeGreaterThan(10_000);
    const forbidden = [
      'nodejs.util.inspect.custom', // classe Secret<T>
      '[REDACTED]',
      'Spectateur invalide', // projection du moteur
      'Partie persistée invalide', // moteur
      'stockfish',
      'secret_state', // colonne SQLite
      'sourceMappingURL',
    ];
    for (const marker of forbidden) expect(bundle, marker).not.toContain(marker);
  });

  it("chess.js n'est ni dans le chunk d'entrée ni dans ses dépendances statiques", () => {
    const entry = entryChunks();
    expect(entry.length, "index.html doit référencer un chunk d'entrée").toBeGreaterThan(0);
    for (const c of entry) expect(files.has(c), c).toBe(true);
    for (const c of staticClosure(entry)) expect(hasChessJs(files.get(c) ?? ''), c).toBe(false);
  });

  it("chess.js n'est dans aucun chunk de l'écran de partie (ni ses imports statiques)", () => {
    const game = jsChunks().filter((c) =>
      GAMESCREEN_MARKERS.every((m) => (files.get(c) ?? '').includes(m)),
    );
    // Marqueurs encore valides : sinon le contrôle passerait à vide.
    expect(game.length, 'chunk de GameScreen introuvable').toBeGreaterThan(0);
    for (const c of staticClosure(game)) expect(hasChessJs(files.get(c) ?? ''), c).toBe(false);
  });

  it('chess.js ne se trouve que dans des chunks chargés dynamiquement', () => {
    const withChess = jsChunks().filter((c) => hasChessJs(files.get(c) ?? ''));
    // Marqueurs encore valides : chess.js doit être présent (Revue, Analyse).
    expect(withChess.length, 'marqueurs chess.js introuvables').toBeGreaterThan(0);
    const eager = staticClosure(entryChunks());
    const dynamic = new Set<string>();
    for (const c of jsChunks()) {
      const code = files.get(c) ?? '';
      const dir = c.slice(0, c.lastIndexOf('/') + 1);
      for (const m of code.matchAll(/import\(\s*[`"']\.\/([^`"']+\.js)[`"']\s*\)/g))
        dynamic.add(dir + m[1]);
    }
    expect(dynamic.size, 'aucun import dynamique détecté').toBeGreaterThan(0);
    // Chunks atteignables seulement via un import dynamique (et leurs dépendances statiques).
    const lazyReachable = staticClosure([...dynamic]);
    for (const c of withChess) {
      expect(eager.has(c), `${c} chargé d'emblée`).toBe(false);
      expect(lazyReachable.has(c), `${c} non rattaché à un import dynamique`).toBe(true);
    }
  });
});

describe('sources du client', () => {
  it('seul analysis/tree.ts importe chess.js', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, e.name);
        if (e.isDirectory()) walk(path);
        else if (/\.(ts|tsx|js|jsx|mts|cts)$/.test(e.name)) {
          const rel = relative(SRC, path).split('\\').join('/');
          if (rel === 'analysis/tree.ts') continue;
          const code = readFileSync(path, 'utf8');
          // import … from 'chess.js', import 'chess.js', import('chess.js'), require('chess.js')
          if (/(?:\bfrom|\bimport|\brequire)\s*\(?\s*["'`]chess\.js(?:\/[^"'`]*)?["'`]/.test(code))
            offenders.push(rel);
        }
      }
    };
    walk(SRC);
    expect(offenders).toEqual([]);
    // Le module autorisé l'importe bien (sinon le test serait vide de sens).
    expect(readFileSync(join(SRC, 'analysis/tree.ts'), 'utf8')).toMatch(/from\s*['"]chess\.js['"]/);
  });
});
