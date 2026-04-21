import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['integration/**/*.test.{js,mjs,ts}'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
