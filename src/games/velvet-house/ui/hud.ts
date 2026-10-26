import { ownsAvatarItem } from '../bridge/avatarShop';
import { simsShopItems, itemLabel } from '../../../data/avatarCatalog';
import { LEVEL_NAMES, FLOOR_ORDER, ATTIC } from '../state/house';
import { NEED_KEYS } from '../state/needs';
import { statusText } from '../state/agents';
import { type GoalContext } from '../state/goals';
import { type DrawerState } from '../ui/drawer';
import type { Game } from '../kernel/game';

export function createHud(g: Game): Partial<Game> {
  const { world, simName, partnerName, townName, people, view, owned, closet, flags, logEntries, personEl, art, pictureThumbs, hasAttic, drawer } = g;
  // Drawer refresh
  function refreshDrawer(): void {
    const goalCtx: GoalContext = {
      flags: flags as never,
      career: { level: 0, perf: 0 } as never,
      bond: g.s.bond,
      hasSofaOnLevel1: world.objs.some(o => o.type === 'sofa' && o.level === 1),
      hasPackedBoxes: world.objs.some(o => o.type === 'pbox'),
      lawnLabel: 'Lush', lawnWeeds: 0,
    };
    const drawerState: DrawerState = {
      arrange: g.isArranging() ? g.arrangeState() : null,
      level: view.level, levelNames: [...LEVEL_NAMES], shopLevels: FLOOR_ORDER.filter(l => l !== 3 && (l !== ATTIC || hasAttic())), lookInfo: art.lookInfo, pictureThumbs,
      page: g.s.drawerPage, shopTab: 'Today',
      money: world.household.money, bond: g.s.bond, day: world.day,
      minutes: world.minutes, owned, careerLevel: 0, careerPerf: 0,
      lifeGoal: g.s.lifeGoal, settleSeen: flags.settleSeen as string[] ?? [],
      goalCtx, dishes: world.household.dishes,
      laundryPile: world.household.laundryPile,
      fridgeBasic: world.household.fridge.basic,
      fridgeFresh: world.household.fridge.fresh,
      power: world.household.power,
      billAmount: world.household.bill?.amount ?? null,
      billOverdue: world.household.bill?.overdue ?? false,
      petCount: 0, log: logEntries,
      partnerName, simName, townName,
      deliveryPending: !!world.household.delivery,
      mayaStatus: statusText(people[1]),
      closet,
      personas: g.s.wardrobe?.personas ?? [],
      wearing: { top: people[0].look.top, topStyle: people[0].look.topStyle, bottom: people[0].look.bottom, bottomStyle: people[0].look.bottomStyle, hat: g.s.wornHat },
      salon: simsShopItems().map(i => ({
        id: i.id, name: itemLabel(i.id), price: i.price, owned: ownsAvatarItem(i.id),
        swatch: i.id.startsWith('hairHighlight:') || i.id.startsWith('hairColor:') ? i.id.split(':')[1] : undefined,
      })),
    };
    drawer.render(drawerState);
  }

  // People refresh
  const refreshPeople = (): void => {
    people.forEach((p) => {
      const root = personEl(p.id);
      root.querySelector<HTMLElement>('[data-status]')!.textContent = statusText(p);
      root.querySelector<HTMLElement>('[data-where]')!.textContent = LEVEL_NAMES[p.level];
      NEED_KEYS.forEach((k) => {
        const bar = root.querySelector<HTMLElement>(`[data-need="${k}"]`)!;
        const v = p.needs[k];
        bar.style.width = `${Math.round(v)}%`;
        bar.dataset.tone = v < 25 ? 'low' : v < 55 ? 'mid' : 'ok';
      });
    });
  };
  return { refreshDrawer, refreshPeople };
}
