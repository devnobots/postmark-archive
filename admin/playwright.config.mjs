// Standard Gauge back office tests: run against the dev server in local mode (no accounts).
// npm --prefix admin test
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/baseline/{arg}{ext}',   // C7 test 8 compares the site against these
  use: { baseURL: 'http://localhost:5173', ...devices['Desktop Chrome'] },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'npm run dev',
    cwd: '..',
    port: 5173,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
