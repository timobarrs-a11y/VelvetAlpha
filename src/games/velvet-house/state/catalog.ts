/**
 * Shop catalog — all buyable items, ported from the original game.
 * Each item has an id, name, price, icon type, tab, and optional style tags.
 */

import { CLOTHES, clothId } from './clothing';
import { PICTURE_WALLS } from './pictureWalls';
import { UNLOCK_CODES } from './unlockCodes';
import { LAMP_STYLES, LAMP_NAMES, LAMP_PRICES } from './wallLamps';

export interface CatalogEntry {
  id: string;
  name: string;
  desc?: string;
  price: number;
  icon: 'paint' | 'paper' | 'floor' | 'drapes' | 'set' | 'upgrade' | 'obj' | 'cloth' | 'wobj' | 'box' | 'bag' | 'pet' | 'home' | 'seed';
  tab: string;
  tags?: string[];
  type?: string;
  /** For seed packets: the crop it plants (see crops.ts). */
  crop?: string;
  /** A picture for the shop card, when the item has its own icon file. */
  image?: string;
  /** A look of `type` (a key of TYPES[type].skins): buying it restyles the piece already on the main floor. */
  skin?: string;
  color?: string;
  pattern?: string;
  floor?: string;
  cols?: string[];
  repeat?: boolean;
  rot?: 'spring' | 'summer' | 'fall' | 'winter' | 'rare';
  likes?: number;
  place?: { type: string; level: number; at: [number, number]; rot: number };
  cloth?: { slot: string; style: string };
  pet?: 'cat' | 'dog';
  home?: string;
  buy?: string;
  /** A themed set sold as one bundle: the catalog ids it holds and the share taken off what is not owned yet. */
  set?: { items: string[]; off: number };
  /** Drapes for the windows of a floor, in this style (art/houseArt.js `drawDrapes`); '' takes them down. */
  drapes?: string;
  /** A wall lamp of this style (state/wallLamps.ts): buying it hangs one, and it can be moved along the walls. */
  wallLamp?: string;
  /**
   * A promo item: it comes free with a promo code (state/unlockCodes.ts) and can't be bought. Until the player has it,
   * the shop shows it by name only, locked, with no preview; the Promo tab lists the promo packs.
   */
  promo?: boolean;
}

export const TABS = [
  'Today', 'Sets', 'Promo', 'Groceries', 'Paint', 'Wallpaper', 'Floors',
  'Furniture', 'Wall', 'Decor', 'Plants', 'Hobbies',
  'Outdoor', 'Clothes', 'Upgrades', 'Attic', 'Pets', 'Homes',
] as const;

export type TabName = typeof TABS[number];

const paint = (id: string, name: string, color: string, price: number, tags: string[]): CatalogEntry => ({
  id, name, price, icon: 'paint', tab: 'Paint', color, tags,
});

const wallpaper = (id: string, name: string, pattern: string, price: number, tags: string[], cols?: string[]): CatalogEntry => ({
  id, name, price, icon: 'paper', tab: 'Wallpaper', pattern, tags, cols,
});

const floor = (id: string, name: string, fl: string, price: number, tags: string[]): CatalogEntry => ({
  id, name, price, icon: 'floor', tab: 'Floors', floor: fl, tags,
});

const furn = (id: string, type: string, name: string, price: number, tags: string[], cols?: string[]): CatalogEntry => ({
  id, name, price, icon: 'obj', tab: 'Furniture', type, tags, cols, repeat: true,
});

const decor = (id: string, type: string, name: string, price: number, tags: string[], cols?: string[]): CatalogEntry => ({
  id, name, price, icon: 'obj', tab: 'Decor', type, tags, cols, repeat: true,
});

/** A look of a piece the house already has: same footprint and spots, drawn and named differently. */
export const look = (id: string, type: string, skin: string, name: string, desc: string, price: number, tags: string[], cols?: string[]): CatalogEntry => ({
  id, name, desc, price, icon: 'obj', tab: 'Furniture', type, skin, tags, cols, repeat: true,
});

/**
 * Another model of a piece (a chest freezer for the fridge): its own size and shape, doing the same job. Buying it puts it
 * in the place of the piece of that kind, if it fits there; its looks are sold with `look` under its own type.
 */
const model = (id: string, type: string, name: string, desc: string, price: number, tags: string[], cols?: string[]): CatalogEntry => ({
  id, name, desc, price, icon: 'obj', tab: 'Furniture', type, tags, cols, repeat: true,
});

/** A themed set: its pieces, wallpaper and floor bought together for less. The price is worked out from the pieces (see `setQuote`). */
const bundle = (id: string, name: string, desc: string, items: string[], tags: string[], off = 0.2): CatalogEntry => ({
  id, name, desc, price: 0, icon: 'set', tab: 'Sets', tags, set: { items, off },
});

/** A promo entry: free with a promo code, never sold. */
export const promo = (e: CatalogEntry): CatalogEntry => ({ ...e, promo: true });

const hobby = (id: string, type: string, name: string, price: number, tags: string[], cols?: string[]): CatalogEntry => ({
  id, name, price, icon: 'obj', tab: 'Hobbies', type, tags, cols, repeat: true,
});

/** A packet of seeds: bought in the shop, planted in the garden bed from the Orders page. */
const seed = (id: string, crop: string, name: string, price: number, desc: string): CatalogEntry => ({
  id, name, price, desc, icon: 'seed', tab: 'Outdoor', tags: ['natural'], crop, repeat: true,
});

const outdoor = (id: string, type: string, name: string, price: number, tags: string[], cols?: string[]): CatalogEntry => ({
  id, name, price, icon: 'obj', tab: 'Outdoor', type, tags, cols, repeat: true,
});

/** A fruit tree, bought as a sapling: set it out, water it, and it grows into a tree that bears fruit (see crops.ts). */
const fruitTree = (id: string, type: string, name: string, price: number, tags: string[]): CatalogEntry => ({
  id, name: `${name} (sapling)`, price, icon: 'obj', tab: 'Outdoor', type, tags, repeat: true,
  desc: `A sapling. Water it and it grows into a ${name.toLowerCase()} that bears fruit again and again.`,
});

const wallItem = (id: string, name: string, price: number, tags: string[], cols?: string[]): CatalogEntry => ({
  id, name, price, icon: 'wobj', tab: 'Wall', tags, cols,
});

const plantItem = (id: string, type: string, name: string, price: number, tags: string[], cols?: string[]): CatalogEntry => ({
  id, name, price, icon: 'obj', tab: 'Plants', type, tags, cols, repeat: true,
});

const petItem = (id: string, name: string, price: number, kind: 'cat' | 'dog'): CatalogEntry => ({
  id, name, price, icon: 'pet', tab: 'Pets', pet: kind, tags: ['cozy'],
});

const clothItem = (key: string): CatalogEntry => {
  const c = CLOTHES.find(x => x.key === key)!;
  return { id: clothId(key), name: c.name, price: c.price, icon: 'cloth', tab: 'Clothes', cloth: { slot: c.slot, style: c.style }, cols: c.colors, tags: c.tags };
};

export const CATALOG: CatalogEntry[] = [
  // Paint
  paint('paint-sand', 'Sand', '#E9DCCB', 40, ['warm', 'soft', 'natural']),
  paint('paint-sage', 'Sage', '#9DB3A5', 40, ['natural', 'cool', 'soft']),
  paint('paint-blush', 'Blush', '#F3DADD', 40, ['warm', 'soft', 'playful']),
  paint('paint-sky', 'Sky', '#C7DDE3', 40, ['cool', 'soft', 'modern']),
  paint('paint-butter', 'Butter', '#F5E8B8', 40, ['warm', 'soft', 'cozy']),
  paint('paint-lavender', 'Lavender', '#D4C5E0', 40, ['cool', 'soft', 'modern']),
  paint('paint-charcoal', 'Charcoal', '#3A3340', 60, ['cool', 'bold', 'modern', 'industrial']),
  paint('paint-navy', 'Navy', '#2E3B57', 60, ['cool', 'bold', 'modern']),
  paint('paint-forest', 'Forest', '#3F5B4C', 60, ['natural', 'cool', 'bold']),
  paint('paint-wine', 'Wine', '#6E3C50', 60, ['warm', 'bold', 'luxe']),
  paint('paint-terracotta', 'Terracotta', '#C27A5A', 60, ['warm', 'natural', 'bold']),
  paint('paint-mustard', 'Mustard', '#D9A84A', 60, ['warm', 'bold', 'vintage']),

  // Wallpaper
  wallpaper('paper-dots-rose', 'Rose dots', 'dots-rose', 80, ['soft', 'playful', 'warm']),
  wallpaper('paper-stripe-mint', 'Mint stripes', 'stripe-mint', 80, ['cool', 'soft', 'modern']),
  wallpaper('paper-stripe-candy', 'Candy stripes', 'stripe-candy', 80, ['playful', 'warm', 'bold']),
  wallpaper('paper-pinstripe', 'Pinstripe', 'pinstripe', 100, ['modern', 'bold', 'luxe']),
  wallpaper('paper-gingham-red', 'Red gingham', 'gingham-red', 80, ['cozy', 'warm', 'vintage']),
  wallpaper('paper-gingham-blue', 'Blue gingham', 'gingham-blue', 80, ['cozy', 'cool', 'vintage']),
  wallpaper('paper-plaid-forest', 'Forest plaid', 'plaid-forest', 100, ['natural', 'cozy', 'vintage']),
  wallpaper('paper-plaid-wine', 'Wine plaid', 'plaid-wine', 100, ['warm', 'bold', 'vintage']),
  wallpaper('paper-chevron-mustard', 'Mustard chevron', 'chevron-mustard', 100, ['warm', 'bold', 'modern']),
  wallpaper('paper-chevron-slate', 'Slate chevron', 'chevron-slate', 100, ['cool', 'modern', 'minimal']),
  wallpaper('paper-scallop-peach', 'Peach scallop', 'scallop-peach', 100, ['soft', 'warm', 'playful']),
  wallpaper('paper-damask-plum', 'Plum damask', 'damask-plum', 120, ['luxe', 'bold', 'vintage']),
  wallpaper('paper-damask-cream', 'Cream damask', 'damask-cream', 120, ['luxe', 'soft', 'vintage']),
  wallpaper('paper-pin-slate', 'Slate pinstripe', 'pin-slate', 100, ['modern', 'minimal', 'cool']),
  wallpaper('paper-gingham-sage', 'Sage gingham', 'gingham-sage', 90, ['cozy', 'natural', 'warm']),
  wallpaper('paper-starburst-mint', 'Atomic mint', 'starburst-mint', 100, ['vintage', 'playful', 'bold']),
  wallpaper('paper-birch', 'Birch forest', 'birch', 90, ['soft', 'minimal', 'natural']),
  wallpaper('paper-brick-white', 'Painted brick', 'brick-white', 110, ['industrial', 'bold', 'cool']),
  wallpaper('paper-blossom-mint', 'Mint blossom', 'blossom-mint', 100, ['soft', 'natural', 'playful']),
  wallpaper('paper-stripe-sun', 'Sunshine stripes', 'stripe-sun', 90, ['playful', 'bold', 'warm']),
  wallpaper('paper-leaves', 'Fallen leaves', 'leaves', 100, ['warm', 'cozy', 'natural']),
  wallpaper('paper-snow', 'Snowfall', 'snow', 100, ['cozy', 'cool', 'soft']),
  wallpaper('paper-stripe-nautical', 'Nautical stripe', 'stripe-nautical', 90, ['cool', 'natural', 'playful']),
  wallpaper('paper-deco-emerald', 'Emerald deco', 'deco-emerald', 120, ['luxe', 'bold', 'vintage']),
  wallpaper('paper-shoji', 'Shoji screen', 'shoji', 90, ['minimal', 'natural', 'cool']),
  wallpaper('paper-arches-terracotta', 'Terracotta arches', 'arches-terracotta', 100, ['warm', 'natural', 'playful']),
  wallpaper('paper-orbit', 'Orbit', 'orbit', 110, ['modern', 'bold', 'playful']),
  wallpaper('paper-damask-onyx', 'Onyx damask', 'damask-onyx', 120, ['luxe', 'vintage', 'cozy']),
  wallpaper('paper-zellige-cobalt', 'Cobalt zellige', 'zellige-cobalt', 110, ['warm', 'bold', 'natural']),
  wallpaper('paper-monstera-night', 'Monstera at night', 'monstera-night', 100, ['playful', 'natural', 'bold']),
  wallpaper('paper-squiggle-pop', 'Squiggle pop', 'squiggle-pop', 110, ['playful', 'bold', 'modern']),
  wallpaper('paper-lavender-sprig', 'Lavender sprig', 'lavender-sprig', 90, ['soft', 'cozy', 'vintage']),
  wallpaper('paper-serape-adobe', 'Serape band', 'serape-adobe', 100, ['warm', 'natural', 'cozy']),
  wallpaper('paper-circuit', 'Circuit', 'circuit', 110, ['bold', 'modern', 'industrial']),
  wallpaper('paper-sprinkles', 'Sprinkles', 'sprinkles', 90, ['soft', 'playful', 'warm']),
  promo(wallpaper('paper-clouds-sky', 'Clouds and rainbows', 'clouds-sky', 90, ['soft', 'playful', 'cozy'])),
  wallpaper('paper-constellations', 'Constellations', 'constellations', 120, ['soft', 'playful', 'cool']),
  wallpaper('paper-clay-plaster', 'Clay plaster', 'clay-plaster', 90, ['minimal', 'natural', 'cool']),
  wallpaper('paper-damask-rose', 'Rose damask', 'damask-rose', 120, ['luxe', 'cozy', 'vintage']),
  wallpaper('paper-knotty-pine', 'Knotty pine paneling', 'knotty-pine', 100, ['cozy', 'warm', 'natural']),
  wallpaper('paper-banana-leaf', 'Banana leaf', 'banana-leaf', 120, ['luxe', 'bold', 'playful']),
  wallpaper('paper-starburst-amber', 'Atomic starburst', 'starburst-amber', 100, ['modern', 'warm', 'vintage']),
  wallpaper('paper-ditsy-cream', 'Ditsy floral', 'ditsy-cream', 90, ['cozy', 'soft', 'vintage']),
  wallpaper('paper-pinstripe-gold', 'Gold pinstripe', 'pinstripe-gold', 110, ['luxe', 'bold', 'vintage']),
  wallpaper('paper-limewash', 'Limewash', 'limewash', 100, ['soft', 'minimal', 'natural']),
  wallpaper('paper-formwork', 'Board-formed concrete', 'formwork', 110, ['industrial', 'minimal', 'bold']),
  wallpaper('paper-pixel-invaders', 'Pixel invaders', 'pixel-invaders', 110, ['playful', 'bold', 'vintage']),
  wallpaper('paper-shiplap', 'Shiplap', 'shiplap', 80, ['natural', 'minimal', 'cozy']),
  wallpaper('paper-subway', 'Subway tile', 'subway', 80, ['modern', 'minimal', 'industrial']),
  wallpaper('paper-stars-night', 'Starry night', 'stars-night', 120, ['playful', 'cool', 'bold']),
  wallpaper('paper-velvet-tuft', 'Tufted velvet', 'velvet-tuft', 150, ['luxe', 'bold', 'warm']),
  wallpaper('paper-blossom', 'Blossom', 'blossom', 100, ['soft', 'natural', 'playful']),
  wallpaper('paper-palms', 'Palms', 'palms', 100, ['natural', 'playful', 'cool']),
  wallpaper('paper-jungle-night', 'Jungle night', 'jungle-night', 120, ['bold', 'natural', 'cool']),

  // Sets: a whole look at once, for less than the pieces apart
  bundle('set-retro', 'Retro kitchen and living room', 'The pastel icebox, diner counter, boomerang table set, davenport, atomic lamp and planter, with atomic mint walls and diner linoleum.',
    ['look-fridge-retro', 'look-counter-retro', 'look-dining-retro', 'look-sofa-retro', 'look-lamp-retro', 'look-plant-retro', 'paper-starburst-mint', 'floor-linoleum'], ['vintage', 'playful', 'bold']),

  bundle('set-farmhouse', 'Farmhouse kitchen and living room', 'The cream enamel icebox, butcher-block counter, farm table set, slipcover sofa, tripod lamp and crate planter, with sage gingham walls and a barnwood floor.',
    ['look-fridge-farmhouse', 'look-counter-farmhouse', 'look-dining-farmhouse', 'look-sofa-farmhouse', 'look-lamp-farmhouse', 'look-plant-farmhouse', 'paper-gingham-sage', 'floor-barnwood'], ['cozy', 'natural', 'warm']),

  bundle('set-modern', 'Modern kitchen and living room', 'The brushed steel fridge, slab counter, glass-top dining set, low-profile sofa, slim torchiere and slab planter, with slate pinstripe walls and a charcoal microcement floor.',
    ['look-fridge-modern', 'look-counter-modern', 'look-dining-modern', 'look-sofa-modern', 'look-lamp-modern', 'look-plant-modern', 'paper-pin-slate', 'floor-charcoal'], ['modern', 'minimal', 'cool']),

  bundle('set-scandi', 'Scandi kitchen and living room', 'Pale ash and linen: the ash-handled fridge, ash slab counter, wishbone dining set, linen sofa, paper lantern and a pot on an ash stand, with birch walls and pale wide planks.',
    ['look-fridge-scandi', 'look-counter-scandi', 'look-dining-scandi', 'look-sofa-scandi', 'look-lamp-scandi', 'look-plant-scandi', 'paper-birch', 'floor-nordic'], ['soft', 'minimal', 'natural']),

  bundle('set-industrial', 'Industrial kitchen and living room', 'Steel, concrete and old wood: the riveted fridge, concrete and steel counter, pipe and plank table, tufted leather sofa, cage bulb lamp and a galvanized bucket, with painted brick and a poured concrete floor.',
    ['look-fridge-industrial', 'look-counter-industrial', 'look-dining-industrial', 'look-sofa-industrial', 'look-lamp-industrial', 'look-plant-industrial', 'paper-brick-white', 'floor-poured'], ['industrial', 'bold', 'cool']),

  bundle('set-beach', 'Beach house kitchen and living room', 'Driftwood, rope and sea glass: the sea-glass fridge, whitewashed shiplap counter, driftwood dining set, striped slipcover sofa, rope-wound lamp and a seagrass basket, with nautical stripes and bleached boards.',
    ['look-fridge-beach', 'look-counter-beach', 'look-dining-beach', 'look-sofa-beach', 'look-lamp-beach', 'look-plant-beach', 'paper-stripe-nautical', 'floor-driftwood'], ['cool', 'natural', 'playful']),

  bundle('set-deco', 'Art Deco kitchen and living room', 'Black lacquer, gold and emerald velvet: the lacquered icebox, lacquer and gold counter, sunburst dining set, emerald velvet sofa, tiered gold lamp and a gold urn, with emerald deco walls and ivory marble veined in gold.',
    ['look-fridge-deco', 'look-counter-deco', 'look-dining-deco', 'look-sofa-deco', 'look-lamp-deco', 'look-plant-deco', 'paper-deco-emerald', 'floor-ivorygold'], ['luxe', 'bold', 'vintage']),

  bundle('set-japandi', 'Japandi kitchen and living room', 'Walnut, stone and paper: the paper-white fridge, walnut and stone counter, low walnut dining set, low walnut sofa, washi lamp and a bonsai in a stone bowl, with shoji walls and tatami underfoot.',
    ['look-fridge-japandi', 'look-counter-japandi', 'look-dining-japandi', 'look-sofa-japandi', 'look-lamp-japandi', 'look-plant-japandi', 'paper-shoji', 'floor-tatami'], ['minimal', 'natural', 'cool']),

  bundle('set-boho', 'Boho kitchen and living room', 'Terracotta, rattan and mustard: the terracotta fridge, rattan-front counter, carved wood dining set, rattan-arm sofa with kilim cushions, macrame lamp and a pot in a hanging sling, with terracotta arches on the walls and jute on the floor.',
    ['look-fridge-boho', 'look-counter-boho', 'look-dining-boho', 'look-sofa-boho', 'look-lamp-boho', 'look-plant-boho', 'paper-arches-terracotta', 'floor-jute'], ['warm', 'natural', 'playful']),

  bundle('set-space', 'Space Age kitchen and living room', 'White moulded plastic, orange and ink: the capsule fridge, moulded pod counter, tulip dining set, pod sofa, saucer lamp and a capsule planter, with an orbit of stars on the walls and moon tile underfoot.',
    ['look-fridge-space', 'look-counter-space', 'look-dining-space', 'look-sofa-space', 'look-lamp-space', 'look-plant-space', 'paper-orbit', 'floor-moon'], ['modern', 'bold', 'playful']),

  bundle('set-gothic', 'Gothic Revival kitchen and living room', 'Ebony, oxblood velvet and brass: the stained-glass icebox, ebony and brass counter, pedestal dining set under a candle chandelier, tufted oxblood sofa, candelabra lamp and a black urn, with onyx damask on the walls and ebony herringbone underfoot.',
    ['look-fridge-gothic', 'look-counter-gothic', 'look-dining-gothic', 'look-sofa-gothic', 'look-lamp-gothic', 'look-plant-gothic', 'paper-damask-onyx', 'floor-herringebony'], ['luxe', 'vintage', 'cozy']),

  bundle('set-riad', 'Riad kitchen and living room', 'Whitewashed plaster, cobalt zellige and cedar: the zellige fridge, zellige and cedar counter, inlaid table with leather poufs under a pierced lantern, cedar banquette, brass lantern lamp and a cobalt-banded pot, with a tiled dado on the walls and zellige mosaic underfoot.',
    ['look-fridge-riad', 'look-counter-riad', 'look-dining-riad', 'look-sofa-riad', 'look-lamp-riad', 'look-plant-riad', 'paper-zellige-cobalt', 'floor-zellige'], ['warm', 'bold', 'natural']),

  bundle('set-tropical', 'Tropical kitchen and living room', 'Bamboo, monstera and flamingo pink: the palm fridge, bamboo-slat counter with a pineapple, bamboo dining set with fan-back chairs, bamboo sofa with palm cushions, cone lamp and a slatted planter, with monstera leaves on the walls and bamboo plank underfoot.',
    ['look-fridge-tropical', 'look-counter-tropical', 'look-dining-tropical', 'look-sofa-tropical', 'look-lamp-tropical', 'look-plant-tropical', 'paper-monstera-night', 'floor-bamboo'], ['playful', 'natural', 'bold']),

  bundle('set-memphis', 'Memphis kitchen and living room', 'White laminate, black squiggles and primary blocks: the squiggle fridge, squiggle counter with a terrazzo top, totem dining set under a sputnik light, block sofa, totem lamp and a stacked planter, with squiggle pop on the walls and pop terrazzo underfoot.',
    ['look-fridge-memphis', 'look-counter-memphis', 'look-dining-memphis', 'look-sofa-memphis', 'look-lamp-memphis', 'look-plant-memphis', 'paper-squiggle-pop', 'floor-terrazzopop'], ['playful', 'bold', 'modern']),

  bundle('set-provence', 'Provence kitchen and living room', 'Whitewashed pine, lavender and toile: the lavender enamel fridge, pine counter with a limestone top, farm table with ladder-back chairs under an iron lantern, skirted linen sofa with toile cushions, wrought iron lamp and a zinc pot, with lavender sprigs on the walls and limestone flags underfoot.',
    ['look-fridge-provence', 'look-counter-provence', 'look-dining-provence', 'look-sofa-provence', 'look-lamp-provence', 'look-plant-provence', 'paper-lavender-sprig', 'floor-limestone'], ['soft', 'cozy', 'vintage']),

  bundle('set-adobe', 'Adobe kitchen and living room', 'Plaster, turquoise and serape stripes: the turquoise fridge, adobe counter with a saltillo top and a cactus, carved pine table with turquoise chairs under a punched-tin star, rust leather sofa with a serape over the back, pottery lamp and a painted clay pot, with a serape band on the walls and saltillo tile underfoot.',
    ['look-fridge-adobe', 'look-counter-adobe', 'look-dining-adobe', 'look-sofa-adobe', 'look-lamp-adobe', 'look-plant-adobe', 'paper-serape-adobe', 'floor-saltillo'], ['warm', 'natural', 'cozy']),

  bundle('set-neon', 'Neon kitchen and living room', 'Black steel, magenta and cyan light: the holo fridge, mesh counter with a lit kick and a holo panel, underlit glass table with lit chairs under a neon ring, black leather sofa with neon piping, a neon tube lamp and a hex pot with a light ring, with circuit walls and a lit grate underfoot. The light comes on with the power.',
    ['look-fridge-neon', 'look-counter-neon', 'look-dining-neon', 'look-sofa-neon', 'look-lamp-neon', 'look-plant-neon', 'paper-circuit', 'floor-grate'], ['bold', 'modern', 'industrial']),

  bundle('set-candy', 'Candy kitchen and living room', 'Pastel pink, mint and lilac: the bow fridge, scalloped mint counter with a cupcake stand, scalloped table with heart-back chairs under a lollipop light, scalloped pink sofa, an ice cream cone lamp and a teacup planter, with sprinkles on the walls and a pink check underfoot.',
    ['look-fridge-candy', 'look-counter-candy', 'look-dining-candy', 'look-sofa-candy', 'look-lamp-candy', 'look-plant-candy', 'paper-sprinkles', 'floor-checkpink'], ['soft', 'playful', 'warm']),

  promo(bundle('set-cuddle', 'Cuddle Clouds kitchen and living room', 'Pastel bears, clouds and rainbows: the rainbow bear fridge, cloud counter with a heart basin and a bear plush, cloud table with bear-face chairs under a rainbow, a puffy cloud sofa, a cloud lamp with rainbow drops and a cloud pot, with clouds and rainbows on the walls and a sky check underfoot.',
    ['look-fridge-cuddle', 'look-counter-cuddle', 'look-dining-cuddle', 'look-sofa-cuddle', 'look-lamp-cuddle', 'look-plant-cuddle', 'paper-clouds-sky', 'floor-skycheck'], ['soft', 'playful', 'cozy'])),

  bundle('set-arcade', 'Arcade kitchen and living room', 'Black cabinets, marquee lights and neon: the cabinet fridge with a glowing screen, coin-op counter with a joystick at the end, a cocktail cabinet to eat off with red vinyl stools under a marquee, a vinyl sofa with chasing lights, a joystick lamp and a pixel pot, with pixel invaders on the walls and the arcade carpet underfoot. The claw machine in Hobbies goes with it.',
    ['look-fridge-arcade', 'look-counter-arcade', 'look-dining-arcade', 'look-sofa-arcade', 'look-lamp-arcade', 'look-plant-arcade', 'paper-pixel-invaders', 'floor-arcadecarpet'], ['playful', 'bold', 'vintage']),

  bundle('touches-arcade', 'Arcade finishing touches', 'The rest of the arcade: the carpet as a rug, a marquee sign that says PLAY in chasing bulbs, a pixel art print, a stack of game cartridges and a pinball machine with a playfield that comes alive when someone plays.',
    ['rug-arcade', 'wobj-marquee', 'wobj-pixelprint', 'cartridges', 'pinball'], ['playful', 'bold', 'vintage']),

  promo(bundle('touches-cuddle', 'Cuddle Clouds finishing touches', 'The rest of the clouds: a cloud-shaped rug with a rainbow across it, a rainbow arch for the wall, a cloud night light that glows, a pile of bear plushies and a swing seat hanging from a cloud that bobs and glows.',
    ['rug-cuddle', 'wobj-rainbowarch', 'wobj-cloudlight', 'plushpile', 'cloudswing'], ['soft', 'playful', 'cozy'])),

  bundle('touches-neon', 'Neon finishing touches', 'The rest of the neon: a black grid rug edged in light, a neon bolt that flickers, a holo poster with a rolling scan, a server stack with blinking lights and a VR pod with ring lights and a holo cube that spins while someone is in it.',
    ['rug-neon', 'wobj-neonbolt', 'wobj-holoposter', 'serverstack', 'vrpod'], ['bold', 'modern', 'industrial']),

  bundle('touches-gothic', 'Gothic Revival finishing touches', 'The rest of the gothic: an oxblood damask rug, a stained glass panel that glows, a candle sconce, a stack of grimoires and a fortune-telling machine whose crystal ball glows while you ask.',
    ['rug-gothic', 'wobj-stainedglass', 'wobj-sconce', 'grimoires', 'fortuneteller'], ['luxe', 'vintage', 'cozy']),

  bundle('touches-candy', 'Candy finishing touches', 'The rest of the sweets: a round lollipop rug, a lollipop wall, a sweet shop sign with chasing bulbs, three jars of sweets and a gumball machine that rattles one down the chute.',
    ['rug-candy', 'wobj-lollipops', 'wobj-candysign', 'candyjars', 'gumball'], ['soft', 'playful', 'warm']),

  bundle('touches-tropical', 'Tropical finishing touches', 'The rest of the tropics: a palm rug, two tiki masks, a flamingo neon, two coconut drinks and a tiki bar under a thatched roof with torches that flicker and a blender that whirs.',
    ['rug-tropical', 'wobj-tikimasks', 'wobj-flamingoneon', 'coconuts', 'tikibar'], ['playful', 'natural', 'bold']),
  bundle('set-spring', 'Spring kitchen and living room', 'The blossom icebox, potting-bench counter, garden table set, posy sofa, daisy lamp and tulip pot, with mint blossom walls and a sunlit birch floor.',
    ['look-fridge-spring', 'look-counter-spring', 'look-dining-spring', 'look-sofa-spring', 'look-lamp-spring', 'look-plant-spring', 'paper-blossom-mint', 'floor-birch'], ['soft', 'natural', 'playful']),

  bundle('set-summer', 'Summer kitchen and living room', 'The sunny icebox, lemonade-stand counter, patio table set, sunbed sofa, palm lamp and palm tub, with sunshine-striped walls and a honey pine floor.',
    ['look-fridge-summer', 'look-counter-summer', 'look-dining-summer', 'look-sofa-summer', 'look-lamp-summer', 'look-plant-summer', 'paper-stripe-sun', 'floor-honey'], ['playful', 'bold', 'warm']),

  bundle('set-fall', 'Fall kitchen and living room', 'The harvest icebox and counter, harvest table set, plaid-throw sofa, lantern lamp and mum pot, with fallen-leaf walls and a chestnut floor.',
    ['look-fridge-fall', 'look-counter-fall', 'look-dining-fall', 'look-sofa-fall', 'look-lamp-fall', 'look-plant-fall', 'paper-leaves', 'floor-chestnut'], ['warm', 'cozy', 'natural']),

  bundle('set-winter', 'Winter kitchen and living room', 'The frosted icebox, evergreen counter, lodge table set, knit-throw sofa, candle-glow lamp and frosted evergreen pot, with snowfall walls and a frosted pine floor.',
    ['look-fridge-winter', 'look-counter-winter', 'look-dining-winter', 'look-sofa-winter', 'look-lamp-winter', 'look-plant-winter', 'paper-snow', 'floor-frostpine'], ['cozy', 'cool', 'soft']),

  bundle('set-brutalist', 'Brutalist Loft bedroom and bath', 'Board-formed concrete, blackened steel and one sheet of glass: the concrete bed and nightstand, a steel locker dresser, a wall-hung black toilet, a trough vanity, a walk-in shower, concrete walls, a dark terrazzo floor, and the Overseer to keep an eye on you.',
    ['look-bed-brutalist', 'look-nightstand-brutalist', 'look-dresser-brutalist', 'look-toilet-brutalist', 'look-vanity-brutalist', 'look-shower-brutalist', 'paper-formwork', 'floor-terrazzodark', 'overseer'], ['industrial', 'minimal', 'bold']),

  bundle('set-spa', 'Spa Retreat bedroom and bath', 'Oiled teak, honed limestone, sage linen and steam: the teak platform bed and floating nightstand, a slatted dresser, a rimless toilet, a vessel vanity, a rain shower on pebbles that fogs its glass, limewashed walls, a teak deck floor, and an aroma diffuser to breathe in.',
    ['look-bed-spa', 'look-nightstand-spa', 'look-dresser-spa', 'look-toilet-spa', 'look-vanity-spa', 'look-shower-spa', 'paper-limewash', 'floor-teakdeck', 'diffuser'], ['soft', 'minimal', 'natural']),

  bundle('set-hotel', 'Grand Hotel bedroom and bath', 'Walnut, veined marble, brass and velvet: the tufted velvet bed, a marble-topped bedside chest and lowboy, a pedestal toilet, a walnut vanity, a marble shower with brass fittings, gold pinstripe walls, a marble check floor, and a service bell that brings breakfast to the bed.',
    ['look-bed-hotel', 'look-nightstand-hotel', 'look-dresser-hotel', 'look-toilet-hotel', 'look-vanity-hotel', 'look-shower-hotel', 'paper-pinstripe-gold', 'floor-marblecheck', 'servicebell'], ['luxe', 'bold', 'vintage']),

  bundle('set-cottage', 'Cottagecore bedroom and bath', 'White iron, painted pine, patchwork and chintz: the iron bed with a patchwork quilt, a painted bedside table and a hand-painted flower chest, a high-cistern toilet, a skirted gingham sink, a beadboard shower with a floral curtain, ditsy floral walls, painted pine boards, and a music box with a little dancer.',
    ['look-bed-cottage', 'look-nightstand-cottage', 'look-dresser-cottage', 'look-toilet-cottage', 'look-vanity-cottage', 'look-shower-cottage', 'paper-ditsy-cream', 'floor-paintedpine', 'musicbox'], ['cozy', 'soft', 'vintage']),

  bundle('set-midcentury', 'Mid-Century bedroom and bath', 'Walnut on tapered legs, cane, mustard and teal, and pastel tile: the walnut and cane bed, a splayed-leg nightstand and long lowboy, a pastel toilet and vanity, a tiled shower with a reeded slider, atomic starburst walls, walnut parquet, and a hi-fi console whose record turns the room amber.',
    ['look-bed-midcentury', 'look-nightstand-midcentury', 'look-dresser-midcentury', 'look-toilet-midcentury', 'look-vanity-midcentury', 'look-shower-midcentury', 'paper-starburst-amber', 'floor-walnutparquet', 'hificonsole'], ['modern', 'warm', 'vintage']),

  bundle('set-regency', 'Hollywood Regency bedroom and bath', 'Blush velvet, black lacquer, mirror and gold: the gold-crested tufted bed, a mirrored nightstand and chest, a black toilet, a lacquer and marble vanity, a black tile shower with gold fittings, banana-leaf walls, white herringbone floors, and a Hollywood dressing table ringed with bulbs to get glam at.',
    ['look-bed-regency', 'look-nightstand-regency', 'look-dresser-regency', 'look-toilet-regency', 'look-vanity-regency', 'look-shower-regency', 'paper-banana-leaf', 'floor-whiteherring', 'glamtable'], ['luxe', 'bold', 'playful']),

  bundle('set-chalet', 'Alpine Chalet bedroom and bath', 'Honey logs, knotty pine, buffalo check and river stone: the log bed with a check blanket and sheepskin, a stump side table with a lantern, a rough-hewn pine chest, a pine-boxed toilet, a copper basin on a log stand, a river-stone shower, knotty pine walls, a river slate floor, and a cast-iron wood stove to sit by.',
    ['look-bed-chalet', 'look-nightstand-chalet', 'look-dresser-chalet', 'look-toilet-chalet', 'look-vanity-chalet', 'look-shower-chalet', 'paper-knotty-pine', 'floor-riverslate', 'woodstove'], ['cozy', 'warm', 'natural']),

  bundle('set-victorian', 'Victorian Boudoir bedroom and bath', 'Carved mahogany, rose damask, velvet and lace: the canopied four-poster, a cabriole bedside table, a mahogany chest with an oval mirror, a china toilet with a high tank, a marble washstand, a tiled shower with a lace curtain, rose damask walls, mahogany herringbone floors, and a brass candelabra whose candles go out one by one at bedtime.',
    ['look-bed-victorian', 'look-nightstand-victorian', 'look-dresser-victorian', 'look-toilet-victorian', 'look-vanity-victorian', 'look-shower-victorian', 'paper-damask-rose', 'floor-mahoganyherring', 'tallcandelabra'], ['luxe', 'cozy', 'vintage']),

  bundle('set-ryokan', 'Wabi-Sabi Ryokan bedroom and bath', 'Pale hinoki, tatami, clay plaster and river stone: a futon on a tatami dais, a paper lantern, a kiri tansu, a hinoki-seat toilet, a stone vessel basin, a hinoki wet room with a noren, clay plaster walls, hinoki boards, and a bamboo water fountain to meditate beside.',
    ['look-bed-ryokan', 'look-nightstand-ryokan', 'look-dresser-ryokan', 'look-toilet-ryokan', 'look-vanity-ryokan', 'look-shower-ryokan', 'paper-clay-plaster', 'floor-hinokiboards', 'shishiodoshi'], ['minimal', 'natural', 'cool']),

  bundle('set-celestial', 'Celestial Dream bedroom and bath', 'Pearl, moon gold, night navy and lavender: the crescent moon bed, a moon lamp, a moon-phase dresser, a pearl toilet and vanity, an opal glass shower, constellation walls, a stardust carpet, and a star projector that dims the room and fills the walls with drifting stars.',
    ['look-bed-celestial', 'look-nightstand-celestial', 'look-dresser-celestial', 'look-toilet-celestial', 'look-vanity-celestial', 'look-shower-celestial', 'paper-constellations', 'floor-stardust', 'starprojector'], ['soft', 'playful', 'cool']),

  // Upgrades
  { id: 'upgrade-attic', name: 'Attic loft', desc: 'A whole new floor above the bedroom: stairs, windows and room for more.', price: 1200, icon: 'upgrade', tab: 'Upgrades', tags: ['cozy', 'natural'] },

  // The attic: a reading nook, a studio and a few things worth finding in a trunk
  { id: 'attic-trunk', name: 'Steamer trunk', desc: 'Somewhere to keep things nobody has opened in years.', price: 90, icon: 'obj', tab: 'Attic', type: 'trunk', cols: ['#7A4E32', '#2E3B57', '#3F5B4C', '#8E5468'], tags: ['vintage', 'cozy', 'natural'], repeat: true },
  { id: 'attic-dressform', name: 'Dress form', desc: 'For the sewing corner.', price: 70, icon: 'obj', tab: 'Attic', type: 'dressform', cols: ['#E8DCC8', '#B5476E', '#2E3B57'], tags: ['vintage', 'creative', 'soft'], repeat: true },
  { id: 'attic-gramophone', name: 'Gramophone', desc: 'Crackly records under the rafters.', price: 220, icon: 'obj', tab: 'Attic', type: 'gramophone', cols: ['#7A4E32', '#1B1A1F', '#C9A24A'], tags: ['vintage', 'warm', 'cozy'], repeat: true },
  { id: 'attic-floorcushion', name: 'Floor cushions', desc: 'A reading nook, no chair needed.', price: 60, icon: 'obj', tab: 'Attic', type: 'floorcushion', cols: ['#B5476E', '#4F6F74', '#C9A24A', '#E8DCC8', '#6E3C50'], tags: ['cozy', 'soft', 'playful'], repeat: true },
  { id: 'attic-crates', name: 'Book crates', desc: 'Paperbacks, by the dozen.', price: 45, icon: 'obj', tab: 'Attic', type: 'crates', cols: ['#B98A6A', '#3A2E2A', '#E4DDD2'], tags: ['natural', 'cozy', 'vintage'], repeat: true },
  { id: 'attic-telescope', name: 'Telescope', desc: 'Best view in the house.', price: 150, icon: 'obj', tab: 'Attic', type: 'telescope', cols: ['#F2EEE8', '#2B2B30', '#C9A24A'], tags: ['modern', 'cool', 'minimal'], repeat: true },
  { id: 'attic-easel', name: 'Art easel', desc: 'A studio in the roof.', price: 100, icon: 'obj', tab: 'Attic', type: 'easel', cols: ['#B98A6A', '#2B2B30', '#F2EEE8'], tags: ['natural', 'creative', 'soft'], repeat: true },
  { id: 'attic-rocker', name: 'Rocking chair', price: 150, icon: 'obj', tab: 'Attic', type: 'rocker', cols: ['#8A5E3B', '#3A2E2A', '#F2EEE8', '#3F5B4C'], tags: ['vintage', 'cozy', 'natural'], repeat: true },
  { id: 'attic-globe', name: 'Antique globe', price: 120, icon: 'obj', tab: 'Attic', type: 'globe', cols: ['#9C6B45', '#2B2B30'], tags: ['vintage', 'luxe', 'natural'], repeat: true },
  { id: 'attic-lantern', name: 'Floor lantern', price: 40, icon: 'obj', tab: 'Attic', type: 'lantern', cols: ['#2B2B30', '#C9A24A', '#F2EEE8'], tags: ['cozy', 'warm', 'vintage'], repeat: true },

  // Pictures on the wall: photos and gradients, the same ones as the app's wallpaper picker
  ...PICTURE_WALLS.map(w => wallpaper(`paper-${w.id}`, w.name, w.id, w.price, w.tags)),

  // Floors
  floor('floor-wood', 'Oak plank', 'wood', 120, ['natural', 'warm', 'cozy']),
  floor('floor-walnut', 'Walnut plank', 'walnut', 150, ['luxe', 'warm', 'bold']),
  floor('floor-maple', 'Maple plank', 'maple', 120, ['natural', 'warm', 'soft']),
  floor('floor-ash', 'Ash plank', 'ash', 120, ['minimal', 'cool', 'modern']),
  floor('floor-cherry', 'Cherry plank', 'cherry', 150, ['warm', 'bold', 'vintage']),
  floor('floor-whitewash', 'Whitewash plank', 'whitewash', 130, ['minimal', 'soft', 'natural']),
  floor('floor-ebony', 'Ebony plank', 'ebony', 180, ['bold', 'cool', 'luxe', 'modern']),
  floor('floor-herring', 'Herringbone', 'herring', 200, ['luxe', 'warm', 'vintage']),
  floor('floor-marble', 'Marble', 'marble', 250, ['luxe', 'cool', 'modern', 'minimal']),
  floor('floor-nero', 'Nero marble', 'nero', 250, ['bold', 'luxe', 'modern']),
  floor('floor-hexwhite', 'White hex', 'hexwhite', 150, ['modern', 'minimal', 'soft']),
  floor('floor-hexsage', 'Sage hex', 'hexsage', 150, ['natural', 'cool', 'modern']),
  floor('floor-terracotta-tile', 'Terracotta tile', 'terracotta', 120, ['warm', 'natural', 'vintage']),
  floor('floor-slate', 'Slate stone', 'slate', 150, ['cool', 'industrial', 'modern']),
  floor('floor-charcoal', 'Charcoal microcement', 'charcoal', 170, ['modern', 'minimal', 'cool']),
  floor('floor-barnwood', 'Barnwood plank', 'barnwood', 140, ['cozy', 'natural', 'warm']),
  floor('floor-linoleum', 'Diner linoleum', 'linoleum', 160, ['vintage', 'playful', 'bold']),
  floor('floor-nordic', 'Pale wide plank', 'nordic', 140, ['soft', 'minimal', 'natural']),
  floor('floor-poured', 'Poured concrete', 'poured', 170, ['industrial', 'bold', 'cool']),
  floor('floor-birch', 'Sunlit birch plank', 'birchplank', 130, ['soft', 'natural', 'playful']),
  floor('floor-honey', 'Honey pine plank', 'honey', 130, ['playful', 'bold', 'warm']),
  floor('floor-chestnut', 'Chestnut plank', 'chestnut', 150, ['warm', 'cozy', 'natural']),
  floor('floor-frostpine', 'Frosted pine plank', 'frostpine', 130, ['cozy', 'cool', 'soft']),
  floor('floor-driftwood', 'Bleached boards', 'driftwood', 140, ['cool', 'natural', 'playful']),
  floor('floor-ivorygold', 'Ivory marble, gold vein', 'ivorygold', 180, ['luxe', 'bold', 'vintage']),
  floor('floor-tatami', 'Tatami mat', 'tatami', 130, ['minimal', 'natural', 'cool']),
  floor('floor-jute', 'Jute weave', 'jute', 130, ['warm', 'natural', 'playful']),
  floor('floor-moon', 'Moon tile', 'moon', 170, ['modern', 'bold', 'playful']),
  floor('floor-herringebony', 'Ebony herringbone', 'herringebony', 180, ['luxe', 'vintage', 'cozy']),
  floor('floor-zellige', 'Zellige mosaic', 'zellige', 160, ['warm', 'bold', 'natural']),
  floor('floor-bamboo', 'Bamboo plank', 'bamboo', 140, ['playful', 'natural', 'bold']),
  floor('floor-terrazzopop', 'Pop terrazzo', 'terrazzopop', 170, ['playful', 'bold', 'modern']),
  floor('floor-limestone', 'Limestone flags', 'limestone', 150, ['soft', 'cozy', 'vintage']),
  floor('floor-saltillo', 'Saltillo tile', 'saltillo', 140, ['warm', 'natural', 'cozy']),
  floor('floor-grate', 'Lit grate', 'grate', 170, ['bold', 'modern', 'industrial']),
  floor('floor-checkpink', 'Pink check', 'checkpink', 140, ['soft', 'playful', 'warm']),
  promo(floor('floor-skycheck', 'Sky check', 'skycheck', 140, ['soft', 'playful', 'cozy'])),
  floor('floor-stardust', 'Stardust carpet', 'stardust', 150, ['soft', 'playful', 'cool']),
  floor('floor-hinokiboards', 'Hinoki boards', 'hinokiboards', 150, ['minimal', 'natural', 'cool']),
  floor('floor-mahoganyherring', 'Mahogany herringbone', 'mahoganyherring', 180, ['luxe', 'cozy', 'vintage']),
  floor('floor-riverslate', 'River slate', 'riverslate', 160, ['cozy', 'warm', 'natural']),
  floor('floor-whiteherring', 'White herringbone', 'whiteherring', 170, ['luxe', 'bold', 'playful']),
  floor('floor-walnutparquet', 'Walnut parquet', 'walnutparquet', 170, ['modern', 'warm', 'vintage']),
  floor('floor-paintedpine', 'Painted pine boards', 'paintedpine', 130, ['cozy', 'soft', 'vintage']),
  floor('floor-marblecheck', 'Marble check', 'marblecheck', 180, ['luxe', 'bold', 'vintage']),
  floor('floor-teakdeck', 'Teak deck', 'teakdeck', 160, ['soft', 'minimal', 'natural']),
  floor('floor-terrazzodark', 'Dark terrazzo', 'terrazzodark', 170, ['industrial', 'minimal', 'bold']),
  floor('floor-arcadecarpet', 'Arcade carpet', 'arcadecarpet', 170, ['playful', 'bold', 'vintage']),
  floor('floor-checker', 'Checkerboard', 'checker', 180, ['bold', 'playful', 'vintage']),
  floor('floor-rose', 'Rose carpet', 'rose', 100, ['soft', 'warm', 'cozy']),
  floor('floor-navy-carpet', 'Navy carpet', 'navy', 100, ['cool', 'modern', 'cozy']),
  floor('floor-rubber', 'Rubber mat', 'rubber', 80, ['industrial', 'cool', 'minimal']),

  // Furniture
  furn('sofa', 'sofa', 'Couch', 350, ['cozy', 'warm', 'natural'], ['#4F6F74', '#B5476E', '#C9A24A', '#8E9C96', '#3A3340', '#E8DCC8']),
  furn('armchair', 'armchair', 'Armchair', 180, ['cozy', 'warm'], ['#4F6F74', '#B5476E', '#C9A24A', '#8E9C96', '#3A3340', '#E8DCC8', '#A65D3F']),
  furn('loveseat', 'loveseat', 'Loveseat', 280, ['cozy', 'warm', 'soft'], ['#8E5468', '#4A5DA8', '#5E8187', '#C9B79C', '#3F5B4C', '#D9A84A']),
  furn('chesterfield', 'chesterfield', 'Chesterfield sofa', 500, ['luxe', 'vintage', 'bold'], ['#5A2E1E', '#2E3B57', '#3F5B4C', '#6E3C50']),
  furn('beanbag', 'beanbag', 'Bean bag', 90, ['playful', 'cozy', 'soft'], ['#D24A7A', '#E0A43A', '#3D6B73', '#7FB069', '#2B2B30', '#F2EEE8']),
  furn('rocker', 'rocker', 'Rocking chair', 150, ['vintage', 'cozy', 'natural'], ['#8A5E3B', '#3A2E2A', '#F2EEE8', '#3F5B4C']),
  furn('accent', 'accent', 'Accent chair', 120, ['modern', 'bold'], ['#E0A43A', '#B5476E', '#5E8187', '#F2EEE8', '#2B2B30']),
  furn('ottoman', 'ottoman', 'Ottoman', 60, ['modern', 'minimal'], ['#C9A24A', '#8E5468', '#4F6F74', '#E8DCC8', '#3A3340']),
  furn('coffeetable', 'coffeetable', 'Coffee table', 100, ['natural', 'minimal'], ['#9C6B45', '#3A2E2A', '#E4DDD2', '#B98A6A']),
  furn('sidetable', 'sidetable', 'Side table', 50, ['minimal', 'natural'], ['#B98A6A', '#3A2E2A', '#F2EEE8', '#3F5B4C']),
  furn('bed', 'bed', 'Luxury bed', 400, ['luxe', 'cozy', 'soft']),
  furn('daybed', 'daybed', 'Guest daybed', 200, ['cozy', 'soft', 'natural']),
  furn('dresser', 'dresser', 'Dresser', 150, ['natural', 'minimal', 'cozy']),
  furn('dining', 'dining', 'Dining set', 320, ['natural', 'cozy', 'warm']),
  furn('desk', 'desk', 'Desk', 220, ['modern', 'minimal', 'creative']),
  furn('nightstand', 'nightstand', 'Nightstand', 50, ['cozy', 'natural', 'minimal']),
  furn('lamp', 'lamp', 'Floor lamp', 70, ['minimal', 'modern', 'warm']),
  furn('arclamp', 'arclamp', 'Arc lamp', 120, ['modern', 'bold', 'minimal']),
  furn('lantern', 'lantern', 'Floor lantern', 40, ['cozy', 'warm', 'vintage'], ['#2B2B30', '#C9A24A', '#F2EEE8']),
  furn('lavalamp', 'lavalamp', 'Lava lamp', 35, ['playful', 'bold', 'modern'], ['#FF7A3A', '#7A5CFF', '#38D39F']),
  furn('bookshelf', 'bookshelf', 'Bookshelf', 180, ['natural', 'vintage', 'cozy']),
  furn('shelves', 'shelves', 'Storage shelves', 120, ['industrial', 'minimal', 'natural']),
  furn('rugrect', 'rugrect', 'Area rug', 100, ['cozy', 'warm', 'soft'], ['#B5476E', '#3D6B73', '#C9A24A', '#E8DCC8', '#2E3B57', '#7FB069']),
  furn('rugrunner', 'rugrunner', 'Runner rug', 60, ['cozy', 'natural'], ['#A63A2C', '#4A5DA8', '#D8C9AE', '#3F5B4C']),
  furn('ruground', 'ruground', 'Round rug', 80, ['soft', 'playful', 'warm'], ['#E8DCC8', '#D24A7A', '#8E9C96', '#2B2B30', '#E0A43A']),
  furn('rug-arcade', 'rugarcade', 'Arcade rug', 110, ['playful', 'bold', 'vintage'], ['#2B2459', '#15121F', '#3A2E73']),
  promo(furn('rug-cuddle', 'rugcloud', 'Cloud rug', 110, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#F6EEF2', '#DCEEFA'])),
  furn('rug-neon', 'rugneon', 'Grid rug', 110, ['bold', 'modern', 'industrial'], ['#111118', '#1E2230', '#2A2F3A']),
  furn('rug-gothic', 'ruggothic', 'Damask rug', 110, ['luxe', 'vintage', 'cozy'], ['#5E1F2A', '#2E3B57', '#3B2541']),
  furn('rug-candy', 'rugcandy', 'Lollipop rug', 110, ['soft', 'playful', 'warm'], ['#F6B7CC', '#BFE8D6', '#D6C4F0']),
  furn('rug-tropical', 'rugtropical', 'Palm rug', 110, ['playful', 'natural', 'bold'], ['#F7F1E3', '#F0E6C8', '#D9BE82']),
  furn('wardrobe', 'wardrobe', 'Wardrobe', 250, ['vintage', 'luxe', 'natural'], ['#E4DDD2', '#9C6B45', '#3A2E2A', '#8E9C96']),
  furn('console', 'console', 'Console table', 130, ['modern', 'minimal', 'luxe'], ['#3A2E2A', '#9C6B45', '#E4DDD2', '#C9A24A']),
  furn('cabinet', 'cabinet', 'Cabinet', 160, ['vintage', 'natural', 'cozy'], ['#B98A6A', '#3F5B4C', '#2E3B57', '#F2EEE8', '#8E5468']),
  furn('cubeshelf', 'cubeshelf', 'Cube shelf', 80, ['modern', 'minimal', 'playful'], ['#F2EEE8', '#2B2B30', '#B98A6A']),
  furn('floormirror', 'floormirror', 'Floor mirror', 90, ['modern', 'minimal', 'luxe'], ['#C9A24A', '#2B2B30', '#F2EEE8', '#9C6B45']),
  furn('gclock', 'gclock', 'Grandfather clock', 300, ['vintage', 'luxe', 'bold'], ['#5A3E2E', '#2B2B30', '#E4DDD2']),
  furn('globe', 'globe', 'Antique globe', 120, ['vintage', 'luxe', 'natural'], ['#9C6B45', '#2B2B30']),
  // TVs: one for the wall, the rest stand on a TV unit, a console, a desk or a dresser; and somewhere to put one.
  furn('walltv', 'walltv', 'Wall-mounted TV', 380, ['modern', 'minimal', 'cool']),
  furn('tvflat', 'tvflat', 'Flat-screen TV', 300, ['modern', 'minimal']),
  furn('tvdesk', 'tvdesk', 'Desk TV', 120, ['playful', 'modern'], ['#2B2B30', '#F2EEE8', '#C2413A']),
  furn('tvtube', 'tvtube', 'Tube TV', 90, ['vintage', 'playful', 'cozy'], ['#8A5E3B', '#E4DDD2', '#2B2B30']),
  furn('entcenter', 'entcenter', 'Entertainment center', 450, ['cozy', 'natural', 'vintage'], ['#9C6B45', '#2B2B30', '#E4DDD2']),
  // Five more: two with a tube, two for the wall, one on the floor.
  furn('crttable', 'crttable', 'CRT TV table', 160, ['vintage', 'playful', 'cozy'], ['#8A5E3B', '#E4DDD2', '#2B2B30']),
  furn('crtwall', 'crtwall', 'Wall shelf CRT', 180, ['vintage', 'playful', 'industrial'], ['#8A5E3B', '#E4DDD2', '#2B2B30']),
  furn('frametv', 'frametv', 'Frame TV', 520, ['modern', 'luxe', 'minimal'], ['#3A2E2A', '#C9A24A', '#F2EEE8']),
  furn('cinematv', 'cinematv', 'Cinema wall TV', 640, ['modern', 'bold', 'cool']),
  furn('floortv', 'floortv', 'Floor-stand TV', 340, ['modern', 'minimal', 'industrial'], ['#2B2B30', '#E4DDD2', '#9C6B45']),

  // Models: other shapes of a piece the house has, each with looks drawn for its own shape. One takes the place of
  // the piece it stands in for (the fridge stays in its corner of the kitchen), so mixing models changes the room.
  model('model-chestfreezer', 'chestfreezer', 'Chest freezer', 'Low and wide, with a lid that swings up. The kitchen gets its wall back.', 300, ['minimal', 'cool']),
  look('look-chestfreezer-camp', 'chestfreezer', 'camp', 'Camp cooler chest', 'Ribbed steel in forest green under a white lid, with chrome corners, latches and a side handle.', 360, ['natural', 'vintage', 'playful'], ['#2F5D43', '#B5532F', '#3F6E8C']),
  model('model-mediaconsole', 'mediaconsole', 'Media console', 'Long and low in pale oak: two drawers either side and a shelf for the console. More wall for the screen.', 260, ['modern', 'minimal', 'natural']),
  look('look-mediaconsole-danish', 'mediaconsole', 'danish', 'Teak credenza', 'A teak credenza on splayed legs, slatted doors between two coloured ones, and brass pulls.', 420, ['vintage', 'warm', 'natural'], ['#D9A84A', '#3D6B73', '#C2603A']),

  // Looks: the same pieces, drawn differently. Buying one restyles the piece already on the main floor.
  // Retro: a 1950s-70s American kitchen and living room.
  look('look-fridge-retro', 'fridge', 'retro', 'Pastel icebox', 'Rounded, cheerful and cold, with a chrome handle you can hold onto.', 360, ['vintage', 'playful', 'bold'], ['#9ED8C6', '#F3B6C4', '#F6E3A1']),
  look('look-counter-retro', 'counter', 'retro', 'Diner counter', 'Cream laminate, chrome trim and a deep white sink.', 420, ['vintage', 'playful', 'bold'], ['#9ED8C6', '#F3B6C4', '#F6E3A1']),
  look('look-dining-retro', 'dining', 'retro', 'Boomerang table set', 'A laminate table with boomerangs on top, chrome legs and vinyl chairs.', 340, ['vintage', 'playful', 'bold'], ['#E58F8F', '#6FBFB0', '#F2C75C']),
  look('look-sofa-retro', 'sofa', 'retro', 'Davenport', 'Buttoned vinyl and a chrome trim. It squeaks a little when you sit.', 380, ['vintage', 'playful', 'bold'], ['#E5A33B', '#5FB3A6', '#E58F8F']),
  look('look-lamp-retro', 'lamp', 'retro', 'Atomic lamp', 'A chrome starburst with glowing bulbs on every arm.', 90, ['vintage', 'playful', 'bold'], ['#F08A6B', '#6FBFB0', '#F2C75C']),
  look('look-plant-retro', 'plant', 'retro', 'Atomic planter', 'Your plant on three wooden legs, in a glazed pot with a cream band.', 45, ['vintage', 'playful', 'bold'], ['#F08A6B', '#6FBFB0', '#F2C75C', '#E58F8F']),

  // Farmhouse: shiplap, butcher block, cream enamel and wood.
  look('look-fridge-farmhouse', 'fridge', 'farmhouse', 'Cream enamel icebox', 'Cream enamel, a butcher-block top and iron pulls. It hums like it means it.', 340, ['cozy', 'natural', 'warm'], ['#F1E8D2', '#B9CBB5', '#F2DFA0']),
  look('look-counter-farmhouse', 'counter', 'farmhouse', 'Butcher-block counter', 'Shiplap cabinets, a thick butcher-block top and a deep apron-front sink.', 400, ['cozy', 'natural', 'warm'], ['#F1E8D2', '#B9CBB5', '#9DB3C6']),
  look('look-dining-farmhouse', 'dining', 'farmhouse', 'Farm table set', 'A plank table with room for everyone, and spindle-back chairs.', 330, ['cozy', 'natural', 'warm'], ['#B98A6A', '#8A5E3B', '#E4DDD2']),
  look('look-sofa-farmhouse', 'sofa', 'farmhouse', 'Slipcover sofa', 'A washable linen slipcover with a little skirt, and a gingham cushion.', 360, ['cozy', 'natural', 'warm'], ['#E8DCC8', '#D8C9AE', '#B7BFB2']),
  look('look-lamp-farmhouse', 'lamp', 'farmhouse', 'Tripod lamp', 'Three wooden legs and a linen shade that glows like a porch light.', 80, ['cozy', 'natural', 'warm'], ['#B98A6A', '#8A5E3B', '#E4DDD2']),
  look('look-plant-farmhouse', 'plant', 'farmhouse', 'Crate and pail planter', 'Your plant in a pail, in a crate, because why not.', 40, ['cozy', 'natural', 'warm'], ['#C9CED6', '#F1E8D2', '#9DB3C6', '#3A3340']),

  // Modern: steel, glass, stone and nothing extra.
  look('look-fridge-modern', 'fridge', 'modern', 'Brushed steel fridge', 'A flat slab of steel with one long handle and a quiet little display.', 480, ['modern', 'minimal', 'cool'], ['#B9BEC3', '#2B2B30', '#E8EAEC']),
  look('look-counter-modern', 'counter', 'modern', 'Slab counter', 'Handleless fronts, a thin stone top and a squared steel sink.', 560, ['modern', 'minimal', 'cool'], ['#2B2B30', '#E8EAEC', '#5E646B']),
  look('look-dining-modern', 'dining', 'modern', 'Glass-top dining set', 'A glass table on slim black legs, and shell chairs that tuck right in.', 520, ['modern', 'minimal', 'cool'], ['#2B2B30', '#E8EAEC', '#5E646B']),
  look('look-sofa-modern', 'sofa', 'modern', 'Low-profile sofa', 'Tight cushions, square arms and a lot of floor showing underneath.', 520, ['modern', 'minimal', 'cool'], ['#5E646B', '#2B2B30', '#C9CED6']),
  look('look-lamp-modern', 'lamp', 'modern', 'Slim torchiere', 'A thin pole and a round white head that washes the ceiling.', 110, ['modern', 'minimal', 'cool'], ['#2B2B30', '#C9CED6', '#E8EAEC']),
  look('look-plant-modern', 'plant', 'modern', 'Slab planter', 'A square matte planter with pale gravel on top.', 70, ['modern', 'minimal', 'cool'], ['#2B2B30', '#E8EAEC', '#9AA0A6', '#C9B79C']),

  // Scandi: pale ash, linen and paper, and nothing shouting.
  look('look-fridge-scandi', 'fridge', 'scandi', 'Ash-handled fridge', 'A quiet white fridge with an ash cap and ash handles, and one small brass dot.', 350, ['soft', 'minimal', 'natural'], ['#F4F2EC', '#DDE3DF', '#F1E6D8']),
  look('look-counter-scandi', 'counter', 'scandi', 'Ash slab counter', 'Ash fronts you open with a finger, a white quartz top, a round sink and a brass tap.', 410, ['soft', 'minimal', 'natural'], ['#D8C7A8', '#E3D6BD', '#C9B693']),
  look('look-dining-scandi', 'dining', 'scandi', 'Wishbone dining set', 'An ash table with the grain showing, splayed legs, wishbone chairs and a paper lantern over it.', 330, ['soft', 'minimal', 'natural'], ['#D8C7A8', '#C9B693', '#EDE4D3']),
  look('look-sofa-scandi', 'sofa', 'scandi', 'Linen sofa on ash legs', 'Oatmeal linen on a frame you can see, a bolster, and a knitted throw over one arm.', 370, ['soft', 'minimal', 'natural'], ['#D9CDB9', '#B9C2B6', '#C7B8C9']),
  look('look-lamp-scandi', 'lamp', 'scandi', 'Paper lantern lamp', 'A big paper lantern on an ash tripod. The whole thing glows.', 85, ['soft', 'minimal', 'natural'], ['#F7F3EA', '#E9DDC7', '#D8E0DA']),
  look('look-plant-scandi', 'plant', 'scandi', 'Ceramic pot on an ash stand', 'A white ceramic pot lifted off the floor on crossed ash legs.', 50, ['soft', 'minimal', 'natural'], ['#F6F4EE', '#9DB3A5', '#D5C3B2', '#3A3A40']),

  // Industrial: steel, concrete and old wood, with the bolts showing.
  look('look-fridge-industrial', 'fridge', 'industrial', 'Riveted steel fridge', 'Gunmetal with rivets down both edges, a steel kick plate and a latch you have to mean.', 470, ['industrial', 'bold', 'cool'], ['#5A5E66', '#2B2B30', '#7B4A3A']),
  look('look-counter-industrial', 'counter', 'industrial', 'Concrete and steel counter', 'An open steel frame with a reclaimed shelf, a concrete top, a steel trough sink and a brass gooseneck.', 580, ['industrial', 'bold', 'cool'], ['#2B2B30', '#4A4D52', '#7B4A3A']),
  look('look-dining-industrial', 'dining', 'industrial', 'Pipe and plank table set', 'Three reclaimed planks on black pipe legs with flanges, and metal stools to perch on.', 500, ['industrial', 'bold', 'cool'], ['#8A5E3B', '#6B4A35', '#A87E48']),
  look('look-sofa-industrial', 'sofa', 'industrial', 'Tufted leather sofa', 'Buttoned leather on a black pipe frame, with brass studs along the arms.', 540, ['industrial', 'bold', 'cool'], ['#6B3A2A', '#2B2B30', '#4A5A4A']),
  look('look-lamp-industrial', 'lamp', 'industrial', 'Cage bulb lamp', 'A pipe stand, an elbow, a wire cage and an Edison bulb that glows amber.', 120, ['industrial', 'bold', 'cool'], ['#2B2B30', '#7B4A3A', '#8E939A']),
  look('look-plant-industrial', 'plant', 'industrial', 'Galvanized bucket planter', 'Your plant in a ribbed steel bucket with a wire handle.', 65, ['industrial', 'bold', 'cool'], ['#B9BEC3', '#2B2B30', '#7B4A3A', '#4A5A4A']),

  // Beach: driftwood, rope and sea glass, like the house is on holiday.
  look('look-fridge-beach', 'fridge', 'beach', 'Sea-glass fridge', 'Sea-glass enamel with a white cap, rope handles and a shell on the door.', 360, ['cool', 'natural', 'playful'], ['#7FB8C9', '#F7F5EF', '#E8907A']),
  look('look-counter-beach', 'counter', 'beach', 'Whitewashed shiplap counter', 'Whitewashed shiplap fronts with rope pulls, a driftwood top, a white basin and a brass tap.', 420, ['cool', 'natural', 'playful'], ['#F7F5EF', '#DDE8EA', '#E8DCC2']),
  look('look-dining-beach', 'dining', 'beach', 'Driftwood dining set', 'A bleached driftwood table, rattan chairs and a woven shade hanging over it.', 340, ['cool', 'natural', 'playful'], ['#C9B9A2', '#DAD0C0', '#B9ADA0']),
  look('look-sofa-beach', 'sofa', 'beach', 'Slipcover sofa with navy stripes', 'A white slipcover on driftwood feet, rope piping, two navy-striped cushions and a few shells underneath.', 380, ['cool', 'natural', 'playful'], ['#F7F5EF', '#E8DCC2', '#DDE8EA']),
  look('look-lamp-beach', 'lamp', 'beach', 'Rope-wound lamp', 'A driftwood post wound with rope and a woven drum shade.', 90, ['cool', 'natural', 'playful'], ['#F2E6DA', '#DDE8EA', '#E8DCC2']),
  look('look-plant-beach', 'plant', 'beach', 'Seagrass basket planter', 'Your plant in a woven seagrass basket with a rope rim.', 50, ['cool', 'natural', 'playful'], ['#D2B48C', '#C9B9A2', '#E8DCC2', '#B9ADA0']),

  look('look-fridge-deco', 'fridge', 'deco', 'Lacquered icebox', 'Black lacquer with an emerald door panel, a gold sunburst and a stepped gold handle.', 520, ['luxe', 'bold', 'vintage'], ['#1B1A1F', '#1F5E4A', '#6E2A3A']),
  look('look-counter-deco', 'counter', 'deco', 'Black lacquer and gold counter', 'Black lacquer fronts with gold fluting, a gold rail, an ivory marble top and a brass basin.', 600, ['luxe', 'bold', 'vintage'], ['#1B1A1F', '#C9A24A', '#1F5E4A']),
  look('look-dining-deco', 'dining', 'deco', 'Sunburst dining set', 'An ivory marble top on a gold pedestal, fan-back velvet chairs and a tiered gold pendant.', 540, ['luxe', 'bold', 'vintage'], ['#1F5E4A', '#6E2A3A', '#2E3B57']),
  look('look-sofa-deco', 'sofa', 'deco', 'Emerald velvet sofa', 'Channel-tufted emerald velvet on a gold plinth, with wine and navy cushions.', 560, ['luxe', 'bold', 'vintage'], ['#1F5E4A', '#6E2A3A', '#2E3B57']),
  look('look-lamp-deco', 'lamp', 'deco', 'Tiered gold lamp', 'A fluted gold column under a stepped, tiered shade.', 160, ['luxe', 'bold', 'vintage'], ['#C9A24A', '#E0C26E', '#B9BEC3']),
  look('look-plant-deco', 'plant', 'deco', 'Gold urn planter', 'Your plant in a fluted gold urn on a black plinth.', 110, ['luxe', 'bold', 'vintage'], ['#C9A24A', '#E0C26E', '#B9BEC3', '#1B1A1F']),

  look('look-fridge-japandi', 'fridge', 'japandi', 'Paper-white fridge', 'Matte paper-white with a slim walnut handle and a stone grey cap.', 360, ['minimal', 'natural', 'cool'], ['#F7F3EA', '#B9B4AC', '#7A8A6A']),
  look('look-counter-japandi', 'counter', 'japandi', 'Walnut and stone counter', 'Slatted walnut fronts under a grey stone top, with a deep stone basin.', 430, ['minimal', 'natural', 'cool'], ['#4A3A2E', '#6B5444', '#B9B4AC']),
  look('look-dining-japandi', 'dining', 'japandi', 'Low walnut dining set', 'A long, low walnut table, bench seating and a washi paper pendant.', 350, ['minimal', 'natural', 'cool'], ['#4A3A2E', '#6B5444', '#2B2B30']),
  look('look-sofa-japandi', 'sofa', 'japandi', 'Low walnut sofa', 'A walnut frame low to the floor with stone-grey cushions and two bolsters.', 380, ['minimal', 'natural', 'cool'], ['#4A3A2E', '#6B5444', '#B9B4AC']),
  look('look-lamp-japandi', 'lamp', 'japandi', 'Washi paper lamp', 'A tall washi paper column glowing on a walnut base.', 90, ['minimal', 'natural', 'cool'], ['#F7F3EA', '#EDE6D6', '#E6DCCB']),
  look('look-plant-japandi', 'plant', 'japandi', 'Stone bowl bonsai', 'A bonsai in a shallow stone bowl on a walnut stand.', 60, ['minimal', 'natural', 'cool'], ['#B9B4AC', '#B07A5A', '#8E8A84', '#2B2B30']),

  look('look-fridge-boho', 'fridge', 'boho', 'Terracotta fridge', 'Terracotta enamel with a mustard band, a teal handle and a hanging plant on top.', 350, ['warm', 'natural', 'playful'], ['#C26B4A', '#D9A84A', '#3D6B73']),
  look('look-counter-boho', 'counter', 'boho', 'Rattan-front counter', 'Woven rattan fronts, a warm wood top, a terracotta basin and a brass tap.', 420, ['warm', 'natural', 'playful'], ['#D2B48C', '#A8865A', '#C9B28A']),
  look('look-dining-boho', 'dining', 'boho', 'Carved wood dining set', 'A carved wood table, rattan-back chairs and a macrame pendant over it.', 340, ['warm', 'natural', 'playful'], ['#9C6B45', '#A85A40', '#C9B28A']),
  look('look-sofa-boho', 'sofa', 'boho', 'Rattan-arm sofa with kilim cushions', 'A cream sofa with rattan arms, kilim cushions and a fringe along the base.', 380, ['warm', 'natural', 'playful'], ['#F1E8D2', '#D9A84A', '#C26B4A']),
  look('look-lamp-boho', 'lamp', 'boho', 'Macrame shade lamp', 'A knotted macrame shade with a fringe, on a rattan post.', 90, ['warm', 'natural', 'playful'], ['#EFE4D2', '#D2B48C', '#C9B28A']),
  look('look-plant-boho', 'plant', 'boho', 'Terracotta pot in a hanging sling', 'Your plant in a terracotta pot, held in a macrame sling from a wooden hook.', 60, ['warm', 'natural', 'playful'], ['#C26B4A', '#D9A84A', '#3D6B73', '#F1E8D2']),

  look('look-fridge-space', 'fridge', 'space', 'Capsule fridge', 'A white capsule with rounded corners, an orange porthole door and an ink base.', 520, ['modern', 'bold', 'playful'], ['#F4F6F8', '#1B1A24', '#F26A2E']),
  look('look-counter-space', 'counter', 'space', 'Moulded pod counter', 'One moulded white shell with a glowing button strip, an ink top and a round basin.', 600, ['modern', 'bold', 'playful'], ['#F4F6F8', '#1B1A24', '#D5DAE0']),
  look('look-dining-space', 'dining', 'space', 'Tulip dining set', 'A white tulip table on a single stem, orange tulip chairs and a saucer pendant.', 540, ['modern', 'bold', 'playful'], ['#F4F6F8', '#F26A2E', '#1B1A24']),
  look('look-sofa-space', 'sofa', 'space', 'Pod sofa', 'A moulded white pod on an ink ring base with cyan-piped cushions.', 560, ['modern', 'bold', 'playful'], ['#F4F6F8', '#1B1A24', '#5BE3E6']),
  look('look-lamp-space', 'lamp', 'space', 'Saucer lamp', 'An orange saucer shade hovering on a slim white stem over a violet glow.', 160, ['modern', 'bold', 'playful'], ['#F26A2E', '#F4F6F8', '#7A5CFF']),
  look('look-plant-space', 'plant', 'space', 'Capsule planter', 'Your plant in a white capsule pod with a cyan ring, on an ink base.', 110, ['modern', 'bold', 'playful'], ['#F4F6F8', '#1B1A24', '#5BE3E6', '#7A5CFF']),

  look('look-fridge-gothic', 'fridge', 'gothic', 'Stained-glass icebox', 'Ebony with a pointed stained-glass arch in the upper door that glows when the power is on, brass handles and a brass crest.', 520, ['luxe', 'vintage', 'cozy'], ['#2A2224', '#B08D57', '#5E1F2A']),
  look('look-counter-gothic', 'counter', 'gothic', 'Ebony and brass counter', 'Ebony fronts with pointed-arch panels in brass, a brass rail, a black marble top, a black basin and a candlestick at the end.', 600, ['luxe', 'vintage', 'cozy'], ['#2A2224', '#B08D57', '#2C2B2F']),
  look('look-dining-gothic', 'dining', 'gothic', 'Ebony pedestal dining set', 'A turned ebony pedestal under a brass-inlaid top, pointed-arch chairs in oxblood velvet, and a brass candle chandelier.', 540, ['luxe', 'vintage', 'cozy'], ['#2A2224', '#5E1F2A', '#B08D57']),
  look('look-sofa-gothic', 'sofa', 'gothic', 'Oxblood velvet sofa', 'Button-tufted oxblood velvet on an ebony plinth with ball feet, a carved crest and brass nailheads.', 560, ['luxe', 'vintage', 'cozy'], ['#5E1F2A', '#2A2224', '#B08D57']),
  look('look-lamp-gothic', 'lamp', 'gothic', 'Brass candelabra lamp', 'A brass candelabra on an ebony base; its three candles light as flames.', 160, ['luxe', 'vintage', 'cozy'], ['#B08D57', '#2A2224', '#FFE0A0']),
  look('look-plant-gothic', 'plant', 'gothic', 'Black urn planter', 'Your plant in a black urn with a brass rim and ring, on a stone plinth.', 110, ['luxe', 'vintage', 'cozy'], ['#2A2224', '#B08D57', '#5E1F2A', '#8E8A84']),

  look('look-fridge-riad', 'fridge', 'riad', 'Zellige fridge', 'Whitewashed plaster with a cobalt zellige band, a cedar arch on the lower door, brass handles and a brass star.', 360, ['warm', 'bold', 'natural'], ['#F3EEE4', '#2E4C9A', '#C9A24A']),
  look('look-counter-riad', 'counter', 'riad', 'Zellige and cedar counter', 'Whitewashed plaster with a cobalt zellige band, a cedar top, a hammered copper basin, a brass tap and a tagine at the end.', 430, ['warm', 'bold', 'natural'], ['#F3EEE4', '#2E4C9A', '#8A5A3A']),
  look('look-dining-riad', 'dining', 'riad', 'Inlaid cedar dining set', 'A carved cedar table inlaid with cobalt and cream stars, leather poufs to sit on, and a pierced brass lantern above.', 350, ['warm', 'bold', 'natural'], ['#8A5A3A', '#2E4C9A', '#F1EDE3']),
  look('look-sofa-riad', 'sofa', 'riad', 'Cedar banquette', 'A low carved cedar banquette with cream cushions, a cobalt back and terracotta bolsters at each end.', 380, ['warm', 'bold', 'natural'], ['#F1EDE3', '#2E4C9A', '#C27A5A']),
  look('look-lamp-riad', 'lamp', 'riad', 'Pierced brass lantern', 'A pierced brass lantern on a cedar stand; the cutouts glow.', 90, ['warm', 'bold', 'natural'], ['#C9A24A', '#8A5A3A', '#2E4C9A']),
  look('look-plant-riad', 'plant', 'riad', 'Cobalt-banded clay pot', 'Your plant in a terracotta pot with a cobalt band and cream diamonds.', 60, ['warm', 'bold', 'natural'], ['#C27A5A', '#2E4C9A', '#F1EDE3', '#9FC9B8']),

  look('look-fridge-tropical', 'fridge', 'tropical', 'Palm fridge', 'Palm green with bamboo bands, a monstera leaf on the door, a hibiscus and a flamingo-pink handle.', 350, ['playful', 'natural', 'bold'], ['#2F6B40', '#F08AA0', '#D9BE82']),
  look('look-counter-tropical', 'counter', 'tropical', 'Bamboo-slat counter', 'Bamboo-slat fronts bound with rattan, a teak top, a white basin, a brass tap and a pineapple at the end.', 420, ['playful', 'natural', 'bold'], ['#D9BE82', '#8A5A3A', '#F7F1E3']),
  look('look-dining-tropical', 'dining', 'tropical', 'Bamboo dining set', 'A teak top on bamboo legs, bamboo chairs with fan backs of palm leaves and pink cushions, under a woven cone.', 340, ['playful', 'natural', 'bold'], ['#8A5A3A', '#D9BE82', '#F08AA0']),
  look('look-sofa-tropical', 'sofa', 'tropical', 'Bamboo sofa with palm cushions', 'A bamboo frame with rattan arms, cream cushions, palm-green seats with monstera leaves and pink piping.', 380, ['playful', 'natural', 'bold'], ['#F7F1E3', '#2F6B40', '#F08AA0']),
  look('look-lamp-tropical', 'lamp', 'tropical', 'Bamboo cone lamp', 'A bamboo pole under a woven cone shade with a pink tassel.', 90, ['playful', 'natural', 'bold'], ['#D2B48C', '#D9BE82', '#F08AA0']),
  look('look-plant-tropical', 'plant', 'tropical', 'Bamboo-slat planter', 'Your plant in a teak box with bamboo slats and brass corner caps.', 60, ['playful', 'natural', 'bold'], ['#8A5A3A', '#D9BE82', '#C9A24A', '#2F6B40']),

  look('look-fridge-memphis', 'fridge', 'memphis', 'Squiggle fridge', 'White with a black squiggle, a red circle, a yellow triangle and blue bar handles.', 520, ['playful', 'bold', 'modern'], ['#F4F1EA', '#1B1A1F', '#E63946']),
  look('look-counter-memphis', 'counter', 'memphis', 'Squiggle counter', 'White laminate with squiggles and a circle, a triangle and a bar for handles, a pop terrazzo top, a black basin and a red tap.', 600, ['playful', 'bold', 'modern'], ['#F4F1EA', '#1B1A1F', '#F4C430']),
  look('look-dining-memphis', 'dining', 'memphis', 'Totem dining set', 'A white top on three coloured legs, chairs with a yellow seat on a red drum and a black half-moon back, under a sputnik light.', 540, ['playful', 'bold', 'modern'], ['#F4F1EA', '#E63946', '#F4C430']),
  look('look-sofa-memphis', 'sofa', 'memphis', 'Block sofa', 'A white block on a black plinth with a red drum arm, a yellow block arm, blue and mint cushions and a squiggle across the back.', 560, ['playful', 'bold', 'modern'], ['#F4F1EA', '#E63946', '#2E6BD6']),
  look('look-lamp-memphis', 'lamp', 'memphis', 'Totem lamp', 'A red stepped base, a yellow stem, a blue ball and a black-and-white striped drum.', 160, ['playful', 'bold', 'modern'], ['#F4C430', '#E63946', '#2E6BD6']),
  look('look-plant-memphis', 'plant', 'memphis', 'Stacked block planter', 'Your plant in a yellow block on a black cube, with a red triangle and blue dots.', 110, ['playful', 'bold', 'modern'], ['#F4C430', '#1B1A1F', '#E63946', '#2E6BD6']),

  look('look-fridge-provence', 'fridge', 'provence', 'Lavender enamel fridge', 'Cream enamel with lavender sprigs on the door, a blue toile band and iron handles.', 350, ['soft', 'cozy', 'vintage'], ['#F4EFE3', '#8E7CC3', '#3A3A40']),
  look('look-counter-provence', 'counter', 'provence', 'Whitewashed pine counter', 'Whitewashed pine panels with iron pulls, a limestone top, an apron-front basin, a copper tap and a jug of lavender at the end.', 420, ['soft', 'cozy', 'vintage'], ['#E8DCC4', '#D9D2C2', '#3A3A40']),
  look('look-dining-provence', 'dining', 'provence', 'Farm table and ladder-backs', 'A whitewashed pine farm table on turned legs, ladder-back chairs with rush seats, a jug of lavender and an iron lantern above.', 340, ['soft', 'cozy', 'vintage'], ['#E8DCC4', '#C9B690', '#3A3A40']),
  look('look-sofa-provence', 'sofa', 'provence', 'Skirted linen sofa', 'A skirted linen sofa with blue toile cushions, a lavender bolster and a sprig on the back.', 380, ['soft', 'cozy', 'vintage'], ['#F4EFE3', '#2E4C9A', '#C9B8E8']),
  look('look-lamp-provence', 'lamp', 'provence', 'Wrought iron lamp', 'A wrought iron scroll stand under a linen drum shade with a sprig tucked in the band.', 90, ['soft', 'cozy', 'vintage'], ['#3A3A40', '#F4EFE3', '#8E7CC3']),
  look('look-plant-provence', 'plant', 'provence', 'Zinc pot with lavender', 'Your plant in an old zinc pot with a band of lavender sprigs.', 60, ['soft', 'cozy', 'vintage'], ['#B9BEC3', '#8E7CC3', '#F4EFE3', '#9DB3A5']),

  look('look-fridge-adobe', 'fridge', 'adobe', 'Turquoise serape fridge', 'Turquoise with a serape band across the door, cream diamonds, a rust handle and a cream cap.', 350, ['warm', 'natural', 'cozy'], ['#3FA7A0', '#B5533C', '#F4ECD8']),
  look('look-counter-adobe', 'counter', 'adobe', 'Adobe and saltillo counter', 'Adobe plaster with a pine shelf line and painted diamonds, a saltillo tile top, a hammered copper basin and a cactus at the end.', 420, ['warm', 'natural', 'cozy'], ['#D9A47A', '#9C7046', '#3FA7A0']),
  look('look-dining-adobe', 'dining', 'adobe', 'Carved pine dining set', 'A carved pine table with a serape runner, turquoise-painted chairs with leather seats and a punched-tin star above.', 340, ['warm', 'natural', 'cozy'], ['#9C7046', '#3FA7A0', '#B5533C']),
  look('look-sofa-adobe', 'sofa', 'adobe', 'Rust leather sofa with a serape', 'Rust leather on a pine frame with a serape blanket over the back and a turquoise cushion.', 380, ['warm', 'natural', 'cozy'], ['#B5533C', '#3FA7A0', '#F4ECD8']),
  look('look-lamp-adobe', 'lamp', 'adobe', 'Pottery and rawhide lamp', 'A turquoise pottery base under a rawhide shade laced with leather.', 90, ['warm', 'natural', 'cozy'], ['#3FA7A0', '#EFE2C8', '#9C7046']),
  look('look-plant-adobe', 'plant', 'adobe', 'Painted clay pot', 'Your plant in a clay pot with a cream band and a turquoise zigzag.', 60, ['warm', 'natural', 'cozy'], ['#C08B62', '#3FA7A0', '#F4ECD8', '#2B2420']),

  look('look-fridge-neon', 'fridge', 'neon', 'Holo fridge', 'A black body with a magenta strip down the door, a cyan holo panel and a glowing seam; the light comes on with the power.', 520, ['bold', 'modern', 'industrial'], ['#111118', '#FF2E9A', '#19E6F0']),
  look('look-counter-neon', 'counter', 'neon', 'Steel mesh counter', 'Black steel with mesh fronts, a cyan strip at the kick, a dark glass top edged in magenta, a steel basin and a holo panel at the end.', 600, ['bold', 'modern', 'industrial'], ['#111118', '#19E6F0', '#3A3F4A']),
  look('look-dining-neon', 'dining', 'neon', 'Underlit glass dining set', 'A black glass table lit from under on a steel pedestal, steel chairs with a cyan seat edge and magenta back, and a neon ring above.', 540, ['bold', 'modern', 'industrial'], ['#1E2230', '#19E6F0', '#FF2E9A']),
  look('look-sofa-neon', 'sofa', 'neon', 'Black leather sofa with neon piping', 'Black leather with magenta piping, a cyan strip under the base and a violet cushion.', 560, ['bold', 'modern', 'industrial'], ['#111118', '#FF2E9A', '#19E6F0']),
  look('look-lamp-neon', 'lamp', 'neon', 'Neon tube lamp', 'A magenta neon tube standing on a black base; the whole tube is the light.', 160, ['bold', 'modern', 'industrial'], ['#FF2E9A', '#111118', '#19E6F0']),
  look('look-plant-neon', 'plant', 'neon', 'Hex pot with a light ring', 'Your plant in a black pot with a cyan ring that lights with the power.', 110, ['bold', 'modern', 'industrial'], ['#111118', '#19E6F0', '#8A3CFF', '#3A3F4A']),

  look('look-fridge-candy', 'fridge', 'candy', 'Bow fridge', 'Pastel pink with a cherry bow on the upper door, sprinkles on the lower one, a scalloped cream cap and cream handles.', 350, ['soft', 'playful', 'warm'], ['#F6B7CC', '#FFF8F0', '#BFE8D6']),
  look('look-counter-candy', 'counter', 'candy', 'Scalloped mint counter', 'Mint fronts under a scalloped edge, a cream top with sprinkles, a pink basin, a cherry tap and a cupcake stand at the end.', 420, ['soft', 'playful', 'warm'], ['#BFE8D6', '#FFF8F0', '#F6B7CC']),
  look('look-dining-candy', 'dining', 'candy', 'Scalloped dining set', 'A pink top with a scalloped edge on a striped drum, lilac chairs with heart backs and a lollipop light above.', 340, ['soft', 'playful', 'warm'], ['#F6B7CC', '#D6C4F0', '#FFF8F0']),
  look('look-sofa-candy', 'sofa', 'candy', 'Scalloped pink sofa', 'A pink sofa with a scalloped skirt, mint and lilac cushions, a cherry bow on one arm and sprinkles on the back.', 380, ['soft', 'playful', 'warm'], ['#F6B7CC', '#BFE8D6', '#D6C4F0']),
  look('look-lamp-candy', 'lamp', 'candy', 'Ice cream cone lamp', 'A waffle cone with a pink scoop that glows, sprinkles and a cherry on top.', 90, ['soft', 'playful', 'warm'], ['#F6B7CC', '#FBE7A6', '#FFF8F0']),
  look('look-plant-candy', 'plant', 'candy', 'Teacup planter', 'Your plant in a pink teacup with a handle, on a scalloped saucer.', 60, ['soft', 'playful', 'warm'], ['#F6B7CC', '#FFF8F0', '#BFE8D6', '#E04A6A']),

  promo(look('look-fridge-cuddle', 'fridge', 'cuddle', 'Rainbow bear fridge', 'Sky blue with a cloud cap, a rainbow between two clouds on the upper door, a pink bear face with a heart on the lower one, and heart handles.', 350, ['soft', 'playful', 'cozy'], ['#AEDDF7', '#FFFFFF', '#F6B7CC'])),
  promo(look('look-counter-cuddle', 'counter', 'cuddle', 'Cloud counter', 'Cloud-white fronts with a rainbow band at the kick, hearts and stars for pulls, cloud puffs along the top edge, a sky top with stars, a pink heart basin and a blue bear plush at the end.', 420, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#AEDDF7', '#F6B7CC'])),
  promo(look('look-dining-cuddle', 'dining', 'cuddle', 'Cloud table and bear chairs', 'A scalloped cloud top on a stack of puffs, chairs with bear-face backs in pink and blue, and a rainbow hanging from a cloud above.', 340, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#F6B7CC', '#9CCBF2'])),
  promo(look('look-sofa-cuddle', 'sofa', 'cuddle', 'Cloud sofa', 'A puffy white cloud sofa with a rainbow band along the base, sky-blue cushions with a heart and a star, and a yellow bear plush in the corner.', 380, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#AEDDF7', '#F6B7CC'])),
  promo(look('look-lamp-cuddle', 'lamp', 'cuddle', 'Cloud lamp', 'A cloud shade on a sky-blue pole with a star on top and rainbow drops hanging under it.', 90, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#AEDDF7', '#F9E27A'])),
  promo(look('look-plant-cuddle', 'plant', 'cuddle', 'Cloud pot', 'Your plant in a puffy white pot with cloud bumps round the rim, a rainbow on the front and a star on the side.', 60, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#AEDDF7', '#F9E27A', '#F6B7CC'])),

  look('look-fridge-arcade', 'fridge', 'arcade', 'Cabinet fridge', 'A black cabinet with a marquee of chasing bulbs on top, a screen glowing in the upper door, a row of buttons on the lower one and a joystick-ball handle.', 520, ['playful', 'bold', 'vintage'], ['#1E1A2E', '#F4C430', '#FF2E9A']),
  look('look-counter-arcade', 'counter', 'arcade', 'Coin-op counter', 'Black cabinet fronts with yellow coin slots and neon trim, a chaser strip under a cyan-edged top, a steel basin, and a joystick and buttons at the end.', 600, ['playful', 'bold', 'vintage'], ['#1E1A2E', '#F4C430', '#19E6F0']),
  look('look-dining-arcade', 'dining', 'arcade', 'Cocktail cabinet table', 'A cocktail arcade cabinet to eat off, the screen glowing up through the top, two red vinyl stools and a marquee overhead.', 540, ['playful', 'bold', 'vintage'], ['#1E1A2E', '#C2413A', '#19E6F0']),
  look('look-sofa-arcade', 'sofa', 'arcade', 'Vinyl sofa with marquee lights', 'Black vinyl with yellow piping, red cushions with pixel hearts, a pixel invader on the back and a chaser strip along the base.', 560, ['playful', 'bold', 'vintage'], ['#1E1A2E', '#E63946', '#F4C430']),
  look('look-lamp-arcade', 'lamp', 'arcade', 'Joystick lamp', 'A joystick as tall as you: a red ball on a black stick that glows, on a base ringed with marquee bulbs.', 160, ['playful', 'bold', 'vintage'], ['#E63946', '#15121F', '#F4C430']),
  look('look-plant-arcade', 'plant', 'arcade', 'Pixel pot', 'Your plant in a black pot with a pixel invader on the front and a pixel coin on the side.', 110, ['playful', 'bold', 'vintage'], ['#15121F', '#19E6F0', '#39D353', '#F4C430']),

  // Spring: a seasonal pack.
  look('look-fridge-spring', 'fridge', 'spring', 'Blossom icebox', 'Pale blush with painted blossoms. It smells faintly of lemon, for some reason.', 340, ['soft', 'natural', 'playful'], ['#F3D6DC', '#CFE6D3', '#F6EBC0']),
  look('look-counter-spring', 'counter', 'spring', 'Potting-bench counter', 'Sage cabinets, a pale wood top and two little herb pots by the sink.', 400, ['soft', 'natural', 'playful'], ['#CFE6D3', '#F3D6DC', '#F6EBC0']),
  look('look-dining-spring', 'dining', 'spring', 'Garden table set', 'A light wood table with petals scattered on it, and chairs in pastel.', 330, ['soft', 'natural', 'playful'], ['#CFE6D3', '#F6EBC0', '#F3D6DC']),
  look('look-sofa-spring', 'sofa', 'spring', 'Posy sofa', 'Soft green, with a cushion embroidered with one very optimistic flower.', 360, ['soft', 'natural', 'playful'], ['#CFE6D3', '#F3D6DC', '#E8DCC8']),
  look('look-lamp-spring', 'lamp', 'spring', 'Daisy lamp', 'A green stem and a big white daisy that glows when you turn it on.', 80, ['soft', 'natural', 'playful'], ['#F2EEE8', '#F6EBC0', '#F3D6DC']),
  look('look-plant-spring', 'plant', 'spring', 'Tulip pot', 'Your plant in a pastel pot, with tulips on top.', 40, ['soft', 'natural', 'playful'], ['#F3B6C8', '#F6EBC0', '#B9DCC4']),

  // Summer: a seasonal pack.
  look('look-fridge-summer', 'fridge', 'summer', 'Sunny icebox', 'Sunshine yellow, with a coral sun on the door and a teal stripe.', 340, ['playful', 'bold', 'warm'], ['#F6D56E', '#7FD1CF', '#F2A38A']),
  look('look-counter-summer', 'counter', 'summer', 'Lemonade-stand counter', 'Teal cabinets, a honey bamboo top and a little basket of lemons.', 400, ['playful', 'bold', 'warm'], ['#7FD1CF', '#F6D56E', '#F2A38A']),
  look('look-dining-summer', 'dining', 'summer', 'Patio table set', 'A slatted table with a striped runner, and chairs bright enough to eat lunch in.', 330, ['playful', 'bold', 'warm'], ['#F6D56E', '#7FD1CF', '#F2A38A']),
  look('look-sofa-summer', 'sofa', 'summer', 'Sunbed sofa', 'Sunshine yellow, with a cushion striped like a beach towel.', 360, ['playful', 'bold', 'warm'], ['#F6D56E', '#7FD1CF', '#F2A38A']),
  look('look-lamp-summer', 'lamp', 'summer', 'Palm lamp', 'A little palm on a stem, with a glowing sun in the middle.', 80, ['playful', 'bold', 'warm'], ['#4F9460', '#7FD1CF', '#F6D56E']),
  look('look-plant-summer', 'plant', 'summer', 'Palm tub', 'Your plant in a bright glazed tub with a stripe around it.', 40, ['playful', 'bold', 'warm'], ['#7FD1CF', '#F6D56E', '#F2A38A']),

  // Fall: a seasonal pack.
  look('look-fridge-fall', 'fridge', 'fall', 'Harvest icebox', 'Rust red with wooden handles and three leaves blowing across the door.', 340, ['warm', 'cozy', 'natural'], ['#B5532F', '#D9A84A', '#8A5E3B']),
  look('look-counter-fall', 'counter', 'fall', 'Harvest counter', 'Dark wood cabinets and two pumpkins that are never going to get carved.', 400, ['warm', 'cozy', 'natural'], ['#8A5E3B', '#B5532F', '#3F5B4C']),
  look('look-dining-fall', 'dining', 'fall', 'Harvest table set', 'A deep walnut table with a plaid runner, and chairs the colour of cider.', 330, ['warm', 'cozy', 'natural'], ['#B5532F', '#D9A84A', '#3F5B4C']),
  look('look-sofa-fall', 'sofa', 'fall', 'Plaid-throw sofa', 'A deep, warm sofa with a plaid blanket over the arm.', 360, ['warm', 'cozy', 'natural'], ['#B5532F', '#D9A84A', '#3F5B4C']),
  look('look-lamp-fall', 'lamp', 'fall', 'Lantern lamp', 'A black stand with a lantern on top, glowing amber.', 80, ['warm', 'cozy', 'natural'], ['#2B2B30', '#8A5E3B', '#B5532F']),
  look('look-plant-fall', 'plant', 'fall', 'Mum pot', 'Your plant in a rust pot, crowded with orange mums.', 40, ['warm', 'cozy', 'natural'], ['#B5532F', '#D9A84A', '#8A5E3B']),

  // Winter: a seasonal pack.
  look('look-fridge-winter', 'fridge', 'winter', 'Frosted icebox', 'Pale as a snowbank, with icicles along the top and red handles.', 340, ['cozy', 'cool', 'soft'], ['#E3EEF6', '#C8D9E6', '#F2EEE8']),
  look('look-counter-winter', 'counter', 'winter', 'Evergreen counter', 'Forest-green cabinets, a white top and a sprig of fir by the sink.', 400, ['cozy', 'cool', 'soft'], ['#3F5B4C', '#8E1F2F', '#2E3B57']),
  look('look-dining-winter', 'dining', 'winter', 'Lodge table set', 'A pine table with a white runner and two candles, and sturdy chairs.', 330, ['cozy', 'cool', 'soft'], ['#8A5E3B', '#3F5B4C', '#8E1F2F']),
  look('look-sofa-winter', 'sofa', 'winter', 'Knit-throw sofa', 'A soft sofa with a chunky knit throw, for staying in.', 360, ['cozy', 'cool', 'soft'], ['#E8DCC8', '#B9C3C8', '#8E1F2F']),
  look('look-lamp-winter', 'lamp', 'winter', 'Candle-glow lamp', 'A frosted globe on a white stem that glows like a candle in a window.', 80, ['cozy', 'cool', 'soft'], ['#F2EEE8', '#8E1F2F', '#3F5B4C']),
  look('look-plant-winter', 'plant', 'winter', 'Frosted evergreen pot', 'Your plant with a dusting of snow and a few red berries.', 40, ['cozy', 'cool', 'soft'], ['#8E1F2F', '#F2EEE8', '#3F5B4C', '#2E3B57']),

  // Cloud Nine: clouds, rainbows and stars. (Cuddle Clouds, the bear pack above, is the promo one.)
  look('look-fridge-cloud', 'fridge', 'cloud', 'Cloud-nine icebox', 'A pale sky-blue icebox with a rainbow on the door and a cloud at each end.', 340, ['soft', 'playful', 'cozy'], ['#BFE3F5', '#F9C6DA', '#C9F0DC']),
  look('look-counter-cloud', 'counter', 'cloud', 'Candy-cloud counter', 'Pastel cabinets, a fluffy scalloped top, heart pulls and a jar of rainbow sweets.', 400, ['soft', 'playful', 'cozy'], ['#F9C6DA', '#BFE3F5', '#FFF2B8']),
  look('look-dining-cloud', 'dining', 'cloud', 'Tea-party table set', 'A white table set for tea, with chairs that have a heart in the back.', 330, ['soft', 'playful', 'cozy'], ['#F9C6DA', '#BFE3F5', '#E2D3F7']),
  look('look-sofa-cloud', 'sofa', 'cloud', 'Puffy cloud-top sofa', 'A puffy, cloud-topped sofa with a heart cushion and a little yellow star.', 360, ['soft', 'playful', 'cozy'], ['#F6F1FA', '#F9C6DA', '#BFE3F5']),
  look('look-lamp-cloud', 'lamp', 'cloud', 'Star lamp', 'A star on a stem that glows butter-yellow when you turn it on.', 80, ['soft', 'playful', 'cozy'], ['#F9C6DA', '#BFE3F5', '#E2D3F7']),
  look('look-plant-cloud', 'plant', 'cloud', 'Rainbow pot', 'Your plant in a pot with a rainbow around it, and a few little flowers.', 40, ['soft', 'playful', 'cozy'], ['#F9C6DA', '#BFE3F5', '#FFF2B8', '#C9F0DC']),
  wallpaper('paper-cloudnine-sky', 'Clouds and stars', 'cloudnine-sky', 100, ['soft', 'playful', 'cozy']),
  floor('floor-confetti', 'Confetti carpet', 'confetti', 130, ['soft', 'playful', 'cozy']),
  bundle('set-cloud', 'Cloud Nine kitchen and living room', 'The cloud-nine icebox, candy-cloud counter, tea-party table set, puffy cloud-top sofa, star lamp and rainbow pot, with clouds-and-stars walls and a confetti carpet.',
    ['look-fridge-cloud', 'look-counter-cloud', 'look-dining-cloud', 'look-sofa-cloud', 'look-lamp-cloud', 'look-plant-cloud', 'paper-cloudnine-sky', 'floor-confetti'], ['soft', 'playful', 'cozy']),

  // Upstairs packs: the bedroom and bath pieces, with the room's wallpaper and floor. Bought upstairs, they restyle upstairs.
  look('look-bed-brutalist', 'bed', 'brutalist', 'Board-formed concrete bed', 'A slab of board-formed concrete for a headboard, tie holes and all, on a low concrete plinth, with white linen and a cover in your colour.', 640, ['industrial', 'minimal', 'bold'], ['#3A3B3F', '#8E939A', '#B5533C']),
  look('look-nightstand-brutalist', 'nightstand', 'brutalist', 'Poured concrete nightstand', 'A poured cube with a recess for the book you are not reading, and a blackened steel reading arm.', 180, ['industrial', 'minimal', 'bold'], ['#A3A19C', '#85837E', '#BDBBB5']),
  look('look-dresser-brutalist', 'dresser', 'brutalist', 'Steel locker dresser', 'Three numbered steel lockers with vents and pulls, on a black plinth under a concrete top.', 420, ['industrial', 'minimal', 'bold'], ['#4A4E55', '#6E7F8A', '#8E3B2E']),
  look('look-toilet-brutalist', 'toilet', 'brutalist', 'Wall-hung black toilet', 'A matte black bowl that floats off the floor, on a concrete cistern block with a steel flush plate.', 260, ['industrial', 'minimal', 'bold'], ['#A3A19C', '#2E2F33', '#8E939A']),
  look('look-vanity-brutalist', 'vanity', 'brutalist', 'Concrete trough vanity', 'A poured concrete trough on blackened steel legs, a wall tap over it and towels on the shelf below.', 380, ['industrial', 'minimal', 'bold'], ['#A3A19C', '#2B2D31', '#E9E6E0']),
  look('look-shower-brutalist', 'shower', 'brutalist', 'Concrete walk-in shower', 'A concrete tray and back wall, a square rain head on a steel arm, a slot drain and a single pane of glass.', 520, ['industrial', 'minimal', 'bold'], ['#A3A19C', '#2B2D31', '#BADEE8']),

  look('look-bed-spa', 'bed', 'spa', 'Teak platform bed', 'A low oiled-teak platform wider than the mattress, a slatted teak panel behind, linen in your colour and a folded throw at the foot.', 560, ['soft', 'minimal', 'natural'], ['#9DB3A5', '#EEEAE0', '#C9B8A6']),
  look('look-nightstand-spa', 'nightstand', 'spa', 'Floating teak nightstand', 'A floating teak box with a limestone top, a dish of river pebbles and a paper globe that glows.', 160, ['soft', 'minimal', 'natural'], ['#9C6B45', '#B98A62', '#7A5236']),
  look('look-dresser-spa', 'dresser', 'spa', 'Slatted teak dresser', 'Floating teak with slatted fronts under a limestone top, a stone tray and eucalyptus in a jar.', 380, ['soft', 'minimal', 'natural'], ['#9C6B45', '#B98A62', '#C9B8A6']),
  look('look-toilet-spa', 'toilet', 'spa', 'Rimless toilet with a teak seat', 'A soft white rimless bowl with a teak seat, under a limestone ledge with a rolled towel.', 220, ['soft', 'minimal', 'natural'], ['#F6F4EE', '#D8D0C2', '#9DB3A5']),
  look('look-vanity-spa', 'vanity', 'spa', 'Teak vanity with a stone vessel', 'A floating slatted teak vanity, a limestone top with a stone vessel basin and a tall spout, rolled towels below.', 360, ['soft', 'minimal', 'natural'], ['#9C6B45', '#D8D0C2', '#9DB3A5']),
  look('look-shower-spa', 'shower', 'spa', 'Rain shower on pebbles', 'A rain head over a river-pebble floor, a limestone wall with a niche, a teak bench and bamboo; the glass fogs and the steam comes up thick.', 540, ['soft', 'minimal', 'natural'], ['#D8D0C2', '#9DB3A5', '#9C6B45']),

  look('look-bed-hotel', 'bed', 'hotel', 'Tufted velvet hotel bed', 'A tall channel-tufted velvet headboard edged in brass on a walnut plinth, crisp white hotel linen, a bolster and a velvet runner across the foot.', 720, ['luxe', 'bold', 'vintage'], ['#1F3A5F', '#5E1F2A', '#2F4A3A']),
  look('look-nightstand-hotel', 'nightstand', 'hotel', 'Walnut and marble bedside chest', 'A walnut chest on brass feet with a marble top, brass pulls and a brass lamp under a pleated shade.', 220, ['luxe', 'bold', 'vintage'], ['#4A3226', '#6B4A36', '#2A2224']),
  look('look-dresser-hotel', 'dresser', 'hotel', 'Walnut lowboy with a marble top', 'Three rows of drawers with brass bails on brass-capped legs, a veined marble top, a brass tray and a vase of red roses.', 480, ['luxe', 'bold', 'vintage'], ['#4A3226', '#6B4A36', '#2A2224']),
  look('look-toilet-hotel', 'toilet', 'hotel', 'Pedestal toilet with a brass lever', 'A white pedestal toilet with a black seat and a brass flush lever.', 240, ['luxe', 'bold', 'vintage'], ['#FAF8F4', '#1E1E22', '#C9A24A']),
  look('look-vanity-hotel', 'vanity', 'hotel', 'Marble-top walnut vanity', 'Walnut doors with brass knobs under a veined marble top, a deep basin, a brass gooseneck tap and a monogrammed towel.', 420, ['luxe', 'bold', 'vintage'], ['#4A3226', '#EFEBE4', '#C9A24A']),
  look('look-shower-hotel', 'shower', 'hotel', 'Marble shower with brass fittings', 'Marble walls, a black and white hex floor, a brass rain head and a brass-framed glass door.', 600, ['luxe', 'bold', 'vintage'], ['#EFEBE4', '#C9A24A', '#1E1E22']),

  look('look-bed-cottage', 'bed', 'cottage', 'White iron bed with a patchwork quilt', 'A white iron bedstead with an arched headboard and brass knobs, ruffled pillows and a patchwork quilt in your colours.', 520, ['cozy', 'soft', 'vintage'], ['#E8A0A8', '#9DB7D5', '#A9BFA0']),
  look('look-nightstand-cottage', 'nightstand', 'cottage', 'Painted pine bedside table', 'A painted pine table with a drawer and a white ceramic knob, a lamp under a floral shade and a jar of wildflowers.', 140, ['cozy', 'soft', 'vintage'], ['#F6EFDF', '#A9BFA0', '#9DB7D5']),
  look('look-dresser-cottage', 'dresser', 'cottage', 'Hand-painted flower chest', 'A painted chest with flowers on every drawer, white ceramic knobs, a lace runner and a jug of wildflowers.', 360, ['cozy', 'soft', 'vintage'], ['#A9BFA0', '#F6EFDF', '#9DB7D5']),
  look('look-toilet-cottage', 'toilet', 'cottage', 'High-cistern toilet with a pull chain', 'A white toilet with a pine seat under a high cistern and a pull chain with a wooden handle.', 200, ['cozy', 'soft', 'vintage'], ['#FFFFFF', '#C69C6D', '#F2F0EA']),
  look('look-vanity-cottage', 'vanity', 'cottage', 'Skirted gingham sink', 'A basin in a pine top over a gathered gingham skirt, copper taps, a jug and a soap dish.', 300, ['cozy', 'soft', 'vintage'], ['#E8A0A8', '#A9BFA0', '#9DB7D5']),
  look('look-shower-cottage', 'shower', 'cottage', 'Beadboard shower with a floral curtain', 'Whitewashed beadboard, exposed copper pipes to a big rain head, a pine duckboard and a floral curtain that draws back while you shower.', 460, ['cozy', 'soft', 'vintage'], ['#E8A0A8', '#9DB7D5', '#F2D98A']),

  look('look-bed-midcentury', 'bed', 'midcentury', 'Walnut and cane bed', 'A walnut bed on tapered legs with a cane-panelled headboard, a cover in mustard, teal or orange and a striped throw at the foot.', 560, ['modern', 'warm', 'vintage'], ['#D9A441', '#3F7F7A', '#D2693A']),
  look('look-nightstand-midcentury', 'nightstand', 'midcentury', 'Splayed-leg walnut nightstand', 'Walnut on splayed tapered legs with a long recessed pull, and a white mushroom lamp.', 180, ['modern', 'warm', 'vintage'], ['#7A4E2D', '#9A6A44', '#5E3A20']),
  look('look-dresser-midcentury', 'dresser', 'midcentury', 'Long walnut lowboy', 'Six drawers with recessed pulls on splayed legs, a teal ceramic vase and a brass sunburst.', 420, ['modern', 'warm', 'vintage'], ['#7A4E2D', '#9A6A44', '#5E3A20']),
  look('look-toilet-midcentury', 'toilet', 'midcentury', 'Pastel toilet', 'A toilet in pink, mint or butter yellow with a chrome flush handle.', 220, ['modern', 'warm', 'vintage'], ['#F3B6C4', '#9ED8C6', '#F6E3A1']),
  look('look-vanity-midcentury', 'vanity', 'midcentury', 'Laminate vanity on chrome legs', 'A pastel laminate vanity on chrome legs, a round basin, a chrome tap and a checked tile backsplash.', 320, ['modern', 'warm', 'vintage'], ['#9ED8C6', '#F3B6C4', '#F6E3A1']),
  look('look-shower-midcentury', 'shower', 'midcentury', 'Pastel tile shower with a reeded slider', 'Square pastel tile with a black pencil trim, a chrome head, and a reeded glass door that slides open while you shower.', 480, ['modern', 'warm', 'vintage'], ['#F3B6C4', '#9ED8C6', '#9DB7D5']),

  look('look-bed-regency', 'bed', 'regency', 'Gold-crested channel-tufted bed', 'A towering channel-tufted headboard in blush, emerald or black with a gold scalloped crest, a black lacquer base on gold feet and white bedding edged in black.', 760, ['luxe', 'bold', 'playful'], ['#F2C4CE', '#1F6B52', '#151517']),
  look('look-nightstand-regency', 'nightstand', 'regency', 'Mirrored nightstand', 'Mirror on every face with a gold ring pull, on gold feet, and a gold gourd lamp under a white drum shade.', 240, ['luxe', 'bold', 'playful'], ['#DCE6EE', '#B9C8D4', '#F1EEE9']),
  look('look-dresser-regency', 'dresser', 'regency', 'Mirrored chest on gold legs', 'Three mirrored drawers with gold ring pulls on gold legs, a gold tray and a white orchid.', 520, ['luxe', 'bold', 'playful'], ['#DCE6EE', '#B9C8D4', '#F1EEE9']),
  look('look-toilet-regency', 'toilet', 'regency', 'Black toilet with a gold plate', 'A glossy black toilet with a gold flush plate.', 260, ['luxe', 'bold', 'playful'], ['#151517', '#D4AF37', '#FAF7F2']),
  look('look-vanity-regency', 'vanity', 'regency', 'Black lacquer and marble vanity', 'Black lacquer on gold legs under white marble, a gold tap, and a hand towel on a gold ring.', 440, ['luxe', 'bold', 'playful'], ['#F2C4CE', '#1F6B52', '#D4AF37']),
  look('look-shower-regency', 'shower', 'regency', 'Black tile shower with gold fittings', 'Black subway tile with white grout, gold fixtures and a gold-framed glass door, on a white floor with black dots.', 580, ['luxe', 'bold', 'playful'], ['#151517', '#D4AF37', '#FAF7F2']),

  look('look-bed-chalet', 'bed', 'chalet', 'Log bed with a buffalo check blanket', 'Thick round log posts and a headboard of stacked logs, flannel pillows, a buffalo check blanket in red, green or navy and a sheepskin over the foot.', 600, ['cozy', 'warm', 'natural'], ['#B3262E', '#2F5D3A', '#2B3A55']),
  look('look-nightstand-chalet', 'nightstand', 'chalet', 'Tree-stump side table', 'A stump with its bark on and its rings on top, and a black iron lantern with a candle glow.', 160, ['cozy', 'warm', 'natural'], ['#8A5A30', '#B07A45', '#6E4A28']),
  look('look-dresser-chalet', 'dresser', 'chalet', 'Rough-hewn pine chest', 'Knotty pine with black iron strap hinges and ring pulls, a candle and a bowl of pinecones.', 400, ['cozy', 'warm', 'natural'], ['#C89A62', '#A87A48', '#8A5A30']),
  look('look-toilet-chalet', 'toilet', 'chalet', 'Toilet with a pine-boxed tank', 'A white toilet with a knotty pine seat and its tank boxed in pine planks.', 220, ['cozy', 'warm', 'natural'], ['#C89A62', '#FFFFFF', '#2A2826']),
  look('look-vanity-chalet', 'vanity', 'chalet', 'Copper basin on a log stand', 'A hammered copper basin on a thick pine plank over log legs, a black iron tap and wool towels below.', 360, ['cozy', 'warm', 'natural'], ['#C89A62', '#A87A48', '#8A5A30']),
  look('look-shower-chalet', 'shower', 'chalet', 'River-stone shower with a cedar floor', 'River-stone walls, a cedar slat floor, black iron pipes to a big rain head and a frosted glass door.', 520, ['cozy', 'warm', 'natural'], ['#9A948A', '#C89A62', '#2A2826']),

  look('look-bed-victorian', 'bed', 'victorian', 'Mahogany four-poster with a canopy', 'Carved mahogany posts to a canopy with a scalloped valance, velvet drapes tied back at the foot, lace pillows and a damask coverlet in claret, forest or plum.', 820, ['luxe', 'cozy', 'vintage'], ['#7A1F2E', '#2F4A3A', '#3A2A55']),
  look('look-nightstand-victorian', 'nightstand', 'victorian', 'Cabriole-leg bedside table', 'Mahogany on cabriole legs with a marble top, and a lamp under a fringed rose shade.', 240, ['luxe', 'cozy', 'vintage'], ['#5A2A1E', '#7A3E2C', '#3E1C14']),
  look('look-dresser-victorian', 'dresser', 'victorian', 'Mahogany chest with an oval mirror', 'Brass escutcheons on carved feet, a tall oval mirror, a lace runner and cut-glass perfume bottles.', 560, ['luxe', 'cozy', 'vintage'], ['#5A2A1E', '#7A3E2C', '#3E1C14']),
  look('look-toilet-victorian', 'toilet', 'victorian', 'China toilet with a high tank', 'A blue-and-white china bowl with a mahogany seat under a mahogany high tank and a brass pull chain.', 280, ['luxe', 'cozy', 'vintage'], ['#FFFFFF', '#2E4C9A', '#5A2A1E']),
  look('look-vanity-victorian', 'vanity', 'victorian', 'Marble-topped washstand', 'A mahogany washstand under marble, a china basin and jug, a brass tap and a lace-edged towel.', 420, ['luxe', 'cozy', 'vintage'], ['#5A2A1E', '#7A3E2C', '#3E1C14']),
  look('look-shower-victorian', 'shower', 'victorian', 'Tiled shower with a lace curtain', 'A rose and cream mosaic floor, green tile under a damask wall, a brass rose head and a lace curtain on a brass rail.', 560, ['luxe', 'cozy', 'vintage'], ['#C98A94', '#4E7A5E', '#FBF6EE']),

  look('look-bed-ryokan', 'bed', 'ryokan', 'Futon on a tatami dais', 'A thin futon on a low hinoki dais edged in tatami, a buckwheat pillow, a quilt in indigo, moss or persimmon folded back at the top, and a paper screen behind.', 520, ['minimal', 'natural', 'cool'], ['#2E3F66', '#8A9A7A', '#B5533C']),
  look('look-nightstand-ryokan', 'nightstand', 'ryokan', 'Hinoki box with a paper lantern', 'A low hinoki box with a paper andon lantern and a single blossoming branch in a stoneware vase.', 150, ['minimal', 'natural', 'cool'], ['#E2C99E', '#C9AC7E', '#B7A184']),
  look('look-dresser-ryokan', 'dresser', 'ryokan', 'Kiri tansu chest', 'A dark tansu with black iron pulls and corner plates, and a tea set on a tray.', 460, ['minimal', 'natural', 'cool'], ['#5A4636', '#3E3028', '#7A6450']),
  look('look-toilet-ryokan', 'toilet', 'ryokan', 'Toilet with a hinoki seat', 'A plain white toilet with a hinoki seat, and a river-stone shelf behind with a tiny bonsai.', 220, ['minimal', 'natural', 'cool'], ['#FFFFFF', '#E2C99E', '#8E8A84']),
  look('look-vanity-ryokan', 'vanity', 'ryokan', 'Stone vessel on hinoki', 'A river-stone vessel basin on a hinoki counter, a bamboo spout, and a folded indigo tenugui underneath.', 340, ['minimal', 'natural', 'cool'], ['#E2C99E', '#C9AC7E', '#B7A184']),
  look('look-shower-ryokan', 'shower', 'ryokan', 'Hinoki wet room with a noren', 'Slatted hinoki floor and side screen, a river-stone wall, a bamboo rain spout, a wooden stool and bucket, and a noren at the front.', 500, ['minimal', 'natural', 'cool'], ['#2E3F66', '#8A9A7A', '#B5533C']),

  look('look-bed-celestial', 'bed', 'celestial', 'Crescent moon bed', 'A cloud-white upholstered bed under a great gold crescent moon, puffy pillows and a duvet in night navy, lavender or blush scattered with gold stars.', 640, ['soft', 'playful', 'cool'], ['#1F2550', '#B9A9DE', '#F2C4CE']),
  look('look-nightstand-celestial', 'nightstand', 'celestial', 'Moon lamp side table', 'A round pearl table on a gold stem, and a cratered moon lamp that glows.', 190, ['soft', 'playful', 'cool'], ['#F4F1F8', '#E2C46A', '#DCD6E8']),
  look('look-dresser-celestial', 'dresser', 'celestial', 'Moon-phase dresser', 'Gold knobs that wax from new moon to full across every drawer, an amethyst geode and a glowing star on top.', 440, ['soft', 'playful', 'cool'], ['#B9A9DE', '#F4F1F8', '#1F2550']),
  look('look-toilet-celestial', 'toilet', 'celestial', 'Pearl toilet with a lavender seat', 'A pearl toilet with a lavender seat and a little gold star on the tank.', 230, ['soft', 'playful', 'cool'], ['#F4F1F8', '#B9A9DE', '#E2C46A']),
  look('look-vanity-celestial', 'vanity', 'celestial', 'Pearl vanity with an opal shell basin', 'A lavender, navy or blush vanity on a gold plinth with gold star knobs, a pearl top, a shell-shaped opal basin and a gold tap.', 380, ['soft', 'playful', 'cool'], ['#B9A9DE', '#1F2550', '#F2C4CE']),
  look('look-shower-celestial', 'shower', 'celestial', 'Opal glass shower', 'Opal glass tile shimmering in four tints, a gold star rain head and glass frosted with stars.', 560, ['soft', 'playful', 'cool'], ['#F4F1F8', '#E2C46A', '#B9A9DE']),

  // Wall decor
  wallItem('wobj-print', 'Framed print', 50, ['modern', 'bold'], ['#E0A43A', '#3D6B73', '#D24A7A', '#4F9460', '#4A5DA8']),
  wallItem('wobj-landscape', 'Landscape canvas', 80, ['natural', 'vintage'], ['#9EC1F5', '#F2B48A', '#C9B8E8', '#2B3A5E']),
  wallItem('wobj-portrait', 'Gilded portrait', 120, ['vintage', 'luxe'], ['#2B2B30', '#3F5B4C', '#6E3C50']),
  wallItem('wobj-roundmirror', 'Round mirror', 60, ['modern', 'luxe', 'minimal'], ['#C9A24A', '#2B2B30', '#9C6B45', '#F2EEE8']),
  wallItem('wobj-floatshelf', 'Floating shelf', 50, ['natural', 'minimal'], ['#9C6B45', '#F2EEE8', '#2B2B30']),
  wallItem('wobj-wclock', 'Wall clock', 40, ['modern', 'minimal'], ['#2B2B30', '#F2EEE8', '#C9A24A', '#D24A7A']),
  wallItem('wobj-tapestry', 'Woven tapestry', 100, ['natural', 'cozy', 'vintage'], ['#E8DCC8', '#C27A5A', '#3D6B73', '#6E3C50']),
  wallItem('wobj-gallery', 'Gallery wall', 120, ['modern', 'playful'], ['#2B2430', '#F2EEE8', '#C9A24A']),
  wallItem('wobj-albums', 'Record wall', 80, ['vintage', 'playful'], ['#2B2B30']),
  wallItem('wobj-macrame', 'Macrame planter', 50, ['natural', 'cozy', 'vintage'], ['#E8DCC8', '#C27A5A']),
  wallItem('wobj-polaroids', 'Photo string', 40, ['playful', 'cozy'], ['#3A3340']),
  wallItem('wobj-plates', 'Plate wall', 80, ['vintage', 'cozy'], ['#4A88B8', '#C2413A', '#4F9460']),
  wallItem('wobj-neon', 'Neon heart', 150, ['bold', 'playful', 'modern'], ['#FF5FA2', '#5FE3FF', '#FFD25F']),
  wallItem('wobj-aquarium', 'Aquarium', 200, ['modern', 'playful', 'cool'], ['#2B2B30', '#9C6B45', '#F2EEE8']),
  wallItem('wobj-marquee', 'Marquee sign', 140, ['playful', 'bold', 'vintage'], ['#F4C430', '#FF2E9A', '#19E6F0']),
  wallItem('wobj-pixelprint', 'Pixel art print', 60, ['playful', 'bold', 'vintage'], ['#19E6F0', '#FF2E9A', '#39D353']),
  promo(wallItem('wobj-rainbowarch', 'Rainbow arch', 140, ['soft', 'playful', 'cozy'], ['#F58A8A', '#AEDDF7'])),
  promo(wallItem('wobj-cloudlight', 'Cloud night light', 60, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#F9E27A'])),
  wallItem('wobj-neonbolt', 'Neon bolt', 140, ['bold', 'modern', 'industrial'], ['#19E6F0', '#FF2E9A', '#FFB020']),
  wallItem('wobj-holoposter', 'Holo poster', 60, ['bold', 'modern', 'industrial'], ['#111118', '#19E6F0', '#FF2E9A']),
  wallItem('wobj-stainedglass', 'Stained glass panel', 140, ['luxe', 'vintage', 'cozy'], ['#8E2E3C', '#2E4C9A', '#C9A24A']),
  wallItem('wobj-sconce', 'Candle sconce', 60, ['luxe', 'vintage', 'cozy'], ['#2A2224', '#B08D57']),
  wallItem('wobj-lollipops', 'Lollipop wall', 140, ['soft', 'playful', 'warm'], ['#F6B7CC', '#BFE8D6', '#D6C4F0']),
  wallItem('wobj-candysign', 'Sweet shop sign', 60, ['soft', 'playful', 'warm'], ['#F6B7CC', '#FFF8F0', '#E04A6A']),
  wallItem('wobj-tikimasks', 'Tiki masks', 140, ['playful', 'natural', 'bold'], ['#8A5A3A', '#D9BE82', '#F08AA0']),
  wallItem('wobj-flamingoneon', 'Flamingo neon', 60, ['playful', 'natural', 'bold'], ['#F08AA0', '#19E6F0', '#F9E27A']),

  // Nana: the soft-girl era, a promo pack that only a code opens (its name and description show, its picture is locked).
  promo(wallpaper('paper-nana-sky', 'Pink sky and clouds', 'nana-sky', 100, ['soft', 'playful', 'cozy'])),
  promo(floor('floor-nanaplush', 'Plush blush carpet', 'nanaplush', 150, ['soft', 'playful', 'cozy'])),
  promo(look('look-fridge-nana', 'fridge', 'nana', 'Pastel pink fridge', 'Blush pink with a cream cloud cap, cloud stickers and little frames on the upper door, a lilac bow and a ruffle band on the lower one, and heart handles.', 360, ['soft', 'playful', 'cozy'], ['#F8C8DC', '#FFF8F0', '#D9C8F2'])),
  promo(look('look-counter-nana', 'counter', 'nana', 'Cream cabinets with a ruffle valance', 'Cream fronts with heart knobs under a pink ruffle valance, a butter top scattered with hearts, a lilac basin with a gold tap and a posy of daisies.', 430, ['soft', 'playful', 'cozy'], ['#FFF8F0', '#F8C8DC', '#FFF1B8'])),
  promo(look('look-dining-nana', 'dining', 'nana', 'Tea-party table and bow chairs', 'A lace-edged cloth over a gold-legged table set with a teapot and cups, chairs with cloud-and-bow backs in pink and lilac, and a cloud lamp overhead.', 350, ['soft', 'playful', 'cozy'], ['#FFF8F0', '#F8C8DC', '#D9C8F2'])),
  promo(look('look-sofa-nana', 'sofa', 'nana', 'Plush ruffle sofa', 'A plush lilac sofa with a ruffled skirt, pink pillows with a heart and a bow, and a butter throw over one arm.', 390, ['soft', 'playful', 'cozy'], ['#E4D6F7', '#F8C8DC', '#FFF1B8'])),
  promo(look('look-lamp-nana', 'lamp', 'nana', 'Cloud lamp', 'A fluffy cluster of clouds for a shade on a gold stem, a little star on top and a soft pink glow when it is on.', 100, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#F8C8DC', '#E8C877'])),
  promo(look('look-rug-nana', 'rugwide', 'nana', 'Plush cloud rug', 'A plush blush rug with a cream cloud in the middle, a shag of little tufts and pom-poms along the ends.', 220, ['soft', 'playful', 'cozy'], ['#F8C8DC', '#FFF8F0', '#D9C8F2'])),
  promo({ id: 'drapes-nana', name: 'Breezy drapes', desc: 'Sheer pink drapes on a gold rod, tied back with lilac bows, that stir in the breeze.', price: 140, icon: 'drapes', tab: 'Decor', drapes: 'nana', tags: ['soft', 'playful', 'cozy'] }),
  promo({ id: 'nook-nana', name: 'Cloud nook', desc: 'A plush cloud lounger under a canopy of sheer pink with twinkling fairy lights. Sit to read, scroll or watch; tap it for its lights.', price: 280, icon: 'obj', tab: 'Furniture', type: 'cloudnook', cols: ['#FFF8F0', '#F8C8DC', '#D9C8F2'], tags: ['soft', 'playful', 'cozy'], repeat: true }),
  promo({ id: 'lamp-cloud', name: 'Cloud wall lamp', desc: 'A fluffy cloud that glows pink and gold on the wall.', price: 75, icon: 'obj', tab: 'Decor', wallLamp: 'cloud', tags: ['soft', 'playful', 'cozy'], repeat: true }),
  promo(look('look-plant-nana', 'plant', 'nana', 'Ruffle pot', 'Your plant in a pink pot with a ruffled rim and a bow, daisies in its leaves.', 65, ['soft', 'playful', 'cozy'], ['#F8C8DC', '#FFF8F0', '#D9C8F2', '#FFF1B8'])),
  promo(bundle('set-nana', 'Nana kitchen and living room', 'The soft-girl era: pastel pink, lilac and butter, a plush ruffle sofa, a tea-party table with bow chairs, cloud lights, ruffles, bows and daisies, breezy drapes at the windows, a plush cloud rug, pink striped walls and a blush carpet underfoot.',
    ['look-fridge-nana', 'look-counter-nana', 'look-dining-nana', 'look-sofa-nana', 'look-lamp-nana', 'look-plant-nana', 'paper-nana-sky', 'floor-nanaplush', 'look-rug-nana', 'drapes-nana'], ['soft', 'playful', 'cozy'])),
  // Wall lamps: hung where there is wall, and movable along the walls with Arrange.
  ...LAMP_STYLES.map((s): CatalogEntry => ({ id: `lamp-${s}`, name: LAMP_NAMES[s], desc: 'A wall lamp. Hang it, then slide it anywhere on the walls with Arrange.', price: LAMP_PRICES[s], icon: 'obj', tab: 'Decor', wallLamp: s, tags: ['cozy', 'warm'], repeat: true })),
  // Decor
  decor('pampas', 'pampas', 'Pampas vase', 40, ['modern', 'minimal', 'natural'], ['#E8DCC8', '#2B2B30', '#C27A5A', '#9EC1C9']),
  decor('candles', 'candles', 'Pillar candles', 35, ['cozy', 'warm', 'soft'], ['#F2EEE8', '#C9A24A', '#B5476E', '#3F5B4C']),
  decor('basket', 'basket', 'Blanket basket', 60, ['cozy', 'natural', 'soft'], ['#B98A6A', '#3A2E2A', '#E4DDD2']),
  decor('coatrack', 'coatrack', 'Coat rack', 70, ['natural', 'minimal', 'vintage'], ['#2B2B30', '#7A4E32', '#C9A24A']),
  decor('bookstack', 'bookstack', 'Stacked books', 25, ['cozy', 'vintage', 'creative'], ['#B5476E', '#3F5B4C', '#2E3B57', '#C9A24A']),
  decor('cartridges', 'cartridges', 'Game cartridges', 30, ['playful', 'bold', 'vintage'], ['#F4C430', '#E63946', '#39D353', '#7A5CFF']),
  promo(decor('plushpile', 'plushpile', 'Plush pile', 30, ['soft', 'playful', 'cozy'], ['#F6B7CC', '#9CCBF2', '#F9E27A', '#C7A8F0'])),
  decor('serverstack', 'serverstack', 'Server stack', 30, ['bold', 'modern', 'industrial'], ['#111118', '#3A3F4A', '#1E2230']),
  decor('grimoires', 'grimoires', 'Grimoires', 30, ['luxe', 'vintage', 'cozy'], ['#5E1F2A', '#2A2224', '#2E3B57']),
  decor('candyjars', 'candyjars', 'Candy jars', 30, ['soft', 'playful', 'warm'], ['#F6B7CC', '#BFE8D6', '#D6C4F0']),
  decor('coconuts', 'coconuts', 'Coconut drinks', 30, ['playful', 'natural', 'bold'], ['#6B4A35', '#8A5A3A']),
  decor('eucalyptus', 'eucalyptus', 'Eucalyptus vase', 55, ['natural', 'modern', 'soft'], ['#F2EEE8', '#2B2B30', '#C27A5A', '#9EC1C9']),
  decor('bust', 'bust', 'Bust on a pedestal', 120, ['luxe', 'vintage', 'bold'], ['#E8DCC8', '#2B2B30', '#9C6B45']),
  decor('tablelamp', 'tablelamp', 'Lamp table', 90, ['cozy', 'warm', 'natural'], ['#9C6B45', '#2B2B30', '#E4DDD2', '#3F5B4C']),
  decor('candelabra', 'candelabra', 'Candelabra', 80, ['luxe', 'vintage', 'warm'], ['#C9A24A', '#2B2B30', '#B9B4AC']),
  decor('blanketladder', 'blanketladder', 'Blanket ladder', 65, ['cozy', 'natural', 'soft'], ['#B98A6A', '#3A2E2A', '#E4DDD2']),
  decor('plantstand', 'plantstand', 'Plant stand', 55, ['natural', 'cozy', 'soft'], ['#9C6B45', '#2B2B30', '#E4DDD2']),
  decor('woodstool', 'woodstool', 'Wooden stool', 30, ['natural', 'minimal', 'vintage'], ['#B98A6A', '#3A2E2A', '#E4DDD2', '#7A4E32']),
  decor('flowervase', 'flowervase', 'Flower vase', 30, ['soft', 'natural', 'cozy'], ['#F2EEE8', '#2B2B30', '#C27A5A', '#9EC1C9']),
  decor('succulents', 'succulents', 'Succulent pots', 28, ['natural', 'minimal', 'cool'], ['#C27A5A', '#E4DDD2', '#2B2B30']),
  decor('desklamp', 'desklamp', 'Desk lamp', 45, ['modern', 'minimal', 'cool'], ['#2B2B30', '#C9A24A', '#E4DDD2', '#B5476E']),
  decor('photoframes', 'photoframes', 'Photo frames', 25, ['cozy', 'soft', 'vintage'], ['#9C6B45', '#2B2B30', '#C9A24A', '#E4DDD2']),
  decor('umbrella', 'umbrella', 'Umbrella stand', 40, ['natural', 'minimal', 'cool'], ['#2B2B30', '#7A4E32', '#3F5B4C', '#B5476E']),
  decor('blossomvase', 'blossomvase', 'Cherry blossom branches', 60, ['soft', 'natural', 'playful'], ['#F2EEE8', '#2B2B30', '#9EC1C9']),
  decor('xmastree', 'xmastree', 'Holiday tree', 120, ['cozy', 'playful', 'warm'], ['#2F6B40', '#F2EEE8']),
  decor('pumpkins', 'pumpkins', 'Pumpkin trio', 30, ['warm', 'cozy', 'natural'], ['#E07A2B', '#F2EEE8']),
  decor('barcart', 'barcart', 'Bar cart', 100, ['luxe', 'modern', 'bold'], ['#C9A24A', '#2B2B30', '#C9CED6']),

  // Plants
  plantItem('plant', 'plant', 'Houseplant', 30, ['natural', 'cozy', 'soft']),
  plantItem('fern', 'fern', 'Fern', 35, ['natural', 'soft', 'cool'], ['#C26B4A', '#E4DDD2', '#2B2B30', '#7FA7C9']),
  plantItem('cactus', 'cactus', 'Cactus', 30, ['natural', 'minimal', 'modern'], ['#E8C9A0', '#C26B4A', '#F2EEE8']),
  plantItem('fiddle', 'fiddle', 'Fiddle leaf fig', 70, ['natural', 'modern', 'bold'], ['#F2EEE8', '#C26B4A', '#2B2B30', '#C9A24A']),
  plantItem('snake', 'snake', 'Snake plant', 40, ['natural', 'modern', 'minimal'], ['#2B2B30', '#F2EEE8', '#C26B4A', '#9EC1C9']),
  plantItem('palm', 'palm', 'Parlor palm', 80, ['natural', 'tropical', 'bold'], ['#E8C9A0', '#C26B4A', '#2B2B30']),

  // Hobbies
  hobby('records', 'records', 'Record player', 150, ['vintage', 'cozy', 'warm']),
  hobby('arcade', 'arcade', 'Arcade cabinet', 200, ['playful', 'bold', 'vintage']),
  hobby('piano', 'piano', 'Upright piano', 400, ['luxe', 'vintage', 'bold'], ['#1B1A1F', '#5A3E2E', '#F2EEE8']),
  hobby('easel', 'easel', 'Art easel', 100, ['natural', 'creative', 'soft'], ['#B98A6A', '#2B2B30', '#F2EEE8']),
  hobby('guitar', 'guitar', 'Guitar on a stand', 120, ['vintage', 'warm', 'bold'], ['#C27A5A', '#1B1A1F', '#C2413A', '#F2EEE8']),
  hobby('telescope', 'telescope', 'Telescope', 150, ['modern', 'cool', 'minimal'], ['#F2EEE8', '#2B2B30', '#C9A24A']),
  hobby('punchbag', 'punchbag', 'Heavy bag', 100, ['bold', 'industrial', 'modern'], ['#C2413A', '#2B2B30', '#4A5DA8']),
  hobby('bike', 'bike', 'Exercise bike', 130, ['modern', 'minimal', 'cool'], ['#2B2B30', '#F2EEE8', '#C2413A']),
  hobby('tread', 'tread', 'Treadmill', 450, ['modern', 'cool', 'minimal']),
  hobby('gym', 'gym', 'Weights and mat', 180, ['cool', 'bold', 'minimal']),
  hobby('yogamat', 'yogamat', 'Yoga mat', 30, ['natural', 'soft', 'minimal'], ['#8E5468', '#7FB069', '#4A88B8', '#E0A43A', '#2B2B30']),
  hobby('massage', 'massage', 'Massage chair', 350, ['luxe', 'modern', 'cozy'], ['#2B2B30', '#E8DCC8', '#6E3C50']),
  hobby('starprojector', 'starprojector', 'Star projector', 140, ['soft', 'playful', 'cool'], ['#F4F1F8', '#B9A9DE', '#1F2550']),
  hobby('shishiodoshi', 'shishiodoshi', 'Bamboo water fountain', 260, ['minimal', 'natural', 'cool'], ['#7FA06A', '#8E8A84', '#C9C2B4']),
  hobby('tallcandelabra', 'tallcandelabra', 'Brass candelabra', 180, ['luxe', 'cozy', 'vintage'], ['#C9A24A', '#8E6E2A', '#E0C26E']),
  hobby('woodstove', 'woodstove', 'Wood stove', 420, ['cozy', 'warm', 'natural'], ['#2A2826', '#3A3634', '#5A1E1E']),
  hobby('glamtable', 'glamtable', 'Hollywood dressing table', 360, ['luxe', 'bold', 'playful'], ['#F2C4CE', '#1F6B52', '#151517']),
  hobby('hificonsole', 'hificonsole', 'Hi-fi console', 380, ['modern', 'warm', 'vintage'], ['#7A4E2D', '#9A6A44', '#5E3A20']),
  hobby('musicbox', 'musicbox', 'Music box', 90, ['cozy', 'soft', 'vintage'], ['#E8A0A8', '#9DB7D5', '#A9BFA0', '#F2D98A']),
  hobby('servicebell', 'servicebell', 'Service bell', 150, ['luxe', 'bold', 'vintage'], ['#C9A24A', '#4A3226', '#1E1E22']),
  hobby('diffuser', 'diffuser', 'Aroma diffuser', 120, ['soft', 'minimal', 'natural'], ['#D8D0C2', '#9DB3A5', '#F6F4EE']),
  hobby('overseer', 'overseer', 'The Overseer', 450, ['industrial', 'minimal', 'bold'], ['#2B2B30', '#8E939A', '#E8EAEC']),
  hobby('jukebox', 'jukebox', 'Jukebox', 300, ['vintage', 'playful', 'bold'], ['#C2413A', '#4A5DA8', '#E0A43A']),
  hobby('clawmachine', 'clawmachine', 'Claw machine', 280, ['playful', 'bold', 'vintage'], ['#FF2E9A', '#19E6F0', '#F4C430', '#7A5CFF']),
  hobby('pinball', 'pinball', 'Pinball machine', 320, ['playful', 'bold', 'vintage'], ['#E63946', '#1E1A2E', '#2E6BD6', '#F4C430']),
  promo(hobby('cloudswing', 'cloudswing', 'Cloud swing', 320, ['soft', 'playful', 'cozy'], ['#F6B7CC', '#AEDDF7', '#C7A8F0', '#F9E27A'])),
  hobby('vrpod', 'vrpod', 'VR pod', 320, ['bold', 'modern', 'industrial'], ['#111118', '#FF2E9A', '#7A5CFF', '#19E6F0']),
  hobby('fortuneteller', 'fortuneteller', 'Fortune-telling machine', 320, ['luxe', 'vintage', 'cozy'], ['#5E1F2A', '#2A2224', '#2E3B57', '#3B2541']),
  hobby('gumball', 'gumball', 'Gumball machine', 320, ['soft', 'playful', 'warm'], ['#E04A6A', '#F6B7CC', '#BFE8D6', '#2E6BD6']),
  hobby('tikibar', 'tikibar', 'Tiki bar', 320, ['playful', 'natural', 'bold'], ['#D9BE82', '#8A5A3A', '#D2B48C']),
  hobby('eggchair', 'eggchair', 'Hanging egg chair', 280, ['modern', 'bold', 'luxe'], ['#E8DCC8', '#2B2B30', '#C27A5A']),

  // Outdoor
  outdoor('hammock', 'hammock', 'Hammock', 120, ['natural', 'cozy', 'soft'], ['#E0A43A', '#3D6B73', '#D24A7A', '#F2EEE8']),
  outdoor('firepit', 'firepit', 'Fire pit', 100, ['cozy', 'warm', 'bold'], ['#8C8884', '#A85A40', '#3A3A3F']),
  outdoor('grill', 'grill', 'Charcoal grill', 80, ['natural', 'warm', 'bold'], ['#1B1A1F', '#C2413A', '#3D6B73']),
  outdoor('patio', 'patio', 'Patio set', 200, ['cozy', 'natural', 'warm'], ['#F2EEE8', '#2B2B30', '#3F5B4C', '#C27A5A']),
  outdoor('birdfeeder', 'birdfeeder', 'Bird feeder', 40, ['natural', 'cozy', 'soft'], ['#9C6B45', '#F2EEE8', '#3F5B4C']),
  outdoor('beachchair', 'beachchair', 'Beach chair', 50, ['playful', 'cool', 'soft'], ['#5FB8D6', '#E0A43A', '#D24A7A']),
  outdoor('treeoak', 'treeoak', 'Oak tree', 120, ['natural', 'cozy', 'warm']),
  fruitTree('treecherry', 'treecherry', 'Cherry blossom tree', 150, ['natural', 'soft', 'playful']),
  outdoor('treepine', 'treepine', 'Pine tree', 100, ['natural', 'cool', 'bold']),
  outdoor('treebirch', 'treebirch', 'Birch tree', 110, ['natural', 'cool', 'soft']),
  outdoor('treewillow', 'treewillow', 'Weeping willow', 160, ['natural', 'soft', 'vintage']),
  fruitTree('treepalm', 'treepalm', 'Palm tree', 140, ['natural', 'playful', 'warm']),
  fruitTree('treeapple', 'treeapple', 'Apple tree', 130, ['natural', 'cozy', 'playful']),
  outdoor('bench', 'bench', 'Garden bench', 90, ['natural', 'vintage', 'cozy']),
  outdoor('hoop', 'hoop', 'Basketball hoop', 260, ['playful', 'bold', 'cool']),
  outdoor('hoopretro', 'hoopretro', 'Barnyard hoop', 220, ['vintage', 'natural', 'cozy']),
  outdoor('hoopstreet', 'hoopstreet', 'Street hoop', 240, ['bold', 'cool']),
  outdoor('hooppro', 'hooppro', 'Pro hoop', 380, ['bold', 'cool', 'luxe']),
  outdoor('hoopcolor', 'hoopcolor', 'Sunshine hoop', 230, ['playful', 'warm', 'soft']),
  outdoor('garden', 'garden', 'Garden bed', 50, ['natural', 'cozy']),
  seed('seed-flower', 'flower', 'Tulip seeds', 6, 'A packet of tulip seeds. Picked blooms brighten the living room.'),
  seed('seed-fruit', 'fruit', 'Apple seeds', 8, 'A packet of apple seeds. Two meals of fruit when ripe.'),
  seed('seed-vegetable', 'vegetable', 'Pumpkin seeds', 5, 'A packet of pumpkin seeds. Two meals of vegetables when ripe.'),
  seed('seed-carrot', 'carrot', 'Carrot seeds', 5, 'A packet of carrot seeds. Two meals of vegetables when pulled up.'),
  seed('seed-lettuce', 'lettuce', 'Lettuce seeds', 4, 'A packet of lettuce seeds. One meal of vegetables when cut.'),
  outdoor('sprinkler', 'sprinkler', 'Sprinkler', 20, ['natural', 'playful']),

  // Pets
  { ...petItem('pet-cat', 'Tabby cat', 80, 'cat'), desc: 'Comes with bowls, a bed and a litter box. Naps a lot, sheds, and the litter needs scooping.' },
  { ...petItem('pet-cat2', 'Black cat', 80, 'cat'), desc: 'Comes with bowls, a bed and a litter box. Naps a lot, sheds, and the litter needs scooping.' },
  { ...petItem('pet-dog', 'Golden retriever', 120, 'dog'), desc: 'Comes with bowls and a bed. Needs walks in the yard, play and attention. Tracks in mud.' },
  { ...petItem('pet-dog2', 'Corgi', 100, 'dog'), desc: 'Comes with bowls and a bed. Needs walks in the yard, play and attention. Tracks in mud.' },
  { id: 'pet-food', name: 'Pet food', desc: '14 portions for the bowls.', price: 14, icon: 'bag', tab: 'Pets', repeat: true },

  // Clothes (driven by the clothing catalog so ids and styles stay in sync)
  ...CLOTHES.map(c => clothItem(c.key)),
];

/** What a set costs: the pieces you do not own yet, less the set's share off. `full` is what they cost apart. */
export function setQuote(set: CatalogEntry, owned: ReadonlySet<string>): { full: number; cost: number; missing: CatalogEntry[]; members: CatalogEntry[] } {
  const members = (set.set?.items ?? []).map((id) => CATALOG.find((c) => c.id === id)).filter((c): c is CatalogEntry => !!c);
  const missing = members.filter((m) => !owned.has(m.id));
  const full = missing.reduce((t, m) => t + m.price, 0);
  return { full, cost: Math.round(full * (1 - (set.set?.off ?? 0))), missing, members };
}

// A set's list price is every piece bought separately, less its share.
for (const e of CATALOG) if (e.set) e.price = setQuote(e, new Set()).cost;

// Tags for items that have them, used by companion taste system
export const ITAGS: Record<string, string> = Object.fromEntries(
  CATALOG.filter(c => c.tags).map(c => [c.id, c.tags!.join(' ')]),
);

export function catalogById(id: string): CatalogEntry | undefined {
  return CATALOG.find(c => c.id === id);
}

/** A promo entry the player doesn't have yet: the shop shows its name, locked, and nothing else. */
export function promoLocked(item: CatalogEntry, owned: ReadonlySet<string>): boolean {
  return !!item.promo && !owned.has(item.id);
}

// Part of a promo pack: one of its pieces, or an extra its code gives with it (Nana's cloud nook and wall lamp).
const inPromoSet = (c: CatalogEntry): boolean =>
  CATALOG.some((s) => s.promo && s.set?.items.includes(c.id)) || Object.values(UNLOCK_CODES).some((u) => u.also?.includes(c.id));

export function itemsForTab(tab: string): CatalogEntry[] {
  if (tab === 'Today') return CATALOG.filter(c => c.tab !== 'Today');
  // The promo packs, and any promo piece that isn't part of one.
  if (tab === 'Promo') return CATALOG.filter(c => c.promo && (c.set || !inPromoSet(c)));
  return CATALOG.filter(c => c.tab === tab);
}

export interface LockInfo {
  locked: boolean;
  hint?: string;
}

export function lockOf(id: string, day: number, bond: number): LockInfo | null {
  const locks: Record<string, { day?: number; bond?: number; hint: string }> = {
    'chesterfield': { bond: 65, hint: 'Come back when your bond is stronger' },
    'piano': { day: 3, hint: 'Available on day 3' },
    'jukebox': { day: 5, hint: 'Available on day 5' },
    'eggchair': { bond: 70, hint: 'Available when bond reaches 70' },
    'aquarium': { day: 4, hint: 'Available on day 4' },
    'neon': { bond: 75, hint: 'Available when bond reaches 75' },
    'pet-cat': { day: 2, hint: 'Settle in first: from day 2' },
    'pet-cat2': { day: 2, hint: 'Settle in first: from day 2' },
    'pet-dog': { day: 3, hint: 'Settle in first: from day 3' },
    'pet-dog2': { day: 3, hint: 'Settle in first: from day 3' },
  };
  const lock = locks[id];
  if (!lock) return null;
  if (lock.day && day < lock.day) return { locked: true, hint: lock.hint };
  if (lock.bond && bond < lock.bond) return { locked: true, hint: lock.hint };
  return { locked: false };
}
