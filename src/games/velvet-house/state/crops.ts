/**
 * The garden bed grows one crop at a time. A bed grows only while it is wet, and it is wet only because the player
 * waters it (or it rains, once the weather is wired in). A dry bed stops growing and says so; nothing dies.
 * Growth is kept on the bed itself (`grow`, 0 to 1), so it saves and loads with the house.
 */
import { stageAt } from './plantGrowth';
import type { ObjectInstance } from './objects';

export type CropId = 'flower' | 'fruit' | 'vegetable';

export interface CropDef {
  name: string;
  seedId: string;
  /** The colour of the crop's tips once it is growing. */
  color: string;
  /** The shop price of one packet. */
  price: number;
}

export const CROPS: Record<CropId, CropDef> = {
  flower: { name: 'Sunflowers', seedId: 'seed-flower', color: '#F2C230', price: 6 },
  fruit: { name: 'Strawberries', seedId: 'seed-fruit', color: '#D8384F', price: 8 },
  vegetable: { name: 'Carrots', seedId: 'seed-vegetable', color: '#E8772E', price: 5 },
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];

/** A bed at or below this wetness is dry: it stops growing and is warned about. */
export const DRY_AT = 0.2;
/** Game minutes of watered growth from a planted seed to a ripe crop. */
export const RIPE_MINUTES = 16 * 60;
/** Wetness lost per game minute (about a day and a half from wet to dry). */
export const WET_FADE_PER_MIN = 0.6 / 1440;
/** How much watering makes the bed wet. */
export const WATERED = 1;

export function cropOf(id: string | null | undefined): CropDef | null {
  return id && id in CROPS ? CROPS[id as CropId] : null;
}

/**
 * Moves every garden bed on by a stretch of game time. Returns the messages worth showing: a bed drying out, or a
 * crop that has just ripened. Each is said once, on the change, not every tick.
 */
export function gardenTick(objs: ObjectInstance[], gameMin: number): string[] {
  const msgs: string[] = [];
  for (const bed of objs) {
    if (bed.type !== 'garden') continue;
    const wasWet = (bed.wet ?? 0) > DRY_AT;
    const hadGrow = bed.grow ?? 0;
    bed.wet = Math.max(0, (bed.wet ?? 0) - gameMin * WET_FADE_PER_MIN);
    if (bed.crop && bed.wet > DRY_AT) bed.grow = Math.min(1, hadGrow + gameMin / RIPE_MINUTES);
    const crop = cropOf(bed.crop);
    if (!crop) continue;
    if (wasWet && bed.wet <= DRY_AT) msgs.push(`The ${crop.name.toLowerCase()} are drying out. Water the garden bed.`);
    if (hadGrow < 1 && (bed.grow ?? 0) >= 1) msgs.push(`The ${crop.name.toLowerCase()} are ripe. Harvest them from the Orders page.`);
  }
  return msgs;
}

/** The growth stage name for a bed, for the Orders page and the drawing. */
export function bedStage(bed: ObjectInstance): string {
  return stageAt(bed.grow ?? 0).name;
}
