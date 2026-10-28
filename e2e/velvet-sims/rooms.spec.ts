import { test, expect } from '@playwright/test';
import { openGame, setMoney, inGame, pageErrors } from './helpers';

// Paint, wallpaper and floors go on one room of a floor: pick it in the shop's Room row.
test('wallpaper goes on the room picked, and wallpaper already bought goes up again for free', async ({ page }) => {
  test.setTimeout(150_000);
  const game = await openGame(page);
  await setMoney(page, 9999);
  const shopAt = async (tab: string, room: string) => {
    if (!(await game.locator(`[data-tab=${tab}]`).isVisible())) await game.locator('.vh-dock [data-open=shop]').click();
    await game.locator(`[data-tab=${tab}]`).click();
    await game.locator(`[data-pickroom="${room}"]`).click();
    await expect(game.locator(`[data-pickroom="${room}"]`)).toHaveClass(/vh-active/);
  };
  await shopAt('Wallpaper', 'Kitchen');
  // The main floor's rooms, and the whole floor.
  await expect(game.locator('[data-pickroom]')).toHaveText(['Whole floor', 'Kitchen', 'Entry', 'Living room']);
  await game.locator('[data-item=paper-stripe-mint] [data-buy]').click();
  await expect(game.locator('.vh-log')).toContainText('Mint stripes on the kitchen walls.');
  const money = await inGame<number>(page, 'v.money');
  await shopAt('Wallpaper', 'Entry');
  await expect(game.locator('[data-item=paper-stripe-mint] [data-buy]')).toHaveText('Apply');
  await game.locator('[data-item=paper-stripe-mint] [data-buy]').click();
  await expect(game.locator('.vh-log')).toContainText('Mint stripes on the entry walls.');
  expect(await inGame<number>(page, 'v.money')).toBe(money);
  expect(pageErrors(page)).toEqual([]);
});
