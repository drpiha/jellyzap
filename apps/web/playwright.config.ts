import { defineConfig, devices } from '@playwright/test';

const PORT = 4321;
const BASE = `http://localhost:${PORT}`;

// Note: the site must be built first (`pnpm build`). CI runs the build step
// before `pnpm e2e`; locally run `pnpm build && pnpm e2e`.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `pnpm exec astro preview --port ${PORT}`,
    url: `${BASE}/en/`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
