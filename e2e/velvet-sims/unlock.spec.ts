import { test, expect } from '@playwright/test';
import { openGame, inGame, objects, savedGame, saveNow, SAVE_KEY } from './helpers';

test('a promo code said to Maya gives the promo pack, free, and is not a message', async ({ page }) => {
  const game = await openGame(page);
  await inGame(page, 'v.settle()');
  const money = await inGame<number>(page, 'v.money');

  // Before the code the pack is in the shop by name only: locked, no preview, no price, nothing to buy.
  await game.locator('.vh-dock [data-open=shop]').click();
  await game.locator('[data-tab=Sets]').click();
  for (const id of ['set-cuddle', 'touches-cuddle']) {
    const card = game.locator(`[data-item=${id}]`);
    await expect(card).toHaveClass(/vh-promo-locked/);
    await expect(card).toContainText('Cuddle Clouds');
    await expect(card).toContainText('Free with a promo code');
    await expect(card.locator('[data-buy]')).toBeDisabled();
    await expect(card.locator('[data-icon]')).toHaveCount(0);
    await expect(card.locator('.vh-price')).toHaveCount(0);
  }
  // The Promo tab lists the promo packs.
  await game.locator('[data-tab=Promo]').click();
  await expect(game.locator('.vh-shop-list .vh-shop-card')).toHaveCount(3);
  await expect(game.locator('[data-item=set-nana]')).toHaveClass(/vh-promo-locked/);
  await expect(game.locator('[data-item=set-cuddle]')).toHaveClass(/vh-promo-locked/);
  await game.locator('.vh-drawer[data-open=shop] .vh-drawer-close').click();

  await inGame(page, 'v.openChat()');
  const input = game.locator('.vh-dialogue input');
  await input.fill('rainbowhugs');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  // A pop-up says what they got, with a picture of the pack.
  const pop = game.locator('.vh-celebrate');
  await expect(pop).toContainText('Cuddle Clouds', { timeout: 10000 });
  await expect(pop).toContainText('Congrats, you just unlocked');
  await expect(pop).toContainText('Try it out today!');
  await expect(pop.locator('img')).toHaveAttribute('src', /^data:image/);
  await pop.locator('.vh-celebrate-btn').click();
  await expect(pop).toHaveCount(0);
  await expect(game.locator('.vh-log')).toContainText('Cuddle Clouds is yours');
  expect(await inGame<number>(page, 'v.money')).toBe(money);
  // It was put on the main floor.
  const objs = await objects(page);
  for (const id of ['fridge', 'counter', 'dining', 'sofa']) expect(objs.find((o) => o.id === id)!.skin, id).toBe('cuddle');
  // Now it is in the Sets tab as an Apply.
  await inGame(page, 'v.closeChat()');
  await game.locator('.vh-dock [data-open=shop]').click();
  await game.locator('[data-tab=Sets]').click();
  await expect(game.locator('[data-item=set-cuddle]')).toContainText('Cuddle Clouds');
  await expect(game.locator('[data-item=set-cuddle]')).not.toHaveClass(/vh-promo-locked/);
  await expect(game.locator('[data-item=set-cuddle] [data-buy]')).toHaveText('Apply');
  await expect(game.locator('[data-item=touches-cuddle] [data-buy]')).toHaveText('Apply');
  // Not remembered as something said.
  await saveNow(page);
  expect(JSON.stringify((await savedGame(page)).turns ?? [])).not.toContain('rainbowhugs');
});

test('a code redeemed on the account in another house: this house has the packs too, without typing it', async ({ page }) => {
  // The account redeemed rainbowhugs in another house; this one opens fresh.
  await page.addInitScript(() => {
    if (window.top === window) (window as unknown as { accountPromos: string[] }).accountPromos = ['rainbowhugs'];
  });
  const game = await openGame(page);
  // Both packs are this house's as soon as it opens (the log line saying so is soon pushed out by the next one).
  await expect.poll(() => inGame<boolean>(page, "v.owns('set-cuddle') && v.owns('touches-cuddle')")).toBe(true);
  await inGame(page, 'v.settle()');
  // Nothing was put on, no pop-up: it waits in Sets as an Apply.
  await expect(game.locator('.vh-celebrate')).toHaveCount(0);
  expect((await objects(page)).find((o) => o.id === 'fridge')!.skin).not.toBe('cuddle');
  await game.locator('.vh-dock [data-open=shop]').click();
  await game.locator('[data-tab=Sets]').click();
  await expect(game.locator('[data-item=set-cuddle]')).not.toHaveClass(/vh-promo-locked/);
  await expect(game.locator('[data-item=set-cuddle] [data-buy]')).toHaveText('Apply');
  await game.locator('[data-item=set-cuddle] [data-buy]').click();
  await expect.poll(async () => (await objects(page)).find((o) => o.id === 'fridge')!.skin).toBe('cuddle');
});

test('a code typed in the house is reported to the app for the account', async ({ page }) => {
  const game = await openGame(page);
  await inGame(page, 'v.settle()');
  await inGame(page, 'v.openChat()');
  const input = game.locator('.vh-dialogue input');
  await input.fill('RainbowHugs');
  await input.press('Enter');
  await expect.poll(() => page.evaluate(() => (window as unknown as { promoLog: string[] }).promoLog)).toEqual(['rainbowhugs']);
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
  await inGame(page, 'v.settle()');
  await expect(again.locator('.vh-celebrate')).toContainText('Cuddle Clouds', { timeout: 15000 });
  await again.locator('.vh-celebrate-btn').click();
  await expect(again.locator('.vh-log')).toContainText('Cuddle Clouds is yours', { timeout: 15000 });
  expect(await inGame<number>(page, 'v.money')).toBeGreaterThanOrEqual(500000);
  expect((await objects(page)).find((o) => o.id === 'fridge')!.skin).toBe('cuddle');
});
