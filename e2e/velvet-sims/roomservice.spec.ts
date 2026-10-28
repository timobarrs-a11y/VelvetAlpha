import { test, expect } from '@playwright/test';
import { openGame, objects, clientPosOf, inGame, pageErrors } from './helpers';

// The Grand Hotel's service bell: ring it, pay for breakfast, and a cart rolls from the stairs to the bed.
test('ringing the service bell sends a breakfast cart to the bed', async ({ page }) => {
  const game = await openGame(page);
  await inGame(page, '(v.money = 20000)');
  await inGame(page, 'v.setView(2)');
  await inGame(page, "v.buy('set-hotel')");
  await inGame(page, 'v.resetCamera()');
  await page.waitForTimeout(1000);
  const bell = (await objects(page)).find((o) => o.type === 'servicebell')!;
  expect(bell.level).toBe(2);
  const money = await inGame<number>(page, 'v.money');
  const [x, y] = await clientPosOf(page, bell.id);
  await page.mouse.click(x, y - 10);
  await expect(game.locator('.vh-tray [data-act=ringBell]')).toHaveCount(1);
  await game.locator('.vh-tray [data-act=ringBell]').evaluate((b) => (b as HTMLButtonElement).click());
  expect(await inGame<number>(page, 'v.money')).toBe(money - 20);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `e2e/velvet-sims/test-results/roomservice-rolling-${test.info().project.name}.png` });
  await page.waitForTimeout(14000);
  await page.screenshot({ path: `e2e/velvet-sims/test-results/roomservice-arrived-${test.info().project.name}.png` });
  expect(pageErrors(page)).toEqual([]);
});
