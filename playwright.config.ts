import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 3,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4187',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1080 } },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 1080 } },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 1080 } },
    },
  ],
  webServer: {
    env: { OPENAI_API_KEY: '' },
    command: 'node scripts/serve.mjs --port 4187',
    url: 'http://127.0.0.1:4187',
    reuseExistingServer: false,
    timeout: 15000,
  },
});
