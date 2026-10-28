import { test, expect } from '@playwright/test';
import { openGame, inGame, drag, setMoney } from './helpers';

type Lamp = { id: string; level: number; p: 'B' | 'L'; u: number; z: number; style: string };
const lamps = (page: import('@playwright/test').Page) => inGame<Lamp[]>(page, 'v.lamps()');
/** A stretch of the back wall where this lamp can hang, well away from where it is. */
async function plainStretch(page: import('@playwright/test').Page, l: Lamp): Promise<number> {
  for (let u = 1; u < 9.5; u += 0.3) if (Math.abs(u - l.u) > 1.5 && (await inGame<boolean>(page, `v.lampOk('${l.id}', 'B', ${u}, 1.9)`))) return u;
  throw new Error('no room on the wall');
}

test('a wall lamp can be dragged along the wall, and goes back from a bad spot', async ({ page }) => {
  const game = await openGame(page);
  await inGame(page, 'v.settle()');
  await game.locator('.vh-dock [data-open=arrange]').click();
  await page.waitForTimeout(1500); // the camera pulls back to frame the house
  await expect(game.locator('.vh-lampbar')).toBeVisible();

  const before = (await lamps(page)).find((l) => l.level === 1 && l.p === 'B' && l.u > 9)!;
  const from = await inGame<[number, number]>(page, `v.wallClientPos('B', ${before.u}, ${before.z})`);
  // Along the back wall to a plain stretch.
  const target = await plainStretch(page, before);
  const to = await inGame<[number, number]>(page, `v.wallClientPos('B', ${target}, 1.9, 0)`);
  await drag(page, from, to);
  const moved = (await lamps(page)).find((l) => l.id === before.id)!;
  expect(Math.abs(moved.u - target)).toBeLessThan(0.3);
  await expect(game.locator('.vh-lampbar')).toContainText(/lamp/i);

  // Onto a window or the screen: it cannot hang there, so it goes back to where it was.
  let bad = -1;
  for (let u = 1; u < 9.5 && bad < 0; u += 0.15) if (!(await inGame<boolean>(page, `v.lampOk('${before.id}', 'B', ${u}, 1.9)`)) && Math.abs(u - moved.u) > 1) bad = u;
  expect(bad, 'a spot on the wall where a lamp cannot hang').toBeGreaterThan(0);
  const corner = await inGame<[number, number]>(page, `v.wallClientPos('B', ${bad}, 1.9, 0)`);
  const here = await inGame<[number, number]>(page, `v.wallClientPos('B', ${moved.u}, ${moved.z})`);
  await drag(page, here, corner);
  const after = (await lamps(page)).find((l) => l.id === before.id)!;
  expect([after.p, after.u, after.z]).toEqual([moved.p, moved.u, moved.z]);

  // A new style, then taking it down puts it in storage and it can be hung again.
  const styleBefore = after.style;
  await game.locator('.vh-lampbar [data-lamp=style]').click();
  expect((await lamps(page)).find((l) => l.id === before.id)!.style).not.toBe(styleBefore);
  const count = (await lamps(page)).length;
  await game.locator('.vh-lampbar [data-lamp=down]').click();
  expect(await lamps(page)).toHaveLength(count - 1);
  expect(await inGame<string[]>(page, 'v.lampStock()')).toHaveLength(1);
  await game.locator('.vh-lampbar [data-stock]').click();
  expect(await lamps(page)).toHaveLength(count);
  expect(await inGame<string[]>(page, 'v.lampStock()')).toHaveLength(0);
});

test('a bought wall lamp hangs on the floor you are looking at, and the shop sells all eight styles (and shows the promo cloud lamp locked)', async ({ page }) => {
  const game = await openGame(page);
  await inGame(page, 'v.settle()');
  await setMoney(page, 2000);
  const count = (await lamps(page)).length;
  await game.locator('.vh-dock [data-open=shop]').click();
  await game.locator('[data-tab=Decor]').click();
  await expect(game.locator('[data-item^=lamp-]:not(.vh-promo-locked)')).toHaveCount(8);
  // The cloud lamp comes with the Nana promo code: on the shelf by name, locked.
  await expect(game.locator('[data-item=lamp-cloud]')).toHaveClass(/vh-promo-locked/);
  await game.locator('[data-item=lamp-cage] [data-buy]').click();
  await expect.poll(async () => (await lamps(page)).length).toBe(count + 1);
  const added = (await lamps(page)).at(-1)!;
  expect(added.style).toBe('cage');
  expect(added.level).toBe(await inGame<number>(page, 'v.level()'));
});

test('lamps persist: a moved lamp is where it was left after a reload', async ({ page }) => {
  const game = await openGame(page);
  await inGame(page, 'v.settle()');
  await game.locator('.vh-dock [data-open=arrange]').click();
  await page.waitForTimeout(1500); // the camera pulls back to frame the house
  const before = (await lamps(page)).find((l) => l.level === 1 && l.p === 'B' && l.u > 9)!;
  const from = await inGame<[number, number]>(page, `v.wallClientPos('B', ${before.u}, ${before.z})`);
  const target = await plainStretch(page, before);
  const to = await inGame<[number, number]>(page, `v.wallClientPos('B', ${target}, 1.9, 0)`);
  await drag(page, from, to);
  const moved = (await lamps(page)).find((l) => l.id === before.id)!;
  expect(moved.u).not.toBe(before.u);
  await inGame(page, 'v.saveGame()');
  await page.reload();
  await openGame(page, { fresh: false });
  const again = (await lamps(page)).find((l) => l.id === before.id)!;
  expect([again.p, again.u, again.z]).toEqual([moved.p, moved.u, moved.z]);
});
