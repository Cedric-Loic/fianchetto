import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'engine',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Tests de propriétés coûteux en CPU : marge pour les machines chargées.
    testTimeout: 60_000,
  },
});
