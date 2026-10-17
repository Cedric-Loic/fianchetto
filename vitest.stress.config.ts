import { defineConfig } from 'vitest/config';

// Tests longs (`*.stress.ts`), hors de `pnpm check` : `pnpm test:stress`.
export default defineConfig({
  test: {
    projects: ['packages/engine/vitest.stress.config.ts', 'tests/security/vitest.stress.config.ts'],
    passWithNoTests: true,
  },
});
