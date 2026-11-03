import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'engine-stress',
    include: ['test/**/*.stress.ts'],
    environment: 'node',
    testTimeout: 30 * 60_000,
  },
});
