import { test, expect } from '@playwright/test';
import { openGame, objects, clientPosOf, drag, inGame, setMoney } from './helpers';

const piece = async (page: import('@playwright/test').Page, id: string) => (await objects(page)).find(o => o.id === id)!;

test('Arrange lists every movable piece, and picking one selects it on its floor', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=arrange]').click();
  await expect(game.locator('[data-arr-pick=sofa]')).toBeVisible();
  await game.locator('[data-arr-pick=desk]').click(); // upstairs
  expect(await inGame<number>(page, 'v.level()')).toBe(2);
  await expect(game.locator('.vh-arr-bar')).toContainText('Desk');
  // Fixed things are not offered.
  await expect(game.locator('[data-arr-pick=stair01]')).toHaveCount(0);
});

test('tap a piece, then drag it to a free spot; a bad spot puts it back', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=arrange]').click();
  const before = await piece(page, 'sofa');
  const from = await clientPosOf(page, 'sofa');
  await drag(page, from, [from[0] - 90, from[1] + 30]);
  const moved = await piece(page, 'sofa');
  expect(moved.x !== before.x || moved.y !== before.y).toBe(true);
  await expect(game.locator('.vh-arr-bar')).toContainText('Couch'); // still selected

  // Onto the TV: it does not fit, so it goes back. (On a phone, selecting zoomed in: zoom out so the TV is on screen.)
  await inGame(page, 'v.resetCamera()');
  await page.waitForTimeout(900);
  const tv = await clientPosOf(page, 'tvunit');
  const here = await clientPosOf(page, 'sofa');
  await drag(page, here, tv);
  const after = await piece(page, 'sofa');
  expect([after.x, after.y]).toEqual([moved.x, moved.y]);
});

test('carry a piece to another floor, and put one in storage and back', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=arrange]').click();
  await game.locator('[data-arr-pick=desk]').click();
  await game.locator('[data-arr-floor="1"]').click();
  expect((await piece(page, 'desk')).level).toBe(1);
  expect(await inGame<number>(page, 'v.level()')).toBe(1);

  await game.locator('[data-arr-pick=sofa]').click();
  await game.locator('[data-arr=store]').click();
  expect(await inGame<number>(page, 'v.storedCount()')).toBe(1);
  expect((await objects(page)).some(o => o.id === 'sofa')).toBe(false);
  await game.locator('[data-arr-unstore=sofa]').click();
  expect((await objects(page)).some(o => o.id === 'sofa')).toBe(true);
  expect(await inGame<number>(page, 'v.storedCount()')).toBe(0);
});

test('build the attic, carry the desk up, and it is still there after a reload', async ({ page }) => {
  const game = await openGame(page);
  await setMoney(page, 5000);
  await game.locator('.vh-dock [data-open=shop]').click();
  await game.locator('[data-tab=Upgrades]').click();
  await game.locator('[data-buy=upgrade-attic]').click();
  await expect(game.locator('[data-level="4"]')).toBeVisible();
  // The purchase puts the shop away by itself.
  await expect(game.locator('.vh-drawer')).toBeHidden();
  await game.locator('.vh-dock [data-open=arrange]').click();
  await game.locator('[data-arr-pick=desk]').click();
  await game.locator('[data-arr-floor="4"]').click();
  expect((await piece(page, 'desk')).level).toBe(4);
  await page.reload();
  await page.waitForTimeout(1500);
  expect((await piece(page, 'desk')).level).toBe(4);
  await expect(game.locator('[data-level="4"]')).toBeVisible();
});
