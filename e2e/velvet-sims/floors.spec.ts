import { test, expect } from '@playwright/test';
import { openGame, inGame, pageErrors } from './helpers';

// Changing floors slides the picture the way you are going, and leaves nothing behind.
test('going up and down a floor slides, then settles', async ({ page }) => {
  await openGame(page);
  const slides = () => page.frameLocator('#g').locator('.vh-floor-slide').count();
  expect(await slides()).toBe(0);
  await inGame(page, 'v.setView(2)');
  expect(await slides()).toBe(1); // the old floor is still leaving
  await page.screenshot({ path: 'e2e/velvet-sims/test-results/floor-slide.png' });
  await expect.poll(slides, { timeout: 3000 }).toBe(0);
  expect(await inGame<number>(page, 'v.level()')).toBe(2);
  await inGame(page, 'v.setView(0)');
  await expect.poll(slides, { timeout: 3000 }).toBe(0);
  expect(await inGame<number>(page, 'v.level()')).toBe(0);
  expect(pageErrors(page)).toEqual([]);
});
