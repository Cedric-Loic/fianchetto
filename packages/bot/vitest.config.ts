import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'bot',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // Les tests du bot lancent Stockfish : marge pour les machines lentes.
    testTimeout: 60_000,
  },
});
