import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/velvet-house',
  outputDir: './e2e/velvet-house/test-results',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    launchOptions: {
      executablePath: '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    },
    headless: true,
    screenshot: 'off',
    trace: 'off',
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'iphone-12',
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'pixel-8',
      use: {
        viewport: { width: 412, height: 915 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
