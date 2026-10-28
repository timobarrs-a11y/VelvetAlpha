import { test, expect } from '@playwright/test';
import { openGame, inGame, objects } from './helpers';

const money = (page: import('@playwright/test').Page) => inGame<number>(page, 'v.money');

test('cheats wait for the move-in to be over, then work from the console', async ({ page }) => {
  const game = await openGame(page);
  const before = await money(page);
  expect(await inGame<string>(page, "v.cheat('kaching')")).toBe('Finish the move-in first.');
  expect(await money(page)).toBe(before);

  await inGame(page, 'v.settle()');
  // Open the console from the keyboard (the backtick), type a code, press Enter.
  await page.locator('#g').focus();
  await page.keyboard.press('`');
  const box = game.locator('.vh-cheat');
  await expect(box).toBeVisible();
  await game.locator('.vh-cheat input').fill('KACHING');
  await game.locator('.vh-cheat input').press('Enter');
  await expect(game.locator('.vh-cheat-out')).toContainText('Found $1000');
  expect(await money(page)).toBe(before + 1000);

  await game.locator('.vh-cheat input').fill('decorate winter');
  await game.locator('.vh-cheat input').press('Enter');
  await expect(game.locator('.vh-cheat-out')).toContainText('Winter kitchen and living room is in');
  const objs = await objects(page);
  for (const id of ['fridge', 'counter', 'dining', 'sofa']) expect(objs.find((o) => o.id === id)!.skin, id).toBe('winter');

  await game.locator('.vh-cheat input').fill('nonsense');
  await game.locator('.vh-cheat input').press('Enter');
  await expect(game.locator('.vh-cheat-out')).toContainText('not a code');
  await game.locator('.vh-cheat input').press('Escape');
  await expect(box).toBeHidden();
});

test('five taps on the money chip open the console (for a phone)', async ({ page }) => {
  const game = await openGame(page);
  const chip = game.locator('[data-el=money]');
  const tap = (n: number) => chip.evaluate((el, k) => { for (let i = 0; i < k; i++) (el as HTMLElement).click(); }, n);
  await tap(4);
  await expect(game.locator('.vh-cheat')).toBeHidden();
  await tap(1);
  await expect(game.locator('.vh-cheat')).toBeVisible();
  await game.locator('.vh-cheat .vh-cheat-x').click();
  await expect(game.locator('.vh-cheat')).toBeHidden();
});
