import { test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GAME_PATH = join(process.cwd(), 'public/games/velvet-house/index.html');

const T = (label: string, code: string) =>
  `{const __s=performance.now();${code}if(window.__flush)document.getElementById('room').getContext('2d').getImageData(0,0,1,1);window.__prof['${label}']=(window.__prof['${label}']||0)+performance.now()-__s;}`;

function instrument(src: string): string {
  const swaps: Array<[string, string]> = [
    ['drawWalls(lv); drawFloor(lv); decals(lv, t); drawFloorDirt(lv);', T('walls+floor', 'drawWalls(lv); drawFloor(lv); decals(lv, t); drawFloorDirt(lv);')],
    ['depthSort(items).forEach(it => it.d());\n    drawFrontWalls', T('objects+chars', 'depthSort(items).forEach(it => it.d());') + '\n    drawFrontWalls'],
    ['drawFrontWalls(lv); drawProjector(lv);', T('frontWalls', 'drawFrontWalls(lv); drawProjector(lv);')],
    ['    lighting(lv, lights);\n', '    ' + T('lighting', 'lighting(lv, lights);') + '\n'],
    ['if (running && !arranging) update(dt);', 'if (running && !arranging) ' + T('update', 'update(dt);')],
    ['    render();\n    placeVideo();', '    ' + T('render', 'render();') + '\n    placeVideo();'],
    ['if (uiTimer <= 0) { refreshUI(); renderTracker(); uiTimer = 0.25; }', 'if (uiTimer <= 0) { ' + T('ui', 'refreshUI(); renderTracker();') + ' uiTimer = 0.25; }'],
  ];
  let out = src;
  for (const [a, b] of swaps) {
    if (!out.includes(a)) throw new Error('instrument anchor missing: ' + a.slice(0, 40));
    out = out.replace(a, b);
  }
  if (process.env.PROF_SWAP) { const [a, b] = process.env.PROF_SWAP.split('|||'); if (!out.includes(a)) throw new Error('swap anchor missing'); out = out.split(a).join(b); }
  if (process.env.PROF_CSS) out = out.replace('</head>', `<style>${process.env.PROF_CSS}</style></head>`);
  return out.replace('<script>', `<script>window.__prof={};window.__flush=${process.env.PROF_FLUSH ? 'true' : 'false'};</script>\n<script>`);
}

async function profile(page: Page, viewport: { width: number; height: number }, device: string, level: number, minutes: number) {
  await page.setViewportSize(viewport);
  await page.goto(`https://localhost/velvet-house/index.html?companion=prof-${device}`);
  await page.waitForFunction(() => !!(window as any).__velvet, { timeout: 15_000 });
  await page.evaluate(() => {
    (document.getElementById('suName') as HTMLInputElement).value = 'Sam';
    (document.getElementById('setupForm') as HTMLFormElement).requestSubmit();
  });
  await page.waitForTimeout(1500);
  await page.evaluate(([lv, m]) => { const v = (window as any).__velvet; v.setView(lv); v.minutes = m; }, [level, minutes]);
  await page.waitForTimeout(500);
  return page.evaluate(() => new Promise<Record<string, number>>((resolve) => {
    (window as any).__prof = {};
    let frames = 0; const start = performance.now();
    const tick = () => {
      frames++;
      if (frames < 150) requestAnimationFrame(tick);
      else {
        const p = (window as any).__prof, elapsed = performance.now() - start, out: Record<string, number> = {};
        for (const k of Object.keys(p)) out[k] = Math.round((p[k] / frames) * 100) / 100;
        out.fps = Math.round((frames / elapsed) * 1000 * 10) / 10;
        const cv = document.getElementById('room') as HTMLCanvasElement;
        out.canvasW = cv.width; out.canvasH = cv.height;
        resolve(out);
      }
    };
    requestAnimationFrame(tick);
  }));
}

test.describe('Profile — per-step render cost', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'desktop-only');
  test.setTimeout(120_000);
  test('per-step render cost', async ({ page }) => {
    const game = instrument(readFileSync(GAME_PATH, 'utf-8'));
    await page.route('https://localhost/velvet-house/index.html**', (r) => r.fulfill({ body: game, contentType: 'text/html' }));
    const results: Record<string, unknown>[] = [];
    for (const [vp, name] of [[{ width: 1280, height: 800 }, 'desktop'], [{ width: 390, height: 844 }, 'iphone-12']] as const) {
      results.push({ device: name, scene: 'main day', ...(await profile(page, vp, name, 1, 600)) });
      results.push({ device: name, scene: 'main night', ...(await profile(page, vp, name, 1, 1320)) });
    }
    writeFileSync(join(process.cwd(), 'e2e/velvet-house/profile-results.json'), JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 1));
  });
});
