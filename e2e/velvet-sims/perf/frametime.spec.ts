import { test, expect } from '@playwright/test';
import { openGame } from '../helpers';

// Frame time of the live game at each graphics setting, on whatever machine runs it. In the cloud container there
// is no GPU, so the numbers are a worst case; run it on a real phone-sized browser for numbers worth quoting.
//   npm run test:perf
const SETTINGS: [string, string][] = [['auto', '0'], ['high', '1'], ['medium', '2'], ['low', '3']];

for (const [name, idx] of SETTINGS) {
  test(`frame time, ${name} quality`, async ({ page }, info) => {
    await page.addInitScript((i) => { try { localStorage.setItem('velvet-quality', i); } catch { /* */ } }, idx);
    await openGame(page);
    await page.waitForTimeout(1500);
    const ms = await page.evaluate(() => new Promise<number[]>((resolve) => {
      const out: number[] = [];
      let last = performance.now();
      const step = (now: number) => {
        out.push(now - last); last = now;
        if (out.length < 180) requestAnimationFrame(step); else resolve(out);
      };
      requestAnimationFrame(step);
    }));
    ms.shift();
    const sorted = [...ms].sort((a, b) => a - b);
    const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const line = `${info.project.name} ${name}: avg ${avg.toFixed(1)} ms (${(1000 / avg).toFixed(0)} fps), p95 ${p95.toFixed(1)} ms`;
    console.log(line);
    info.annotations.push({ type: 'frame-time', description: line });
    expect(avg).toBeLessThan(1000); // a sanity bound only: the numbers are for reading
  });
}
