import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'lint-rules',
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
