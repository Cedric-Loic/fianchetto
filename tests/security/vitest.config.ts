import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'security',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'e2e/**'],
    environment: 'node',
    // Tests de propriétés coûteux en CPU : marge pour les machines chargées.
    testTimeout: 60_000,
  },
});
