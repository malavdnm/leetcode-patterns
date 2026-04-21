import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // e2e/ is Playwright; integration/ hits real services and runs via
    // `npm run test:integration` instead.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'integration/**'],
  },
});
