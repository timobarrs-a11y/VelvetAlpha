import { test, expect } from '@playwright/test';
import { inGame, openGame, setMoney, objects } from '../helpers';

// A themed set is reviewed as one picture: do the pieces and the walls read as one kitchen and living room?
// Each set lists what it sells; the main floor then wears all of it, by day and by night.
const SETS: Record<string, string[]> = {
  retro: ['look-fridge-retro', 'look-counter-retro', 'look-dining-retro', 'look-sofa-retro', 'look-lamp-retro', 'look-plant-retro', 'paper-starburst-mint', 'floor-linoleum'],
};

for (const [set, ids] of Object.entries(SETS)) {
  for (const [time, minutes] of [['day', 13 * 60], ['night', 23 * 60]] as const) {
    test(`the ${set} set on the main floor, ${time}`, async ({ page }) => {
      await openGame(page, { freeze: true });
      await setMoney(page, 9999);
      await inGame(page, 'v.setView(1)');
      for (const id of ids) await inGame(page, `v.buy('${id}')`);
      // Every piece kept its place: a look never moves anything.
      const wearing = (await objects(page)).filter((o) => o.level === 1 && ['fridge', 'counter', 'dining', 'sofa', 'lamp1', 'plant1'].includes(o.id));
      expect(wearing).toHaveLength(6);
      await inGame(page, `v.setMinutes(${minutes})`);
      await page.waitForTimeout(2600);
      await expect(page).toHaveScreenshot(`set-${set}-${time}.png`);
    });
  }
}
