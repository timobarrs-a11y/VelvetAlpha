import { test, expect } from '@playwright/test';
import { openGame, objects, clientPosOf, drag, inGame, pageErrors } from './helpers';

// Small pieces sit on tables and shelves, and go with them.
test('drag a candle onto a coffee table, then move the table', async ({ page }) => {
  const game = await openGame(page);
  await inGame(page, "v.addObject('coffeetable', 1, 6.4, 6.0)");
  await inGame(page, "v.addObject('candles', 1, 8.2, 6.2)");
  const objs = await objects(page);
  const table = objs.find((o) => o.type === 'coffeetable')!, candles = objs.find((o) => o.type === 'candles')!;
  await game.locator('.vh-dock [data-open=arrange]').click();
  await inGame(page, 'v.resetCamera()');
  await page.waitForTimeout(900);

  // Candles onto the table.
  const from = await clientPosOf(page, candles.id), to = await clientPosOf(page, table.id);
  await drag(page, from, to);
  const on = (await objects(page)).find((o) => o.id === candles.id)!;
  expect(on.on).toBe(table.id);
  expect(on.z).toBeCloseTo(0.45, 2);
  await page.screenshot({ path: 'e2e/velvet-sims/test-results/candles-on-table.png' });

  // The table moves; the candles go with it.
  await inGame(page, 'v.resetCamera()');
  await page.waitForTimeout(900);
  const t0 = (await objects(page)).find((o) => o.id === table.id)!;
  const tablePos = await clientPosOf(page, table.id), candlePos = await clientPosOf(page, candles.id);
  // Grab the table at the end away from the candles.
  const dx = tablePos[0] - candlePos[0], dy = tablePos[1] - candlePos[1], len = Math.hypot(dx, dy) || 1;
  const grab: [number, number] = [tablePos[0] + (dx / len) * 22, tablePos[1] + (dy / len) * 9 + 6];
  await drag(page, grab, [grab[0] - 70, grab[1] - 24]);
  const t1 = (await objects(page)).find((o) => o.id === table.id)!, c1 = (await objects(page)).find((o) => o.id === candles.id)!;
  expect(t1.x !== t0.x || t1.y !== t0.y).toBe(true);
  expect(c1.on).toBe(table.id);
  expect(Math.abs(c1.x - t1.x)).toBeLessThan(1.3);
  expect(Math.abs(c1.y - t1.y)).toBeLessThan(0.8);
  expect(pageErrors(page)).toEqual([]);
});
