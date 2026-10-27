import { startChain } from '../state/agents';
import { stockFridge } from '../state/household';
import type { Game } from '../kernel/game';

/** An order waiting for Dez: the shop's furniture, and later anything else that comes in a box. */
export interface Order { id: string; category: 'furniture' | 'decor'; due: number; type: string; name: string; col?: string }

/**
 * Everything that arrives at the door, and what the household does with it. Groceries and takeout are fetched by
 * whoever is free; once the story has introduced Dez (`dez.deliveries`), each arrival is handed to him as an event
 * and he carries it in. Shop furniture is ordered and arrives in a box. It also watches the household for the moments
 * the story waits on: a meal cooked, the dishes done, the groceries put away.
 */
export function createDeliveries(g: Game): Partial<Game> {
  const { world, people, house, rng, flags, log } = g;
  const dezMode = (): boolean => (flags.story as Record<string, unknown> | undefined)?.['dez.deliveries'] === true;
  const orders = (): Order[] => (flags.orders ??= []) as Order[];
  let fetching: { id: string; kind: string } | null = null;
  let prev = { dishes: world.household.dishes, meals: servings() };
  function servings(): number { const f = world.household.fridge; return f.basic + f.fresh; }

  function order(o: Omit<Order, 'due'>, afterMin: number): void {
    orders().push({ ...o, due: world.day * 1440 + world.minutes + afterMin });
  }

  function tick(): void {
    const h = world.household;
    const absM = world.day * 1440 + world.minutes;

    // Groceries and takeout that have reached the door: in Dez's arms first, once he is part of the story.
    if (h.parcel && h.parcel.ready === undefined && dezMode()) {
      h.parcel.ready = false;
      g.scriptEmit({ type: 'delivery.due', category: h.parcel.kind === 'groceries' ? 'food' : 'takeout', deliveryId: h.parcel.kind, carry: h.parcel.kind === 'groceries' ? 'groceries' : 'parcel' });
    }
    for (const o of [...orders()]) {
      if (absM < o.due) continue;
      orders().splice(orders().indexOf(o), 1);
      ((flags.dezOrders ??= {}) as Record<string, { type: string; col?: string }>)[o.id] = { type: o.type, col: o.col };
      g.scriptEmit({ type: 'delivery.due', category: o.category, deliveryId: o.id, carry: 'pbox' });
    }

    // Someone free fetches what is on the doorstep.
    if (!fetching && h.parcel && h.parcel.ready !== false) {
      const who = people.slice(0, 2).find((p) => !p.scripted && !p.task && !p.onStairs);
      if (who) {
        const kind = h.parcel.kind;
        if (startChain(house, who, kind === 'groceries' ? 'putaway' : 'takeout', people.find((p) => p !== who && p.kind !== 'npc') ?? null, () => rng.next())) fetching = { id: who.id, kind };
      }
    }
    if (fetching) {
      const who = people.find((p) => p.id === fetching!.id);
      if (!who || !who.task) {
        if (h.parcel) {
          if (fetching.kind === 'groceries') { stockFridge(h, log); g.scriptEmit({ type: 'groceries.putaway' }); } else h.parcel = null;
        }
        fetching = null;
      }
    }

    // What the story waits on.
    if (h.dishes > prev.dishes) g.scriptEmit({ type: 'meal.cooked' });
    if (h.dishes === 0 && prev.dishes > 0) g.scriptEmit({ type: 'dishes.washed' });
    prev = { dishes: h.dishes, meals: servings() };
  }

  return { deliveriesTick: tick, orderDelivery: order, dezDeliveries: dezMode };
}
