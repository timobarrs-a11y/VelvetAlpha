/**
 * The garden bed grows one crop at a time. A bed grows only while it is wet, and it is wet only because the player
 * waters it (or it rains, once the weather is wired in). A bed that stays dry stops growing and says so. If it stays
 * dry for a long spell, the crop dies: the player is warned well before that, and clears the bed to plant again.
 * Growth, dryness and death are kept on the bed itself, so they save and load with the house.
 */
import { stageAt } from './plantGrowth';
import type { ObjectInstance } from './objects';

export type CropId = 'flower' | 'fruit' | 'vegetable' | 'carrot' | 'lettuce';

/** How a crop grows and is drawn: a stalk with a bloom, a bush with fruit, or vines spread on the ground. */
export type GrowthForm = 'stem-bloom' | 'bush-fruit' | 'ground-vine' | 'root' | 'rosette';
/** `once`: picked and gone. `repeat`: picked, then it regrows to mid-size and fruits again. */
export type HarvestRule = 'once' | 'repeat';

export interface CropDef {
  name: string;
  seedId: string;
  form: GrowthForm;
  harvest: HarvestRule;
  /** Meals of food each harvest adds to the fridge (0 for a flower). */
  meals: number;
  /** Game minutes of watered growth from seed to ripe (see docs/velvet-house/crops.md). */
  ripeMinutes: number;
  /** The colour of the crop's tips once it is growing. */
  color: string;
  /** The shop price of one packet. */
  price: number;
}

export const CROPS: Record<CropId, CropDef> = {
  flower: { name: 'Tulips', seedId: 'seed-flower', form: 'stem-bloom', harvest: 'once', meals: 0, ripeMinutes: 16 * 60, color: '#E9457A', price: 6 },
  fruit: { name: 'Apples', seedId: 'seed-fruit', form: 'bush-fruit', harvest: 'repeat', meals: 2, ripeMinutes: 16 * 60, color: '#E63B3B', price: 8 },
  vegetable: { name: 'Pumpkins', seedId: 'seed-vegetable', form: 'ground-vine', harvest: 'once', meals: 2, ripeMinutes: 24 * 60, color: '#F08A24', price: 5 },
  carrot: { name: 'Carrots', seedId: 'seed-carrot', form: 'root', harvest: 'once', meals: 2, ripeMinutes: 20 * 60, color: '#E8772E', price: 5 },
  lettuce: { name: 'Lettuces', seedId: 'seed-lettuce', form: 'rosette', harvest: 'once', meals: 1, ripeMinutes: 12 * 60, color: '#7BC96F', price: 4 },
};

export const CROP_IDS = Object.keys(CROPS) as CropId[];

/** A bed at or below this wetness is dry: it stops growing. */
export const DRY_AT = 0.2;
/** Game minutes of watered growth from a planted seed to a ripe crop. */
export const RIPE_MINUTES = 16 * 60;
/** Wetness lost per game minute (about a day and a half from wet to dry). */
export const WET_FADE_PER_MIN = 0.6 / 1440;
/** How much watering makes the bed wet. */
export const WATERED = 1;
/** Game minutes a crop can stay dry before it dies. Two game days. */
export const DEAD_AFTER_MIN = 2 * 1440;

export function cropOf(id: string | null | undefined): CropDef | null {
  return id && id in CROPS ? CROPS[id as CropId] : null;
}

/**
 * Moves every garden bed on by a stretch of game time. Returns the messages worth showing: a bed drying out, a warning
 * that the crop will die if it stays dry, the death itself, or a crop that has just ripened. Each is said once, on the
 * change, not every tick.
 */
export function gardenTick(objs: ObjectInstance[], gameMin: number): string[] {
  const msgs: string[] = [];
  for (const bed of objs) {
    if (bed.type !== 'garden') continue;
    const crop = cropOf(bed.crop);
    const wasWet = (bed.wet ?? 0) > DRY_AT;
    const hadGrow = bed.grow ?? 0;
    const hadDry = bed.dry ?? 0;
    bed.wet = Math.max(0, (bed.wet ?? 0) - gameMin * WET_FADE_PER_MIN);
    if (!crop || bed.dead) continue;
    if (bed.wet > DRY_AT) {
      bed.grow = Math.min(1, hadGrow + gameMin / crop.ripeMinutes);
      bed.dry = 0;
    } else {
      bed.dry = hadDry + gameMin;
    }
    const name = crop.name.toLowerCase();
    if (wasWet && bed.wet <= DRY_AT) msgs.push(`The ${name} are drying out. Water the garden bed.`);
    if (hadDry < DEAD_AFTER_MIN / 2 && (bed.dry ?? 0) >= DEAD_AFTER_MIN / 2) msgs.push(`The ${name} will die if the bed stays dry. Water it now.`);
    if (bed.dry !== undefined && bed.dry >= DEAD_AFTER_MIN) {
      bed.dead = true;
      msgs.push(`The ${name} died of thirst. Clear the bed to plant again.`);
    }
    if (hadGrow < 1 && (bed.grow ?? 0) >= 1) msgs.push(`The ${name} are ripe. Harvest them from the Orders page.`);
  }
  return msgs;
}

/** The stage a bed shows: its growth stage, or dead once the crop has died. */
export function bedStage(bed: ObjectInstance): string {
  return bed.dead ? 'dead' : stageAt(bed.grow ?? 0).name;
}
