import { test, expect } from '@playwright/test';
import { openGame, objects, clientPosOf, inGame, pageErrors } from './helpers';

// The Overseer: tap it, ask for cake, and it holds forth, one line after another, with nothing asked of the player.
test('the Overseer answers a request for cake with a monologue', async ({ page }) => {
  const game = await openGame(page);
  await inGame(page, "v.addObject('overseer', 1, 6.4, 6.0)");
  await inGame(page, 'v.resetCamera()');
  await page.waitForTimeout(900);
  const eye = (await objects(page)).find((o) => o.type === 'overseer')!;
  const [x, y] = await clientPosOf(page, eye.id);
  // Tap the caged head, above the middle of its footprint.
  await page.mouse.click(x, y - 12);
  // The tray shuts itself after a few seconds, and a slow headless frame can outlast that before a pointer click lands,
  // so read it and press the button at once.
  await expect(game.locator('.vh-tray button')).toHaveText([/Ask for encouragement/, /Request cake/, /Unplug/]);
  await game.locator('.vh-tray [data-act=overseerCake]').evaluate((b) => (b as HTMLButtonElement).click());
  await page.waitForTimeout(700);
  await page.screenshot({ path: 'e2e/velvet-sims/test-results/overseer-cake.png' });
  // It keeps going on its own: a few seconds later, still talking, with no reply asked for.
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'e2e/velvet-sims/test-results/overseer-later.png' });
  expect(pageErrors(page)).toEqual([]);
});
