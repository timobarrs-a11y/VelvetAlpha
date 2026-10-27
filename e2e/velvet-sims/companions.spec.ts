import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openGame, objects, saveNow, waitReady, pageErrors, SAVE_KEY } from './helpers';

// With more than one companion, Start asks the host who is moving in (the app puts up a picker; the stand-in host
// answers by itself): 'go' carries on with the current companion, 'cancel' backs out, 'other' moves in with someone else.
const HOST = readFileSync('e2e/velvet-sims/host.html', 'utf-8');

async function openWithCompanions(page: Page, answer: 'go' | 'cancel' | 'other' | 'other-continue', houses = 0) {
  await page.route('**/__e2e/host.html*', (r) => r.fulfill({
    status: 200, contentType: 'text/html',
    body: HOST.replace("window.companionCount = 0; window.houseCount = 0; window.startAnswer = 'go';", `window.companionCount = 2; window.houseCount = ${houses}; window.startAnswer = '${answer}';`),
  }));
  await page.goto('/__e2e/host.html?menu&script');
  return page.frameLocator('#g');
}
const requests = (page: Page) => page.evaluate(() => (window as unknown as { startRequests: number }).startRequests);

test('one companion: Start goes straight in, with no question', async ({ page }) => {
  const game = await openGame(page, { menu: true, script: true });
  await game.locator('[data-m=new]').click();
  await waitReady(page);
  await expect(game.locator('.vh-stage[data-script="cutscene"]')).toHaveCount(1);
  expect(await requests(page)).toBe(0);
});

test('two companions: Start asks who is moving in, and the current one carries on', async ({ page }) => {
  const game = await openWithCompanions(page, 'go');
  await expect(game.locator('.vh-menu')).toBeVisible();
  await game.locator('[data-m=new]').click();
  await waitReady(page);
  await expect(game.locator('.vh-stage[data-script="cutscene"]')).toHaveCount(1);
  expect(await requests(page)).toBe(1);
  expect(pageErrors(page)).toEqual([]);
});

test('two companions: backing out returns to the title screen', async ({ page }) => {
  const game = await openWithCompanions(page, 'cancel');
  await game.locator('[data-m=new]').click();
  await expect(game.locator('.vh-menu-title')).toHaveText('Velvet House');
  await expect(game.locator('[data-m=new]')).toBeVisible();
  expect(await requests(page)).toBe(1);
});

test('two companions: picking someone else starts a new house for them', async ({ page }) => {
  const game = await openWithCompanions(page, 'other');
  await game.locator('[data-m=new]').click();
  await waitReady(page);
  await expect(game.locator('.vh-stage[data-script="cutscene"]')).toHaveCount(1); // the move-in begins, with no title screen
  const search = await page.evaluate(() => (document.getElementById('g') as HTMLIFrameElement).contentWindow!.location.search);
  expect(search).toContain('companion=e2e-b');
  expect(search).not.toContain('start=new'); // a reload of the game never starts over again
});

test('two companions, one with a house: Continue asks whose house and goes back to theirs', async ({ page }) => {
  // The other companion's house: play the first one to the couch, save it, and file the save under them.
  await openGame(page);
  await saveNow(page);
  await page.evaluate((k) => { localStorage.setItem('velvet-sims:e2e-b', localStorage.getItem(k)!); }, SAVE_KEY);
  // Leave the game (it saves on the way out), then take the first companion's house away: they have none, the other does.
  await page.goto('/games/velvet-house-next/none.txt');
  await page.evaluate((k) => localStorage.removeItem(k), SAVE_KEY);

  const game = await openWithCompanions(page, 'other-continue', 1);
  await expect(game.locator('[data-m=continue] small')).toContainText('Choose whose house');
  await game.locator('[data-m=continue]').click();
  await waitReady(page);
  expect(await page.evaluate(() => (window as unknown as { startModes: string[] }).startModes)).toEqual(['continue']);
  expect((await objects(page)).some((o) => o.type === 'sofa')).toBe(true); // their house, not a fresh move-in
  await expect(game.locator('.vh-stage[data-script]')).toHaveCount(0);
  const search = await page.evaluate(() => (document.getElementById('g') as HTMLIFrameElement).contentWindow!.location.search);
  expect(search).toContain('companion=e2e-b');
});
