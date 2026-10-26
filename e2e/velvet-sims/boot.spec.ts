import { test, expect } from '@playwright/test';
import { openGame, pageErrors, inGame } from './helpers';

test('boots to the main floor with a working HUD and no errors', async ({ page }) => {
  const game = await openGame(page);
  await expect(game.locator('.vh-canvas')).toBeVisible();
  await expect(game.locator('[data-el=money]')).toContainText('$');
  await expect(game.locator('[data-level="1"]')).toHaveAttribute('aria-selected', 'true');
  expect(pageErrors(page)).toEqual([]);
});

test('switches between the floors, and the attic is hidden until it is built', async ({ page }) => {
  const game = await openGame(page);
  for (const lv of [0, 2, 3, 1]) {
    await game.locator(`[data-level="${lv}"]`).click();
    await expect(game.locator(`[data-level="${lv}"]`)).toHaveAttribute('aria-selected', 'true');
    expect(await inGame<number>(page, 'v.level()')).toBe(lv);
  }
  await expect(game.locator('[data-level="4"]')).toBeHidden();
});

test('the bottom bar and floor buttons are all visible and do not overlap', async ({ page }) => {
  const game = await openGame(page);
  const dock = await game.locator('.vh-dock').boundingBox();
  const floors = await game.locator('.vh-floors').boundingBox();
  expect(dock && floors).toBeTruthy();
  const vp = page.viewportSize()!;
  expect(floors!.y + floors!.height).toBeLessThanOrEqual(vp.height);
  // On a phone the floor buttons ride above the bar, not under it.
  if (vp.width < 560) expect(floors!.y + floors!.height).toBeLessThanOrEqual(dock!.y + 1);
  for (const tab of ['shop', 'arrange', 'goals', 'do', 'partner', 'you', 'home', 'log']) {
    await expect(game.locator(`.vh-dock [data-open=${tab}]`)).toBeAttached();
  }
});
