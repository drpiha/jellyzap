import { defineWorkspace } from 'vitest/config';

// Aggregates every package that ships unit tests. Game logic is pure and runs in
// the default (node) environment; SDK helpers that touch the DOM opt into jsdom.
export default defineWorkspace([
  {
    test: {
      name: 'games',
      include: ['packages/games/*/src/**/*.test.ts'],
      environment: 'node',
    },
  },
  {
    test: {
      name: 'sdk',
      include: ['packages/game-sdk/src/**/*.test.ts'],
      environment: 'jsdom',
    },
  },
]);
