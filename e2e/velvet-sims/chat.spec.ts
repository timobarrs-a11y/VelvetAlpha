import { test, expect } from '@playwright/test';
import { openGame } from './helpers';

test('talking to Maya goes through the host and the reply stays on screen', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=partner]').click();
  await game.locator('[data-talk]').click();
  await expect(game.locator('.vh-dialogue')).toBeVisible();
  await game.locator('.vh-dialogue-input input').fill('hello there');
  await game.locator('.vh-dialogue-input button').click();
  await expect(game.locator('.vh-dialogue-text')).toContainText('I was just thinking about you');
  // Still there after the answer box comes back.
  await page.waitForTimeout(1500);
  await expect(game.locator('.vh-dialogue-text')).toContainText('I was just thinking about you');
  // The host got the persona first and the player's line last.
  const log = await page.evaluate(() => (window as unknown as { sampleLog: string[][] }).sampleLog);
  expect(log.length).toBe(1);
  expect(log[0][0]).toContain('You are');
  expect(log[0][log[0].length - 1]).toContain('hello there');
});
