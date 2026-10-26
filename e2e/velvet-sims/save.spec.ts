import { test, expect } from '@playwright/test';
import { openGame, saveNow, savedGame, setMoney, SAVE_KEY, waitReady } from './helpers';

test('paint, floors and a carried-over career survive a reload', async ({ page }) => {
  const game = await openGame(page);
  await setMoney(page, 5000);
  await game.locator('.vh-dock [data-open=shop]').click();
  await game.locator('[data-tab=Paint]').click();
  await game.locator('[data-buy=paint-wine]').click();
  await game.locator('[data-tab=Floors]').click();
  await game.locator('[data-buy=floor-herring]').click();
  await saveNow(page);
  // An older save has data the game does not use yet: it must come through untouched. The edit is made as the
  // page loads (the page saves on the way out, which would overwrite an edit made before the reload).
  await page.context().addInitScript((key) => {
    try {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      const j = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (!j) return;
      j.career = { level: 2, perf: 4.5 };
      j.pets = [{ id: 'p1', name: 'Miso' }];
      localStorage.setItem(key, JSON.stringify(j));
    } catch { /* not the game's origin yet */ }
  }, SAVE_KEY);
  await page.reload();
  await waitReady(page);
  await saveNow(page);
  const saved = await savedGame(page);
  expect(saved.LOOKS[1].paint).toBe('#6E3C50');
  expect(saved.LOOKS[1].floor).toBe('herring');
  expect(saved.career).toEqual({ level: 2, perf: 4.5 });
  expect(saved.pets).toEqual([{ id: 'p1', name: 'Miso' }]);
  expect(saved.yard.t).toHaveLength(80);
});
