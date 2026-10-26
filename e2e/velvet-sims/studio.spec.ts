import { test, expect } from '@playwright/test';
import { inGame, openGame, saveNow, savedGame, setMoney, waitReady } from './helpers';

test('design a garment, wear it, and it is still on after a reload', async ({ page }) => {
  const game = await openGame(page);
  await setMoney(page, 500);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-cut=hoodie]').click();
  await game.locator('[data-fabric=flannel]').click();
  await game.locator('[data-kind=plaid]').click();
  await game.locator('.vh-st-name').fill('Cabin Plaid');
  await game.locator('.vh-st-name').dispatchEvent('change');
  await game.locator('[data-st=make]').click();
  await expect(game.locator('[data-msg]')).toContainText('Made the Cabin Plaid');
  expect(await inGame<number>(page, 'v.money')).toBeLessThan(500);
  await saveNow(page);
  const saved = await savedGame(page);
  expect(saved.look.topGarment.pattern.kind).toBe('plaid');
  expect(saved.closet.some((c: { recipe?: { name: string } }) => c.recipe?.name === 'Cabin Plaid')).toBe(true);
  await page.goto('/__e2e/host.html');
  await waitReady(page);
  await saveNow(page);
  const again = await savedGame(page);
  expect(again.look.topGarment.name).toBe('Cabin Plaid');
  expect(again.closet.filter((c: { recipe?: { name: string } }) => c.recipe?.name === 'Cabin Plaid')).toHaveLength(1);
});

test('a share code loads the same design back', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-cut=cardigan]').click();
  await game.locator('[data-kind=argyle]').click();
  await game.locator('[data-sttab=share]').click();
  const code = await game.locator('[data-code]').inputValue();
  expect(code).toMatch(/^VH-/);
  await game.locator('[data-sttab=make]').click();
  await game.locator('[data-cut=tee]').click();
  await game.locator('[data-sttab=share]').click();
  await game.locator('[data-incode]').fill(code.toLowerCase());
  await game.locator('[data-load]').click();
  await expect(game.locator('[data-msg]')).toContainText('Loaded');
  await expect(game.locator('[data-cut=cardigan]')).toHaveAttribute('aria-pressed', 'true');
  await game.locator('[data-sttab=share]').click();
  await game.locator('[data-incode]').fill('VH-NOPE');
  await game.locator('[data-load]').click();
  await expect(game.locator('[data-msg]')).toContainText("doesn't look right");
});

test('describe it falls back to a made-up design when the designer cannot answer', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-sttab=describe]').click();
  await game.locator('[data-describe-text]').fill('70s sunset over the ocean');
  await game.locator('[data-describe]').click();
  // The stand-in host answers with chat text, not a recipe, so the fallback is what comes back.
  await expect(game.locator('[data-msg]')).toContainText(/Here is your design|made from your words/, { timeout: 15000 });
  await expect(game.locator('[data-sttab=make]')).toHaveAttribute('aria-selected', 'true');
});

test('the boutique has a fresh rack, and a piece can be bought and worn', async ({ page }) => {
  const game = await openGame(page);
  await setMoney(page, 800);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-sttab=boutique]').click();
  await expect(game.locator('.vh-st-card')).toHaveCount(6);
  await game.locator('[data-buyit="0"]').click();
  await expect(game.locator('[data-buyit="0"]')).toHaveText('Owned');
  expect(await inGame<number>(page, 'v.money')).toBeLessThan(800);
});

test('save an outfit for an occasion and put it back on later', async ({ page }) => {
  const game = await openGame(page);
  await setMoney(page, 900);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-cut=hoodie]').click();
  await game.locator('.vh-st-name').fill('Gym Hoodie');
  await game.locator('.vh-st-name').dispatchEvent('change');
  await game.locator('[data-st=make]').click();
  await game.locator('[data-sttab=outfits]').click();
  await game.locator('[data-occasion=workout]').click();
  await game.locator('[data-outfit-name]').fill('Gym');
  await game.locator('[data-saveoutfit]').click();
  await expect(game.locator('.vh-st-outfit')).toHaveCount(1);
  // Change into something else, then wear the saved outfit again.
  await game.locator('[data-sttab=make]').click();
  await game.locator('[data-cut=tank]').click();
  await game.locator('.vh-st-name').fill('Plain Tank');
  await game.locator('.vh-st-name').dispatchEvent('change');
  await game.locator('[data-st=make]').click();
  await saveNow(page);
  expect((await savedGame(page)).look.topGarment.name).toBe('Plain Tank');
  await game.locator('[data-sttab=outfits]').click();
  await game.locator('[data-wearoutfit]').click();
  await saveNow(page);
  const saved = await savedGame(page);
  expect(saved.look.topGarment.name).toBe('Gym Hoodie');
  expect(saved.flags.outfits[0].occasion).toBe('workout');
  await game.locator('[data-auto]').uncheck();
  await saveNow(page);
  expect((await savedGame(page)).flags.autoOutfit).toBe(false);
});

test('the partner can design a gift once a day', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-sttab=boutique]').click();
  await game.locator('[data-mayagift]').click();
  await expect(game.locator('[data-msg]')).toContainText('made you', { timeout: 15000 });
  await saveNow(page);
  const n = (await savedGame(page)).closet.filter((c: { recipe?: unknown }) => c.recipe).length;
  expect(n).toBe(1);
  await game.locator('.vh-dcard button').click();
  await game.locator('[data-mayagift]').click();
  await expect(game.locator('[data-msg]')).toContainText('already made you something today');
});

test('draw pixel art, wear it as a print, and keep it', async ({ page }) => {
  const game = await openGame(page);
  await setMoney(page, 900);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-sttab=pixel]').click();
  const grid = game.locator('[data-pixgrid]');
  await grid.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  const box = (await grid.boundingBox())!;
  const at = (i: number, j: number) => [box.x + ((i + 0.5) / 16) * box.width, box.y + ((j + 0.5) / 16) * box.height] as const;
  await game.locator('[data-pxcolor="3"]').click();
  for (const [i, j] of [[3, 3], [4, 4], [5, 5], [6, 6]]) { const [x, y] = at(i, j); await page.mouse.click(x, y); }
  await game.locator('[data-pxcolor="4"]').click();
  await game.locator('[data-pxmirror]').click();
  const [x1, y1] = at(2, 10); const [x2, y2] = at(6, 10);
  await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y2, { steps: 6 }); await page.mouse.up();
  await game.locator('[data-sttab=make]').click();
  await expect(game.locator('[data-kind=pixel]')).toHaveAttribute('aria-pressed', 'true');
  await game.locator('[data-st=make]').click();
  await saveNow(page);
  const saved = await savedGame(page);
  const art = saved.look.topGarment.pattern.pixels;
  expect(art.w).toBe(16);
  expect(art.data.length).toBe(256);
  expect(art.palette.length).toBe(4);
  // The diagonal is in colour 3 and the mirrored stroke is symmetric.
  expect(art.data[3 * 16 + 3]).toBe('3');
  expect(art.data[10 * 16 + 4]).toBe('4');
  expect(art.data[10 * 16 + 11]).toBe('4');
  await game.locator('[data-sttab=share]').click();
  const code = await game.locator('[data-code]').inputValue();
  expect(code.length).toBeGreaterThan(100);
});

// A valid share code to stand in for a friend's design, made by the app's own generator.
async function codeFor(page: import('@playwright/test').Page, seed: number): Promise<string> {
  return page.evaluate(async (s) => {
    const m = await import('/src/games/velvet-house/state/garment.ts');
    return m.encodeGarment(m.generateGarment(s));
  }, seed);
}

test('share a design with friends, see friends\' designs, and delete your own', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-cut=sweater]').click();
  await game.locator('[data-sttab=share]').click();
  await game.locator('[data-publish]').click();
  await expect(game.locator('[data-msg]')).toContainText('Shared with your friends');
  await game.locator('[data-sharevis=public]').click();
  await game.locator('[data-publish]').click();
  await expect(game.locator('[data-msg]')).toContainText('Sent for review');
  const sent = await page.evaluate(() => (window as unknown as { designsLog: { op: string; args: { visibility: string; code: string } }[] }).designsLog.filter((l) => l.op === 'publish'));
  expect(sent.map((s) => s.args.visibility)).toEqual(['friends', 'public']);
  expect(sent[0].args.code).toMatch(/^VH-/);

  await game.locator('[data-sttab=community]').click();
  await game.locator('[data-commview=mine]').click();
  await expect(game.locator('.vh-st-card')).toHaveCount(2);
  await expect(game.locator('.vh-st-by').first()).toContainText(/Shared|Waiting for review/);
  await game.locator('[data-cdelete="0"]').click();
  await expect(game.locator('.vh-st-card')).toHaveCount(1);
});

test('a name the server will not allow is refused politely', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('.vh-st-name').fill('bad name');
  await game.locator('.vh-st-name').dispatchEvent('change');
  await game.locator('[data-sttab=share]').click();
  await game.locator('[data-publish]').click();
  await expect(game.locator('[data-msg]')).toContainText("isn't allowed");
});

test('friends\' designs can be tried on and reported; junk codes are ignored', async ({ page }) => {
  const game = await openGame(page);
  const code = await codeFor(page, 42);
  await page.evaluate((c) => {
    (window as unknown as { friendDesigns: unknown[] }).friendDesigns = [
      { id: 'f1', name: 'Pals Plaid', owner_name: 'Sam', code: c, visibility: 'friends' },
      { id: 'f2', name: 'Junk', owner_name: 'Sam', code: 'VH-NOTREAL', visibility: 'friends' },
    ];
  }, code);
  page.on('dialog', (d) => d.accept());
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-sttab=community]').click();
  await expect(game.locator('.vh-st-card')).toHaveCount(1);
  await expect(game.locator('.vh-st-by')).toContainText('by Sam');
  await game.locator('[data-ctry="0"]').click();
  await expect(game.locator('[data-msg]')).toContainText('Trying on');
  await expect(game.locator('[data-sttab=make]')).toHaveAttribute('aria-selected', 'true');
  await game.locator('[data-sttab=community]').click();
  await game.locator('[data-creport="0"]').click();
  await expect(game.locator('[data-msg]')).toContainText('Thanks');
  await expect(game.locator('.vh-st-card')).toHaveCount(0);
});

test('a member does not see the review queue', async ({ page }) => {
  const game = await openGame(page);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-sttab=community]').click();
  await expect(game.locator('[data-commview=friends]')).toBeVisible();
  await expect(game.locator('[data-commview=review]')).toHaveCount(0);
});

test('a moderator can approve from the review queue', async ({ page }) => {
  const game = await openGame(page);
  const code = await codeFor(page, 7);
  await page.evaluate((c) => {
    const w = window as unknown as { moderator: boolean; pendingDesigns: unknown[] };
    w.moderator = true;
    w.pendingDesigns = [{ id: 'p1', name: 'Waiting', owner_name: 'Alex', code: c, visibility: 'public', status: 'pending', report_count: 0 }];
  }, code);
  await game.locator('.vh-dock [data-open=studio]').click();
  await game.locator('[data-sttab=community]').click();
  await game.locator('[data-commview=review]').click();
  await expect(game.locator('.vh-st-card')).toHaveCount(1);
  await game.locator('[data-capprove="0"]').click();
  await expect(game.locator('[data-msg]')).toContainText('Approved');
  await expect(game.locator('.vh-st-card')).toHaveCount(0);
});
