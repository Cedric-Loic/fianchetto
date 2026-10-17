import { defineConfig } from 'vitest/config';

// Chaque paquet déclare son propre projet Vitest (vitest.config.ts local).
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*', 'tests/security', 'tools/eslint-plugin-secret'],
    passWithNoTests: true,
  },
});
