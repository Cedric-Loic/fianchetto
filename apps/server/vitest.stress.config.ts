import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'server-stress',
    include: ['test/**/*.stress.ts'],
    environment: 'node',
    testTimeout: 10 * 60_000,
  },
});
