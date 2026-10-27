import { snapshot } from '../state/save';
import { SAVE_KEY, WALL_MODES, run } from '../kernel/config';
import type { Game } from '../kernel/game';

export function createPersist(g: Game): Partial<Game> {
  const { world, simName, partnerName, townName, people, rngSeed, view, owned, closet, flags, style, companionCfg, art, storage, coreMem, memories, pastMem } = g;
  // Save: one serializer (state/save.ts). What the game models comes from live state; the rest is carried over from the loaded save.
  function doSave(): void {
    if (run.attract) return;
    try {
      const data = snapshot({
        rev: ++g.s.saveRev, day: world.day, minutes: world.minutes,
        money: world.household.money, earnedToday: world.household.earnedToday, spentToday: world.household.spentToday,
        power: world.household.power, fridge: world.household.fridge, dishes: world.household.dishes, laundryPile: world.household.laundryPile,
        bill: world.household.bill, nextBillAt: world.household.nextBillAt,
        objs: world.objs, storage, owned: [...owned], closet: closet.filter(c => !c.id.startsWith('w-')), bond: g.s.bond, flags,
        simName, partnerName, look: people[0].look, mayaLook: people[1].look,
        needs: { jordan: people[0].needs, maya: people[1].needs },
        memories, coreMem, pastMem, townName, turns: g.s.chatTurns, rngSeed,
        lifeGoal: g.s.lifeGoal, settleDone: g.s.settleDone, freeWill: g.s.freeWill, style, companion: companionCfg as unknown as Record<string, unknown>,
        wallMode: WALL_MODES[view.wallIdx].mode,
        looks: art.exportLooks(),
        life: world.life,
      }, world.save);
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch { /* non-fatal */ }
  }

  // Auto-save (the title screen's backdrop is a throwaway house and never saves)
  if (!run.attract) {
    setInterval(doSave, 15000);
    window.addEventListener('pagehide', doSave);
    document.addEventListener('visibilitychange', () => { if (document.hidden) doSave(); });
  }
  return { doSave };
}
