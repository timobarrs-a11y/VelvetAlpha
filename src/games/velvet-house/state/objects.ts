export interface Vec3 { x?: number; y?: number; z?: number; }
export type Dir2 = [number, number];

export interface SpotDef {
  stand: [number, number];
  pos?: [number, number, number];
  dir?: Dir2;
  lie?: Dir2;
  tag: string;
  base?: string;
  group?: string;
}

export interface LightDef {
  at: [number, number, number];
  r: number;
  col?: string;
}

export type BlockRect = [number, number, number, number];

/** What a look is mostly made of, and the theme set it belongs to. */
export type Material = 'wood' | 'metal' | 'laminate' | 'stone' | 'fabric' | 'glass';
export type Theme = 'retro' | 'farmhouse' | 'modern' | 'scandi' | 'industrial' | 'beach' | 'deco' | 'japandi' | 'boho' | 'space' | 'gothic' | 'riad' | 'tropical' | 'memphis' | 'provence' | 'adobe' | 'neon' | 'candy' | 'cuddle' | 'arcade' | 'spring' | 'summer' | 'fall' | 'winter' | 'cloud' | 'camp' | 'midcentury';

/**
 * One look of a piece. A look only changes how the piece is drawn, named, priced and coloured; the footprint, height
 * and spots always come from the type, so the household finds the fridge, the sink and the seats wherever they stand.
 */
export interface SkinDef {
  name: string;
  material: Material;
  theme: Theme;
  /** The colours this look comes in, if it comes in several (Arrange's Colour button cycles them). */
  cols?: string[];
}

export interface ObjectTypeDef {
  W: number;
  D: number;
  h: number;
  name?: string;
  store?: boolean;
  fixed?: boolean;
  rug?: boolean;
  wall?: boolean;
  out?: boolean;
  blocks?: BlockRect[];
  cols?: string[];
  light?: LightDef;
  spots?: Record<string, SpotDef>;
  /** A small piece that can sit on a surface (a table, a shelf) instead of the floor. */
  small?: boolean;
  /** What can be put on this piece: the height of its top, and the part of it that is flat (local coordinates). */
  surface?: { z: number; rect: [number, number, number, number] };
  /** The looks this piece has besides the stock one, by id. */
  skins?: Record<string, SkinDef>;
  /**
   * The job this piece does, when it is another model of a piece the house has (a chest freezer is a fridge): its own
   * size, height and spots, so it changes the room, while the household, the shop and the story treat it as that piece.
   * Unset, the type is its own kind.
   */
  kind?: string;
  /** A TV: where the middle of its picture is (local x, y and height), for its glow. People watch from seats on its floor. */
  screen?: [number, number, number];
  /**
   * Hung on a wall this high off the floor: its back must be against one, it hangs over whatever stands below it, and
   * nobody walks into it.
   */
  mount?: number;
}

export const TYPES: Record<string, ObjectTypeDef> = {
  sofa: { W: 2.4, D: 1.0, h: 0.95, name: 'Couch', skins: { arcade: { name: 'Vinyl sofa with marquee lights', material: 'fabric', theme: 'arcade', cols: ['#1E1A2E', '#E63946', '#F4C430'] }, cuddle: { name: 'Cloud sofa', material: 'fabric', theme: 'cuddle', cols: ['#FFFFFF', '#AEDDF7', '#F6B7CC'] }, provence: { name: 'Skirted linen sofa', material: 'fabric', theme: 'provence', cols: ['#F4EFE3', '#2E4C9A', '#C9B8E8'] }, adobe: { name: 'Rust leather sofa with a serape', material: 'fabric', theme: 'adobe', cols: ['#B5533C', '#3FA7A0', '#F4ECD8'] }, neon: { name: 'Black leather sofa with neon piping', material: 'fabric', theme: 'neon', cols: ['#111118', '#FF2E9A', '#19E6F0'] }, candy: { name: 'Scalloped pink sofa', material: 'fabric', theme: 'candy', cols: ['#F6B7CC', '#BFE8D6', '#D6C4F0'] }, gothic: { name: 'Oxblood velvet sofa', material: 'fabric', theme: 'gothic', cols: ['#5E1F2A', '#2A2224', '#B08D57'] }, riad: { name: 'Cedar banquette', material: 'fabric', theme: 'riad', cols: ['#F1EDE3', '#2E4C9A', '#C27A5A'] }, tropical: { name: 'Bamboo sofa with palm cushions', material: 'fabric', theme: 'tropical', cols: ['#F7F1E3', '#2F6B40', '#F08AA0'] }, memphis: { name: 'Block sofa', material: 'fabric', theme: 'memphis', cols: ['#F4F1EA', '#E63946', '#2E6BD6'] }, deco: { name: 'Emerald velvet sofa', material: 'fabric', theme: 'deco', cols: ['#1F5E4A', '#6E2A3A', '#2E3B57'] }, japandi: { name: 'Low walnut sofa', material: 'wood', theme: 'japandi', cols: ['#4A3A2E', '#6B5444', '#B9B4AC'] }, boho: { name: 'Rattan-arm sofa with kilim cushions', material: 'fabric', theme: 'boho', cols: ['#F1E8D2', '#D9A84A', '#C26B4A'] }, space: { name: 'Pod sofa', material: 'laminate', theme: 'space', cols: ['#F4F6F8', '#1B1A24', '#5BE3E6'] }, scandi: { name: 'Linen sofa on ash legs', material: 'fabric', theme: 'scandi', cols: ['#D9CDB9', '#B9C2B6', '#C7B8C9'] }, industrial: { name: 'Tufted leather sofa', material: 'fabric', theme: 'industrial', cols: ['#6B3A2A', '#2B2B30', '#4A5A4A'] }, beach: { name: 'Slipcover sofa with navy stripes', material: 'fabric', theme: 'beach', cols: ['#F7F5EF', '#E8DCC2', '#DDE8EA'] }, retro: { name: 'Davenport', material: 'laminate', theme: 'retro', cols: ['#E5A33B', '#5FB3A6', '#E58F8F'] }, farmhouse: { name: 'Slipcover sofa', material: 'fabric', theme: 'farmhouse', cols: ['#E8DCC8', '#D8C9AE', '#B7BFB2'] }, modern: { name: 'Low-profile sofa', material: 'fabric', theme: 'modern', cols: ['#5E646B', '#2B2B30', '#C9CED6'] }, spring: { name: 'Posy sofa', material: 'fabric', theme: 'spring', cols: ['#CFE6D3', '#F3D6DC', '#E8DCC8'] }, summer: { name: 'Sunbed sofa', material: 'fabric', theme: 'summer', cols: ['#F6D56E', '#7FD1CF', '#F2A38A'] }, fall: { name: 'Plaid-throw sofa', material: 'fabric', theme: 'fall', cols: ['#B5532F', '#D9A84A', '#3F5B4C'] }, winter: { name: 'Knit-throw sofa', material: 'fabric', theme: 'winter', cols: ['#E8DCC8', '#B9C3C8', '#8E1F2F'] }, cloud: { name: 'Puffy cloud-top sofa', material: 'fabric', theme: 'cloud', cols: ['#F6F1FA', '#F9C6DA', '#BFE3F5'] } },
    spots: { s1: { stand: [0.85, 1.6], pos: [0.85, 0.6, 0.48], dir: [0, 1], tag: 'seat', base: 'base' }, s2: { stand: [1.6, 1.6], pos: [1.6, 0.6, 0.48], dir: [0, 1], tag: 'seat', base: 'base' } } },
  bed: { W: 2.5, D: 1.6, h: 1.0, name: 'Bed',
    spots: { a: { stand: [1.3, 2.05], pos: [0.52, 0.42, 0.56], lie: [1, 0], tag: 'bedA', base: 'mattress' }, b: { stand: [1.9, 2.05], pos: [0.52, 1.18, 0.56], lie: [1, 0], tag: 'bedB', base: 'mattress' },
      make: { stand: [1.6, 2.05], dir: [0, -1], tag: 'makebed' } } },
  // Two friends sharing a place sleep in a bed each: the partner's side is A and the player's is B.
  bedA: { W: 2.5, D: 0.9, h: 1.0, name: 'Bed',
    spots: { a: { stand: [2.9, 0.45], pos: [0.52, 0.45, 0.56], lie: [1, 0], tag: 'bedA', base: 'mattress' }, make: { stand: [2.9, 0.45], dir: [-1, 0], tag: 'makebed' } } },
  bedB: { W: 2.5, D: 0.9, h: 1.0, name: 'Bed',
    spots: { b: { stand: [2.9, 0.45], pos: [0.52, 0.45, 0.56], lie: [1, 0], tag: 'bedB', base: 'mattress' }, make: { stand: [2.9, 0.45], dir: [-1, 0], tag: 'makebed' } } },
  dining: { W: 1.3, D: 2.5, h: 1.1, name: 'Dining set', skins: { arcade: { name: 'Cocktail cabinet table', material: 'laminate', theme: 'arcade', cols: ['#1E1A2E', '#C2413A', '#19E6F0'] }, cuddle: { name: 'Cloud table and bear chairs', material: 'laminate', theme: 'cuddle', cols: ['#FFFFFF', '#F6B7CC', '#9CCBF2'] }, provence: { name: 'Farm table and ladder-backs', material: 'wood', theme: 'provence', cols: ['#E8DCC4', '#C9B690', '#3A3A40'] }, adobe: { name: 'Carved pine dining set', material: 'wood', theme: 'adobe', cols: ['#9C7046', '#3FA7A0', '#B5533C'] }, neon: { name: 'Underlit glass dining set', material: 'glass', theme: 'neon', cols: ['#1E2230', '#19E6F0', '#FF2E9A'] }, candy: { name: 'Scalloped dining set', material: 'laminate', theme: 'candy', cols: ['#F6B7CC', '#D6C4F0', '#FFF8F0'] }, gothic: { name: 'Ebony pedestal dining set', material: 'wood', theme: 'gothic', cols: ['#2A2224', '#5E1F2A', '#B08D57'] }, riad: { name: 'Inlaid cedar dining set', material: 'wood', theme: 'riad', cols: ['#8A5A3A', '#2E4C9A', '#F1EDE3'] }, tropical: { name: 'Bamboo dining set', material: 'wood', theme: 'tropical', cols: ['#8A5A3A', '#D9BE82', '#F08AA0'] }, memphis: { name: 'Totem dining set', material: 'laminate', theme: 'memphis', cols: ['#F4F1EA', '#E63946', '#F4C430'] }, deco: { name: 'Sunburst dining set', material: 'wood', theme: 'deco', cols: ['#1F5E4A', '#6E2A3A', '#2E3B57'] }, japandi: { name: 'Low walnut dining set', material: 'wood', theme: 'japandi', cols: ['#4A3A2E', '#6B5444', '#2B2B30'] }, boho: { name: 'Carved wood dining set', material: 'wood', theme: 'boho', cols: ['#9C6B45', '#A85A40', '#C9B28A'] }, space: { name: 'Tulip dining set', material: 'laminate', theme: 'space', cols: ['#F4F6F8', '#F26A2E', '#1B1A24'] }, scandi: { name: 'Wishbone dining set', material: 'wood', theme: 'scandi', cols: ['#D8C7A8', '#C9B693', '#EDE4D3'] }, industrial: { name: 'Pipe and plank table set', material: 'wood', theme: 'industrial', cols: ['#8A5E3B', '#6B4A35', '#A87E48'] }, beach: { name: 'Driftwood dining set', material: 'wood', theme: 'beach', cols: ['#C9B9A2', '#DAD0C0', '#B9ADA0'] }, retro: { name: 'Boomerang table set', material: 'laminate', theme: 'retro', cols: ['#E58F8F', '#6FBFB0', '#F2C75C'] }, farmhouse: { name: 'Farm table set', material: 'wood', theme: 'farmhouse', cols: ['#B98A6A', '#8A5E3B', '#E4DDD2'] }, modern: { name: 'Glass-top dining set', material: 'glass', theme: 'modern', cols: ['#2B2B30', '#E8EAEC', '#5E646B'] }, spring: { name: 'Garden table set', material: 'wood', theme: 'spring', cols: ['#CFE6D3', '#F6EBC0', '#F3D6DC'] }, summer: { name: 'Patio table set', material: 'wood', theme: 'summer', cols: ['#F6D56E', '#7FD1CF', '#F2A38A'] }, fall: { name: 'Harvest table set', material: 'wood', theme: 'fall', cols: ['#B5532F', '#D9A84A', '#3F5B4C'] }, winter: { name: 'Lodge table set', material: 'wood', theme: 'winter', cols: ['#8A5E3B', '#3F5B4C', '#8E1F2F'] }, cloud: { name: 'Tea-party table set', material: 'wood', theme: 'cloud', cols: ['#F9C6DA', '#BFE3F5', '#E2D3F7'] } }, light: { at: [0.65, 1.24, 1.8], r: 130 },
    spots: { c1: { stand: [0.65, -0.45], pos: [0.65, 0.3, 0.49], dir: [0, 1], tag: 'dine1', base: 'seat1' }, c2: { stand: [0.65, 2.95], pos: [0.65, 2.18, 0.49], dir: [0, -1], tag: 'dine2', base: 'seat2' }, clear: { stand: [1.75, 1.24], dir: [-1, 0], tag: 'clear' } } },
  lamp: { W: 0.4, D: 0.4, h: 1.75, name: 'Floor lamp', skins: { arcade: { name: 'Joystick lamp', material: 'metal', theme: 'arcade', cols: ['#E63946', '#15121F', '#F4C430'] }, cuddle: { name: 'Cloud lamp', material: 'laminate', theme: 'cuddle', cols: ['#FFFFFF', '#AEDDF7', '#F9E27A'] }, provence: { name: 'Wrought iron lamp', material: 'metal', theme: 'provence', cols: ['#3A3A40', '#F4EFE3', '#8E7CC3'] }, adobe: { name: 'Pottery and rawhide lamp', material: 'stone', theme: 'adobe', cols: ['#3FA7A0', '#EFE2C8', '#9C7046'] }, neon: { name: 'Neon tube lamp', material: 'metal', theme: 'neon', cols: ['#FF2E9A', '#111118', '#19E6F0'] }, candy: { name: 'Ice cream cone lamp', material: 'laminate', theme: 'candy', cols: ['#F6B7CC', '#FBE7A6', '#FFF8F0'] }, gothic: { name: 'Brass candelabra lamp', material: 'metal', theme: 'gothic', cols: ['#B08D57', '#2A2224', '#FFE0A0'] }, riad: { name: 'Pierced brass lantern', material: 'metal', theme: 'riad', cols: ['#C9A24A', '#8A5A3A', '#2E4C9A'] }, tropical: { name: 'Bamboo cone lamp', material: 'wood', theme: 'tropical', cols: ['#D2B48C', '#D9BE82', '#F08AA0'] }, memphis: { name: 'Totem lamp', material: 'metal', theme: 'memphis', cols: ['#F4C430', '#E63946', '#2E6BD6'] }, deco: { name: 'Tiered gold lamp', material: 'metal', theme: 'deco', cols: ['#C9A24A', '#E0C26E', '#B9BEC3'] }, japandi: { name: 'Washi paper lamp', material: 'wood', theme: 'japandi', cols: ['#F7F3EA', '#EDE6D6', '#E6DCCB'] }, boho: { name: 'Macrame shade lamp', material: 'fabric', theme: 'boho', cols: ['#EFE4D2', '#D2B48C', '#C9B28A'] }, space: { name: 'Saucer lamp', material: 'metal', theme: 'space', cols: ['#F26A2E', '#F4F6F8', '#7A5CFF'] }, scandi: { name: 'Paper lantern lamp', material: 'wood', theme: 'scandi', cols: ['#F7F3EA', '#E9DDC7', '#D8E0DA'] }, industrial: { name: 'Cage bulb lamp', material: 'metal', theme: 'industrial', cols: ['#2B2B30', '#7B4A3A', '#8E939A'] }, beach: { name: 'Rope-wound lamp', material: 'wood', theme: 'beach', cols: ['#F2E6DA', '#DDE8EA', '#E8DCC2'] }, retro: { name: 'Atomic lamp', material: 'metal', theme: 'retro', cols: ['#F08A6B', '#6FBFB0', '#F2C75C'] }, farmhouse: { name: 'Tripod lamp', material: 'wood', theme: 'farmhouse', cols: ['#B98A6A', '#8A5E3B', '#E4DDD2'] }, modern: { name: 'Slim torchiere', material: 'metal', theme: 'modern', cols: ['#2B2B30', '#C9CED6', '#E8EAEC'] }, spring: { name: 'Daisy lamp', material: 'metal', theme: 'spring', cols: ['#F2EEE8', '#F6EBC0', '#F3D6DC'] }, summer: { name: 'Palm lamp', material: 'metal', theme: 'summer', cols: ['#4F9460', '#7FD1CF', '#F6D56E'] }, fall: { name: 'Lantern lamp', material: 'metal', theme: 'fall', cols: ['#2B2B30', '#8A5E3B', '#B5532F'] }, winter: { name: 'Candle-glow lamp', material: 'glass', theme: 'winter', cols: ['#F2EEE8', '#8E1F2F', '#3F5B4C'] }, cloud: { name: 'Star lamp', material: 'metal', theme: 'cloud', cols: ['#F9C6DA', '#BFE3F5', '#E2D3F7'] } }, store: true, light: { at: [0.2, 0.2, 1.5], r: 140 } },
  plant: { W: 0.5, D: 0.5, h: 1.1, name: 'Plant', skins: { arcade: { name: 'Pixel pot', material: 'laminate', theme: 'arcade', cols: ['#15121F', '#19E6F0', '#39D353', '#F4C430'] }, cuddle: { name: 'Cloud pot', material: 'stone', theme: 'cuddle', cols: ['#FFFFFF', '#AEDDF7', '#F9E27A', '#F6B7CC'] }, provence: { name: 'Zinc pot with lavender', material: 'metal', theme: 'provence', cols: ['#B9BEC3', '#8E7CC3', '#F4EFE3', '#9DB3A5'] }, adobe: { name: 'Painted clay pot', material: 'stone', theme: 'adobe', cols: ['#C08B62', '#3FA7A0', '#F4ECD8', '#2B2420'] }, neon: { name: 'Hex pot with a light ring', material: 'metal', theme: 'neon', cols: ['#111118', '#19E6F0', '#8A3CFF', '#3A3F4A'] }, candy: { name: 'Teacup planter', material: 'stone', theme: 'candy', cols: ['#F6B7CC', '#FFF8F0', '#BFE8D6', '#E04A6A'] }, gothic: { name: 'Black urn planter', material: 'stone', theme: 'gothic', cols: ['#2A2224', '#B08D57', '#5E1F2A', '#8E8A84'] }, riad: { name: 'Cobalt-banded clay pot', material: 'stone', theme: 'riad', cols: ['#C27A5A', '#2E4C9A', '#F1EDE3', '#9FC9B8'] }, tropical: { name: 'Bamboo-slat planter', material: 'wood', theme: 'tropical', cols: ['#8A5A3A', '#D9BE82', '#C9A24A', '#2F6B40'] }, memphis: { name: 'Stacked block planter', material: 'laminate', theme: 'memphis', cols: ['#F4C430', '#1B1A1F', '#E63946', '#2E6BD6'] }, deco: { name: 'Gold urn planter', material: 'metal', theme: 'deco', cols: ['#C9A24A', '#E0C26E', '#B9BEC3', '#1B1A1F'] }, japandi: { name: 'Stone bowl bonsai', material: 'stone', theme: 'japandi', cols: ['#B9B4AC', '#B07A5A', '#8E8A84', '#2B2B30'] }, boho: { name: 'Terracotta pot in a hanging sling', material: 'fabric', theme: 'boho', cols: ['#C26B4A', '#D9A84A', '#3D6B73', '#F1E8D2'] }, space: { name: 'Capsule planter', material: 'laminate', theme: 'space', cols: ['#F4F6F8', '#1B1A24', '#5BE3E6', '#7A5CFF'] }, scandi: { name: 'Ceramic pot on an ash stand', material: 'wood', theme: 'scandi', cols: ['#F6F4EE', '#9DB3A5', '#D5C3B2', '#3A3A40'] }, industrial: { name: 'Galvanized bucket planter', material: 'metal', theme: 'industrial', cols: ['#B9BEC3', '#2B2B30', '#7B4A3A', '#4A5A4A'] }, beach: { name: 'Seagrass basket planter', material: 'fabric', theme: 'beach', cols: ['#D2B48C', '#C9B9A2', '#E8DCC2', '#B9ADA0'] }, retro: { name: 'Atomic planter', material: 'laminate', theme: 'retro', cols: ['#F08A6B', '#6FBFB0', '#F2C75C', '#E58F8F'] }, farmhouse: { name: 'Crate and pail planter', material: 'metal', theme: 'farmhouse', cols: ['#C9CED6', '#F1E8D2', '#9DB3C6', '#3A3340'] }, modern: { name: 'Slab planter', material: 'stone', theme: 'modern', cols: ['#2B2B30', '#E8EAEC', '#9AA0A6', '#C9B79C'] }, spring: { name: 'Tulip pot', material: 'stone', theme: 'spring', cols: ['#F3B6C8', '#F6EBC0', '#B9DCC4'] }, summer: { name: 'Palm tub', material: 'stone', theme: 'summer', cols: ['#7FD1CF', '#F6D56E', '#F2A38A'] }, fall: { name: 'Mum pot', material: 'stone', theme: 'fall', cols: ['#B5532F', '#D9A84A', '#8A5E3B'] }, winter: { name: 'Frosted evergreen pot', material: 'stone', theme: 'winter', cols: ['#8E1F2F', '#F2EEE8', '#3F5B4C', '#2E3B57'] }, cloud: { name: 'Rainbow pot', material: 'stone', theme: 'cloud', cols: ['#F9C6DA', '#BFE3F5', '#FFF2B8', '#C9F0DC'] } },
    spots: { w: { stand: [0.25, 1.05], dir: [0, -1], tag: 'water' } } },
  bookshelf: { W: 1.4, D: 0.38, h: 1.6, name: 'Bookshelf' , surface: { z: 1.6, rect: [0.06, 0.04, 1.34, 0.34] } },
  records: { W: 0.85, D: 0.45, h: 0.7, name: 'Record player',
    spots: { r: { stand: [0.42, 1.05], dir: [0, -1], tag: 'records' } } },
  arcade: { W: 0.56, D: 0.5, h: 1.3, name: 'Arcade cabinet',
    spots: { a: { stand: [0.28, 1.05], dir: [0, -1], tag: 'arcade' } } },
  tread: { W: 1.35, D: 0.62, h: 1.2, name: 'Treadmill',
    spots: { t: { stand: [-0.45, 0.31], pos: [0.6, 0.31, 0.18], dir: [1, 0], tag: 'tread', base: 'deck' } } },
  gym: { W: 1.45, D: 1.0, h: 0.6, name: 'Weights and mat', blocks: [[1.1, 0.1, 1.45, 0.9]],
    spots: { l: { stand: [0.55, 0.5], dir: [0, 1], tag: 'lift', group: 'mat' }, s: { stand: [0.55, 0.5], dir: [0, 1], tag: 'stretch', group: 'mat' } } },
  desk: { W: 1.2, D: 1.25, h: 1.2, name: 'Desk', light: { at: [1.06, 0.18, 1.02], r: 95 }, surface: { z: 0.78, rect: [0.03, 0.3, 1.17, 0.58] },
    spots: { d: { stand: [0.6, 1.75], pos: [0.6, 0.98, 0.49], dir: [0, -1], tag: 'desk', base: 'seat' } } },
  dresser: { W: 1.2, D: 0.5, h: 0.85, name: 'Dresser', surface: { z: 0.85, rect: [0.38, 0.03, 1.17, 0.47] },
    spots: { f: { stand: [0.6, 0.95], dir: [0, -1], tag: 'dresser' } } },
  nightstand: { W: 0.45, D: 0.45, h: 0.75, name: 'Nightstand', light: { at: [0.22, 0.22, 0.8], r: 100 } },
  counter: { W: 2.8, D: 0.8, h: 1.1, fixed: true, name: 'Kitchen counter', skins: { arcade: { name: 'Coin-op counter', material: 'laminate', theme: 'arcade', cols: ['#1E1A2E', '#F4C430', '#19E6F0'] }, cuddle: { name: 'Cloud counter', material: 'laminate', theme: 'cuddle', cols: ['#FFFFFF', '#AEDDF7', '#F6B7CC'] }, provence: { name: 'Whitewashed pine counter', material: 'wood', theme: 'provence', cols: ['#E8DCC4', '#D9D2C2', '#3A3A40'] }, adobe: { name: 'Adobe and saltillo counter', material: 'stone', theme: 'adobe', cols: ['#D9A47A', '#9C7046', '#3FA7A0'] }, neon: { name: 'Steel mesh counter', material: 'metal', theme: 'neon', cols: ['#111118', '#19E6F0', '#3A3F4A'] }, candy: { name: 'Scalloped mint counter', material: 'laminate', theme: 'candy', cols: ['#BFE8D6', '#FFF8F0', '#F6B7CC'] }, gothic: { name: 'Ebony and brass counter', material: 'wood', theme: 'gothic', cols: ['#2A2224', '#B08D57', '#2C2B2F'] }, riad: { name: 'Zellige and cedar counter', material: 'stone', theme: 'riad', cols: ['#F3EEE4', '#2E4C9A', '#8A5A3A'] }, tropical: { name: 'Bamboo-slat counter', material: 'wood', theme: 'tropical', cols: ['#D9BE82', '#8A5A3A', '#F7F1E3'] }, memphis: { name: 'Squiggle counter', material: 'laminate', theme: 'memphis', cols: ['#F4F1EA', '#1B1A1F', '#F4C430'] }, deco: { name: 'Black lacquer and gold counter', material: 'stone', theme: 'deco', cols: ['#1B1A1F', '#C9A24A', '#1F5E4A'] }, japandi: { name: 'Walnut and stone counter', material: 'wood', theme: 'japandi', cols: ['#4A3A2E', '#6B5444', '#B9B4AC'] }, boho: { name: 'Rattan-front counter', material: 'wood', theme: 'boho', cols: ['#D2B48C', '#A8865A', '#C9B28A'] }, space: { name: 'Moulded pod counter', material: 'laminate', theme: 'space', cols: ['#F4F6F8', '#1B1A24', '#D5DAE0'] }, scandi: { name: 'Ash slab counter', material: 'wood', theme: 'scandi', cols: ['#D8C7A8', '#E3D6BD', '#C9B693'] }, industrial: { name: 'Concrete and steel counter', material: 'stone', theme: 'industrial', cols: ['#2B2B30', '#4A4D52', '#7B4A3A'] }, beach: { name: 'Whitewashed shiplap counter', material: 'wood', theme: 'beach', cols: ['#F7F5EF', '#DDE8EA', '#E8DCC2'] }, retro: { name: 'Diner counter', material: 'laminate', theme: 'retro', cols: ['#9ED8C6', '#F3B6C4', '#F6E3A1'] }, farmhouse: { name: 'Butcher-block counter', material: 'wood', theme: 'farmhouse', cols: ['#F1E8D2', '#B9CBB5', '#9DB3C6'] }, modern: { name: 'Slab counter', material: 'stone', theme: 'modern', cols: ['#2B2B30', '#E8EAEC', '#5E646B'] }, spring: { name: 'Potting-bench counter', material: 'wood', theme: 'spring', cols: ['#CFE6D3', '#F3D6DC', '#F6EBC0'] }, summer: { name: 'Lemonade-stand counter', material: 'wood', theme: 'summer', cols: ['#7FD1CF', '#F6D56E', '#F2A38A'] }, fall: { name: 'Harvest counter', material: 'wood', theme: 'fall', cols: ['#8A5E3B', '#B5532F', '#3F5B4C'] }, winter: { name: 'Evergreen counter', material: 'wood', theme: 'winter', cols: ['#3F5B4C', '#8E1F2F', '#2E3B57'] }, cloud: { name: 'Candy-cloud counter', material: 'wood', theme: 'cloud', cols: ['#F9C6DA', '#BFE3F5', '#FFF2B8'] } },
    spots: { sink: { stand: [0.65, 1.23], dir: [0, -1], tag: 'sink', group: 'counterL' }, window: { stand: [0.95, 1.23], dir: [0, -1], tag: 'window', group: 'counterL' }, stove: { stand: [1.65, 1.23], dir: [0, -1], tag: 'stove' }, coffee: { stand: [2.45, 1.23], dir: [0, -1], tag: 'coffee' } } },
  fridge: { W: 0.9, D: 0.85, h: 1.95, fixed: true, name: 'Fridge', skins: { arcade: { name: 'Cabinet fridge', material: 'metal', theme: 'arcade', cols: ['#1E1A2E', '#F4C430', '#FF2E9A'] }, cuddle: { name: 'Rainbow bear fridge', material: 'metal', theme: 'cuddle', cols: ['#AEDDF7', '#FFFFFF', '#F6B7CC'] }, provence: { name: 'Lavender enamel fridge', material: 'metal', theme: 'provence', cols: ['#F4EFE3', '#8E7CC3', '#3A3A40'] }, adobe: { name: 'Turquoise serape fridge', material: 'metal', theme: 'adobe', cols: ['#3FA7A0', '#B5533C', '#F4ECD8'] }, neon: { name: 'Holo fridge', material: 'metal', theme: 'neon', cols: ['#111118', '#FF2E9A', '#19E6F0'] }, candy: { name: 'Bow fridge', material: 'metal', theme: 'candy', cols: ['#F6B7CC', '#FFF8F0', '#BFE8D6'] }, gothic: { name: 'Stained-glass icebox', material: 'metal', theme: 'gothic', cols: ['#2A2224', '#B08D57', '#5E1F2A'] }, riad: { name: 'Zellige fridge', material: 'metal', theme: 'riad', cols: ['#F3EEE4', '#2E4C9A', '#C9A24A'] }, tropical: { name: 'Palm fridge', material: 'metal', theme: 'tropical', cols: ['#2F6B40', '#F08AA0', '#D9BE82'] }, memphis: { name: 'Squiggle fridge', material: 'metal', theme: 'memphis', cols: ['#F4F1EA', '#1B1A1F', '#E63946'] }, deco: { name: 'Lacquered icebox', material: 'metal', theme: 'deco', cols: ['#1B1A1F', '#1F5E4A', '#6E2A3A'] }, japandi: { name: 'Paper-white fridge', material: 'metal', theme: 'japandi', cols: ['#F7F3EA', '#B9B4AC', '#7A8A6A'] }, boho: { name: 'Terracotta fridge', material: 'metal', theme: 'boho', cols: ['#C26B4A', '#D9A84A', '#3D6B73'] }, space: { name: 'Capsule fridge', material: 'metal', theme: 'space', cols: ['#F4F6F8', '#1B1A24', '#F26A2E'] }, scandi: { name: 'Ash-handled fridge', material: 'metal', theme: 'scandi', cols: ['#F4F2EC', '#DDE3DF', '#F1E6D8'] }, industrial: { name: 'Riveted steel fridge', material: 'metal', theme: 'industrial', cols: ['#5A5E66', '#2B2B30', '#7B4A3A'] }, beach: { name: 'Sea-glass fridge', material: 'metal', theme: 'beach', cols: ['#7FB8C9', '#F7F5EF', '#E8907A'] }, retro: { name: 'Pastel icebox', material: 'metal', theme: 'retro', cols: ['#9ED8C6', '#F3B6C4', '#F6E3A1'] }, farmhouse: { name: 'Cream enamel icebox', material: 'metal', theme: 'farmhouse', cols: ['#F1E8D2', '#B9CBB5', '#F2DFA0'] }, modern: { name: 'Brushed steel fridge', material: 'metal', theme: 'modern', cols: ['#B9BEC3', '#2B2B30', '#E8EAEC'] }, spring: { name: 'Blossom icebox', material: 'metal', theme: 'spring', cols: ['#F3D6DC', '#CFE6D3', '#F6EBC0'] }, summer: { name: 'Sunny icebox', material: 'metal', theme: 'summer', cols: ['#F6D56E', '#7FD1CF', '#F2A38A'] }, fall: { name: 'Harvest icebox', material: 'metal', theme: 'fall', cols: ['#B5532F', '#D9A84A', '#8A5E3B'] }, winter: { name: 'Frosted icebox', material: 'metal', theme: 'winter', cols: ['#E3EEF6', '#C8D9E6', '#F2EEE8'] }, cloud: { name: 'Cloud-nine icebox', material: 'metal', theme: 'cloud', cols: ['#BFE3F5', '#F9C6DA', '#C9F0DC'] } },
    spots: { f: { stand: [0.45, 1.45], dir: [0, -1], tag: 'fridge' } } },
  // V2 models: the same jobs in new shapes, so a room can mix sizes. Each has its own looks, drawn for its shape.
  // The fridge's: low and wide, and the lid lifts on its back hinge.
  chestfreezer: { kind: 'fridge', W: 1.2, D: 0.75, h: 0.92, fixed: true, name: 'Chest freezer', skins: { camp: { name: 'Camp cooler chest', material: 'metal', theme: 'camp', cols: ['#2F5D43', '#B5532F', '#3F6E8C'] } },
    spots: { f: { stand: [0.6, 1.3], dir: [0, -1], tag: 'fridge' } } },
  tvunit: { W: 1.6, D: 0.45, h: 0.75, fixed: true, name: 'TV unit', surface: { z: 0.42, rect: [0.3, 0.02, 1.3, 0.44] } },
  // The TV unit's: a long, low console under the screen on the wall.
  mediaconsole: { kind: 'tvunit', W: 2.0, D: 0.5, h: 0.5, fixed: true, name: 'Media console', surface: { z: 0.5, rect: [0.04, 0.03, 1.96, 0.47] }, skins: { midcentury: { name: 'Walnut credenza', material: 'wood', theme: 'midcentury', cols: ['#D9A84A', '#3D6B73', '#C2603A'] } } },
  shower: { W: 1.18, D: 1.18, h: 2.1, fixed: true, name: 'Shower',
    spots: { s: { stand: [0.6, 1.7], pos: [0.6, 0.6, 0.1], dir: [0, 1], tag: 'shower', base: 'tray' } } },
  toilet: { W: 0.42, D: 0.62, h: 0.8, fixed: true, name: 'Toilet' },
  vanity: { W: 1.0, D: 0.5, h: 0.95, fixed: true, name: 'Vanity',
    spots: { m: { stand: [0.5, 0.95], dir: [0, -1], tag: 'mirror' } } },
  flightY: { W: 1, D: 3.16, h: 2.7, fixed: true, name: 'Stairs' },
  flightX: { W: 3.16, D: 1, h: 2.7, fixed: true, name: 'Stairs' },
  holeY: { W: 1, D: 2.0, h: 1.0, fixed: true, name: 'Floor opening' },
  holeX: { W: 2.0, D: 1, h: 1.0, fixed: true, name: 'Floor opening' },
  waterheater: { W: 0.7, D: 0.7, h: 1.7, fixed: true, name: 'Water heater' },
  furnace: { W: 0.85, D: 1.0, h: 1.75, fixed: true, name: 'Furnace' },
  laundry: { W: 1.5, D: 0.75, h: 1.05, fixed: true, name: 'Washer and dryer',
    spots: { w: { stand: [0.37, 1.25], dir: [0, -1], tag: 'washer' } } },
  shelves: { W: 1.6, D: 0.5, h: 1.85, name: 'Storage shelves',
    spots: { r: { stand: [0.8, 1.0], dir: [0, -1], tag: 'rummage' } } },
  boxes: { W: 0.9, D: 0.6, h: 0.9, name: 'Moving boxes' },
  pbox: { W: 0.62, D: 0.52, h: 0.62, name: 'Moving box' },
  /** Groceries at the door, and what is inside once opened: carried to the fridge in Arrange. */
  bag: { W: 0.42, D: 0.36, h: 0.52, name: 'Grocery bag' },
  food: { W: 0.5, D: 0.42, h: 0.38, name: 'Groceries' },
  tree: { W: 1.4, D: 1.4, h: 4, fixed: true, name: 'Maple tree', blocks: [[0.5, 0.5, 0.9, 0.9]] },
  garden: { W: 2.0, D: 1.0, h: 0.7, name: 'Garden bed',
    spots: { t: { stand: [1.0, 1.5], dir: [0, -1], tag: 'garden' } } },
  sprinkler: { W: 0.4, D: 0.4, h: 0.3, name: 'Sprinkler',
    spots: { s: { stand: [0.2, 0.9], dir: [0, -1], tag: 'sprinkler' } } },
  fireplace: { W: 1.3, D: 0.55, h: 2.6, fixed: true, name: 'Fireplace', light: { at: [0.65, 0.6, 0.5], r: 160, col: '255,150,70' },
    spots: { f: { stand: [0.65, 1.25], dir: [0, -1], tag: 'fireside' } } },
  bathtub: { W: 1.6, D: 0.8, h: 0.7, fixed: true, name: 'Clawfoot tub',
    spots: { b: { stand: [0.8, 1.3], pos: [0.8, 0.4, 0.35], dir: [0, 1], tag: 'tub', base: 'basin' } } },
  bar: { W: 1.8, D: 0.6, h: 1.2, fixed: true, name: 'Basement bar',
    spots: { s: { stand: [0.9, 1.15], dir: [0, -1], tag: 'bar' } } },
  pool: { W: 3.2, D: 2.0, h: 0.2, fixed: true, name: 'Pool',
    spots: { w: { stand: [1.6, 2.45], pos: [1.6, 1.0, 0.0], dir: [0, 1], tag: 'swim', base: 'water' } } },
  daybed: { W: 1.9, D: 0.9, h: 0.8, name: 'Guest daybed', store: true },
  snowman: { W: 0.6, D: 0.6, h: 1.4, name: 'Snowman' },
  bench: { W: 1.6, D: 0.6, h: 0.9, name: 'Garden bench', store: true,
    spots: { s1: { stand: [0.45, 1.05], pos: [0.45, 0.32, 0.48], dir: [0, 1], tag: 'seat', base: 'seat' }, s2: { stand: [1.15, 1.05], pos: [1.15, 0.32, 0.48], dir: [0, 1], tag: 'seat', base: 'seat' } } },
  bowl: { W: 0.5, D: 0.4, h: 0.2, name: 'Pet bowls',
    spots: { fill: { stand: [0.25, 0.9], dir: [0, -1], tag: 'bowl' } } },
  petbed: { W: 0.8, D: 0.7, h: 0.3, name: 'Pet bed',
    spots: { rest: { stand: [0.4, 1.1], dir: [0, -1], tag: 'petbed' } } },
  litter: { W: 0.7, D: 0.55, h: 0.35, name: 'Litter box',
    spots: { scoop: { stand: [0.35, 1.0], dir: [0, -1], tag: 'litter' } } },
  arclamp: { W: 1.2, D: 0.5, h: 1.9, name: 'Arc lamp', store: true, blocks: [[0, 0.05, 0.45, 0.45]], light: { at: [1.04, 0.25, 1.45], r: 150 } },
  armchair: { W: 0.95, D: 0.9, h: 0.95, name: 'Armchair', store: true, cols: ['#4F6F74', '#B5476E', '#C9A24A', '#8E9C96', '#3A3340', '#E8DCC8', '#A65D3F'],
    spots: { s: { stand: [0.48, 1.45], pos: [0.48, 0.52, 0.5], dir: [0, 1], tag: 'seat', base: 'base' } } },
  loveseat: { W: 1.7, D: 0.92, h: 0.95, name: 'Loveseat', store: true, cols: ['#8E5468', '#4A5DA8', '#5E8187', '#C9B79C', '#3F5B4C', '#D9A84A'],
    spots: { s1: { stand: [0.5, 1.5], pos: [0.5, 0.56, 0.48], dir: [0, 1], tag: 'seat', base: 'base' }, s2: { stand: [1.2, 1.5], pos: [1.2, 0.56, 0.48], dir: [0, 1], tag: 'seat', base: 'base' } } },
  beanbag: { W: 0.85, D: 0.85, h: 0.6, name: 'Bean bag', store: true, cols: ['#D24A7A', '#E0A43A', '#3D6B73', '#7FB069', '#2B2B30', '#F2EEE8'],
    spots: { s: { stand: [0.42, 1.4], pos: [0.42, 0.5, 0.3], dir: [0, 1], tag: 'seat', base: 'base' } } },
  rocker: { W: 0.8, D: 0.95, h: 1.15, name: 'Rocking chair', store: true, cols: ['#8A5E3B', '#3A2E2A', '#F2EEE8', '#3F5B4C'],
    spots: { s: { stand: [0.4, 1.5], pos: [0.4, 0.55, 0.52], dir: [0, 1], tag: 'seat', base: 'base' } } },
  accent: { W: 0.72, D: 0.72, h: 0.9, name: 'Accent chair', store: true, cols: ['#E0A43A', '#B5476E', '#5E8187', '#F2EEE8', '#2B2B30'],
    spots: { s: { stand: [0.36, 1.25], pos: [0.36, 0.42, 0.5], dir: [0, 1], tag: 'seat', base: 'seat' } } },
  ottoman: { W: 0.6, D: 0.6, h: 0.42, name: 'Ottoman', store: true, cols: ['#C9A24A', '#8E5468', '#4F6F74', '#E8DCC8', '#3A3340'] , surface: { z: 0.42, rect: [0.05, 0.05, 0.55, 0.55] } },
  coffeetable: { W: 1.2, D: 0.65, h: 0.45, name: 'Coffee table', store: true, cols: ['#9C6B45', '#3A2E2A', '#E4DDD2', '#B98A6A'] , surface: { z: 0.45, rect: [0.08, 0.06, 1.12, 0.59] } },
  sidetable: { W: 0.5, D: 0.5, h: 0.62, name: 'Side table', store: true, cols: ['#B98A6A', '#3A2E2A', '#F2EEE8', '#3F5B4C'] , surface: { z: 0.62, rect: [0.05, 0.05, 0.45, 0.45] } },
  console: { wall: true, W: 1.3, D: 0.38, h: 0.85, name: 'Console table', store: true, cols: ['#3A2E2A', '#9C6B45', '#E4DDD2', '#C9A24A'] , surface: { z: 0.85, rect: [0.05, 0.04, 1.25, 0.34] } },
  cabinet: { wall: true, W: 1.0, D: 0.45, h: 1.05, name: 'Cabinet', store: true, cols: ['#B98A6A', '#3F5B4C', '#2E3B57', '#F2EEE8', '#8E5468'] },
  wardrobe: { wall: true, W: 1.2, D: 0.6, h: 2.05, name: 'Wardrobe', store: true, cols: ['#E4DDD2', '#9C6B45', '#3A2E2A', '#8E9C96'] },
  cubeshelf: { wall: true, W: 1.0, D: 0.35, h: 1.0, name: 'Cube shelf', store: true, cols: ['#F2EEE8', '#2B2B30', '#B98A6A'] },
  // The rugs the house comes with (they used to be painted on the floor): pieces like any other, so they can be moved, stored or carried upstairs.
  rugwide: { W: 3.3, D: 1.9, h: 0.02, name: 'Living room rug', rug: true, blocks: [], cols: ['#B5476E', '#3D6B73', '#C9A24A', '#E8DCC8', '#2E3B57', '#7FB069'] },
  rugsquare: { W: 2.0, D: 2.1, h: 0.02, name: 'Bedroom rug', rug: true, blocks: [], cols: ['#C8B6C9', '#B5476E', '#3D6B73', '#E8DCC8'] },
  rugrect: { W: 2.4, D: 1.6, h: 0.02, name: 'Area rug', store: true, rug: true, blocks: [], cols: ['#B5476E', '#3D6B73', '#C9A24A', '#E8DCC8', '#2E3B57', '#7FB069'] },
  rugrunner: { W: 2.8, D: 0.8, h: 0.02, name: 'Runner rug', store: true, rug: true, blocks: [], cols: ['#A63A2C', '#4A5DA8', '#D8C9AE', '#3F5B4C'] },
  ruground: { W: 1.8, D: 1.8, h: 0.02, name: 'Round rug', store: true, rug: true, blocks: [], cols: ['#E8DCC8', '#D24A7A', '#8E9C96', '#2B2B30', '#E0A43A'] },
  floormirror: { wall: true, W: 0.7, D: 0.18, h: 1.8, name: 'Floor mirror', store: true, cols: ['#C9A24A', '#2B2B30', '#F2EEE8', '#9C6B45'] },
  gclock: { wall: true, W: 0.55, D: 0.38, h: 2.1, name: 'Grandfather clock', store: true, cols: ['#5A3E2E', '#2B2B30', '#E4DDD2'] },
  pampas: { W: 0.42, D: 0.42, h: 1.4, name: 'Pampas vase', store: true, cols: ['#E8DCC8', '#2B2B30', '#C27A5A', '#9EC1C9'] },
  // Small things that sit on a table or a shelf as well as on the floor.
  flowervase: { W: 0.3, D: 0.3, h: 0.55, name: 'Flower vase', store: true, small: true, cols: ['#F2EEE8', '#2B2B30', '#C27A5A', '#9EC1C9'] },
  succulents: { W: 0.35, D: 0.35, h: 0.3, name: 'Succulent pots', store: true, small: true, cols: ['#C27A5A', '#E4DDD2', '#2B2B30'] },
  desklamp: { W: 0.3, D: 0.3, h: 0.55, name: 'Desk lamp', store: true, small: true, cols: ['#2B2B30', '#C9A24A', '#E4DDD2', '#B5476E'], light: { at: [0.15, 0.15, 0.5], r: 90 } },
  photoframes: { W: 0.4, D: 0.15, h: 0.3, name: 'Photo frames', store: true, small: true, cols: ['#9C6B45', '#2B2B30', '#C9A24A', '#E4DDD2'] },
  // Small things that make a room look lived in.
  candles: { W: 0.5, D: 0.4, h: 0.5, name: 'Pillar candles', store: true, small: true, cols: ['#F2EEE8', '#C9A24A', '#B5476E', '#3F5B4C'], light: { at: [0.25, 0.2, 0.4], r: 70, col: '255,190,110' } },
  basket: { W: 0.8, D: 0.8, h: 0.55, name: 'Blanket basket', store: true, cols: ['#B98A6A', '#3A2E2A', '#E4DDD2'] },
  coatrack: { W: 0.45, D: 0.45, h: 1.8, name: 'Coat rack', store: true, cols: ['#2B2B30', '#7A4E32', '#C9A24A'] },
  bookstack: { W: 0.45, D: 0.35, h: 0.5, name: 'Stacked books', store: true, small: true, cols: ['#B5476E', '#3F5B4C', '#2E3B57', '#C9A24A'] },
  eucalyptus: { W: 0.42, D: 0.42, h: 1.7, name: 'Eucalyptus vase', store: true, cols: ['#F2EEE8', '#2B2B30', '#C27A5A', '#9EC1C9'] },
  bust: { W: 0.5, D: 0.5, h: 1.5, name: 'Bust on a pedestal', store: true, cols: ['#E8DCC8', '#2B2B30', '#9C6B45'] },
  tablelamp: { W: 0.5, D: 0.5, h: 1.15, name: 'Lamp table', store: true, cols: ['#9C6B45', '#2B2B30', '#E4DDD2', '#3F5B4C'], light: { at: [0.25, 0.25, 1.0], r: 120 } },
  candelabra: { W: 0.4, D: 0.4, h: 1.5, name: 'Candelabra', store: true, cols: ['#C9A24A', '#2B2B30', '#B9B4AC'], light: { at: [0.2, 0.2, 1.4], r: 100, col: '255,190,110' } },
  blanketladder: { W: 0.7, D: 0.25, h: 1.6, name: 'Blanket ladder', store: true, cols: ['#B98A6A', '#3A2E2A', '#E4DDD2'] },
  plantstand: { W: 0.5, D: 0.5, h: 1.15, name: 'Plant stand', store: true, cols: ['#9C6B45', '#2B2B30', '#E4DDD2'] },
  woodstool: { W: 0.45, D: 0.45, h: 0.55, name: 'Wooden stool', store: true, cols: ['#B98A6A', '#3A2E2A', '#E4DDD2', '#7A4E32'] },
  umbrella: { W: 0.4, D: 0.4, h: 0.8, name: 'Umbrella stand', store: true, cols: ['#2B2B30', '#7A4E32', '#3F5B4C', '#B5476E'] },
  lantern: { W: 0.36, D: 0.36, h: 0.65, name: 'Floor lantern', store: true, cols: ['#2B2B30', '#C9A24A', '#F2EEE8'], light: { at: [0.18, 0.18, 0.3], r: 95 } },
  fern: { W: 0.55, D: 0.55, h: 1.0, name: 'Fern', store: true, cols: ['#C26B4A', '#E4DDD2', '#2B2B30', '#7FA7C9'],
    spots: { w: { stand: [0.27, 1.05], dir: [0, -1], tag: 'water' } } },
  cactus: { W: 0.45, D: 0.45, h: 1.3, name: 'Cactus', store: true, cols: ['#E8C9A0', '#C26B4A', '#F2EEE8'],
    spots: { w: { stand: [0.22, 0.95], dir: [0, -1], tag: 'water' } } },
  fiddle: { W: 0.6, D: 0.6, h: 1.9, name: 'Fiddle leaf fig', store: true, cols: ['#F2EEE8', '#C26B4A', '#2B2B30', '#C9A24A'],
    spots: { w: { stand: [0.3, 1.1], dir: [0, -1], tag: 'water' } } },
  snake: { W: 0.45, D: 0.45, h: 1.1, name: 'Snake plant', store: true, cols: ['#2B2B30', '#F2EEE8', '#C26B4A', '#9EC1C9'],
    spots: { w: { stand: [0.22, 0.95], dir: [0, -1], tag: 'water' } } },
  palm: { W: 0.7, D: 0.7, h: 1.9, name: 'Parlor palm', store: true, cols: ['#E8C9A0', '#C26B4A', '#2B2B30'],
    spots: { w: { stand: [0.35, 1.2], dir: [0, -1], tag: 'water' } } },
  aquarium: { wall: true, W: 1.2, D: 0.45, h: 1.35, name: 'Aquarium', store: true, cols: ['#2B2B30', '#9C6B45', '#F2EEE8'], light: { at: [0.6, 0.22, 1.0], r: 70, col: '120,190,255' },
    spots: { a: { stand: [0.6, 1.0], dir: [0, -1], tag: 'aquarium' } } },
  piano: { wall: true, W: 1.5, D: 1.1, h: 1.25, name: 'Upright piano', store: true, cols: ['#1B1A1F', '#5A3E2E', '#F2EEE8'],
    spots: { p: { stand: [0.75, 1.6], pos: [0.75, 0.95, 0.45], dir: [0, -1], tag: 'piano', base: 'bench' } } },
  easel: { W: 0.8, D: 0.6, h: 1.75, name: 'Art easel', store: true, cols: ['#B98A6A', '#2B2B30', '#F2EEE8'],
    spots: { e: { stand: [0.4, 1.15], dir: [0, -1], tag: 'easel' } } },
  telescope: { W: 0.6, D: 0.6, h: 1.45, name: 'Telescope', store: true, cols: ['#F2EEE8', '#2B2B30', '#C9A24A'],
    spots: { s: { stand: [0.3, 1.1], dir: [0, -1], tag: 'stars' } } },
  punchbag: { W: 0.8, D: 0.8, h: 2.1, name: 'Heavy bag', store: true, cols: ['#C2413A', '#2B2B30', '#4A5DA8'],
    spots: { b: { stand: [0.4, 1.25], dir: [0, -1], tag: 'boxbag' } } },
  bike: { W: 1.3, D: 0.55, h: 1.15, name: 'Exercise bike', store: true, cols: ['#2B2B30', '#F2EEE8', '#C2413A'],
    spots: { r: { stand: [-0.4, 0.28], pos: [0.45, 0.27, 0.62], dir: [1, 0], tag: 'bike', base: 'seat' } } },
  yogamat: { W: 1.8, D: 0.7, h: 0.02, name: 'Yoga mat', store: true, rug: true, blocks: [], cols: ['#8E5468', '#7FB069', '#4A88B8', '#E0A43A', '#2B2B30'],
    spots: { y: { stand: [0.9, 0.35], dir: [0, 1], tag: 'stretch' } } },
  massage: { W: 0.95, D: 1.15, h: 1.15, name: 'Massage chair', store: true, cols: ['#2B2B30', '#E8DCC8', '#6E3C50'],
    spots: { m: { stand: [0.47, 1.7], pos: [0.47, 0.6, 0.52], dir: [0, 1], tag: 'massage', base: 'base' } } },
  barcart: { W: 0.9, D: 0.5, h: 0.95, name: 'Bar cart', store: true, cols: ['#C9A24A', '#2B2B30', '#C9CED6'],
    spots: { b: { stand: [0.45, 1.0], dir: [0, -1], tag: 'bar' } } },
  guitar: { W: 0.5, D: 0.4, h: 1.1, name: 'Guitar on a stand', store: true, cols: ['#C27A4A', '#1B1A1F', '#C2413A', '#F2EEE8'],
    spots: { g: { stand: [0.25, 0.95], dir: [0, -1], tag: 'guitar' } } },
  cattree: { W: 0.8, D: 0.8, h: 1.7, name: 'Cat tree', store: true, cols: ['#D8C9AE', '#8E9C96', '#6E3C50'] },
  hammock: { W: 2.4, D: 1.0, h: 1.3, name: 'Hammock', store: true, out: true, cols: ['#E0A43A', '#3D6B73', '#D24A7A', '#F2EEE8'],
    spots: { h: { stand: [1.2, 1.5], pos: [0.65, 0.5, 0.62], lie: [1, 0], tag: 'hammock', base: 'bed' } } },
  firepit: { W: 1.2, D: 1.2, h: 0.4, name: 'Fire pit', store: true, out: true, cols: ['#8C8884', '#A85A40', '#3A3A3F'], light: { at: [0.6, 0.6, 0.4], r: 150, col: '255,150,70' },
    spots: { f: { stand: [0.6, 1.7], dir: [0, -1], tag: 'fireside' } } },
  grill: { W: 0.9, D: 0.6, h: 1.1, name: 'Charcoal grill', store: true, out: true, cols: ['#1B1A1F', '#C2413A', '#3D6B73'],
    spots: { g: { stand: [0.45, 1.1], dir: [0, -1], tag: 'grill' } } },
  patio: { W: 1.8, D: 1.3, h: 0.95, name: 'Patio set', store: true, out: true, cols: ['#F2EEE8', '#2B2B30', '#3F5B4C', '#C27A5A'],
    spots: { s1: { stand: [0.28, 1.6], pos: [0.3, 0.65, 0.42], dir: [1, 0], tag: 'seat', base: 'seatA' }, s2: { stand: [1.52, 1.6], pos: [1.5, 0.65, 0.42], dir: [-1, 0], tag: 'seat', base: 'seatB' } } },
  birdfeeder: { W: 0.5, D: 0.5, h: 1.7, name: 'Bird feeder', store: true, out: true, cols: ['#9C6B45', '#F2EEE8', '#3F5B4C'],
    spots: { b: { stand: [0.25, 1.15], dir: [0, -1], tag: 'birds' } } },
  xmastree: { W: 0.95, D: 0.95, h: 2.1, name: 'Holiday tree', store: true, cols: ['#2F6B40', '#F2EEE8'], light: { at: [0.47, 0.47, 1.0], r: 120, col: '255,210,140' } },
  pumpkins: { W: 0.85, D: 0.6, h: 0.5, name: 'Pumpkin trio', store: true, cols: ['#E07A2B', '#F2EEE8'], light: { at: [0.55, 0.32, 0.2], r: 55, col: '255,170,80' } },
  beachchair: { W: 0.7, D: 1.3, h: 0.8, name: 'Beach chair', store: true, out: true, cols: ['#5FB8D6', '#E0A43A', '#D24A7A'],
    spots: { s: { stand: [0.35, 1.75], pos: [0.35, 0.6, 0.3], dir: [0, 1], tag: 'seat', base: 'base' } } },
  blossomvase: { W: 0.45, D: 0.45, h: 1.6, name: 'Cherry blossom branches', store: true, cols: ['#F2EEE8', '#2B2B30', '#9EC1C9'] },
  rugarcade: { W: 2.4, D: 1.6, h: 0.02, name: 'Arcade rug', store: true, rug: true, blocks: [], cols: ['#2B2459', '#15121F', '#3A2E73'] },
  cartridges: { W: 0.45, D: 0.35, h: 0.3, name: 'Game cartridges', store: true, small: true, cols: ['#F4C430', '#E63946', '#39D353', '#7A5CFF'] },
  pinball: { W: 0.75, D: 1.5, h: 1.9, name: 'Pinball machine', store: true, cols: ['#E63946', '#1E1A2E', '#2E6BD6', '#F4C430'], light: { at: [0.375, 0.3, 1.5], r: 70, col: '244,196,48' },
    spots: { p: { stand: [0.375, 1.95], dir: [0, -1], tag: 'pinball' } } },
  rugcloud: { W: 2.2, D: 1.6, h: 0.02, name: 'Cloud rug', store: true, rug: true, blocks: [], cols: ['#FFFFFF', '#F6EEF2', '#DCEEFA'] },
  rugneon: { W: 2.4, D: 1.6, h: 0.02, name: 'Grid rug', store: true, rug: true, blocks: [], cols: ['#111118', '#1E2230', '#2A2F3A'] },
  plushpile: { W: 0.8, D: 0.7, h: 0.5, name: 'Plush pile', store: true, small: true, cols: ['#F6B7CC', '#9CCBF2', '#F9E27A', '#C7A8F0'] },
  serverstack: { W: 0.45, D: 0.45, h: 0.45, name: 'Server stack', store: true, small: true, cols: ['#111118', '#3A3F4A', '#1E2230'] },
  cloudswing: { W: 1.2, D: 1.0, h: 2.0, name: 'Cloud swing', store: true, cols: ['#F6B7CC', '#AEDDF7', '#C7A8F0', '#F9E27A'], light: { at: [0.6, 0.5, 1.7], r: 60, col: '255,241,201' },
    spots: { s: { stand: [0.6, 1.5], pos: [0.6, 0.5, 0.5], dir: [0, 1], tag: 'swing', base: 'seat' } } },
  vrpod: { W: 1.0, D: 1.6, h: 1.3, name: 'VR pod', store: true, cols: ['#111118', '#FF2E9A', '#7A5CFF', '#19E6F0'], light: { at: [0.5, 0.8, 1.0], r: 70, col: '25,230,240' },
    spots: { s: { stand: [0.5, 2.0], pos: [0.5, 0.8, 0.45], dir: [0, 1], tag: 'vr', base: 'seat' } } },
  ruggothic: { W: 2.4, D: 1.6, h: 0.02, name: 'Damask rug', store: true, rug: true, blocks: [], cols: ['#5E1F2A', '#2E3B57', '#3B2541'] },
  rugcandy: { W: 1.8, D: 1.8, h: 0.02, name: 'Lollipop rug', store: true, rug: true, blocks: [], cols: ['#F6B7CC', '#BFE8D6', '#D6C4F0'] },
  rugtropical: { W: 2.4, D: 1.6, h: 0.02, name: 'Palm rug', store: true, rug: true, blocks: [], cols: ['#F7F1E3', '#F0E6C8', '#D9BE82'] },
  grimoires: { W: 0.38, D: 0.33, h: 0.3, name: 'Grimoires', store: true, small: true, cols: ['#5E1F2A', '#2A2224', '#2E3B57'] },
  candyjars: { W: 0.5, D: 0.36, h: 0.4, name: 'Candy jars', store: true, small: true, cols: ['#F6B7CC', '#BFE8D6', '#D6C4F0'] },
  coconuts: { W: 0.45, D: 0.35, h: 0.35, name: 'Coconut drinks', store: true, small: true, cols: ['#6B4A35', '#8A5A3A'] },
  fortuneteller: { W: 0.8, D: 0.6, h: 1.9, name: 'Fortune-telling machine', store: true, cols: ['#5E1F2A', '#2A2224', '#2E3B57', '#3B2541'], light: { at: [0.4, 0.4, 1.0], r: 60, col: '201,162,74' },
    spots: { f: { stand: [0.4, 1.05], dir: [0, -1], tag: 'fortune' } } },
  gumball: { W: 0.5, D: 0.5, h: 1.3, name: 'Gumball machine', store: true, cols: ['#E04A6A', '#F6B7CC', '#BFE8D6', '#2E6BD6'], light: { at: [0.25, 0.25, 0.8], r: 40, col: '255,210,225' },
    spots: { g: { stand: [0.25, 0.95], dir: [0, -1], tag: 'gumball' } } },
  tikibar: { W: 2.0, D: 0.8, h: 2.0, name: 'Tiki bar', store: true, cols: ['#D9BE82', '#8A5A3A', '#D2B48C'], light: { at: [1.0, 0.4, 1.4], r: 110, col: '255,190,90' },
    spots: { t: { stand: [1.0, 1.25], dir: [0, -1], tag: 'tiki' } } },
  clawmachine: { W: 0.7, D: 0.6, h: 1.7, name: 'Claw machine', store: true, cols: ['#FF2E9A', '#19E6F0', '#F4C430', '#7A5CFF'], light: { at: [0.35, 0.3, 1.2], r: 60, col: '255,46,154' },
    spots: { c: { stand: [0.35, 1.05], dir: [0, -1], tag: 'claw' } } },
  jukebox: { W: 0.8, D: 0.5, h: 1.45, name: 'Jukebox', store: true, cols: ['#C2413A', '#4A5DA8', '#E0A43A'], light: { at: [0.4, 0.5, 1.0], r: 70, col: '255,140,200' },
    spots: { j: { stand: [0.4, 1.0], dir: [0, -1], tag: 'jukebox' } } },
  eggchair: { W: 1.0, D: 1.0, h: 2.0, name: 'Hanging egg chair', store: true, cols: ['#E8DCC8', '#2B2B30', '#C27A5A'],
    spots: { s: { stand: [0.5, 1.45], pos: [0.5, 0.55, 0.62], dir: [0, 1], tag: 'seat', base: 'base' } } },
  lavalamp: { W: 0.3, D: 0.3, h: 0.65, name: 'Lava lamp', store: true, cols: ['#FF7A3A', '#7A5CFF', '#38D39F'], light: { at: [0.15, 0.15, 0.35], r: 70 } },
  chesterfield: { W: 2.0, D: 0.95, h: 0.9, name: 'Chesterfield sofa', store: true, cols: ['#5A2E1E', '#2E3B57', '#3F5B4C', '#6E3C50'],
    spots: { s1: { stand: [0.6, 1.5], pos: [0.6, 0.58, 0.5], dir: [0, 1], tag: 'seat', base: 'base' }, s2: { stand: [1.4, 1.5], pos: [1.4, 0.58, 0.5], dir: [0, 1], tag: 'seat', base: 'base' } } },
  globe: { W: 0.5, D: 0.5, h: 1.15, name: 'Antique globe', store: true, cols: ['#9C6B45', '#2B2B30'] },
  trunk: { W: 0.9, D: 0.55, h: 0.55, name: 'Steamer trunk', store: true, cols: ['#7A4E32', '#2E3B57', '#3F5B4C', '#8E5468'] },
  dressform: { W: 0.5, D: 0.5, h: 1.5, name: 'Dress form', store: true, cols: ['#E8DCC8', '#B5476E', '#2E3B57'] },
  gramophone: { W: 0.6, D: 0.6, h: 1.1, name: 'Gramophone', store: true, cols: ['#7A4E32', '#1B1A1F', '#C9A24A'],
    spots: { r: { stand: [0.3, 1.1], dir: [0, -1], tag: 'records' } } },
  floorcushion: { W: 1.1, D: 1.1, h: 0.25, name: 'Floor cushions', store: true, cols: ['#B5476E', '#4F6F74', '#C9A24A', '#E8DCC8', '#6E3C50'],
    spots: { s: { stand: [0.55, 1.7], pos: [0.55, 0.55, 0.16], dir: [0, 1], tag: 'seat', base: 'base' } } },
  crates: { W: 0.8, D: 0.5, h: 0.55, name: 'Book crates', store: true, cols: ['#B98A6A', '#3A2E2A', '#E4DDD2'] },
  // TVs are pieces like any other: one hangs on a wall, the rest stand on a TV unit, a console, a desk or a dresser (or the
  // floor). Whoever wants to watch sits on a seat on a floor that has one.
  walltv: { W: 1.4, D: 0.1, h: 1.7, mount: 0.8, blocks: [], name: 'Wall-mounted TV', store: true, screen: [0.7, 0.1, 1.25] },
  tvflat: { W: 1.0, D: 0.26, h: 0.72, small: true, name: 'Flat-screen TV', store: true, screen: [0.5, 0.15, 0.42] },
  tvdesk: { W: 0.52, D: 0.2, h: 0.44, small: true, name: 'Desk TV', store: true, cols: ['#2B2B30', '#F2EEE8', '#C2413A'], screen: [0.26, 0.11, 0.27] },
  tvtube: { W: 0.6, D: 0.4, h: 0.58, small: true, name: 'Tube TV', store: true, cols: ['#8A5E3B', '#E4DDD2', '#2B2B30'], screen: [0.25, 0.4, 0.27] },
  entcenter: { wall: true, W: 2.4, D: 0.55, h: 2.0, name: 'Entertainment center', store: true, cols: ['#9C6B45', '#2B2B30', '#E4DDD2'], surface: { z: 0.62, rect: [0.56, 0.04, 1.84, 0.5] } },
};

export interface ObjectInstance {
  id: string;
  type: string;
  level: number;
  x: number;
  y: number;
  rot: number;
  col?: string;
  /** Which look of its type this piece wears (a key of TYPES[type].skins); none is the stock look. */
  skin?: string;
  pot?: string;
  pet?: string;
  grow?: number;
  wet?: number;
  art?: number;
  runUntil?: number;
  flash?: number;
  /** A moving box: what comes out when it is unpacked (an object type). */
  contents?: string;
  /** A small piece sitting on another (the id of what it is on), and the height of its base above the floor. */
  on?: string;
  z?: number;
}

/** The house's own rugs. A house saved before they were pieces gets them once (see `kernel/config.ts`). */
export const STARTER_RUG_IDS = ['rug1', 'rug2'];
/** The TV on the living room wall. A house saved while it was part of the wall gets it as a piece, once. */
export const STARTER_TV_IDS = ['walltv'];

export const INITIAL_OBJS: ObjectInstance[] = [
  { id: 'stair01', type: 'flightY', level: 0, x: 9.0, y: 0, rot: 0 },
  { id: 'tread', type: 'tread', level: 0, x: 1.2, y: 1.2, rot: 0 },
  { id: 'gym', type: 'gym', level: 0, x: 1.2, y: 3.4, rot: 0 },
  { id: 'lamp0', type: 'lamp', level: 0, x: 8.2, y: 0.3, rot: 0 },
  { id: 'heater', type: 'waterheater', level: 0, x: 0.18, y: 4.8, rot: 0 },
  { id: 'furnace', type: 'furnace', level: 0, x: 0.15, y: 5.75, rot: 0 },
  { id: 'laundry', type: 'laundry', level: 0, x: 1.4, y: 4.72, rot: 0 },
  { id: 'shelves', type: 'shelves', level: 0, x: 4.5, y: 5.4, rot: 1 },
  { id: 'boxes', type: 'boxes', level: 0, x: 2.4, y: 7.0, rot: 0 },
  { id: 'tree', type: 'tree', level: 3, x: 7.6, y: 0.5, rot: 0 },
  { id: 'garden', type: 'garden', level: 3, x: 3.6, y: 0.35, rot: 0, grow: 0.35, wet: 0.6 },
  { id: 'sprinkler', type: 'sprinkler', level: 3, x: 5.6, y: 4.4, rot: 0 },
  { id: 'bench', type: 'bench', level: 3, x: 0.8, y: 6.2, rot: 0 },
  { id: 'open01', type: 'holeY', level: 1, x: 9.0, y: 1.2, rot: 0 },
  { id: 'stair12', type: 'flightX', level: 1, x: 0, y: 7.0, rot: 0 },
  { id: 'counter', type: 'counter', level: 1, x: 0.4, y: 0.12, rot: 0 },
  { id: 'fridge', type: 'fridge', level: 1, x: 3.35, y: 0.12, rot: 0 },
  { id: 'dining', type: 'dining', level: 1, x: 1.0, y: 1.9, rot: 1 },
  { id: 'tvunit', type: 'tvunit', level: 1, x: 6.0, y: 0.12, rot: 0 },
  { id: 'walltv', type: 'walltv', level: 1, x: 6.1, y: 0.08, rot: 0 },
  { id: 'sofa', type: 'sofa', level: 1, x: 5.6, y: 3.3, rot: 2 },
  { id: 'plant1', type: 'plant', level: 1, x: 4.95, y: 0.15, rot: 0 },
  { id: 'lamp1', type: 'lamp', level: 1, x: 5.1, y: 3.4, rot: 0 },
  { id: 'open12', type: 'holeX', level: 2, x: 1.2, y: 7.0, rot: 0 },
  { id: 'rug1', type: 'rugwide', level: 1, x: 5.3, y: 1.0, rot: 0 },
  { id: 'rug2', type: 'rugsquare', level: 2, x: 2.6, y: 0.9, rot: 0 },
  { id: 'bed', type: 'bed', level: 2, x: 0.12, y: 1.0, rot: 0 },
  { id: 'night', type: 'nightstand', level: 2, x: 0.15, y: 0.35, rot: 0 },
  { id: 'dresser', type: 'dresser', level: 2, x: 3.0, y: 0.12, rot: 0 },
  { id: 'shower', type: 'shower', level: 2, x: 8.6, y: 0.12, rot: 0 },
  { id: 'toilet', type: 'toilet', level: 2, x: 6.1, y: 0.15, rot: 0 },
  { id: 'vanity', type: 'vanity', level: 2, x: 6.8, y: 0.12, rot: 0 },
  { id: 'desk', type: 'desk', level: 2, x: 7.0, y: 5.6, rot: 0 },
  { id: 'plant2', type: 'plant', level: 2, x: 9.2, y: 7.3, rot: 2, pot: '#E4DDD2' },
];

// Building the attic puts a staircase in the upstairs hall and an opening above it.
export const ATTIC_STAIR_OBJS: ObjectInstance[] = [
  { id: 'stair24', type: 'flightX', level: 2, x: 3.3, y: 7.0, rot: 0 },
  { id: 'open24', type: 'holeX', level: 4, x: 4.5, y: 7.0, rot: 0 },
];

export function footprint(o: ObjectInstance): [number, number] {
  const t = TYPES[o.type];
  return o.rot % 2 ? [t.D, t.W] : [t.W, t.D];
}

/** The job a piece does: its kind if it is another model of a piece (a chest freezer is a fridge), else its own type. */
export function kindOf(type: string): string {
  return TYPES[type]?.kind ?? type;
}

/** Every model of a kind, the kind's own type first. */
export function modelsOf(kind: string): string[] {
  return Object.keys(TYPES).filter((k) => kindOf(k) === kind).sort((a, b) => Number(b === kind) - Number(a === kind));
}

export function isFixed(type: string): boolean {
  return !!TYPES[type]?.fixed;
}

export function isRug(type: string): boolean {
  return !!TYPES[type]?.rug;
}

/** Hung on a wall (see `mount`). */
export function isMount(type: string): boolean {
  return TYPES[type]?.mount !== undefined;
}

/** A TV (see `screen`). */
export function isScreen(type: string): boolean {
  return !!TYPES[type]?.screen;
}

export function isWall(type: string): boolean {
  return !!TYPES[type]?.wall;
}

export function isOutdoor(type: string): boolean {
  return !!TYPES[type]?.out;
}

export function isStoreItem(type: string): boolean {
  return !!TYPES[type]?.store;
}

/** The look a piece wears, or undefined for the stock look (also when the save names a look the type no longer has). */
export function skinOf(o: Pick<ObjectInstance, 'type' | 'skin'>): SkinDef | undefined {
  return o.skin ? TYPES[o.type]?.skins?.[o.skin] : undefined;
}

/** What to call a piece: its look's name if it wears one, else the type's. */
export function displayName(o: Pick<ObjectInstance, 'type' | 'skin'>): string {
  return skinOf(o)?.name ?? TYPES[o.type]?.name ?? o.type;
}

/** The colours a piece comes in: its look's own, else the type's. */
export function colsOf(o: Pick<ObjectInstance, 'type' | 'skin'>): string[] | undefined {
  return skinOf(o)?.cols ?? TYPES[o.type]?.cols;
}

export function typeOf(type: string): ObjectTypeDef | undefined {
  return TYPES[type];
}

export function storeItems(): string[] {
  return Object.keys(TYPES).filter((k) => TYPES[k].store);
}

export function allSpots(type: string): Record<string, SpotDef> | undefined {
  return TYPES[type]?.spots;
}

export function lightOf(type: string): LightDef | undefined {
  return TYPES[type]?.light;
}

export function blocksOf(type: string): BlockRect[] {
  const t = TYPES[type];
  return t?.blocks || (t ? [[0, 0, t.W, t.D]] : []);
}
