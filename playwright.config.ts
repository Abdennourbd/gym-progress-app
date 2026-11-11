import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:3210',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        // The iPhone descriptor defaults to WebKit; Chromium is what is
        // installed here and it renders the same layout.
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'npm run start -- --port 3210',
    port: 3210,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
