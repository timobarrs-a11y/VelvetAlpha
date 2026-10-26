import { test, expect } from '@playwright/test';
import { inGame, openGame, saveNow, savedGame, setMoney, waitReady } from './helpers';

test('design a garment, wear it, and it is still on after a reload', async ({ page }) => {
  const game = await openGame(page);
  await setMoney(page, 500);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-cut=hoodie]').click();
  await game.locator('[data-fabric=flannel]').click();
  await game.locator('[data-kind=plaid]').click();
  await game.locator('.vh-st-name').fill('Cabin Plaid');
  await game.locator('.vh-st-name').dispatchEvent('change');
  await game.locator('[data-st=make]').click();
  await expect(game.locator('[data-msg]')).toContainText('Made the Cabin Plaid');
  expect(await inGame<number>(page, 'v.money')).toBeLessThan(500);
  await saveNow(page);
  const saved = await savedGame(page);
  expect(saved.look.topGarment.pattern.kind).toBe('plaid');
  expect(saved.closet.some((c: { recipe?: { name: string } }) => c.recipe?.name === 'Cabin Plaid')).toBe(true);
  await page.goto('/__e2e/host.html');
  await waitReady(page);
  await saveNow(page);
  const again = await savedGame(page);
  expect(again.look.topGarment.name).toBe('Cabin Plaid');
  expect(again.closet.filter((c: { recipe?: { name: string } }) => c.recipe?.name === 'Cabin Plaid')).toHaveLength(1);
});

test('a share code loads the same design back', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-cut=cardigan]').click();
  await game.locator('[data-kind=argyle]').click();
  await game.locator('[data-sttab=share]').click();
  const code = await game.locator('[data-code]').inputValue();
  expect(code).toMatch(/^VH-/);
  await game.locator('[data-sttab=make]').click();
  await game.locator('[data-cut=tee]').click();
  await game.locator('[data-sttab=share]').click();
  await game.locator('[data-incode]').fill(code.toLowerCase());
  await game.locator('[data-load]').click();
  await expect(game.locator('[data-msg]')).toContainText('Loaded');
  await expect(game.locator('[data-cut=cardigan]')).toHaveAttribute('aria-pressed', 'true');
  await game.locator('[data-sttab=share]').click();
  await game.locator('[data-incode]').fill('VH-NOPE');
  await game.locator('[data-load]').click();
  await expect(game.locator('[data-msg]')).toContainText("doesn't look right");
});

test('describe it falls back to a made-up design when the designer cannot answer', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-sttab=describe]').click();
  await game.locator('[data-describe-text]').fill('70s sunset over the ocean');
  await game.locator('[data-describe]').click();
  // The stand-in host answers with chat text, not a recipe, so the fallback is what comes back.
  await expect(game.locator('[data-msg]')).toContainText(/Here is your design|made from your words/, { timeout: 15000 });
  await expect(game.locator('[data-sttab=make]')).toHaveAttribute('aria-selected', 'true');
});

test('the boutique has a fresh rack, and a piece can be bought and worn', async ({ page }) => {
  const game = await openGame(page);
  await setMoney(page, 800);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-sttab=boutique]').click();
  await expect(game.locator('.vh-st-card')).toHaveCount(6);
  await game.locator('[data-buyit="0"]').click();
  await expect(game.locator('[data-buyit="0"]')).toHaveText('Owned');
  expect(await inGame<number>(page, 'v.money')).toBeLessThan(800);
});
