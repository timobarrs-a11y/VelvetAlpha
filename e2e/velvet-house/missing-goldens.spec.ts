import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GAME_URL = 'file://' + join(process.cwd(), 'public/games/velvet-house/index.html');

const initScript = readFileSync(join(process.cwd(), 'e2e/velvet-house/deterministic.ts'), 'utf-8')
  .replace(/^\/\*\*[\s\S]*?\*\//, '')
  .replace(/^import.*$/gm, '');

async function loadGame(page: Page, companion = 'test-companion') {
  await page.addInitScript(initScript);
  await page.goto(`${GAME_URL}?companion=${companion}`);
  await page.waitForFunction(() => !!(window as any).__velvet, { timeout: 15_000 });
  await page.evaluate(() => (window as any).__clearVelvetSaves?.());
}

async function setupNewGame(page: Page) {
  await page.evaluate(() => {
    const form = document.getElementById('setupForm') as HTMLFormElement;
    const suName = document.getElementById('suName') as HTMLInputElement;
    const suPartner = document.getElementById('suPartner') as HTMLInputElement;
    if (suName) suName.value = 'Sam';
    if (suPartner) suPartner.value = 'Maya';
    if (form) form.requestSubmit();
  });
  await page.waitForTimeout(2000);
}

async function setFloor(page: Page, level: number) {
  await page.evaluate((lv) => (window as any).__velvet.setView(lv), level);
  await page.waitForTimeout(500);
}

async function setMinutes(page: Page, minutes: number) {
  await page.evaluate((m) => { (window as any).__velvet.minutes = m; }, minutes);
  await page.waitForTimeout(300);
}

async function capture(page: Page, name: string) {
  const dir = join(process.cwd(), 'e2e/velvet-house/goldens');
  await page.screenshot({ path: join(dir, `${name}.png`) });
  expect(true).toBe(true);
}

// Missing golden screenshots: night variants for basement/upstairs/backyard,
// rain rendering, treadmill rig, second house

test.describe('Missing golden screenshots', () => {
  test.setTimeout(120_000);

  test('basement — night', async ({ page }) => {
    await loadGame(page);
    await setupNewGame(page);
    await setFloor(page, 0);
    await setMinutes(page, 1320); // 10 PM
    await page.waitForTimeout(800);
    await capture(page, 'desktop-basement-night');
  });

  test('upstairs — night', async ({ page }) => {
    await loadGame(page);
    await setupNewGame(page);
    await setFloor(page, 2);
    await setMinutes(page, 1320);
    await page.waitForTimeout(800);
    await capture(page, 'desktop-upstairs-night');
  });

  test('backyard — night', async ({ page }) => {
    await loadGame(page);
    await setupNewGame(page);
    await setFloor(page, 3);
    await setMinutes(page, 1320);
    await page.waitForTimeout(800);
    await capture(page, 'desktop-backyard-night');
  });

  test('rain', async ({ page }) => {
    await loadGame(page);
    await setupNewGame(page);
    await setFloor(page, 3);
    await page.evaluate(() => {
      const v = (window as any).__velvet;
      v.YARD.rainAt = v.day * 1440 + v.minutes;
      v.YARD.rainUntil = v.YARD.rainAt + 240;
    });
    await setMinutes(page, 600);
    await page.waitForTimeout(800);
    await capture(page, 'desktop-rain');
  });

  test('treadmill rig', async ({ page }) => {
    await loadGame(page);
    await setupNewGame(page);
    await setFloor(page, 0); // basement has the treadmill
    await page.evaluate(() => {
      const v = (window as any).__velvet;
      // Force Jordan to use the treadmill
      if (v.jordan) { v.jordan.task = { name: 'treadmill', act: 'treadmill' }; }
    });
    await page.waitForTimeout(1000);
    await capture(page, 'desktop-treadmill-rig');
  });

  test('second house (craftsman)', async ({ page }) => {
    await loadGame(page);
    await setupNewGame(page);
    await page.evaluate(() => {
      const v = (window as any).__velvet;
      v.moveHouse('craftsman', true);
      v.day = 10; v.saveGame();
    });
    await setFloor(page, 1);
    await setMinutes(page, 600);
    await page.waitForTimeout(800);
    await capture(page, 'desktop-second-house');
  });

  // Pixel 8 additional shots
  test('Pixel 8 — arrange mode', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await loadGame(page);
    await setupNewGame(page);
    await setFloor(page, 1);
    await page.evaluate(() => (window as any).__velvet.setArranging(true));
    await page.waitForTimeout(600);
    await capture(page, 'pixel8-arrange-mode');
  });

  test('Pixel 8 — main floor night', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await loadGame(page);
    await setupNewGame(page);
    await setFloor(page, 1);
    await setMinutes(page, 1320);
    await page.waitForTimeout(800);
    await capture(page, 'pixel8-main-floor-night');
  });
});
