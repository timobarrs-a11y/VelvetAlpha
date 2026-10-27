import { test, expect } from '@playwright/test';
import { openGame, objects, pageErrors, inGame, dragToMark } from './helpers';

test.setTimeout(240_000);
test('a new game opens with the move-in and nothing can skip it', async ({ page }) => {
  const game = await openGame(page, { script: true });
  // The house starts without the first day's furniture, the cutscene is on, and there is no Skip button anywhere.
  expect((await objects(page)).some((o) => o.type === 'sofa')).toBe(false);
  await expect(game.locator('.vh-stage[data-script="cutscene"]')).toBeVisible();
  expect(await game.locator('.vh-skip').count()).toBe(0);
  expect(pageErrors(page)).toEqual([]);
});

test('watching the move-in: tap the box, drag the couch into the outline, and the lamp arrives next', async ({ page }) => {
  test.setTimeout(420_000);
  const game = await openGame(page, { script: true });
  // Tap through the cutscene lines until the guided step asks for the box.
  await expect.poll(async () => {
    if (await game.locator('.vh-speech:visible').count()) await game.locator('.vh-speech').click();
    return game.locator('.vh-scard:visible').count();
  }, { timeout: 200_000, intervals: [300] }).toBeGreaterThan(0);
  const pos = await inGame<[number, number] | null>(page, "v.clientPosOf('box.couch')");
  await page.mouse.click(pos![0], pos![1]);
  await expect.poll(async () => (await objects(page)).some((o) => o.id === 'box.couch' && o.type === 'sofa')).toBe(true);
  // Your partner asks for the couch first; tap through that to get the placement card.
  await expect.poll(async () => {
    if (await game.locator('.vh-speech:visible').count()) await game.locator('.vh-speech').click();
    return game.locator('.vh-scard-go:visible').count();
  }, { timeout: 30_000, intervals: [300] }).toBeGreaterThan(0);
  // Set it down with the couch still in the entry: the lesson stays open and the story has not moved on.
  await game.locator('.vh-scard-go').click();
  await page.waitForTimeout(1500);
  expect(JSON.parse(await inGame<string>(page, 'v.story()'))['opening.done']).toBeUndefined();
  await expect(game.locator('.vh-scard-go')).toBeVisible();
  // Drag it into the outline by the TV; it snaps and faces the TV, and only then does the opening end.
  await dragToMark(page, 'box.couch', 'living.couchTv', 'sofa', 2);
  // In the outline, the lesson ends by itself: no button needed.
  await expect.poll(async () => JSON.parse(await inGame<string>(page, 'v.story()'))['opening.done'], { timeout: 15_000 }).toBe(true);
  const sofa = (await objects(page)).find((o) => o.id === 'box.couch')!;
  expect(sofa.type).toBe('sofa');
  expect(Math.hypot(sofa.x - 5.6, sofa.y - 3.3)).toBeLessThan(0.61);
  expect(sofa.rot).toBe(2);
  // The couch is down and the next delivery is the lamp.
  await expect.poll(async () => (await objects(page)).some((o) => o.id === 'box.lamp'), { timeout: 150_000, intervals: [1000] }).toBe(true);
  expect(pageErrors(page)).toEqual([]);
});

test('a reload after the box is open resumes at the placement lesson instead of waiting for the box again', async ({ page }) => {
  test.setTimeout(300_000);
  const game = await openGame(page, { script: true });
  await expect.poll(async () => {
    if (await game.locator('.vh-speech:visible').count()) await game.locator('.vh-speech').click();
    return game.locator('.vh-scard:visible').count();
  }, { timeout: 200_000, intervals: [300] }).toBeGreaterThan(0);
  const pos = await inGame<[number, number] | null>(page, "v.clientPosOf('box.couch')");
  await page.mouse.click(pos![0], pos![1]);
  await expect.poll(async () => (await objects(page)).some((o) => o.id === 'box.couch' && o.type === 'sofa')).toBe(true);
  await inGame(page, 'v.saveGame()');
  await openGame(page, { script: true, fresh: false });
  // Back in the lesson: the partner's ask, then the placement card with its button; the "open the box" card is gone.
  await expect.poll(async () => {
    if (await game.locator('.vh-speech:visible').count()) await game.locator('.vh-speech').click();
    return game.locator('.vh-scard-go:visible').count();
  }, { timeout: 30_000, intervals: [300] }).toBeGreaterThan(0);
  expect(await game.locator('.vh-scard strong').innerText()).toBe('Put it where it goes');
  expect(pageErrors(page)).toEqual([]);
});
