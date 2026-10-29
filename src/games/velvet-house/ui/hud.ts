import { ownsAvatarItem } from '../bridge/avatarShop';
import { simsShopItems, itemLabel } from '../../../data/avatarCatalog';
import { LEVEL_NAMES, LEVELS, FLOOR_ORDER, ATTIC } from '../state/house';
import { isPaintable } from '../state/scenes';
import { NEED_KEYS } from '../state/needs';
import { statusText } from '../state/agents';
import { type GoalContext } from '../state/goals';
import { type DrawerState } from '../ui/drawer';
import { phoneView } from '../ui/phone';
import { SIDE_JOBS, progress } from '../state/sideJobs';
import { cropOf, DRY_AT, FRUIT_TREES, FRUIT_RIPE_AT, cropEta, treeEta } from '../state/crops';
import { seasonOf } from '../state/weather';
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
      level: view.level, levelNames: [...LEVEL_NAMES], shopRooms: LEVELS[view.level]?.rooms.length > 1 ? LEVELS[view.level].rooms.map((r) => r.n) : [], shopRoom: view.room, shopLevels: FLOOR_ORDER.filter(l => isPaintable(l) && (l !== ATTIC || hasAttic())), lookInfo: art.lookInfo, pictureThumbs,
      page: g.s.drawerPage, shopTab: 'Today',
      money: world.household.money, bond: g.s.bond, day: world.day,
      minutes: world.minutes, owned, careerLevel: 0, careerPerf: 0,
      lifeGoal: g.s.lifeGoal, settleSeen: flags.settleSeen as string[] ?? [],
      goalCtx, dishes: world.household.dishes,
      laundryPile: world.household.laundryPile,
      fridgeBasic: world.household.fridge.basic,
      fridgeFresh: world.household.fridge.fresh,
      power: world.household.power,
      phone: phoneView(world.household, world.life, world.day, world.minutes, !!people[0].away),
      billAmount: world.household.bill?.amount ?? null,
      billOverdue: world.household.bill?.overdue ?? false,
      petCount: world.pets.length, petFood: world.petFood, pets: g.petViews(), log: logEntries,
      partnerName, simName, townName,
      deliveryPending: !!world.household.delivery,
      mayaStatus: statusText(people[1]),
      timed: timedRows(),
      garden: ((bed) => ({ bed: !!bed, crop: bed?.crop ?? null, grow: bed?.grow ?? 0, wet: bed?.wet ?? 0, dead: !!bed?.dead, dry: bed?.dry ?? 0, packets: (flags.seedPackets ?? {}) as Record<string, number> }))(world.objs.find(o => o.type === 'garden')),
      beds: world.objs.filter(o => o.type === 'garden').map(o => ({ id: o.id, crop: o.crop ?? null, grow: o.grow ?? 0, wet: o.wet ?? 0, dead: !!o.dead, eta: cropEta(o, seasonOf(world.day)) })),
      trees: world.objs.filter(o => FRUIT_TREES[o.type]).map(o => ({ id: o.id, type: o.type, grow: o.grow ?? 0, fruit: o.fruit ?? 0, wet: o.wet ?? 0, eta: treeEta(o, seasonOf(world.day)) })),
      closet,
      personas: g.s.wardrobe?.personas ?? [],
      wearing: { top: people[0].look.top, topStyle: people[0].look.topStyle, topGarment: people[0].look.topGarment, bottomGarment: people[0].look.bottomGarment, bottom: people[0].look.bottom, bottomStyle: people[0].look.bottomStyle, hat: g.s.wornHat },
      salon: simsShopItems().map(i => ({
        id: i.id, name: itemLabel(i.id), price: i.price, owned: ownsAvatarItem(i.id),
        swatch: i.id.startsWith('hairHighlight:') || i.id.startsWith('hairColor:') ? i.id.split(':')[1] : undefined,
      })),
    };
    drawer.render(drawerState);
  }

  // What is in progress, for the Goals page: each side job Jordan has taken, and the garden bed while it has a crop.
  function timedRows(): { label: string; pct: number; note: string; tone: 'ok' | 'mid' | 'low' | 'ripe' }[] {
    const rows: { label: string; pct: number; note: string; tone: 'ok' | 'mid' | 'low' | 'ripe' }[] = [];
    for (const t of world.life.taken) {
      rows.push({ label: `${SIDE_JOBS[t.job].title} (${t.client})`, pct: progress(t), note: world.life.working === t.id ? 'working on it now' : 'waiting', tone: 'ok' });
    }
    const season = seasonOf(world.day);
    for (const bed of world.objs.filter(o => o.type === 'garden')) {
      const crop = cropOf(bed.crop);
      if (!crop) continue;
      const pct = Math.round((bed.grow ?? 0) * 100), dry = (bed.wet ?? 0) <= DRY_AT;
      rows.push({ label: `${crop.name} in the garden`, pct, note: bed.dead ? 'died' : cropEta(bed, season), tone: bed.dead ? 'low' : dry ? 'mid' : pct >= 100 ? 'ripe' : 'ok' });
    }
    for (const tree of world.objs.filter(o => FRUIT_TREES[o.type])) {
      const def = FRUIT_TREES[tree.type], grown = (tree.grow ?? 0) >= 1, pct = Math.round((grown ? tree.fruit ?? 0 : tree.grow ?? 0) * 100), dry = !grown && (tree.wet ?? 0) <= DRY_AT;
      rows.push({ label: grown ? `${def.name}: ${def.fruit}` : `${def.name} growing`, pct, note: treeEta(tree, season), tone: dry ? 'mid' : pct >= FRUIT_RIPE_AT * 100 && grown ? 'ripe' : 'ok' });
    }
    return rows;
  }

  // People refresh
  const refreshPeople = (): void => {
    people.filter((p) => p.kind !== 'npc').forEach((p) => {
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
