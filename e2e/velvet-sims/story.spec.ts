import { test, expect } from '@playwright/test';
import { openGame, objects, pageErrors, inGame } from './helpers';

test.setTimeout(240_000);
test('a new game opens with the move-in; skipping it leaves the couch by the TV and Dez starts the first day', async ({ page }) => {
  const game = await openGame(page, { script: true });
  // The house starts without the first day's furniture.
  expect((await objects(page)).some((o) => o.type === 'sofa')).toBe(false);
  await expect(game.locator('.vh-skip')).toBeVisible();
  await game.locator('.vh-skip').click();
  await expect.poll(async () => (await objects(page)).some((o) => o.type === 'sofa')).toBe(true);
  await expect(game.locator('.vh-skip')).toBeHidden();
  // Chapter 7: a box of lamp arrives and waits to be unpacked.
  await expect.poll(async () => (await objects(page)).some((o) => o.id === 'box.lamp'), { timeout: 150_000, intervals: [1000] }).toBe(true);
  expect(pageErrors(page)).toEqual([]);
});

test('watching the move-in: tap the box, place the couch, and carry on to the choice', async ({ page }) => {
  test.setTimeout(420_000);
  const game = await openGame(page, { script: true });
  // Tap through the cutscene lines until the guided step asks for the box.
  await expect.poll(async () => {
    if (await game.locator('.vh-speech:visible').count()) await game.locator('.vh-speech').click();
    return game.locator('.vh-scard:visible').count();
  }, { timeout: 200_000, intervals: [300] }).toBeGreaterThan(0);
  const pos = await inGame<[number, number] | null>(page, "v.clientPosOf('box.couch')");
  await page.mouse.click(pos![0], pos![1]);
  await expect.poll(async () => (await objects(page)).some((o) => o.id === 'box.couch' && o.type === 'sofa')).toBe(true);
  // Your partner asks for the couch first; tap through that to get the placement card.
  await expect.poll(async () => {
    if (await game.locator('.vh-speech:visible').count()) await game.locator('.vh-speech').click();
    return game.locator('.vh-scard button:visible').count();
  }, { timeout: 30_000, intervals: [300] }).toBeGreaterThan(0);
  await game.locator('.vh-scard button').click();
  // Back to the cutscene, and eventually the choice.
  await expect.poll(async () => {
    if (await game.locator('.vh-speech:visible').count()) await game.locator('.vh-speech').click();
    return game.locator('.vh-choices button').count();
  }, { timeout: 150_000, intervals: [300] }).toBeGreaterThan(0);
  await game.locator('.vh-choices button').first().click();
  expect(pageErrors(page)).toEqual([]);
});
