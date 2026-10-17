import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'coach',
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
