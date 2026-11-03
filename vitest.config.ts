import { defineConfig } from 'vitest/config';

// Chaque paquet déclare son propre projet Vitest (vitest.config.ts local).
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*', 'tests/security', 'tools/eslint-plugin-secret'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['packages/engine/src/**/*.ts'],
      reporter: ['text-summary', 'text'],
      // Porte de l'étape 1 : la projection (seule source de ce que voit un joueur) est
      // couverte à 100 %.
      thresholds: {
        'packages/engine/src/**/projection*.ts': {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  },
});
