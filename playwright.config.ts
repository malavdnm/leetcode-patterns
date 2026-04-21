import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    // Shorter debounce so tests exercising the save path finish quickly.
    // If you're reusing an existing dev server, restart it with this env
    // set for the sync-signed-in spec to run fast.
    env: { VITE_SYNC_DEBOUNCE_MS: '500' },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
