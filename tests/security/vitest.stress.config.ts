import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'security-stress',
    include: ['**/*.stress.ts'],
    exclude: ['node_modules/**', 'e2e/**'],
    environment: 'node',
    testTimeout: 30 * 60_000,
  },
});
