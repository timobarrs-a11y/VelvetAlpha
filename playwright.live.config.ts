import { defineConfig } from '@playwright/test';

// End-to-end tests for the live game (Velvet Sims), run against the dev server.
// The older config (playwright.config.ts) covers only the legacy page.
//
//   npm run test:live
//
// Set PW_CHROMIUM_PATH to use a specific browser binary.
const PORT = 5188;

export default defineConfig({
  testDir: './e2e/velvet-sims',
  outputDir: './e2e/velvet-sims/test-results',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
    launchOptions: {
      executablePath: process.env.PW_CHROMIUM_PATH || undefined,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    },
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/games/velvet-house-next/index.html`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
