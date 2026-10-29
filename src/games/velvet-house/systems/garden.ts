/**
 * What the player does with the garden bed from the Orders page: plant a packet, water it, or harvest when it is ripe.
 * Seeds are bought in the shop and kept as packets in the flags. A packet is used up when it is planted.
 */
import type { ObjectInstance } from '../state/objects';
import { CROPS, cropOf, WATERED, FRUIT_TREES, type CropId } from '../state/crops';

export type GardenAction = 'plant' | 'water' | 'harvest' | 'clear';

export function gardenAction(
  objs: ObjectInstance[],
  flags: Record<string, unknown>,
  fridge: { fresh: number },
  action: GardenAction,
  crop: string | undefined,
  log: (msg: string) => void,
  bedId?: string,
): void {
  const bed = (bedId ? objs.find((o) => o.id === bedId && o.type === 'garden') : undefined) ?? objs.find((o) => o.type === 'garden');
  if (!bed) { log('There is no garden bed in the yard.'); return; }
  const packets = (flags.seedPackets ?? {}) as Record<string, number>;
  const current = cropOf(bed.crop);

  if (action === 'clear') {
    if (!current || !bed.dead) { log('Nothing to clear.'); return; }
    log(`Cleared the dead ${current.name.toLowerCase()} from the bed.`);
    bed.crop = null;
    bed.grow = 0;
    bed.dry = 0;
    bed.dead = false;
    return;
  }

  if (action === 'plant') {
    const def = cropOf(crop);
    if (!def || !crop) return;
    if (bed.dead) { log('Clear the dead crop from the bed first.'); return; }
    if (current) { log(`The bed already has ${current.name.toLowerCase()} growing.`); return; }
    if ((packets[crop] ?? 0) <= 0) { log(`No ${def.name.toLowerCase()} seeds left. Buy a packet in the shop.`); return; }
    packets[crop] -= 1;
    flags.seedPackets = packets;
    bed.crop = crop;
    bed.grow = 0;
    bed.dry = 0;
    bed.wet = Math.max(bed.wet ?? 0, WATERED);
    log(`Planted ${def.name.toLowerCase()} in the garden bed.`);
    return;
  }

  if (action === 'water') {
    if (!current) { log('Plant something in the bed before watering it.'); return; }
    if (bed.dead) { log(`It is too late for the ${current.name.toLowerCase()}. Clear the bed to plant again.`); return; }
    bed.wet = WATERED;
    log(`Watered the ${current.name.toLowerCase()}.`);
    return;
  }

  // Harvest: only a ripe crop, and the bed is empty again afterwards.
  if (!current) { log('Nothing to harvest.'); return; }
  if (bed.dead) { log(`The ${current.name.toLowerCase()} died. Clear the bed instead.`); return; }
  if ((bed.grow ?? 0) < 1) { log(`The ${current.name.toLowerCase()} aren't ripe yet.`); return; }
  const id = bed.crop as CropId;
  if (id === 'flower') log(`Picked the ${CROPS[id].name.toLowerCase()}. They brighten up the living room.`);
  else {
    fridge.fresh += CROPS[id].meals;
    log(`Picked the ${CROPS[id].name.toLowerCase()}. ${CROPS[id].meals} meal${CROPS[id].meals === 1 ? '' : 's'}' worth went into the fridge.`);
  }
  flags.harvests = ((flags.harvests as number) ?? 0) + 1;
  if (CROPS[id].harvest === 'repeat') {
    // A bush keeps its roots: it goes back to mid-size and fruits again.
    bed.grow = 0.5;
    log(`The ${current.name.toLowerCase()} will fruit again.`);
    return;
  }
  bed.crop = null;
  bed.grow = 0;
  bed.dry = 0;
}

export type TreeAction = 'water' | 'harvest';

/**
 * What the player does with a fruit tree: water a sapling, or pick (shake) a grown tree. A ripe tree gives up its fruit, which goes into
 * the fridge as meals, and starts bearing again; one that is not ripe only shivers. `shaken` is told when the tree was shaken and how
 * many pieces fell, so the art can drop them.
 */
export function treeAction(
  objs: ObjectInstance[],
  id: string,
  action: TreeAction,
  fridge: { fresh: number },
  flags: Record<string, unknown>,
  log: (msg: string) => void,
  shaken?: (tree: ObjectInstance, fell: number) => void,
): void {
  const tree = objs.find((o) => o.id === id), def = tree && FRUIT_TREES[tree.type];
  if (!tree || !def) return;
  const name = def.name.toLowerCase(), grown = (tree.grow ?? 0) >= 1;
  if (action === 'water') {
    if (grown) { log(`The ${name} is grown and looks after itself.`); return; }
    tree.wet = WATERED;
    log(`Watered the ${name} sapling.`);
    return;
  }
  if (!grown) { log(`The ${name} is still growing. Water it, and give it time.`); return; }
  if ((tree.fruit ?? 0) < 1) { shaken?.(tree, 0); log(`Gave the ${name} a shake. Nothing is ripe yet.`); return; }
  fridge.fresh += def.meals;
  tree.fruit = 0;
  flags.harvests = ((flags.harvests as number) ?? 0) + 1;
  shaken?.(tree, 99);
  log(`Shook the ${name}: ripe ${def.fruit} dropped. ${def.meals} meals' worth went into the fridge.`);
}
