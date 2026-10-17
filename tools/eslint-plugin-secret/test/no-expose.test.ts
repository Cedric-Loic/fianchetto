import { fileURLToPath } from 'node:url';
import { ESLint, Linter } from 'eslint';
import { describe, expect, it } from 'vitest';
import secret from '../index.js';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('règle secret/no-expose', () => {
  const linter = new Linter({ configType: 'flat' });
  const lint = (code: string) =>
    linter.verify(code, {
      plugins: { secret },
      rules: { 'secret/no-expose': 'error' },
    });

  it('signale un appel à expose()', () => {
    expect(lint('const v = s.expose();')).toHaveLength(1);
    expect(lint("const v = s['expose']();")).toHaveLength(1);
  });

  it("n'interfère pas avec le reste", () => {
    expect(lint('const v = s.exposeLater(); JSON.stringify(s);')).toHaveLength(0);
  });
});

describe('configuration ESLint du projet', () => {
  const eslint = new ESLint({ cwd: ROOT });
  const ruleFor = async (file: string, rule: string): Promise<unknown> => {
    const config = (await eslint.calculateConfigForFile(file)) as {
      rules?: Record<string, unknown>;
    };
    return config.rules?.[rule];
  };

  it('expose() interdit dans le serveur hors persistance, autorisé dans la persistance', async () => {
    expect(await ruleFor('apps/server/src/game.ts', 'secret/no-expose')).toEqual([2]);
    expect(await ruleFor('apps/server/src/persistence/db.ts', 'secret/no-expose')).toEqual([0]);
    expect(await ruleFor('packages/engine/src/internal/real.ts', 'secret/no-expose')).toEqual([0]);
    expect(await ruleFor('packages/engine/src/projection.ts', 'secret/no-expose')).toEqual([2]);
  });

  it('le web ne peut importer ni Secret, ni moteur, ni bot', async () => {
    const rule = JSON.stringify(await ruleFor('apps/web/src/App.tsx', 'no-restricted-imports'));
    for (const forbidden of ['@sq/shared/secret', '@sq/engine', '@sq/bot', 'chess.js']) {
      expect(rule).toContain(forbidden);
    }
  });

  it('console interdit partout dans le code de production', async () => {
    for (const file of [
      'apps/web/src/App.tsx',
      'apps/server/src/app.ts',
      'packages/engine/src/index.ts',
    ]) {
      expect((await ruleFor(file, 'no-console')) as unknown[]).toContain(2);
    }
  });
});
