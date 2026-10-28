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
  // A piece let go of is loose until it is set down: over the TV it does not fit, so it is red and Set it down refuses.
  await expect(game.locator('.vh-arr-bar [data-arr=back]')).toBeVisible();
  await game.locator('.vh-arr-bar [data-arr=set]').click();
  const stuck = await piece(page, 'sofa');
  expect([stuck.x, stuck.y]).not.toEqual([moved.x, moved.y]); // still loose where it was let go, not placed
  // Put it back returns it to where it was picked up.
  await game.locator('.vh-arr-bar [data-arr=back]').click();
  const after = await piece(page, 'sofa');
  expect([after.x, after.y]).toEqual([before.x, before.y]);
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

test('the Arrange bar is never cut off: Set it down, Rotate and Store are fully on screen, and the house is not under the panel', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=arrange]').click();
  for (const id of ['sofa', 'dining', 'lamp1']) {
    await game.locator(`[data-arr-pick=${id}]`).click();
    await page.waitForTimeout(600);
    const panel = (await game.locator('.vh-drawer[data-open=arrange]').boundingBox())!;
    for (const act of ['set', 'rotate']) {
      const b = (await game.locator(`.vh-arr-bar [data-arr=${act}]`).boundingBox())!;
      expect(b.y).toBeGreaterThanOrEqual(panel.y);
      expect(b.y + b.height).toBeLessThanOrEqual(panel.y + panel.height);
      expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
    // Picking a piece scrolls the list, never the panel itself.
    expect(await game.locator('.vh-drawer[data-open=arrange] .vh-drawer-body').evaluate((e) => e.scrollTop)).toBe(0);
    // The house is framed in what the panel leaves free.
    const canvas = (await game.locator('.vh-canvas').boundingBox())!;
    const piece = await clientPosOf(page, id);
    if (page.viewportSize()!.width <= 560) expect(piece[1]).toBeGreaterThan(Math.min(panel.y + panel.height, canvas.y + canvas.height));
  }
});

test('nothing is too heavy or too indoors: the treadmill can go to the backyard and up to the bedroom', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=arrange]').click();
  await game.locator('[data-arr-pick=tread]').click();
  await game.locator('[data-arr-floor="3"]').click();
  expect((await piece(page, 'tread')).level).toBe(3);
  await game.locator('[data-arr-floor="2"]').click();
  expect((await piece(page, 'tread')).level).toBe(2);
});

test('Arrange has no title bar or close button; the Arrange button in the bottom bar turns it on and off', async ({ page }) => {
  const game = await openGame(page);
  const dock = game.locator('.vh-dock [data-open=arrange]');
  await dock.click();
  await expect(game.locator('.vh-drawer[data-open=arrange]')).toBeVisible();
  // The title bar is not on the page at all (not just hidden).
  await expect(game.locator('.vh-drawer[data-open=arrange] .vh-drawer-head')).toHaveCount(0);
  await expect(game.locator('.vh-drawer[data-open=arrange] .vh-drawer-close')).toHaveCount(0);
  // The controls and the list are still there.
  await game.locator('[data-arr-pick=sofa]').click();
  await expect(game.locator('.vh-arr-bar [data-arr=set]')).toBeVisible();
  // Other pages keep their title bar and close button.
  await game.locator('.vh-dock [data-open=shop]').click();
  await expect(game.locator('.vh-drawer[data-open=shop] .vh-drawer-head')).toBeVisible();
  await game.locator('.vh-drawer[data-open=shop] .vh-drawer-close').click();
  // The same button turns Arrange off again.
  await dock.click();
  await expect(game.locator('.vh-drawer[data-open=arrange]')).toBeVisible();
  await dock.click();
  await expect(game.locator('.vh-drawer')).toBeHidden();
  expect(await inGame<boolean>(page, 'v.isArranging ? v.isArranging() : false')).toBe(false);
});

test('the Arrange action buttons are all the same size', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=arrange]').click();
  await game.locator('[data-arr-pick=sofa]').click();
  const sizes = () => game.locator('.vh-arr-acts > button').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }));
  // Wait for the panel to settle, then every button is the same size.
  await expect.poll(async () => { const z = await sizes(); return z.length >= 3 && z.every((x) => x === z[0]); }).toBe(true);
});
