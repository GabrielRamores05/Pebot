import { defineConfig } from '@playwright/test';

// End-to-end checks against a running, activated Pebot. See tests/e2e/.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: process.env.PEBOT_URL ?? 'http://localhost:3000' },
});
