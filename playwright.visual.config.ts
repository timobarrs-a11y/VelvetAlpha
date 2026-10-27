import { defineConfig } from '@playwright/test';

// Golden screenshots of the live game (Velvet Sims): each floor by day and night, and the drawer open.
// The pictures depend on the machine's fonts and rendering, so they are kept for the environment that made
// them (Linux, the bundled Chromium) and are not part of `npm run test:live`.
//
//   npm run test:visual            compare with the pictures in e2e/velvet-sims/visual/__screenshots__
//   npm run test:visual -- --update-snapshots    replace them after a change to the look you meant to make
const PORT = 5188;

export default defineConfig({
  testDir: './e2e/velvet-sims/visual',
  outputDir: './e2e/velvet-sims/test-results',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  timeout: 60_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.003, animations: 'disabled' } },
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
