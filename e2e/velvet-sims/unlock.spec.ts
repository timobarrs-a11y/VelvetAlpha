import { test, expect } from '@playwright/test';
import { openGame, inGame, objects, savedGame, saveNow, SAVE_KEY } from './helpers';

test('an unlock code said to Maya gives the secret pack, free, and is not a message', async ({ page }) => {
  const game = await openGame(page);
  const money = await inGame<number>(page, 'v.money');

  // Before the code the pack is nowhere in the shop.
  await game.locator('.vh-dock [data-open=shop]').click();
  await game.locator('[data-tab=Sets]').click();
  await expect(game.locator('[data-item=set-cloud]')).toHaveCount(0);
  await game.locator('.vh-drawer[data-open=shop] .vh-drawer-close').click();

  await inGame(page, 'v.openChat()');
  const input = game.locator('.vh-dialogue input');
  await input.fill('rainbowhugs');
  await input.press('Enter');
  await expect(game.locator('.vh-log')).toContainText('Cloud Nine is yours');
  await expect(input).toHaveValue('');
  expect(await inGame<number>(page, 'v.money')).toBe(money);
  // It was put on the main floor.
  const objs = await objects(page);
  for (const id of ['fridge', 'counter', 'dining', 'sofa']) expect(objs.find((o) => o.id === id)!.skin, id).toBe('cloud');
  // Now it is in the Sets tab as an Apply.
  await inGame(page, 'v.closeChat()');
  await game.locator('.vh-dock [data-open=shop]').click();
  await game.locator('[data-tab=Sets]').click();
  await expect(game.locator('[data-item=set-cloud]')).toContainText('Cloud Nine');
  await expect(game.locator('[data-item=set-cloud] [data-buy]')).toHaveText('Apply');
  // Not remembered as something said.
  await saveNow(page);
  expect(JSON.stringify((await savedGame(page)).turns ?? [])).not.toContain('rainbowhugs');
});

test('the start menu has a Cheats screen: public codes are checked and saved for the house', async ({ page }) => {
  const game = await openGame(page, { menu: true });
  await game.locator('[data-m=cheats]').click();
  await expect(game.locator('.vh-menu-codes')).toContainText('kaching');
  await expect(game.locator('.vh-menu-codes')).toContainText('decorate');
  // The secret code is never listed.
  await expect(game.locator('.vh-menu-card')).not.toContainText('rainbowhugs');
  const input = game.locator('.vh-menu-code input');
  await input.fill('nonsense');
  await input.press('Enter');
  await expect(game.locator('.vh-menu-codemsg')).toContainText('not a code');
  await input.fill('kaching');
  await input.press('Enter');
  await expect(game.locator('.vh-menu-codemsg')).toContainText('Saved');
  await input.fill('rainbowhugs');
  await input.press('Enter');
  await expect(game.locator('.vh-menu-codemsg')).toContainText('Code accepted');
  const saved = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.endsWith(':codes')).map(([, v]) => JSON.parse(v)));
  expect(saved.flat()).toEqual(['kaching', 'rainbowhugs']);
  await game.locator('[data-m=back]').click();
  await expect(game.locator('[data-m=cheats]')).toBeVisible();
  void SAVE_KEY;
});
