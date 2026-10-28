import { test, expect } from '@playwright/test';
import { openGame, objects, inGame, pageErrors } from './helpers';

// The upstairs packs: bought upstairs, a pack restyles the bedroom and bath there, papers and floors it, and adds its piece.
test('buying the Brutalist Loft pack upstairs restyles the bedroom and bath', async ({ page }) => {
  await openGame(page);
  await inGame(page, '(v.money = 20000)');
  await inGame(page, 'v.setView(2)');
  await inGame(page, "v.buy('set-brutalist')");
  const up = (await objects(page)).filter((o) => o.level === 2);
  for (const t of ['bed', 'nightstand', 'dresser', 'toilet', 'vanity', 'shower']) expect(up.find((o) => o.type === t)!.skin, t).toBe('brutalist');
  expect(up.some((o) => o.type === 'overseer')).toBe(true);
  await inGame(page, 'v.resetCamera()');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `e2e/velvet-sims/test-results/pack-brutalist-${test.info().project.name}.png` });
  expect(pageErrors(page)).toEqual([]);
});
