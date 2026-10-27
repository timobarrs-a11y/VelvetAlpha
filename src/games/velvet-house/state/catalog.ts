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
  icon: 'paint' | 'paper' | 'floor' | 'upgrade' | 'obj' | 'cloth' | 'wobj' | 'box' | 'bag' | 'pet' | 'home';
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
}

export const TABS = [
  'Today', 'Groceries', 'Paint', 'Wallpaper', 'Floors',
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
  wallpaper('paper-shiplap', 'Shiplap', 'shiplap', 80, ['natural', 'minimal', 'cozy']),
  wallpaper('paper-subway', 'Subway tile', 'subway', 80, ['modern', 'minimal', 'industrial']),
  wallpaper('paper-stars-night', 'Starry night', 'stars-night', 120, ['playful', 'cool', 'bold']),
  wallpaper('paper-velvet-tuft', 'Tufted velvet', 'velvet-tuft', 150, ['luxe', 'bold', 'warm']),
  wallpaper('paper-blossom', 'Blossom', 'blossom', 100, ['soft', 'natural', 'playful']),
  wallpaper('paper-palms', 'Palms', 'palms', 100, ['natural', 'playful', 'cool']),
  wallpaper('paper-jungle-night', 'Jungle night', 'jungle-night', 120, ['bold', 'natural', 'cool']),

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
  petItem('pet-cat', 'Tabby cat', 80, 'cat'),
  petItem('pet-cat2', 'Black cat', 80, 'cat'),
  petItem('pet-dog', 'Golden retriever', 120, 'dog'),
  petItem('pet-dog2', 'Corgi', 100, 'dog'),

  // Clothes (driven by the clothing catalog so ids and styles stay in sync)
  ...CLOTHES.map(c => clothItem(c.key)),
];

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
  };
  const lock = locks[id];
  if (!lock) return null;
  if (lock.day && day < lock.day) return { locked: true, hint: lock.hint };
  if (lock.bond && bond < lock.bond) return { locked: true, hint: lock.hint };
  return { locked: false };
}
