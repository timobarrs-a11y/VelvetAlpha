import { test, expect } from '@playwright/test';
import { openGame, objects, inGame, pageErrors } from './helpers';

/**
 * The whole first day, played the way a new player would: skip the cutscene, then do what each card asks (unpack and
 * place the lamp, open the shop, order groceries and let Dez bring them, cook, wash up, talk, paint, go upstairs, be told
 * about the rent) until the tutorial is over and the household looks after itself.
 */
test.setTimeout(900_000);

test('the first day plays through from the move-in to free will', async ({ page }) => {
  const game = await openGame(page, { script: true });
  const story = async (): Promise<Record<string, unknown>> => JSON.parse(await inGame<string>(page, 'v.story()'));
  const card = async (): Promise<string> => ((await game.locator('.vh-scard:visible strong').count()) ? (await game.locator('.vh-scard strong').innerText()) : '');
  const done: string[] = [];
  const once = (key: string): boolean => (done.includes(key) ? false : (done.push(key), true));

  await game.locator('.vh-skip').click();

  const deadline = Date.now() + Number(process.env.DAY1_MS ?? 800_000);
  let lastLog = 0;
  const t0 = Date.now();
  let flags = await story();
  while (!flags['tutorial.done'] && Date.now() < deadline) {
    // Lines of speech are tapped through; a choice takes its first option.
    if (await game.locator('.vh-speech:visible').count()) await game.locator('.vh-speech').click().catch(() => {});
    if (await game.locator('.vh-choices:visible button').count()) await game.locator('.vh-choices button').first().click().catch(() => {});
    const title = await card();
    flags = await story();
    if (title && once('log:' + title)) console.log('STEP', Math.round((Date.now() - t0) / 1000), title);

    if (!flags['tutorial.lamp']) {
      const arranging = await game.locator('.vh-stage.vh-arranging').count();
      const box = (await objects(page)).find((o) => o.id === 'box.lamp' && o.type === 'pbox');
      if (arranging) { await game.getByRole('button', { name: 'Rotate' }).first().click().catch(() => {}); await inGame(page, 'v.closeDrawer()'); }
      else if (box) {
        // Jordan wandering to another floor takes the view with him; come back and let the camera settle before tapping.
        if ((await inGame<number>(page, 'v.level()')) !== 1) { await inGame(page, 'v.setView(1)'); await page.waitForTimeout(1500); }
        else { const p = await inGame<[number, number]>(page, "v.clientPosOf('box.lamp')"); await page.mouse.click(p[0], p[1]); }
      }
    } else if (title === 'The shop' && once('shop')) await inGame(page, "v.openTab('shop')");
    else if (title === 'Order groceries' && once('groceries')) { await inGame(page, "v.openTab('home')"); await game.locator('[data-groceries]').click(); await inGame(page, 'v.closeDrawer()'); }
    else if (flags['tutorial.shop'] && !flags['tutorial.groceries'] && !(await inGame<string>(page, 'v.parcel()')).includes('"ready":false')) await inGame(page, 'v.advance(5)');
    else if (title === 'Cook something' && once('cook')) { await inGame(page, "v.openTab('do')"); await game.getByRole('button', { name: 'Cook a meal' }).first().click(); await inGame(page, 'v.closeDrawer()'); }
    else if (title === 'Wash up' && once('wash')) { await inGame(page, "v.openTab('do')"); await game.getByRole('button', { name: 'Clean up' }).first().click(); await inGame(page, 'v.closeDrawer()'); }
    else if (title === 'Talk to your partner' && once('talk')) { await inGame(page, "v.openChat()"); await page.waitForTimeout(500); await inGame(page, 'v.closeChat()'); }
    else if (title === 'Make one room yours' && once('paint')) { await inGame(page, 'v.setView(1)'); await inGame(page, "v.buy('paint-sage')"); }
    else if (title === 'Floors and the camera' && once('floors')) await inGame(page, 'v.setView(2)');
    else if (flags['tutorial.upstairs'] && !flags.tutorial) await inGame(page, 'v.setMinutes(15 * 60 + 5)');
    if (Date.now() - lastLog > 15_000) { lastLog = Date.now(); console.log('PROGRESS', title, Object.keys(flags).filter((k) => k.startsWith('tutorial')).join(','), (await inGame<string>(page, 'v.scriptState()')).replace(/"trace":"[^"]*?(\\S+ \\S+ \\S+)"/, '"tail":"$1"').slice(0, 260), await game.locator('.vh-stage.vh-arranging').count(), await inGame<number>(page, 'v.level()'), Object.keys(flags).filter((k) => k.startsWith('did.')).join(',')); }
    await page.waitForTimeout(400);
  }

  flags = await story();
  expect(flags['tutorial.done']).toBe(true);
  expect(flags['tutorial.groceries']).toBe(true);
  expect(flags['tutorial.dishes']).toBe(true);
  expect(flags['tutorial.room']).toBe(true);
  expect(pageErrors(page)).toEqual([]);
  // The lamp was unpacked and placed, and the household is on its own now.
  expect((await objects(page)).some((o) => o.id === 'box.lamp' && o.type === 'lamp')).toBe(true);
});
