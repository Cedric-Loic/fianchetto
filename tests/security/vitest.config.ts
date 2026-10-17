import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'security',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'e2e/**'],
    environment: 'node',
  },
});
