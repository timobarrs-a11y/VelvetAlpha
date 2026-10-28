import { test, expect } from '@playwright/test';
import { openGame, inGame, pageErrors, SAVE_KEY } from './helpers';

const BO = '0b0e3f8a-8f1c-4d2a-9e51-2c4b7d9a1e00';
// The keys of a save the server hands over for a visit (supabase/migrations/20261111100000_velvet_house_visits.sql).
const HOUSE_KEYS = ['v', 'rev', 'contentVersion', 'day', 'minutes', 'power', 'wallMode', 'townName', 'fridge', 'dishes', 'laundryPile', 'owned',
  'LOOKS', 'ROOMLOOK', 'WALLOBJS', 'yard', 'objs', 'pets', 'petSeq', 'simName', 'look', 'mayaLook'];

test('the Household page lists friends\' houses to visit, and opens or closes this one', async ({ page }) => {
  test.setTimeout(120_000);
  const game = await openGame(page);
  await page.evaluate((id) => { (window as unknown as { friendHouses: unknown[] }).friendHouses = [{ ownerId: id, name: 'Bo', day: 12 }]; }, BO);
  await game.locator('.vh-dock [data-open=home]').click();
  const row = game.locator('.vh-visit-row');
  await expect(row).toContainText('Bo');
  await expect(row).toContainText('Day 12');
  await expect(game.locator('[data-visits-open]')).toHaveText('On');
  await game.locator('[data-visits-open]').click();
  await expect(game.locator('[data-visits-open]')).toHaveText('Off');
  expect(await page.evaluate(() => (window as unknown as { visitsOpen: boolean }).visitsOpen)).toBe(false);
  await game.locator(`[data-visit="${BO}"]`).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { visitTo: string | null }).visitTo)).toBe(BO);
  expect(pageErrors(page)).toEqual([]);
});

test('a friend\'s house: looked round as they left it, nothing to buy or say, never saved, and Go home', async ({ page }) => {
  test.setTimeout(150_000);
  // Make a house to visit: this game's, moved about a little, as the server would hand it over.
  await openGame(page);
  await inGame(page, 'v.moveObject("sofa", 2.2, 5.6)');
  await inGame(page, 'v.saveGame()');
  const house = await page.evaluate(([key, keys]) => {
    const f = document.getElementById('g') as HTMLIFrameElement;
    const s = JSON.parse(f.contentWindow!.localStorage.getItem(key as string)!);
    const h: Record<string, unknown> = Object.fromEntries((keys as string[]).filter((k) => s[k] !== undefined).map((k) => [k, s[k]]));
    return { ...h, day: 12, player: { name: 'Bo' }, partner: { name: 'Juniper' }, flags: { rugObjects: true, tvObject: true }, ownerName: 'Bo' };
  }, [SAVE_KEY, HOUSE_KEYS] as const);
  const stored = JSON.stringify(house);
  await page.evaluate((h) => localStorage.setItem('velvet-sims:visit', h), stored);

  const game = await openGame(page, { visit: true, fresh: false });
  await expect(game.locator('.vh-visit-bar')).toContainText("Bo's house");
  await expect(game.locator('.vh-visit-bar')).toContainText('Day 12');
  const sofa = (await inGame<Array<{ id: string; x: number }>>(page, 'v.objects()')).find((o) => o.id === 'sofa')!;
  expect(sofa.x).toBeCloseTo(2.2, 1);
  // Nothing to buy, move or open.
  await expect(game.locator('.vh-dock')).toBeHidden();
  await expect(game.locator('.vh-hud')).toBeHidden();
  // Tapping their companion does not open a chat with them.
  const [mx, my] = await inGame<[number, number]>(page, 'v.personClientPos("maya")');
  if (await inGame<number>(page, 'v.personLevel("maya")') === await inGame<number>(page, 'v.level()')) {
    await page.mouse.click(mx, my);
    await page.waitForTimeout(600);
    await expect(game.locator('.vh-dialogue')).toBeHidden();
  }
  await page.screenshot({ path: `e2e/velvet-sims/test-results/visit-${test.info().project.name}.png` });
  // Nothing of the visit is saved: the house the host put down is still exactly that.
  await page.waitForTimeout(16_000);
  expect(await page.evaluate(() => localStorage.getItem('velvet-sims:visit'))).toBe(stored);
  // Their goals are not the visitor's to tick off, and nothing pops up.
  await expect(game.locator('.vh-log')).not.toContainText('Goal complete');
  await expect(game.locator('.vh-dcard')).toHaveCount(0);
  await game.locator('[data-visit-home]').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { visitEnded: boolean }).visitEnded)).toBe(true);
  expect(pageErrors(page)).toEqual([]);
});
