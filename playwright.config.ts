import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90000,
  workers: 1,
  use: {
    ...devices['Pixel 7'],
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4322',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4322/scriptorium/comparateur',
    env: { HOST: '127.0.0.1', PORT: '4322' },
    reuseExistingServer: !process.env.CI,
  },
});
