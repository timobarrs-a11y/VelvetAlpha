import { TYPES, type ObjectInstance } from '../state/objects';
import { startChain } from '../state/agents';
import { relocate } from '../state/arrange';
import { CORNER_MARKET } from '../state/routine';
import { type TrayAction } from '../ui/dialogue';
import type { Game } from '../kernel/game';

export function createInteract(g: Game): Partial<Game> {
  const { world, people, house, rng, view, log, art, tray } = g;
  // Which part of the kitchen counter was tapped: the sink, the stove or the coffee machine.
  function counterPartAt(obj: ObjectInstance, sx: number, sy: number): string {
    if (obj.type !== 'counter') return '';
    const [wx, wy] = art.unproject(sx, sy);
    const along = obj.rot % 2 ? wy - obj.y : wx - obj.x;
    const parts: [string, number][] = [['sink', 0.65], ['stove', 1.65], ['coffee', 2.45]];
    return parts.reduce((best, p) => Math.abs(p[1] - along) < Math.abs(best[1] - along) ? p : best)[0];
  }

  // The piece under a tap, front-most, by its drawn shape: right at every rotation of the house. Floor openings are
  // part of the house, not something to tap.
  const NOT_TAPPABLE = new Set(['holeX', 'holeY']);
  function findObjectAt(sx: number, sy: number): ObjectInstance | null {
    const ids = world.objs.filter(o => o.level === view.level && !NOT_TAPPABLE.has(o.type)).map(o => o.id);
    return art.hitObject(view.level, sx, sy, ids);
  }

  function showObjectActions(obj: ObjectInstance, x: number, y: number, poked = false): void {
    const spots = TYPES[obj.type]?.spots;
    const isLight = Boolean(TYPES[obj.type]?.light);
    const acts: TrayAction[] = [];
    if (obj.type === 'pbox' && obj.contents) acts.push({ act: 'unpack', label: 'Unpack', icon: '' });
    if (obj.type === 'bag' && obj.contents) acts.push({ act: 'unpack', label: 'Open', icon: '' });
    if (isLight) acts.push({ act: 'toggleLight', label: 'Turn light on/off', icon: '' });
    if (obj.type === 'overseer') {
      acts.push({ act: 'overseerTalk', label: 'Ask for encouragement', icon: '' }, { act: 'overseerCake', label: 'Request cake', icon: '' }, { act: 'overseerUnplug', label: 'Unplug', icon: '' });
    }
    if (spots) {
      const tags = Object.values(spots).map(s => s.tag);
      const seen = new Set<string>();
      for (const tag of tags) {
        if (seen.has(tag)) continue;
        seen.add(tag);
        const label = actionLabel(tag);
        if (label) acts.push({ act: tag, label, icon: '' });
      }
    }
    if (acts.length === 0) return;
    // A tap that brought the object to life shouldn't also send Jordan over:
    // offer the action instead of doing it.
    if (acts.length === 1 && (!poked || acts[0].act === 'unpack')) { handleObjectAction(obj, acts[0].act); return; }
    tray.show(acts, x, y, (a) => handleObjectAction(obj, a.act));
  }

  function actionLabel(tag: string): string | null {
    const labels: Record<string, string> = {
      seat: 'Sit', bedA: 'Sleep', bedB: 'Sleep', dine1: 'Eat', dine2: 'Eat',
      stove: 'Cook', coffee: 'Make coffee', sink: 'Wash dishes', window: 'Look out',
      shower: 'Shower', tub: 'Bathe', tread: 'Run', lift: 'Lift weights', stretch: 'Stretch',
      records: 'Play records', arcade: 'Play arcade', claw: 'Try the claw', diffuse: 'Breathe in the mist', water: 'Water plants',
      tv: 'Watch TV', desk: 'Work', phone: 'Check phone', read: 'Read',
      piano: 'Play piano', easel: 'Paint', guitar: 'Play guitar',
      stars: 'Stargaze', boxbag: 'Box', bike: 'Ride bike', massage: 'Massage chair',
      hammock: 'Rest in hammock', jukebox: 'Play jukebox', fireside: 'Sit by fire',
      swim: 'Swim', grill: 'Grill', birds: 'Watch birds', garden: 'Tend garden',
      sprinkler: 'Sprinkler', bowl: 'Fill pet bowl', petbed: 'Pet bed',
      litter: 'Scoop litter', rummage: 'Rummage', washer: 'Do laundry',
    };
    return labels[tag] ?? null;
  }

  // A moving box becomes what was in it, on the same spot (or the nearest free one), ready to be placed.
  const unpacking = new Set<string>();
  function unpack(obj: ObjectInstance): void {
    const type = obj.contents;
    if (!type || !TYPES[type]) return;
    if (unpacking.has(obj.id)) return;
    // A cloud covers the box for a moment, and what was inside is there when it clears.
    const [bw, bd] = [TYPES[obj.type]?.W ?? 0.6, TYPES[obj.type]?.D ?? 0.5];
    art.poof(obj.level, obj.x + bw / 2, obj.y + bd / 2);
    unpacking.add(obj.id);
    setTimeout(() => {
      unpacking.delete(obj.id);
      if (!world.objs.includes(obj) || obj.contents !== type) return;
      const was = obj.type;
      obj.type = type;
      delete obj.contents;
      if (!relocate(world.objs, obj, obj.level, [], [obj.x, obj.y])) { obj.type = was; obj.contents = type; log('There is no room to unpack that here.'); return; }
      g.relearnLayout(obj);
      art.reveal(obj.id);
      art.burst(obj.level, obj.x + (TYPES[type]?.W ?? 0.6) / 2, obj.y + (TYPES[type]?.D ?? 0.5) / 2, 0.8);
      log(was === 'bag' ? 'Opened the groceries. Carry them to the fridge.' : `Unpacked the ${(TYPES[type]?.name ?? "piece").toLowerCase()}.`);
      g.scriptEmit({ type: 'obj.unpacked', objId: obj.id, objType: type });
      g.drawer.open('arrange');
      g.selectObject(obj);
    }, 380);
  }

  function handleObjectAction(obj: ObjectInstance, tag: string): void {
    if (tag === 'unpack') { unpack(obj); return; }
    if (tag.startsWith('overseer')) { g.overseerAction(obj, tag); return; }
    if (tag === 'toggleLight') {
      const on = art.toggleObjectLight(obj.id);
      log(`${TYPES[obj.type]?.name ?? 'Light'} turned ${on ? 'on' : 'off'}.`);
      g.scriptEmit({ type: 'light.toggled', objId: obj.id, objType: obj.type, on });
      return;
    }
    const chainMap: Record<string, string> = {
      stove: 'cookeat', sink: 'clean', coffee: 'coffee', shower: 'shower', tub: 'bath',
      seat: 'tv', bedA: 'sleep', bedB: 'sleep', dine1: 'cookeat', dine2: 'cookeat',
      tread: 'workout', lift: 'workout', stretch: 'stretch',
      records: 'records', arcade: 'arcade', claw: 'claw', diffuse: 'diffuse', water: 'plants',
      tv: 'tv', desk: 'freelance', phone: 'phone', read: 'read',
      piano: 'piano', easel: 'easel', guitar: 'guitar',
      stars: 'stargaze', boxbag: 'boxing', bike: 'bike',
      massage: 'massage', hammock: 'hammock', jukebox: 'jukebox',
      fireside: 'fire', swim: 'swim', grill: 'grill', birds: 'birds',
      garden: 'tend', sprinkler: 'sprinkle', bowl: 'feedPet',
      petbed: 'petPet', litter: 'scoop', rummage: 'rummage', washer: 'laundry',
    };
    if (tag === 'bowl' || tag === 'petbed' || tag === 'litter') {
      const pet = world.pets.find(p => p.bowl === obj.id || p.bed === obj.id || p.litter === obj.id) ?? world.pets[0];
      if (!pet) { log('No pet lives here yet. Adopt one in the shop (Pets).'); return; }
      g.petOrder(tag === 'bowl' ? 'feedPet' : tag === 'petbed' ? 'petPet' : 'scoop', pet.id);
      return;
    }
    const chain = chainMap[tag];
    if (chain) handleOrder(chain);
  }

  function handleOrder(chain: string): void {
    const jordan = people[0];
    if (jordan.away) { log(`${jordan.name} is at work until ${CORNER_MARKET.end - 12} PM.`); return; }
    world.life.working = null;
    startChain(house, jordan, chain, people[1], () => rng.next());
    view.follow = 'jordan';
    if (jordan.level !== view.level) g.setLevel(jordan.level, true);
    g.syncControls();
  }
  return { findObjectAt, showObjectActions, handleObjectAction, handleOrder, counterPartAt };
}
