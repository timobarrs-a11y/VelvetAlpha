import { test, expect } from '@playwright/test';
import { openGame, objects, inGame, pageErrors } from './helpers';

// A friend who moves in is a roommate: two beds, a roommate joke from Dez, and lines in their own style.
test('a friend companion gets the roommates opening', async ({ page }) => {
  test.setTimeout(180_000);
  const game = await openGame(page, { script: true });
  await page.evaluate(() => {
    const f = document.getElementById('g') as HTMLIFrameElement;
    f.contentWindow!.postMessage({
      type: 'velvet:profile',
      player: { name: 'Sam' },
      companion: { name: 'Riley', pronoun: 'she', gender: 'female', personality: 'dry', humor: 'Sarcastic & Dry - Subtle & Deadpan', communication: 'Playfully Indirect - Hints, Teases, Makes You Guess', relationship: 'friend', memories: [], likes: [], dislikes: [] },
    }, location.origin);
  });
  await expect.poll(async () => (await objects(page)).some((o) => o.id === 'bedA')).toBe(true);
  const objs = await objects(page);
  expect(objs.some((o) => o.id === 'bed')).toBe(false);
  expect(objs.find((o) => o.id === 'bedB')).toBeTruthy();

  // Tap through Dez's welcome and the first reactions.
  const said: string[] = [];
  await expect.poll(async () => {
    if (await game.locator('.vh-speech:visible').count()) {
      const t = (await game.locator('.vh-speech').innerText()).replace(/\n/g, ' ');
      if (!said.includes(t)) { said.push(t); console.log('SAID', t.slice(0, 90)); }
      await game.locator('.vh-speech').click().catch(() => {});
    }
    return said.some((t) => /roommates/.test(t));
  }, { timeout: 60_000, intervals: [250], message: () => said.join(' / ') }).toBe(true);
  const all = said.join(' | ');
  console.log(all);
  expect(all).toMatch(/Come on in, Sam and Riley! Welcome to your new home/);
  expect(all).toMatch(/Great\. The mover can't stay on the road/); // Riley's dry humor
  expect(all).not.toMatch(/babe/i);
  expect(pageErrors(page)).toEqual([]);
  expect(await inGame<number>(page, 'v.level()')).toBeGreaterThan(-1);
});
