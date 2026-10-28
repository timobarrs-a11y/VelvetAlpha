/**
 * Shop catalog — all buyable items, ported from the original game.
 * Each item has an id, name, price, icon type, tab, and optional style tags.
 */

import { CLOTHES, clothId } from './clothing';
import { PICTURE_WALLS } from './pictureWalls';

export interface CatalogEntry {
  id: string;
  name: string;
  desc?: string;
  price: number;
  icon: 'paint' | 'paper' | 'floor' | 'set' | 'upgrade' | 'obj' | 'cloth' | 'wobj' | 'box' | 'bag' | 'pet' | 'home';
  tab: string;
  tags?: string[];
  type?: string;
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
}

export const TABS = [
  'Today', 'Sets', 'Groceries', 'Paint', 'Wallpaper', 'Floors',
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

/** A themed set: its pieces, wallpaper and floor bought together for less. The price is worked out from the pieces (see `setQuote`). */
const bundle = (id: string, name: string, desc: string, items: string[], tags: string[], off = 0.2): CatalogEntry => ({
  id, name, desc, price: 0, icon: 'set', tab: 'Sets', tags, set: { items, off },
});

const hobby = (id: string, type: string, name: string, price: number, tags: string[], cols?: string[]): CatalogEntry => ({
  id, name, price, icon: 'obj', tab: 'Hobbies', type, tags, cols, repeat: true,
});

const outdoor = (id: string, type: string, name: string, price: number, tags: string[], cols?: string[]): CatalogEntry => ({
  id, name, price, icon: 'obj', tab: 'Outdoor', type, tags, cols, repeat: true,
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
  wallpaper('paper-clouds-sky', 'Clouds and rainbows', 'clouds-sky', 90, ['soft', 'playful', 'cozy']),
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

  bundle('set-cuddle', 'Cuddle Clouds kitchen and living room', 'Pastel bears, clouds and rainbows: the rainbow bear fridge, cloud counter with a heart basin and a bear plush, cloud table with bear-face chairs under a rainbow, a puffy cloud sofa, a cloud lamp with rainbow drops and a cloud pot, with clouds and rainbows on the walls and a sky check underfoot.',
    ['look-fridge-cuddle', 'look-counter-cuddle', 'look-dining-cuddle', 'look-sofa-cuddle', 'look-lamp-cuddle', 'look-plant-cuddle', 'paper-clouds-sky', 'floor-skycheck'], ['soft', 'playful', 'cozy']),

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
  floor('floor-skycheck', 'Sky check', 'skycheck', 140, ['soft', 'playful', 'cozy']),
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
  furn('wardrobe', 'wardrobe', 'Wardrobe', 250, ['vintage', 'luxe', 'natural'], ['#E4DDD2', '#9C6B45', '#3A2E2A', '#8E9C96']),
  furn('console', 'console', 'Console table', 130, ['modern', 'minimal', 'luxe'], ['#3A2E2A', '#9C6B45', '#E4DDD2', '#C9A24A']),
  furn('cabinet', 'cabinet', 'Cabinet', 160, ['vintage', 'natural', 'cozy'], ['#B98A6A', '#3F5B4C', '#2E3B57', '#F2EEE8', '#8E5468']),
  furn('cubeshelf', 'cubeshelf', 'Cube shelf', 80, ['modern', 'minimal', 'playful'], ['#F2EEE8', '#2B2B30', '#B98A6A']),
  furn('floormirror', 'floormirror', 'Floor mirror', 90, ['modern', 'minimal', 'luxe'], ['#C9A24A', '#2B2B30', '#F2EEE8', '#9C6B45']),
  furn('gclock', 'gclock', 'Grandfather clock', 300, ['vintage', 'luxe', 'bold'], ['#5A3E2E', '#2B2B30', '#E4DDD2']),
  furn('globe', 'globe', 'Antique globe', 120, ['vintage', 'luxe', 'natural'], ['#9C6B45', '#2B2B30']),

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

  look('look-fridge-cuddle', 'fridge', 'cuddle', 'Rainbow bear fridge', 'Sky blue with a cloud cap, a rainbow between two clouds on the upper door, a pink bear face with a heart on the lower one, and heart handles.', 350, ['soft', 'playful', 'cozy'], ['#AEDDF7', '#FFFFFF', '#F6B7CC']),
  look('look-counter-cuddle', 'counter', 'cuddle', 'Cloud counter', 'Cloud-white fronts with a rainbow band at the kick, hearts and stars for pulls, cloud puffs along the top edge, a sky top with stars, a pink heart basin and a blue bear plush at the end.', 420, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#AEDDF7', '#F6B7CC']),
  look('look-dining-cuddle', 'dining', 'cuddle', 'Cloud table and bear chairs', 'A scalloped cloud top on a stack of puffs, chairs with bear-face backs in pink and blue, and a rainbow hanging from a cloud above.', 340, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#F6B7CC', '#9CCBF2']),
  look('look-sofa-cuddle', 'sofa', 'cuddle', 'Cloud sofa', 'A puffy white cloud sofa with a rainbow band along the base, sky-blue cushions with a heart and a star, and a yellow bear plush in the corner.', 380, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#AEDDF7', '#F6B7CC']),
  look('look-lamp-cuddle', 'lamp', 'cuddle', 'Cloud lamp', 'A cloud shade on a sky-blue pole with a star on top and rainbow drops hanging under it.', 90, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#AEDDF7', '#F9E27A']),
  look('look-plant-cuddle', 'plant', 'cuddle', 'Cloud pot', 'Your plant in a puffy white pot with cloud bumps round the rim, a rainbow on the front and a star on the side.', 60, ['soft', 'playful', 'cozy'], ['#FFFFFF', '#AEDDF7', '#F9E27A', '#F6B7CC']),

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

  // Decor
  decor('pampas', 'pampas', 'Pampas vase', 40, ['modern', 'minimal', 'natural'], ['#E8DCC8', '#2B2B30', '#C27A5A', '#9EC1C9']),
  decor('candles', 'candles', 'Pillar candles', 35, ['cozy', 'warm', 'soft'], ['#F2EEE8', '#C9A24A', '#B5476E', '#3F5B4C']),
  decor('basket', 'basket', 'Blanket basket', 60, ['cozy', 'natural', 'soft'], ['#B98A6A', '#3A2E2A', '#E4DDD2']),
  decor('coatrack', 'coatrack', 'Coat rack', 70, ['natural', 'minimal', 'vintage'], ['#2B2B30', '#7A4E32', '#C9A24A']),
  decor('bookstack', 'bookstack', 'Stacked books', 25, ['cozy', 'vintage', 'creative'], ['#B5476E', '#3F5B4C', '#2E3B57', '#C9A24A']),
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
  hobby('jukebox', 'jukebox', 'Jukebox', 300, ['vintage', 'playful', 'bold'], ['#C2413A', '#4A5DA8', '#E0A43A']),
  hobby('eggchair', 'eggchair', 'Hanging egg chair', 280, ['modern', 'bold', 'luxe'], ['#E8DCC8', '#2B2B30', '#C27A5A']),

  // Outdoor
  outdoor('hammock', 'hammock', 'Hammock', 120, ['natural', 'cozy', 'soft'], ['#E0A43A', '#3D6B73', '#D24A7A', '#F2EEE8']),
  outdoor('firepit', 'firepit', 'Fire pit', 100, ['cozy', 'warm', 'bold'], ['#8C8884', '#A85A40', '#3A3A3F']),
  outdoor('grill', 'grill', 'Charcoal grill', 80, ['natural', 'warm', 'bold'], ['#1B1A1F', '#C2413A', '#3D6B73']),
  outdoor('patio', 'patio', 'Patio set', 200, ['cozy', 'natural', 'warm'], ['#F2EEE8', '#2B2B30', '#3F5B4C', '#C27A5A']),
  outdoor('birdfeeder', 'birdfeeder', 'Bird feeder', 40, ['natural', 'cozy', 'soft'], ['#9C6B45', '#F2EEE8', '#3F5B4C']),
  outdoor('beachchair', 'beachchair', 'Beach chair', 50, ['playful', 'cool', 'soft'], ['#5FB8D6', '#E0A43A', '#D24A7A']),
  outdoor('bench', 'bench', 'Garden bench', 90, ['natural', 'vintage', 'cozy']),
  outdoor('garden', 'garden', 'Garden bed', 50, ['natural', 'cozy']),
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

export function itemsForTab(tab: string): CatalogEntry[] {
  if (tab === 'Today') return CATALOG.filter(c => c.tab !== 'Today');
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
