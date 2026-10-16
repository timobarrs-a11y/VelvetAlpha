import { test, expect, type Page } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const GAME_PATH = join(process.cwd(), 'public/games/velvet-house/index.html');
const initScript = readFileSync(join(process.cwd(), 'e2e/velvet-house/deterministic.ts'), 'utf-8')
  .replace(/^\/\*\*[\s\S]*?\*\//, '')
  .replace(/^import.*$/gm, '');

// Capture frame-time traces on desktop, iPhone 12, and Pixel 8 viewports.
// Also records canvas dimensions so slowdowns can be correlated with canvas size.

async function captureFrameTrace(page: Page, viewport: { width: number; height: number }, deviceName: string) {
  await page.setViewportSize(viewport);
  await page.addInitScript(initScript);
  await page.goto('file://' + GAME_PATH + '?companion=test-trace');
  await page.waitForFunction(() => !!(window as any).__velvet, { timeout: 15_000 });

  // Set up to a stable game state
  await page.evaluate(() => {
    const form = document.getElementById('setupForm') as HTMLFormElement;
    const suName = document.getElementById('suName') as HTMLInputElement;
    if (suName) suName.value = 'Sam';
    const form2 = document.getElementById('setupForm') as HTMLFormElement;
    if (form2) form2.requestSubmit();
  });
  await page.waitForTimeout(2000);

  // Record canvas dimensions for diagnostics
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

  // Collect frame times for 3 seconds
  const trace = await page.evaluate(() => {
    return new Promise<number[]>((resolve) => {
      const times: number[] = [];
      let last = performance.now();
      let frames = 0;
      const maxFrames = 180; // ~3 seconds at 60fps
      const tick = () => {
        const now = performance.now();
        const dt = now - last;
        last = now;
        if (frames > 5) times.push(dt); // skip first few warmup frames
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

  const result = {
    device: deviceName,
    viewport,
    samples: trace.length,
    avgFrameMs: Math.round(avg * 100) / 100,
    minFrameMs: Math.round(min * 100) / 100,
    maxFrameMs: Math.round(max * 100) / 100,
    p95FrameMs: Math.round(p95 * 100) / 100,
    avgFps: Math.round(fps * 10) / 10,
    canvas: canvasInfo,
  };

  return result;
}

test.describe('Baseline frame-time traces', () => {
  test.setTimeout(120_000);

  test('desktop, iPhone 12, Pixel 8', async ({ page }) => {
    const results: any[] = [];

    results.push(await captureFrameTrace(page, { width: 1280, height: 800 }, 'desktop'));
    results.push(await captureFrameTrace(page, { width: 390, height: 844 }, 'iphone-12'));
    results.push(await captureFrameTrace(page, { width: 412, height: 915 }, 'pixel-8'));

    const dir = join(process.cwd(), 'e2e/velvet-house');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'frame-time-traces.json'), JSON.stringify(results, null, 2));

    // Verify traces were captured
    expect(results.length).toBe(3);
    for (const r of results) {
      expect(r.samples).toBeGreaterThan(100);
      expect(r.avgFps).toBeGreaterThan(0);
    }
  });
});
