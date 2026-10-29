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
/** How fast crops grow by season (spring, summer, autumn, winter): winter is dormant. Matches the yard's seasons. */
export const SEASON_GROW = [1, 1.15, 0.6, 0];
/** How fast a bed dries by season: summer dries quickest, winter slowest. */
export const SEASON_DRY = [1, 1.5, 0.8, 0.3];

export function gardenTick(objs: ObjectInstance[], gameMin: number, raining = false, season = 0): string[] {
  const msgs: string[] = [];
  for (const bed of objs) {
    if (bed.type !== 'garden') continue;
    const crop = cropOf(bed.crop);
    const wasWet = (bed.wet ?? 0) > DRY_AT;
    const hadGrow = bed.grow ?? 0;
    const hadDry = bed.dry ?? 0;
    // Rain soaks a bed that has a crop in it, so a rainy day waters it for free.
    if (raining && crop) bed.wet = Math.max(bed.wet ?? 0, WATERED);
    bed.wet = Math.max(0, (bed.wet ?? 0) - gameMin * WET_FADE_PER_MIN * (SEASON_DRY[season] ?? 1));
    if (!crop || bed.dead) continue;
    if (bed.wet > DRY_AT) {
      bed.grow = Math.min(1, hadGrow + (gameMin * (SEASON_GROW[season] ?? 1)) / crop.ripeMinutes);
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

// ---- Fruit trees --------------------------------------------------------------------------------------------------------
// A fruit tree is bought as a sapling and set out in the yard. Watered, it grows through its stages into a tree; a grown tree then bears
// a batch of fruit that swells and colours over time until it is ripe, is picked (from the Orders page or by giving the tree a shake) and
// grows again. A tree's growth and its fruit stop in winter. It never dies. State lives on the tree itself: `grow` 0 sapling .. 1 grown,
// `fruit` 0 bare .. 1 ripe, `wet` as for a bed. (A tree placed without `grow` starts as a sapling.)

export interface FruitTreeDef {
  /** Which painted tree it is (art/treeArt.js). */
  kind: 'apple' | 'cherry' | 'palm';
  name: string;
  /** What it bears, plural. */
  fruit: string;
  /** Meals of food one ripe batch adds to the fridge. */
  meals: number;
}

export const FRUIT_TREES: Record<string, FruitTreeDef> = {
  treeapple: { kind: 'apple', name: 'Apple tree', fruit: 'apples', meals: 3 },
  treecherry: { kind: 'cherry', name: 'Cherry tree', fruit: 'cherries', meals: 2 },
  treepalm: { kind: 'palm', name: 'Coconut palm', fruit: 'coconuts', meals: 3 },
};
export const isFruitTree = (type: string): boolean => type in FRUIT_TREES;
/** Game minutes of watered growth from a sapling to a grown tree: a day and a half. */
export const TREE_GROW_MIN = 36 * 60;
/** Game minutes of fruiting weather from a bare tree to ripe fruit: a day. */
export const FRUIT_MIN = 24 * 60;
/** The fruit is ripe once it has come this far (0..1). */
export const FRUIT_RIPE_AT = 1;

/** Where a tree is in its life, in words. */
export function treeStage(o: ObjectInstance): 'sapling' | 'young' | 'growing' | 'grown' {
  const g = o.grow ?? 0;
  return g < 0.16 ? 'sapling' : g < 0.5 ? 'young' : g < 1 ? 'growing' : 'grown';
}

/**
 * Moves every fruit tree on by a stretch of game time. A sapling grows only while it is wet (rain, or watered from the Orders page); a grown
 * tree's fruit comes on by itself. Returns the messages worth showing, each said once, on the change.
 */
export function treeTick(objs: ObjectInstance[], gameMin: number, raining = false, season = 0): string[] {
  const msgs: string[] = [];
  for (const tree of objs) {
    const def = FRUIT_TREES[tree.type];
    if (!def) continue;
    const name = def.name.toLowerCase(), rate = SEASON_GROW[season] ?? 1;
    tree.grow = tree.grow ?? 0;
    const wasWet = (tree.wet ?? 0) > DRY_AT;
    if (raining && tree.grow < 1) tree.wet = Math.max(tree.wet ?? 0, WATERED);
    tree.wet = Math.max(0, (tree.wet ?? 0) - gameMin * WET_FADE_PER_MIN * (SEASON_DRY[season] ?? 1));
    if (tree.grow < 1) {
      if (tree.wet > DRY_AT) tree.grow = Math.min(1, tree.grow + (gameMin * rate) / TREE_GROW_MIN);
      else if (wasWet) msgs.push(`The ${name} sapling is thirsty. Water it from the Orders page.`);
      if (tree.grow >= 1) msgs.push(`The ${name} has grown. It will bear ${def.fruit} before long.`);
      continue;
    }
    const had = tree.fruit ?? 0;
    tree.fruit = Math.min(1, had + (gameMin * rate) / FRUIT_MIN);
    if (had < 1 && tree.fruit >= 1) msgs.push(`The ${name} is full of ripe ${def.fruit}. Pick them from the Orders page, or give the tree a shake.`);
  }
  return msgs;
}

// ---- Time left to grow -------------------------------------------------------------------------------------------------

/** A span of game minutes in words: "40 min", "9 h", "1 day 4 h". */
export function fmtGameMinutes(min: number): string {
  const m = Math.max(1, Math.round(min));
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24), r = h % 24;
  return `${d} day${d === 1 ? '' : 's'}${r ? ` ${r} h` : ''}`;
}

/** How long until a bed's crop is ripe, in words, or what is holding it up. Empty when there is nothing growing. */
export function cropEta(bed: ObjectInstance, season = 0): string {
  const crop = cropOf(bed.crop);
  if (!crop || bed.dead) return '';
  if ((bed.grow ?? 0) >= 1) return 'ripe';
  if ((bed.wet ?? 0) <= DRY_AT) return 'needs water';
  const rate = SEASON_GROW[season] ?? 1;
  if (rate <= 0) return 'asleep for the winter';
  return `ripe in about ${fmtGameMinutes(((1 - (bed.grow ?? 0)) * crop.ripeMinutes) / rate)}`;
}

/** The same for a fruit tree: how long until it is grown, or until its fruit is ripe. */
export function treeEta(tree: ObjectInstance, season = 0): string {
  if (!FRUIT_TREES[tree.type]) return '';
  const rate = SEASON_GROW[season] ?? 1, grown = (tree.grow ?? 0) >= 1;
  if (!grown) {
    if ((tree.wet ?? 0) <= DRY_AT) return 'needs water';
    return rate <= 0 ? 'asleep for the winter' : `grown in about ${fmtGameMinutes(((1 - (tree.grow ?? 0)) * TREE_GROW_MIN) / rate)}`;
  }
  if ((tree.fruit ?? 0) >= 1) return 'ripe';
  return rate <= 0 ? 'bare for the winter' : `ripe in about ${fmtGameMinutes(((1 - (tree.fruit ?? 0)) * FRUIT_MIN) / rate)}`;
}
