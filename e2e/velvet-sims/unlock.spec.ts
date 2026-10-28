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

test('the start menu has a Cheats screen that takes unlock codes and saves them for the house', async ({ page }) => {
  const game = await openGame(page, { menu: true });
  await game.locator('[data-m=cheats]').click();
  // It lists no codes, and the old cheats are gone.
  await expect(game.locator('.vh-menu-codes')).toHaveCount(0);
  await expect(game.locator('.vh-menu-card')).not.toContainText('kaching');
  await expect(game.locator('.vh-menu-card')).not.toContainText('rainbowhugs');
  const input = game.locator('.vh-menu-code input');
  for (const wrong of ['nonsense', 'kaching', 'decorate retro']) {
    await input.fill(wrong);
    await input.press('Enter');
    await expect(game.locator('.vh-menu-codemsg')).toContainText('not a code');
  }
  await input.fill('rainbowhugs');
  await input.press('Enter');
  await expect(game.locator('.vh-menu-codemsg')).toContainText('Code accepted');
  // The developer's money phrase is taken here too, and saved the same way.
  await input.fill('xoxotimoisgodxoxo');
  await input.press('Enter');
  await expect(game.locator('.vh-menu-codemsg')).toContainText('Code accepted');
  const saved = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.endsWith(':codes')).map(([, v]) => JSON.parse(v)));
  expect(saved.flat()).toEqual(['rainbowhugs', 'xoxotimoisgodxoxo']);
  await game.locator('[data-m=back]').click();
  await expect(game.locator('[data-m=cheats]')).toBeVisible();
  void SAVE_KEY;
});

test('there is no console, no key and no tap that opens a cheat menu in the house', async ({ page }) => {
  const game = await openGame(page);
  await page.locator('#g').focus();
  await page.keyboard.press('`');
  await game.locator('[data-el=money]').evaluate((el) => { for (let i = 0; i < 8; i++) (el as HTMLElement).click(); });
  await expect(game.locator('.vh-cheat')).toHaveCount(0);
  // The old public codes are plain talk now.
  const before = await inGame<number>(page, 'v.money');
  await inGame(page, 'v.openChat()');
  const box = game.locator('.vh-dialogue input');
  await box.fill('kaching');
  await game.locator('[data-send]').click();
  expect(await inGame<number>(page, 'v.money')).toBe(before);
});

test('codes saved on the start menu are redeemed in the house: the pack and the money', async ({ page }) => {
  await openGame(page);
  // Save the codes the way the start menu does, then reload into the house.
  await page.evaluate((key) => localStorage.setItem(key + ':codes', JSON.stringify(['rainbowhugs', 'xoxotimoisgodxoxo'])), SAVE_KEY);
  await page.reload();
  const again = await openGame(page, { fresh: false });
  await expect(again.locator('.vh-log')).toContainText('Cloud Nine is yours', { timeout: 15000 });
  await expect(again.locator('.vh-log')).toContainText('+$500000');
  expect(await inGame<number>(page, 'v.money')).toBeGreaterThanOrEqual(500000);
  expect((await objects(page)).find((o) => o.id === 'fridge')!.skin).toBe('cloud');
});
