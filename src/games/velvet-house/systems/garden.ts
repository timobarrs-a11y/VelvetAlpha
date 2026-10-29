/**
 * What the player does with the garden bed from the Orders page: plant a packet, water it, or harvest when it is ripe.
 * Seeds are bought in the shop and kept as packets in the flags. A packet is used up when it is planted.
 */
import type { ObjectInstance } from '../state/objects';
import { CROPS, cropOf, WATERED, type CropId } from '../state/crops';

export type GardenAction = 'plant' | 'water' | 'harvest' | 'clear';

export function gardenAction(
  objs: ObjectInstance[],
  flags: Record<string, unknown>,
  fridge: { fresh: number },
  action: GardenAction,
  crop: string | undefined,
  log: (msg: string) => void,
): void {
  const bed = objs.find((o) => o.type === 'garden');
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
  else { fridge.fresh += 2; log(`Picked the ${CROPS[id].name.toLowerCase()}. Two meals' worth went into the fridge.`); }
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
