import { test, expect } from '@playwright/test';
import { inGame, openGame } from '../helpers';

// The game starts paused (?freeze), so the picture is the same every time: pick a floor and a time, let the
// lights settle, and compare.
const FLOORS: [string, number][] = [['basement', 0], ['main', 1], ['upstairs', 2], ['yard', 3]];
const TIMES: [string, number][] = [['morning', 8 * 60], ['day', 13 * 60], ['evening', 19 * 60 + 30], ['night', 23 * 60]];

test.describe('each floor at four times of day', () => {
  for (const [floor, level] of FLOORS) {
    for (const [time, minutes] of TIMES) {
      test(`${floor} ${time}`, async ({ page }) => {
        await openGame(page, { freeze: true });
        await inGame(page, `v.setMinutes(${minutes})`);
        await inGame(page, `v.setView(${level})`);
        await page.waitForTimeout(1800);
        await expect(page).toHaveScreenshot(`${floor}-${time}.png`);
      });
    }
  }
});

test('the house turned a quarter, with the walls down', async ({ page }) => {
  const game = await openGame(page, { freeze: true });
  await inGame(page, 'v.setMinutes(13 * 60)');
  await game.locator('[data-act=rotate]').click();
  await game.locator('[data-act=walls]').click();
  await game.locator('[data-act=walls]').click();
  await page.waitForTimeout(1800);
  await expect(page).toHaveScreenshot('main-rotated-walls-down.png');
});

test('arrange mode and the shop', async ({ page }) => {
  const game = await openGame(page, { freeze: true });
  await inGame(page, 'v.setMinutes(13 * 60)');
  await game.locator('.vh-dock [data-open=arrange]').click();
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot('arrange-open.png');
  await game.locator('.vh-dock [data-open=shop]').click();
  await page.waitForTimeout(1200);
  await expect(page).toHaveScreenshot('shop-open.png');
});
