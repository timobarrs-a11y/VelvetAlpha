import { test, expect } from '@playwright/test';
import { openGame, objects, pageErrors, inGame, dragToMark, rotateTo, storyTap } from './helpers';

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
  // Tap through the cutscene lines until the lesson's card asks for the box, and close it with Got it.
  await expect.poll(() => storyTap(game), { timeout: 200_000, intervals: [300] }).toBe('Open the box');
  const pos = await inGame<[number, number] | null>(page, "v.clientPosOf('box.couch')");
  await page.mouse.click(pos![0], pos![1]);
  await expect.poll(async () => (await objects(page)).some((o) => o.id === 'box.couch' && o.type === 'sofa')).toBe(true);
  // Your partner asks for the couch first; tap through that and read the placement card.
  await expect.poll(() => storyTap(game), { timeout: 30_000, intervals: [300] }).toBe('Put it where it goes');
  // Set it down with the couch still in the entry: the partner says it is not the spot and the objective stays.
  await game.locator('[data-arr="set"]').click();
  await page.waitForTimeout(1500);
  expect(JSON.parse(await inGame<string>(page, 'v.story()'))['opening.done']).toBeUndefined();
  expect(JSON.parse(await inGame<string>(page, 'v.story()'))['did.lesson.misplaced']).toBe(true);
  await expect(game.locator('.vh-objective strong')).toHaveText('Put it where it goes');
  // Drag it into the outline by the TV and set it down. It is facing the wrong way, so the lesson asks for a turn.
  await dragToMark(page, 'box.couch', 'living.couchTv', 'sofa', 2);
  await expect.poll(() => storyTap(game), { timeout: 15_000, intervals: [300] }).toBe('Turn it');
  expect(JSON.parse(await inGame<string>(page, 'v.story()'))['opening.done']).toBeUndefined();
  await rotateTo(page, 'box.couch', 2);
  await expect.poll(async () => JSON.parse(await inGame<string>(page, 'v.story()'))['opening.done'], { timeout: 15_000 }).toBe(true);
  const sofa = (await objects(page)).find((o) => o.id === 'box.couch')!;
  expect(sofa.type).toBe('sofa');
  expect(Math.hypot(sofa.x - 5.6, sofa.y - 3.3)).toBeLessThan(0.61);
  expect(sofa.rot).toBe(2);
  // The objective is done, so its bar is gone; the couch is down and the next delivery is the lamp.
  await expect(game.locator('.vh-objective')).toBeHidden();
  await expect.poll(async () => (await objects(page)).some((o) => o.id === 'box.lamp'), { timeout: 150_000, intervals: [1000] }).toBe(true);
  expect(pageErrors(page)).toEqual([]);
});

test('a card holds the game only until Got it: then everything works, the clock runs, and the objective waits in the bar', async ({ page }) => {
  test.setTimeout(300_000);
  const game = await openGame(page, { script: true });
  await expect.poll(async () => {
    if (await game.locator('.vh-speech:visible').count()) await game.locator('.vh-speech').click();
    return game.locator('.vh-scard:visible').count();
  }, { timeout: 200_000, intervals: [300] }).toBeGreaterThan(0);
  // The card is up: the game under it takes no taps and the clock holds still.
  await expect(game.locator('.vh-scard-veil')).toBeVisible();
  const before = await inGame<number>(page, 'v.minutes()');
  await page.waitForTimeout(1500);
  expect(await inGame<number>(page, 'v.minutes()')).toBe(before);
  await game.locator('.vh-scard-go').click();
  // Got it: the card folds into the objective bar and nothing is held.
  await expect(game.locator('.vh-scard')).toBeHidden();
  await expect(game.locator('.vh-objective strong')).toHaveText('Open the box');
  await expect(game.locator('.vh-stage[data-script="cutscene"]')).toHaveCount(0);
  // Arrange opens from the dock and any piece can be picked up, not only the one the lesson is about.
  await game.locator('.vh-dock [data-open="arrange"]').click();
  await expect(game.locator('.vh-stage.vh-arranging')).toHaveCount(1);
  await game.locator('.vh-dock [data-open="arrange"]').click();
  await expect(game.locator('.vh-stage.vh-arranging')).toHaveCount(0);
  // The clock runs while the objective is open.
  const t0 = await inGame<number>(page, 'v.minutes()');
  await expect.poll(() => inGame<number>(page, 'v.minutes()'), { timeout: 15_000 }).not.toBe(t0);
  // The bar brings the card back to read; Got it puts it away again.
  await game.locator('.vh-objective').click();
  await expect(game.locator('.vh-scard')).toBeVisible();
  await game.locator('.vh-scard-go').click();
  await expect(game.locator('.vh-objective')).toBeVisible();
  // Doing the objective whenever they like still moves the story on.
  const pos = await inGame<[number, number] | null>(page, "v.clientPosOf('box.couch')");
  await page.mouse.click(pos![0], pos![1]);
  await expect.poll(async () => (await objects(page)).some((o) => o.id === 'box.couch' && o.type === 'sofa')).toBe(true);
  expect(pageErrors(page)).toEqual([]);
});

test('a reload after the box is open resumes at the placement lesson instead of waiting for the box again', async ({ page }) => {
  test.setTimeout(300_000);
  const game = await openGame(page, { script: true });
  await expect.poll(() => storyTap(game), { timeout: 200_000, intervals: [300] }).toBe('Open the box');
  const pos = await inGame<[number, number] | null>(page, "v.clientPosOf('box.couch')");
  await page.mouse.click(pos![0], pos![1]);
  await expect.poll(async () => (await objects(page)).some((o) => o.id === 'box.couch' && o.type === 'sofa')).toBe(true);
  await inGame(page, 'v.saveGame()');
  await openGame(page, { script: true, fresh: false });
  // Back in the lesson: the partner's ask, then the placement card; the "open the box" card is gone.
  await expect.poll(() => storyTap(game), { timeout: 30_000, intervals: [300] }).toBe('Put it where it goes');
  expect(pageErrors(page)).toEqual([]);
});
