import { test, expect } from '@playwright/test';
import { openGame, inGame, savedGame, saveNow } from './helpers';

const money = (page: import('@playwright/test').Page) => inGame<number>(page, 'v.money');

test('the developer money phrase works from Maya\'s chat box, and is not a message', async ({ page }) => {
  const game = await openGame(page);
  const before = await money(page);
  await inGame(page, 'v.openChat()');
  const input = game.locator('.vh-dialogue input');
  await expect(input).toBeVisible();

  // Ordinary talk does nothing to the wallet.
  await input.fill('how much money do we have');
  await game.locator('[data-send]').click();
  expect(await money(page)).toBe(before);

  // The phrase adds the money, clears the box and shows a +$ in the log.
  await input.fill('xoxotimoisgodxoxo');
  await input.press('Enter');
  await expect.poll(() => money(page)).toBe(before + 500000);
  await expect(input).toHaveValue('');
  await expect(game.locator('.vh-log')).toContainText('+$500000');

  // It is not remembered as something said: it is nowhere in the saved chat.
  await saveNow(page);
  const saved = await savedGame(page);
  expect(JSON.stringify(saved.turns ?? [])).not.toContain('xoxotimoisgodxoxo');
  expect(JSON.stringify(saved.life ?? {})).toContain('Found money');
});
