import { test, expect } from '@playwright/test';
import { openGame, objects, clientPosOf, inGame, pageErrors } from './helpers';

// An order picked from a piece's tray is carried through: Jordan keeps it all the way there and does it, nothing else
// takes it over on the way. Uses the Hollywood dressing table upstairs, so the walk crosses a floor.
test('an order from the tray is kept all the way to the piece', async ({ page }) => {
  test.setTimeout(150_000);
  const game = await openGame(page);
  await inGame(page, '(v.money = 20000)');
  await inGame(page, 'v.setView(2)');
  await inGame(page, "v.buy('set-regency')");
  await inGame(page, 'v.resetCamera()');
  await page.waitForTimeout(900);
  const table = (await objects(page)).find((o) => o.type === 'glamtable')!;
  const [x, y] = await clientPosOf(page, table.id);
  await page.mouse.click(x, y - 20);
  // The tray shuts itself after a few seconds, so press the button at once.
  await game.locator('.vh-tray [data-act=glam]').evaluate((b) => (b as HTMLButtonElement).click());
  let arrived = false;
  for (let k = 0; k < 60 && !arrived; k++) {
    await page.waitForTimeout(1000);
    const st = await inGame<{ act: string | null; walking: boolean; level: number }>(page, "v.agentState('jordan')");
    expect(st.act, `second ${k}`).toBe('glam');
    arrived = !st.walking && st.level === 2 && Math.abs((st as never as { face: number[] }).face[1] + 1) < 0.01;
  }
  expect(arrived).toBe(true);
  expect(pageErrors(page)).toEqual([]);
});
