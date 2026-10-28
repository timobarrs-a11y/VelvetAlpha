import { test, expect } from '@playwright/test';
import { openGame, objects, setMoney, inGame } from './helpers';

test('the Sets tab sells a whole look for less, through its Buy button', async ({ page }) => {
  const game = await openGame(page);
  await setMoney(page, 3000);
  await game.locator('.vh-dock [data-open=shop]').click();
  await game.locator('[data-tab=Sets]').click();
  const card = game.locator('[data-item=set-retro]');
  await expect(card).toContainText('Retro kitchen and living room');
  await expect(card).toContainText('Save $379');
  await expect(card.locator('.vh-was')).toHaveText('$1895');
  await page.screenshot({ path: '/tmp/claude-0/-home-user-VelvetAlpha/a9a0f942-0423-5df6-90a1-33ce69493d46/scratchpad/sets-' + test.info().project.name + '.png' });
  await card.locator('[data-buy]').click();
  const objs = await objects(page);
  for (const id of ['fridge', 'counter', 'dining', 'sofa', 'lamp1', 'plant1']) expect(objs.find((o) => o.id === id)!.skin, id).toBe('retro');
  // Owned: the button is now Apply, and it puts the whole set back on, free.
  await expect(card).toContainText('You have all of it');
  await expect(card.locator('[data-buy]')).toHaveText('Apply');
  await expect(card.locator('[data-buy]')).toBeEnabled();
  const money = await inGame<number>(page, 'v.money');
  await game.locator('.vh-dock [data-open=arrange]').click();
  await game.locator('[data-arr-pick=fridge]').click();
  await game.locator('[data-arr-look=""]').click();
  expect((await objects(page)).find((o) => o.id === 'fridge')!.skin).toBeUndefined();
  await game.locator('.vh-dock [data-open=shop]').click();
  await game.locator('[data-tab=Sets]').click();
  await game.locator('[data-item=set-retro] [data-buy]').click();
  expect((await objects(page)).find((o) => o.id === 'fridge')!.skin).toBe('retro');
  expect(await inGame<number>(page, 'v.money')).toBe(money);
});

test('on day 1 every set is in the shop, priced, and the starting money does not cover it; buying changes nothing', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=shop]').click();
  await game.locator('[data-tab=Sets]').click();
  for (const id of ['retro', 'farmhouse', 'modern', 'scandi', 'industrial', 'beach', 'spring', 'summer', 'fall', 'winter']) {
    const card = game.locator(`[data-item=set-${id}]`);
    await expect(card).toBeVisible();
    await expect(card.locator('.vh-price')).toContainText('$');
    await expect(card).not.toHaveClass(/vh-locked/);
  }
  const before = JSON.stringify(await objects(page));
  await game.locator('[data-item=set-fall] [data-buy]').click();
  expect(JSON.stringify(await objects(page))).toBe(before);
});
