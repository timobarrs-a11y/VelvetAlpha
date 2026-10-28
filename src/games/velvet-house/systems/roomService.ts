import { findPath, nearestFree, cellOf } from '../state/pathfinding';
import { STAIRS } from '../state/house';
import { TYPES, type ObjectInstance } from '../state/objects';
import type { Game } from '../kernel/game';

export const ROOM_SERVICE_PRICE = 20;
const SPEED = 1.1, WAIT = 25;

/** Where the cart comes in on a floor: the top of the flight that leads up to it, else the foot of the one leading on. */
export function cartEntry(level: number): [number, number] | null {
  const up = STAIRS.find((s) => s.upper === level && !s.door);
  if (up) return up.upperNode;
  const down = STAIRS.find((s) => s.lower === level && !s.door);
  return down ? down.lowerNode : null;
}

/** A free spot beside the bed, on the open side of it. */
export function bedside(bed: ObjectInstance): [number, number] {
  const t = TYPES[bed.type], [w, d] = bed.rot % 2 ? [t.D, t.W] : [t.W, t.D];
  return [bed.x + w + 0.45, bed.y + d / 2];
}

/**
 * Room service. Ring the service bell, pay for breakfast, and a cart rolls from the stairs to the bed, waits there while
 * the coffee steams, and rolls back out. Whoever is on that floor when it arrives eats. Once a day.
 */
export function createRoomService(g: Game): Partial<Game> {
  const { world, people, view, log, art, house } = g;
  let servedDay = -1;
  let arrival: { at: number; level: number } | null = null;

  function ringBell(obj: ObjectInstance): void {
    if (art.roomServiceBusy()) { log('Ding! The cart is already on its way.'); return; }
    if (servedDay === world.day) { log('Ding! Room service is closed until tomorrow morning.'); return; }
    const bed = world.objs.find((o) => o.type === 'bed' && o.level === obj.level) ?? world.objs.find((o) => o.type === 'bed');
    if (!bed) { log('Ding! There is no bed to bring breakfast to.'); return; }
    const from = cartEntry(bed.level);
    if (!from) { log('Ding! The cart cannot reach that floor.'); return; }
    const grid = house.grids[bed.level];
    const goal = bedside(bed), free = nearestFree(grid, cellOf(goal[0], goal[1]));
    if (!free) { log('Ding! There is no room by the bed for the cart.'); return; }
    if (!g.spendOn('Room service', ROOM_SERVICE_PRICE)) { log('Ding! Room service is $20, and you are short.'); return; }
    servedDay = world.day;
    const pts: [number, number][] = [from, ...findPath(grid, from[0], from[1], goal[0], goal[1])];
    art.roomService(bed.level, pts);
    const len = pts.slice(1).reduce((s, p, k) => s + Math.hypot(p[0] - pts[k][0], p[1] - pts[k][1]), 0);
    arrival = { at: view.t + len / SPEED, level: bed.level };
    log(`Ding! Room service: breakfast is on its way to the ${bed.level === 2 ? 'bedroom' : 'bed'} ($${ROOM_SERVICE_PRICE}).`);
  }

  // When the cart reaches the bed, whoever is on that floor has breakfast.
  function roomServiceTick(): void {
    if (!arrival || view.t < arrival.at) return;
    const here = people.slice(0, 2).filter((p) => p.level === arrival!.level && !p.away);
    for (const p of here) { p.needs.food = Math.min(100, p.needs.food + 45); p.needs.comfort = Math.min(100, p.needs.comfort + 15); }
    log(here.length ? `Breakfast in bed: coffee, juice and something under a silver cloche. ${here.map((p) => p.name).join(' and ')} tuck in.` : 'Breakfast is waiting by the bed. Nobody is up there to eat it.');
    arrival = null;
  }

  return { ringBell, roomServiceTick };
}
export { SPEED as CART_SPEED, WAIT as CART_WAIT };
