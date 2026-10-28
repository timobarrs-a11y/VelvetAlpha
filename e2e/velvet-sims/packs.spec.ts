import { test, expect } from '@playwright/test';
import { openGame, objects, inGame, pageErrors } from './helpers';

// The upstairs packs: bought upstairs, a pack restyles the bedroom and bath there, papers and floors it, and adds its piece.
const PACKS = [
  { theme: 'brutalist', extra: 'overseer' },
  { theme: 'spa', extra: 'diffuser' },
  { theme: 'hotel', extra: 'servicebell' },
  { theme: 'cottage', extra: 'musicbox' },
  { theme: 'midcentury', extra: 'hificonsole' },
];
for (const P of PACKS) {
  test(`buying the ${P.theme} pack upstairs restyles the bedroom and bath`, async ({ page }) => {
    await openGame(page);
    await inGame(page, '(v.money = 20000)');
    await inGame(page, 'v.setView(2)');
    await inGame(page, `v.buy('set-${P.theme}')`);
    const up = (await objects(page)).filter((o) => o.level === 2);
    for (const t of ['bed', 'nightstand', 'dresser', 'toilet', 'vanity', 'shower']) expect(up.find((o) => o.type === t)!.skin, t).toBe(P.theme);
    expect(up.some((o) => o.type === P.extra)).toBe(true);
    await inGame(page, 'v.resetCamera()');
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `e2e/velvet-sims/test-results/pack-${P.theme}-${test.info().project.name}.png` });
    expect(pageErrors(page)).toEqual([]);
  });
}
