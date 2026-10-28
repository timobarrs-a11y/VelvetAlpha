import { test, expect } from '@playwright/test';
import { inGame, openGame, setMoney, objects } from '../helpers';

// A themed set is reviewed as one picture: do the pieces and the walls read as one kitchen and living room?
// Each set lists what it sells; the main floor then wears all of it, by day and by night.
const SETS: Record<string, string[]> = {
  retro: ['look-fridge-retro', 'look-counter-retro', 'look-dining-retro', 'look-sofa-retro', 'look-lamp-retro', 'look-plant-retro', 'paper-starburst-mint', 'floor-linoleum'],
  farmhouse: ['look-fridge-farmhouse', 'look-counter-farmhouse', 'look-dining-farmhouse', 'look-sofa-farmhouse', 'look-lamp-farmhouse', 'look-plant-farmhouse', 'paper-gingham-sage', 'floor-barnwood'],
  modern: ['look-fridge-modern', 'look-counter-modern', 'look-dining-modern', 'look-sofa-modern', 'look-lamp-modern', 'look-plant-modern', 'paper-pin-slate', 'floor-charcoal'],
  scandi: ['look-fridge-scandi', 'look-counter-scandi', 'look-dining-scandi', 'look-sofa-scandi', 'look-lamp-scandi', 'look-plant-scandi', 'paper-birch', 'floor-nordic'],
  industrial: ['look-fridge-industrial', 'look-counter-industrial', 'look-dining-industrial', 'look-sofa-industrial', 'look-lamp-industrial', 'look-plant-industrial', 'paper-brick-white', 'floor-poured'],
  beach: ['look-fridge-beach', 'look-counter-beach', 'look-dining-beach', 'look-sofa-beach', 'look-lamp-beach', 'look-plant-beach', 'paper-stripe-nautical', 'floor-driftwood'],
  deco: ['look-fridge-deco', 'look-counter-deco', 'look-dining-deco', 'look-sofa-deco', 'look-lamp-deco', 'look-plant-deco', 'paper-deco-emerald', 'floor-ivorygold'],
  japandi: ['look-fridge-japandi', 'look-counter-japandi', 'look-dining-japandi', 'look-sofa-japandi', 'look-lamp-japandi', 'look-plant-japandi', 'paper-shoji', 'floor-tatami'],
  boho: ['look-fridge-boho', 'look-counter-boho', 'look-dining-boho', 'look-sofa-boho', 'look-lamp-boho', 'look-plant-boho', 'paper-arches-terracotta', 'floor-jute'],
  space: ['look-fridge-space', 'look-counter-space', 'look-dining-space', 'look-sofa-space', 'look-lamp-space', 'look-plant-space', 'paper-orbit', 'floor-moon'],
  gothic: ['look-fridge-gothic', 'look-counter-gothic', 'look-dining-gothic', 'look-sofa-gothic', 'look-lamp-gothic', 'look-plant-gothic', 'paper-damask-onyx', 'floor-herringebony', 'touches-gothic'],
  riad: ['look-fridge-riad', 'look-counter-riad', 'look-dining-riad', 'look-sofa-riad', 'look-lamp-riad', 'look-plant-riad', 'paper-zellige-cobalt', 'floor-zellige'],
  tropical: ['look-fridge-tropical', 'look-counter-tropical', 'look-dining-tropical', 'look-sofa-tropical', 'look-lamp-tropical', 'look-plant-tropical', 'paper-monstera-night', 'floor-bamboo', 'touches-tropical'],
  memphis: ['look-fridge-memphis', 'look-counter-memphis', 'look-dining-memphis', 'look-sofa-memphis', 'look-lamp-memphis', 'look-plant-memphis', 'paper-squiggle-pop', 'floor-terrazzopop'],
  provence: ['look-fridge-provence', 'look-counter-provence', 'look-dining-provence', 'look-sofa-provence', 'look-lamp-provence', 'look-plant-provence', 'paper-lavender-sprig', 'floor-limestone'],
  adobe: ['look-fridge-adobe', 'look-counter-adobe', 'look-dining-adobe', 'look-sofa-adobe', 'look-lamp-adobe', 'look-plant-adobe', 'paper-serape-adobe', 'floor-saltillo'],
  neon: ['look-fridge-neon', 'look-counter-neon', 'look-dining-neon', 'look-sofa-neon', 'look-lamp-neon', 'look-plant-neon', 'paper-circuit', 'floor-grate', 'touches-neon'],
  candy: ['look-fridge-candy', 'look-counter-candy', 'look-dining-candy', 'look-sofa-candy', 'look-lamp-candy', 'look-plant-candy', 'paper-sprinkles', 'floor-checkpink', 'touches-candy'],
  cuddle: ['look-fridge-cuddle', 'look-counter-cuddle', 'look-dining-cuddle', 'look-sofa-cuddle', 'look-lamp-cuddle', 'look-plant-cuddle', 'paper-clouds-sky', 'floor-skycheck', 'touches-cuddle'],
  arcade: ['look-fridge-arcade', 'look-counter-arcade', 'look-dining-arcade', 'look-sofa-arcade', 'look-lamp-arcade', 'look-plant-arcade', 'paper-pixel-invaders', 'floor-arcadecarpet', 'clawmachine', 'touches-arcade'],
  cloud: ['look-fridge-cloud', 'look-counter-cloud', 'look-dining-cloud', 'look-sofa-cloud', 'look-lamp-cloud', 'look-plant-cloud', 'paper-cloudnine-sky', 'floor-confetti'],
  spring: ['look-fridge-spring', 'look-counter-spring', 'look-dining-spring', 'look-sofa-spring', 'look-lamp-spring', 'look-plant-spring', 'paper-blossom-mint', 'floor-birch'],
  summer: ['look-fridge-summer', 'look-counter-summer', 'look-dining-summer', 'look-sofa-summer', 'look-lamp-summer', 'look-plant-summer', 'paper-stripe-sun', 'floor-honey'],
  fall: ['look-fridge-fall', 'look-counter-fall', 'look-dining-fall', 'look-sofa-fall', 'look-lamp-fall', 'look-plant-fall', 'paper-leaves', 'floor-chestnut'],
  winter: ['look-fridge-winter', 'look-counter-winter', 'look-dining-winter', 'look-sofa-winter', 'look-lamp-winter', 'look-plant-winter', 'paper-snow', 'floor-frostpine'],
};

for (const [set, ids] of Object.entries(SETS)) {
  for (const [time, minutes] of [['day', 13 * 60], ['night', 23 * 60]] as const) {
    test(`the ${set} set on the main floor, ${time}`, async ({ page }) => {
      const frame = await openGame(page, { freeze: true });
      await setMoney(page, 9999);
      await inGame(page, 'v.setView(1)');
      // Cuddle Clouds is a promo pack: a code gives it, so the pieces are theirs before they go on.
      if (set === 'cuddle') for (const id of ids) await inGame(page, `v.own('${id}')`);
      for (const id of ids) await inGame(page, `v.buy('${id}')`);
      // Every piece kept its place: a look never moves anything.
      const wearing = (await objects(page)).filter((o) => o.level === 1 && ['fridge', 'counter', 'dining', 'sofa', 'lamp1', 'plant1'].includes(o.id));
      expect(wearing).toHaveLength(6);
      await inGame(page, `v.setMinutes(${minutes})`);
      await page.waitForTimeout(2600);
      // The log and the vitals are hidden for the shot: the companion's taste is rolled per game, so her reaction lines, the log's height and the bond bar vary from run to run.
      for (const q of ['.vh-log', '.vh-vitals']) await frame.locator(q).first().evaluate((el) => { (el as HTMLElement).style.visibility = 'hidden'; });
      await expect(page).toHaveScreenshot(`set-${set}-${time}.png`);
    });
  }
}
