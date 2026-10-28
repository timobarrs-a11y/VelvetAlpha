import { test, expect } from '@playwright/test';
import { openGame, objects, inGame } from './helpers';

test('the rugs the house comes with can be picked in Arrange, put away and carried upstairs like any piece', async ({ page }) => {
  const game = await openGame(page);
  expect((await objects(page)).filter((o) => o.type.startsWith('rug')).map((o) => o.id).sort()).toEqual(['rug1', 'rug2']);
  await game.locator('.vh-dock [data-open=arrange]').click();
  await expect(game.locator('[data-arr-pick=rug1]')).toContainText('Living room rug');
  await game.locator('[data-arr-pick=rug1]').click();
  await expect(game.locator('.vh-arr-bar')).toContainText('Living room rug');
  // It turns like any piece.
  const rot0 = (await objects(page)).find((o) => o.id === 'rug1')!.rot;
  await game.locator('[data-arr=rotate]').click();
  expect((await objects(page)).find((o) => o.id === 'rug1')!.rot).toBe((rot0 + 1) % 4);
  await game.locator('[data-arr-floor="2"]').click();
  expect((await objects(page)).find((o) => o.id === 'rug1')!.level).toBe(2);
  await game.locator('[data-arr=colour]').click();
  await game.locator('[data-arr=store]').click();
  expect((await objects(page)).some((o) => o.id === 'rug1')).toBe(false);
  expect(await inGame<number>(page, 'v.storedCount()')).toBe(1);
  // It stays put away across a reload: the house is not given it back.
  await inGame(page, 'v.saveGame()');
  await page.reload();
  const again = await openGame(page, { fresh: false });
  void again;
  expect((await objects(page)).some((o) => o.id === 'rug1')).toBe(false);
  expect(await inGame<number>(page, 'v.storedCount()')).toBe(1);
});
