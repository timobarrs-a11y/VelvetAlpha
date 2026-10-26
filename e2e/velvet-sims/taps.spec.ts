import { test, expect } from '@playwright/test';
import { openGame, clientPosOf, inGame } from './helpers';

// Taps on things in the house land on the right thing, whichever way the house is turned.
test('tapping the TV works at every rotation of the house', async ({ page }) => {
  const game = await openGame(page);
  for (let turn = 0; turn < 4; turn++) {
    const [x, y] = await clientPosOf(page, 'tvunit');
    await page.mouse.click(x, y);
    await expect(game.locator('.vh-log li').first()).toContainText(/TV/);
    const text = await game.locator('.vh-log li').first().innerText();
    expect(text, `turn ${turn}`).toMatch(/The TV flickers on|TV off/);
    // Turn the house a quarter and wait for the view to settle.
    await game.locator('[data-act=rotate]').click();
    await page.waitForTimeout(700);
  }
});

test('tapping Maya opens the chat at every rotation', async ({ page }) => {
  const game = await openGame(page);
  for (let turn = 0; turn < 4; turn++) {
    // Maya wanders, so look for her again (and follow her to her floor) on each try.
    await expect(async () => {
      await game.locator(`[data-level="${await inGame<number>(page, 'v.personLevel("maya")')}"]`).click();
      const [x, y] = await inGame<[number, number]>(page, 'v.personClientPos("maya")');
      await page.mouse.click(x, y);
      await expect(game.locator('.vh-dialogue')).toBeVisible({ timeout: 1500 });
    }, `turn ${turn}`).toPass({ timeout: 15_000 });
    await inGame(page, 'v.closeChat()');
    await expect(game.locator('.vh-dialogue')).toBeHidden();
    await game.locator('[data-act=rotate]').click();
    await page.waitForTimeout(700);
  }
});
