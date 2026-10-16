import { test, expect, type Page, devices } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GAME_PATH = join(process.cwd(), 'public/games/velvet-house/index.html');
const initScript = readFileSync(join(process.cwd(), 'e2e/velvet-house/deterministic.ts'), 'utf-8')
  .replace(/^\/\*\*[\s\S]*?\*\//, '')
  .replace(/^import.*$/gm, '');

// Emulated device configs using Playwright's built-in device presets.
// Real-device numbers must come from an actual phone — these are emulated.
const EMULATED_DEVICES = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, device: null as null },
  { name: 'iphone-12', viewport: { width: 390, height: 664 }, device: devices['iPhone 12'] },
  { name: 'pixel-7', viewport: { width: 412, height: 839 }, device: devices['Pixel 7'] },
];

async function captureFrameTrace(
  page: Page,
  deviceConfig: typeof EMULATED_DEVICES[number],
  scene: 'day' | 'night',
): Promise<Record<string, unknown>> {
  // Apply full device emulation (DPR, touch, user agent, viewport)
  if (deviceConfig.device) {
    await page.context().clearCookies();
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: deviceConfig.viewport.width,
      height: deviceConfig.viewport.height,
      deviceScaleFactor: deviceConfig.device.deviceScaleFactor ?? 1,
      mobile: true,
      screenWidth: deviceConfig.viewport.width,
      screenHeight: deviceConfig.viewport.height,
    });
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  } else {
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  }

  await page.setViewportSize(deviceConfig.viewport);
  await page.addInitScript(initScript);
  await page.goto('file://' + GAME_PATH + '?companion=test-trace');
  await page.waitForFunction(() => !!(window as any).__velvet, { timeout: 15_000 });

  await page.evaluate(() => {
    const form = document.getElementById('setupForm') as HTMLFormElement;
    const suName = document.getElementById('suName') as HTMLInputElement;
    if (suName) suName.value = 'Sam';
    const form2 = document.getElementById('setupForm') as HTMLFormElement;
    if (form2) form2.requestSubmit();
  });
  await page.waitForTimeout(2000);
  await page.evaluate((m) => { (window as any).__velvet.minutes = m; }, scene === 'night' ? 1320 : 600);
  await page.waitForTimeout(8000);

  const canvasInfo = await page.evaluate(() => {
    const cv = document.getElementById('room') as HTMLCanvasElement;
    return {
      dpr: window.devicePixelRatio || 1,
      clientWidth: cv.clientWidth,
      clientHeight: cv.clientHeight,
      canvasWidth: cv.width,
      canvasHeight: cv.height,
      canvasPixels: cv.width * cv.height,
    };
  });

  const trace = await page.evaluate(() => {
    return new Promise<number[]>((resolve) => {
      const times: number[] = [];
      let last = performance.now();
      let frames = 0;
      const maxFrames = 180;
      const tick = () => {
        const now = performance.now();
        const dt = now - last;
        last = now;
        if (frames > 5) times.push(dt);
        frames++;
        if (frames < maxFrames) {
          requestAnimationFrame(tick);
        } else {
          resolve(times);
        }
      };
      requestAnimationFrame(tick);
    });
  });

  const avg = trace.reduce((a, b) => a + b, 0) / trace.length;
  const max = Math.max(...trace);
  const min = Math.min(...trace);
  const p95 = trace.sort((a, b) => a - b)[Math.floor(trace.length * 0.95)];
  const fps = 1000 / avg;

  return {
    device: deviceConfig.name,
    scene,
    emulated: true,
    viewport: deviceConfig.viewport,
    dpr: deviceConfig.device?.deviceScaleFactor ?? 1,
    cpuThrottling: '4x',
    samples: trace.length,
    avgFrameMs: Math.round(avg * 100) / 100,
    minFrameMs: Math.round(min * 100) / 100,
    maxFrameMs: Math.round(max * 100) / 100,
    p95FrameMs: Math.round(p95 * 100) / 100,
    avgFps: Math.round(fps * 10) / 10,
    canvas: canvasInfo,
  };
}

test.describe('Baseline frame-time traces (emulated)', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'desktop-only — handles all devices internally');
  test.setTimeout(240_000);

  test('desktop, iPhone 12 (emulated), Pixel 7 (emulated) — 4× CPU throttle', async ({ page }) => {
    const results: Record<string, unknown>[] = [];

    for (const scene of ['day', 'night'] as const) {
      for (const dev of EMULATED_DEVICES) {
        results.push(await captureFrameTrace(page, dev, scene));
      }
    }

    const dir = join(process.cwd(), 'e2e/velvet-house');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'frame-time-traces.json'), JSON.stringify(results, null, 2));

    expect(results.length).toBe(6);
    for (const r of results) {
      expect(r.samples).toBeGreaterThan(100);
      expect(r.avgFps).toBeGreaterThan(0);
    }
  });
});
