import { test, expect } from '@playwright/test';
import { openGame, objects, saveNow, waitReady, pageErrors } from './helpers';

// The title screen comes before the house. (Every other test starts the game directly.)
test('a first launch shows only Start and Settings, and Start begins the move-in', async ({ page }) => {
  const game = await openGame(page, { menu: true, script: true });
  const menu = page.locator('body');
  void menu;
  const m = game.locator('.vh-menu');
  await expect(m.locator('.vh-menu-title')).toHaveText('Velvet House');
  await expect(m.locator('[data-m=continue]')).toHaveCount(0);
  await expect(m.locator('[data-m=new]')).toContainText('Start');
  await m.locator('[data-m=new]').click();
  await waitReady(page);
  await expect(game.locator('.vh-menu')).toHaveCount(0);
  await expect(game.locator('.vh-skip')).toBeVisible();
  expect(pageErrors(page)).toEqual([]);
});

test('with a saved house: Continue picks it up, New Game asks first and then starts over', async ({ page }) => {
  // Make a house to continue: skip the opening so the couch is in, then save.
  const first = await openGame(page, { script: true });
  await first.locator('.vh-skip').click();
  await expect.poll(async () => (await objects(page)).some((o) => o.type === 'sofa')).toBe(true);
  await saveNow(page);

  await openGame(page, { menu: true, script: true, fresh: false });
  const game = page.frameLocator('#g');
  const m = game.locator('.vh-menu');
  await expect(m.locator('[data-m=continue]')).toBeVisible();
  await expect(m.locator('[data-m=continue] small')).toContainText('Day 1');
  // New Game asks first; keeping the house goes back.
  await m.locator('[data-m=new]').click();
  await expect(m).toContainText('Start over?');
  await m.locator('[data-m=no]').click();
  await expect(m.locator('[data-m=continue]')).toBeVisible();
  // Settings: the graphics choice sticks.
  await m.locator('[data-m=settings]').click();
  await m.locator('[data-q="3"]').click();
  await expect(m.locator('[data-q="3"]')).toHaveAttribute('aria-pressed', 'true');
  await m.locator('[data-m=back]').click();
  // Continue: the same house, no move-in.
  await m.locator('[data-m=continue]').click();
  await waitReady(page);
  expect((await objects(page)).some((o) => o.type === 'sofa')).toBe(true);
  await expect(game.locator('.vh-skip')).toBeHidden();
});

test('starting over from the menu begins the move-in again', async ({ page }) => {
  const first = await openGame(page, { script: true });
  await first.locator('.vh-skip').click();
  await expect.poll(async () => (await objects(page)).some((o) => o.type === 'sofa')).toBe(true);
  await saveNow(page);

  await openGame(page, { menu: true, script: true, fresh: false });
  const game = page.frameLocator('#g');
  await game.locator('[data-m=new]').click();
  await game.locator('[data-m=yes]').click();
  await waitReady(page);
  expect((await objects(page)).some((o) => o.type === 'sofa')).toBe(false);
  await expect(game.locator('.vh-skip')).toBeVisible();
});
