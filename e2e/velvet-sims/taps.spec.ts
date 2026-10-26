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
  // Maya has to be on the floor in view for this.
  await game.locator(`[data-level="${await inGame<number>(page, 'v.personLevel("maya")')}"]`).click();
  for (let turn = 0; turn < 4; turn++) {
    const [x, y] = await inGame<[number, number]>(page, 'v.personClientPos("maya")');
    await page.mouse.click(x, y);
    await expect(game.locator('.vh-dialogue'), `turn ${turn}`).toBeVisible();
    await inGame(page, 'v.closeChat()');
    await expect(game.locator('.vh-dialogue')).toBeHidden();
    await game.locator('[data-act=rotate]').click();
    await page.waitForTimeout(700);
  }
});
