import { RNG } from './rng';
import { STYLE_TAGS, type StyleTag } from './taste';

/**
 * A garment is a recipe, not a picture: a small, plain object the renderer draws on the body, the same way every
 * time. This file is the data side: the shape, checking and clamping, a seeded generator, prices, and the short
 * share code. Nothing here touches a canvas.
 */

export const SLOTS = ['top', 'bottom', 'dress', 'outer', 'shoes', 'hat'] as const;
export type GarmentSlot = typeof SLOTS[number];

/** The cuts each slot has. The studio offers top, bottom, dress and outer; shoes and hat are checked but not drawn yet. */
export const CUTS: Record<GarmentSlot, readonly string[]> = {
  top: ['tee', 'tank', 'crop', 'button-up', 'hoodie', 'sweater', 'cardigan'],
  outer: ['jacket', 'blazer'],
  dress: ['dress'],
  bottom: ['slim', 'straight', 'wide', 'cargo', 'shorts', 'skirt'],
  shoes: ['sneaker', 'boot', 'slide', 'loafer'],
  hat: ['beanie', 'cap', 'bucket', 'sunhat'],
};
export const ALL_CUTS: readonly string[] = SLOTS.flatMap((s) => CUTS[s]);

export const FABRICS = ['cotton', 'denim', 'knit', 'flannel', 'corduroy', 'linen', 'leather', 'satin', 'fleece', 'puffer'] as const;
export type Fabric = typeof FABRICS[number];

export const PATTERN_KINDS = [
  'stripes', 'pinstripe', 'plaid', 'gingham', 'polka', 'floral', 'camo', 'tie-dye', 'checker', 'argyle', 'leopard', 'zebra',
  'color-block', 'graphic',
] as const;
export type PatternKind = typeof PATTERN_KINDS[number];

export const RARITIES = ['common', 'uncommon', 'rare', 'one-of-a-kind'] as const;
export type Rarity = typeof RARITIES[number];

export interface Pattern {
  kind: PatternKind;
  /** One to three hex colours. */
  colors: string[];
  /** 0.25 to 4, in steps of 0.025. */
  scale: number;
  /** Degrees, -90 to 90. */
  angle: number;
  /** 0 to 1, in steps of 0.01. How crowded the motif is. */
  density?: number;
  seed: number;
  layer2?: Omit<Pattern, 'layer2'>;
}

export interface GarmentDetails {
  pocket?: boolean;
  buttons?: boolean;
  cuffs?: 'rolled' | 'contrast';
  /** 0 to 1 */
  distress?: number;
  /** Denim only: 0 raw to 1 light. */
  wash?: number;
  drawstring?: boolean;
}

export interface Garment {
  v: 1;
  slot: GarmentSlot;
  cut: string;
  fabric: Fabric;
  base: string;
  pattern?: Pattern;
  details?: GarmentDetails;
  /** Style words the companion's taste understands. */
  tags: StyleTag[];
  rarity: Rarity;
  name: string;
}

// ---------------------------------------------------------------------------------------------------------------
// Checking and clamping

const HEX6 = /^#[0-9a-f]{6}$/i;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && HEX6.test(v) ? v.toLowerCase() : fallback);
const oneOf = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback);

export const NAME_MAX = 24;
/** A name keeps letters, digits, spaces and a little punctuation, so it stays short and safe in a share code. */
export function cleanName(v: unknown, fallback = 'Untitled'): string {
  const s = typeof v === 'string' ? v.replace(/[^A-Za-z0-9 '&!.,-]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX).trim() : '';
  return s || fallback;
}

function validPattern(raw: unknown, allowLayer2: boolean): Pattern | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.kind !== 'string' || !(PATTERN_KINDS as readonly string[]).includes(o.kind)) return undefined;
  const colors = (Array.isArray(o.colors) ? o.colors : []).filter((c): c is string => typeof c === 'string' && HEX6.test(c)).slice(0, 3).map((c) => c.toLowerCase());
  if (!colors.length) return undefined;
  const p: Pattern = {
    kind: o.kind as PatternKind,
    colors,
    scale: Math.round(clamp(num(o.scale, 1), 0.25, 4) * 40) / 40,
    angle: Math.round(clamp(num(o.angle, 0), -90, 90)),
    seed: (Math.floor(num(o.seed, 1)) >>> 0),
  };
  if (o.density !== undefined) p.density = Math.round(clamp(num(o.density, 0.5), 0, 1) * 100) / 100;
  if (allowLayer2 && o.layer2) {
    const l2 = validPattern(o.layer2, false);
    if (l2) p.layer2 = l2;
  }
  return p;
}

/** Turns anything into a good garment, or null if it is nothing like one. Every value is clamped to what the renderer handles. */
export function validateGarment(raw: unknown): Garment | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const slot = oneOf(SLOTS, o.slot, 'top');
  if (typeof o.slot !== 'string' || !(SLOTS as readonly string[]).includes(o.slot)) return null;
  const cut = typeof o.cut === 'string' && CUTS[slot].includes(o.cut) ? o.cut : CUTS[slot][0];
  const fabric = oneOf(FABRICS, o.fabric, 'cotton');
  const g: Garment = {
    v: 1, slot, cut, fabric,
    base: hex(o.base, '#808080'),
    // In the order of STYLE_TAGS, so the same tags always read the same.
    tags: STYLE_TAGS.filter((t) => Array.isArray(o.tags) && o.tags.includes(t)).slice(0, 4),
    rarity: oneOf(RARITIES, o.rarity, 'common'),
    name: cleanName(o.name),
  };
  const pattern = validPattern(o.pattern, true);
  if (pattern) g.pattern = pattern;
  if (o.details && typeof o.details === 'object') {
    const d = o.details as Record<string, unknown>;
    const out: GarmentDetails = {};
    if (d.pocket === true) out.pocket = true;
    if (d.buttons === true) out.buttons = true;
    if (d.drawstring === true) out.drawstring = true;
    if (d.cuffs === 'rolled' || d.cuffs === 'contrast') out.cuffs = d.cuffs;
    if (d.distress !== undefined) out.distress = Math.round(clamp(num(d.distress, 0), 0, 1) * 100) / 100;
    if (d.wash !== undefined) out.wash = Math.round(clamp(num(d.wash, 0.5), 0, 1) * 100) / 100;
    if (Object.keys(out).length) g.details = out;
  }
  return g;
}

/** Which slot of the body a garment is drawn on: dresses and outer layers sit on the torso, like tops. */
export const bodyPart = (g: Pick<Garment, 'slot'>): 'top' | 'bottom' | null =>
  g.slot === 'bottom' ? 'bottom' : g.slot === 'top' || g.slot === 'dress' || g.slot === 'outer' ? 'top' : null;

/** The game's existing style names for a cut, so the rest of the game (icons, taste, closet labels) keeps working. */
const TOP_STYLE: Record<string, string> = {
  tee: 'tee', tank: 'tank', crop: 'tank', 'button-up': 'flannel', hoodie: 'hoodie', sweater: 'sweater', cardigan: 'sweater',
  jacket: 'denim', blazer: 'blazer', dress: 'dress',
};
const BOTTOM_STYLE: Record<string, string> = { slim: 'pants', straight: 'jeans', wide: 'baggy', cargo: 'trousers', shorts: 'shorts', skirt: 'skirt' };
export const garmentStyle = (g: Garment): string => (g.slot === 'bottom' ? BOTTOM_STYLE[g.cut] : TOP_STYLE[g.cut]) ?? 'tee';

/** How far down the arm each cut reaches, as the figure draws it (0 none, 1 to the wrist). */
export const SLEEVE_BY_CUT: Record<string, number> = {
  tank: 0, crop: 0.3, tee: 0.55, 'button-up': 1, hoodie: 1, sweater: 1, cardigan: 1, jacket: 1, blazer: 1, dress: 0.4,
};

// ---------------------------------------------------------------------------------------------------------------
// Colour helpers

export function luminance(h: string): number {
  const n = parseInt(h.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const mix = (s: number) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return '#' + ((mix(16) << 16) | (mix(8) << 8) | mix(0)).toString(16).padStart(6, '0');
}

/** Nudges a colour until it stands out from the base, so a pattern never disappears into the cloth. */
export function withContrast(col: string, base: string, min = 0.12): string {
  let c = col;
  const toward = luminance(base) > 0.35 ? '#000000' : '#ffffff';
  for (let i = 0; i < 6 && Math.abs(luminance(c) - luminance(base)) < min; i++) c = mixHex(c, toward, 0.25);
  return c;
}

// ---------------------------------------------------------------------------------------------------------------
// The generator

export interface Palette { id: string; word: string; tags: StyleTag[]; colors: string[] }

/** Curated palettes: the first colour suits a base, the rest suit patterns and trim. */
export const PALETTES: Palette[] = [
  { id: 'sunset', word: 'Sunset', tags: ['warm', 'bold', 'vintage'], colors: ['#e07a3f', '#f2b05e', '#b2453a', '#6e3c50', '#f6e3c3'] },
  { id: 'ocean', word: 'Ocean', tags: ['cool', 'natural', 'soft'], colors: ['#2f6f8f', '#8fc5d4', '#1f3b57', '#e9f1ef', '#d9b36c'] },
  { id: 'forest', word: 'Forest', tags: ['natural', 'cozy', 'warm'], colors: ['#3f5b4c', '#a8553a', '#d9c7a1', '#2b2b30', '#7a8c5a'] },
  { id: 'cabin', word: 'Cabin', tags: ['cozy', 'vintage', 'warm'], colors: ['#a63a2c', '#2e3b57', '#e8dcc0', '#3a2b24', '#c79a4a'] },
  { id: 'candy', word: 'Candy', tags: ['playful', 'soft', 'bold'], colors: ['#f3b6c8', '#8fd3c7', '#fbe38e', '#a99bea', '#ffffff'] },
  { id: 'mono', word: 'Studio', tags: ['minimal', 'modern', 'cool'], colors: ['#2b2b30', '#f2eee8', '#8e9c96', '#c9ced6', '#5a6a7a'] },
  { id: 'midnight', word: 'Midnight', tags: ['luxe', 'cool', 'modern'], colors: ['#1f2a44', '#c9a24a', '#6e3c50', '#e9e4dd', '#3f5b4c'] },
  { id: 'denim', word: 'Indigo', tags: ['industrial', 'vintage', 'cool'], colors: ['#3d5b8a', '#9eb3cf', '#2e3b57', '#f2eee8', '#c9a24a'] },
  { id: 'meadow', word: 'Meadow', tags: ['natural', 'soft', 'playful'], colors: ['#7fb069', '#f3b6c8', '#fbe38e', '#f5ebd8', '#4a5da8'] },
  { id: 'wine', word: 'Velvet', tags: ['luxe', 'warm', 'bold'], colors: ['#6e3c50', '#c9a24a', '#2b2b30', '#e8c9a0', '#a63a2c'] },
  { id: 'sand', word: 'Dune', tags: ['natural', 'minimal', 'warm'], colors: ['#c9b79c', '#8a6a50', '#f2eee8', '#5a6a3a', '#a8553a'] },
  { id: 'neon', word: 'Neon', tags: ['bold', 'playful', 'modern'], colors: ['#2b2b30', '#ff4f9a', '#3be3d0', '#f6e84a', '#ffffff'] },
];

/** What patterns suit which cloth: leather and satin stay plain or striped, rough cloth takes anything. */
const PATTERNS_FOR: Record<Fabric, readonly PatternKind[]> = {
  cotton: PATTERN_KINDS,
  denim: ['stripes', 'pinstripe', 'polka', 'camo', 'graphic', 'color-block', 'checker'],
  knit: ['stripes', 'argyle', 'checker', 'polka', 'color-block', 'graphic', 'floral'],
  flannel: ['plaid', 'gingham', 'checker', 'stripes'],
  corduroy: ['stripes', 'color-block', 'checker', 'polka'],
  linen: ['stripes', 'pinstripe', 'gingham', 'floral', 'polka', 'color-block'],
  leather: ['color-block', 'stripes', 'leopard'],
  satin: ['floral', 'polka', 'stripes', 'leopard', 'zebra', 'color-block'],
  fleece: ['stripes', 'color-block', 'camo', 'graphic', 'checker'],
  puffer: ['color-block', 'stripes', 'camo'],
};
/** Overlays that sit well on top of another pattern. */
const LAYER2_KINDS: readonly PatternKind[] = ['stripes', 'polka', 'graphic', 'color-block'];
const NO_LAYER2_ON: readonly PatternKind[] = ['camo', 'leopard', 'zebra', 'tie-dye', 'graphic'];
const PREMIUM_FABRICS: readonly Fabric[] = ['leather', 'satin', 'corduroy', 'puffer'];

const RARITY_WEIGHT: Record<Rarity, number> = { common: 60, uncommon: 25, rare: 11, 'one-of-a-kind': 4 };
const PATTERN_CHANCE: Record<Rarity, number> = { common: 0.35, uncommon: 0.6, rare: 0.85, 'one-of-a-kind': 1 };
const LAYER2_CHANCE: Record<Rarity, number> = { common: 0, uncommon: 0.1, rare: 0.3, 'one-of-a-kind': 0.6 };
const PREMIUM_CHANCE: Record<Rarity, number> = { common: 0.05, uncommon: 0.15, rare: 0.4, 'one-of-a-kind': 0.7 };

export interface GenerateOptions {
  slot?: GarmentSlot;
  rarity?: Rarity;
  /** Prefer palettes carrying these style tags (the companion's taste, a player's mood). */
  tags?: readonly StyleTag[];
  palette?: string;
}

function weighted<T>(rng: RNG, items: readonly T[], weight: (t: T) => number): T {
  const total = items.reduce((a, t) => a + weight(t), 0);
  let r = rng.next() * total;
  for (const t of items) { r -= weight(t); if (r <= 0) return t; }
  return items[items.length - 1];
}

export function rollRarity(rng: RNG): Rarity {
  return weighted(rng, RARITIES, (r) => RARITY_WEIGHT[r]);
}

/** The same seed and options always make the same garment. Everything it makes passes validateGarment unchanged. */
export function generateGarment(seed: number, opts: GenerateOptions = {}): Garment {
  const rng = new RNG(seed);
  const rarity = opts.rarity ?? rollRarity(rng);
  const slot = opts.slot ?? weighted(rng, ['top', 'bottom', 'outer', 'dress'] as const, (s) => (s === 'top' ? 5 : s === 'bottom' ? 3 : s === 'outer' ? 1.5 : 1));
  const cut = rng.pick(CUTS[slot]);
  const palette = PALETTES.find((p) => p.id === opts.palette)
    ?? weighted(rng, PALETTES, (p) => 1 + (opts.tags ? 2.5 * p.tags.filter((t) => opts.tags!.includes(t)).length : 0));
  const premium = slot !== 'dress' && rng.chance(PREMIUM_CHANCE[rarity]);
  const fabricPool = FABRICS.filter((f) => PREMIUM_FABRICS.includes(f) === premium);
  let fabric: Fabric = rng.pick(fabricPool);
  if (slot === 'bottom' && !premium) fabric = rng.chance(0.55) ? 'denim' : rng.pick(['cotton', 'corduroy', 'linen'] as const);
  if (slot === 'outer' && !premium) fabric = rng.pick(['denim', 'cotton', 'fleece', 'flannel'] as const);
  if (slot === 'dress') fabric = rng.pick(['cotton', 'linen', 'satin', 'knit'] as const);

  let base = palette.colors[rng.int(0, 2)];
  if (fabric === 'denim') base = rng.pick(['#3d5b8a', '#2e3b57', '#5a7ca8', '#9eb3cf', '#2b2b30'] as const);
  const g: Garment = { v: 1, slot, cut, fabric, base, tags: [], rarity, name: '' };

  if (rng.chance(PATTERN_CHANCE[rarity])) {
    const kind = rng.pick(PATTERNS_FOR[fabric]);
    const others = palette.colors.filter((c) => c !== base);
    const colors = rng.shuffle(others).slice(0, kind === 'color-block' || kind === 'tie-dye' || kind === 'argyle' ? rng.int(2, 3) : rng.int(1, 2)).map((c) => withContrast(c, base));
    g.pattern = {
      kind, colors,
      scale: Math.round(rng.range(0.6, 2) * 40) / 40,
      angle: kind === 'stripes' || kind === 'pinstripe' || kind === 'color-block' ? rng.pick([0, 0, 90, 45, -45] as const) : rng.pick([0, 0, 15, -15] as const),
      density: Math.round(rng.range(0.3, 0.8) * 100) / 100,
      seed: rng.int(1, 0xffffff),
    };
    if (!NO_LAYER2_ON.includes(kind) && rng.chance(LAYER2_CHANCE[rarity])) {
      const k2 = rng.pick(LAYER2_KINDS.filter((k) => k !== kind));
      g.pattern.layer2 = {
        kind: k2, colors: [withContrast(rng.pick(others), base)],
        scale: Math.round(rng.range(0.8, 2.2) * 40) / 40, angle: rng.pick([0, 90, 45] as const), density: 0.4, seed: rng.int(1, 0xffffff),
      };
    }
  }

  const details: GarmentDetails = {};
  if (slot !== 'bottom' && ['cotton', 'denim', 'flannel', 'linen'].includes(fabric) && rng.chance(0.4)) details.pocket = true;
  if (cut === 'button-up' || cut === 'cardigan' || cut === 'blazer') details.buttons = true;
  if (cut === 'hoodie' && rng.chance(0.7)) details.drawstring = true;
  if (slot === 'bottom' && cut !== 'shorts' && cut !== 'skirt' && rng.chance(0.3)) details.cuffs = rng.pick(['rolled', 'contrast'] as const);
  if (fabric === 'denim') { details.wash = Math.round(rng.range(0.1, 0.9) * 100) / 100; if (rarity !== 'common' && rng.chance(0.4)) details.distress = Math.round(rng.range(0.2, 0.7) * 100) / 100; }
  if (Object.keys(details).length) g.details = details;

  g.tags = tagsFor(g, palette);
  g.name = nameFor(g, palette);
  return validateGarment(g)!;
}

/** The style words a garment carries: from its palette, its cut, its cloth and its pattern. */
export function tagsFor(g: Pick<Garment, 'cut' | 'fabric' | 'pattern' | 'rarity'>, palette?: Palette): StyleTag[] {
  const t: StyleTag[] = [];
  if (palette) t.push(...palette.tags.slice(0, 2));
  if (['hoodie', 'sweater', 'cardigan'].includes(g.cut) || ['knit', 'fleece', 'flannel'].includes(g.fabric)) t.push('cozy');
  if (['blazer', 'dress'].includes(g.cut) || ['leather', 'satin'].includes(g.fabric)) t.push('luxe');
  if (['corduroy', 'flannel'].includes(g.fabric) || g.pattern?.kind === 'plaid' || g.pattern?.kind === 'argyle') t.push('vintage');
  if (['linen', 'cotton'].includes(g.fabric) && !g.pattern) t.push('minimal');
  if (['floral', 'polka', 'tie-dye', 'gingham'].includes(g.pattern?.kind ?? '')) t.push('playful');
  if (['camo', 'leopard', 'zebra', 'color-block'].includes(g.pattern?.kind ?? '')) t.push('bold');
  if (g.fabric === 'denim' || g.cut === 'cargo') t.push('industrial');
  if (g.pattern?.kind === 'floral' || g.fabric === 'linen') t.push('natural');
  return [...new Set(t)].slice(0, 4);
}

const PATTERN_WORD: Partial<Record<PatternKind, string>> = {
  stripes: 'Striped', pinstripe: 'Pinstripe', plaid: 'Plaid', gingham: 'Gingham', polka: 'Dotted', floral: 'Floral', camo: 'Camo',
  'tie-dye': 'Tie-dye', checker: 'Checked', argyle: 'Argyle', leopard: 'Leopard', zebra: 'Zebra', 'color-block': 'Blocked', graphic: 'Graphic',
};
const CUT_WORD: Record<string, string> = {
  tee: 'Tee', tank: 'Tank', crop: 'Crop top', 'button-up': 'Button-up', hoodie: 'Hoodie', sweater: 'Sweater', cardigan: 'Cardigan', jacket: 'Jacket',
  blazer: 'Blazer', dress: 'Dress', slim: 'Slim jeans', straight: 'Straight jeans', wide: 'Wide jeans', cargo: 'Cargo pants', shorts: 'Shorts', skirt: 'Skirt',
  sneaker: 'Sneakers', boot: 'Boots', slide: 'Slides', loafer: 'Loafers', beanie: 'Beanie', cap: 'Cap', bucket: 'Bucket hat', sunhat: 'Sun hat',
};
export const cutLabel = (cut: string): string => CUT_WORD[cut] ?? cut;

function nameFor(g: Garment, palette: Palette): string {
  const pat = g.pattern ? PATTERN_WORD[g.pattern.kind] : null;
  const fab = g.fabric === 'cotton' ? '' : g.fabric[0].toUpperCase() + g.fabric.slice(1);
  return cleanName([palette.word, pat ?? fab, cutLabel(g.cut)].filter(Boolean).join(' '));
}

// ---------------------------------------------------------------------------------------------------------------
// Prices

const CUT_PRICE: Record<string, number> = {
  tee: 20, tank: 18, crop: 22, 'button-up': 40, hoodie: 45, sweater: 55, cardigan: 60, jacket: 80, blazer: 95, dress: 60,
  slim: 40, straight: 40, wide: 45, cargo: 50, shorts: 25, skirt: 35, sneaker: 45, boot: 70, slide: 15, loafer: 60,
  beanie: 20, cap: 25, bucket: 30, sunhat: 35,
};
const FABRIC_PRICE: Record<Fabric, number> = { cotton: 1, denim: 1.1, knit: 1.2, flannel: 1.1, corduroy: 1.2, linen: 1.15, leather: 1.9, satin: 1.6, fleece: 1.15, puffer: 1.7 };
const RARITY_PRICE: Record<Rarity, number> = { common: 1, uncommon: 1.35, rare: 1.9, 'one-of-a-kind': 2.8 };

export function priceOf(g: Garment): number {
  const raw = (CUT_PRICE[g.cut] ?? 30) * FABRIC_PRICE[g.fabric] * RARITY_PRICE[g.rarity] * (g.pattern ? (g.pattern.layer2 ? 1.2 : 1.1) : 1);
  return Math.max(5, Math.round(raw / 5) * 5);
}

// ---------------------------------------------------------------------------------------------------------------
// Share codes: VH-<checksum>-<payload in groups of five>. Base 32 (no look-alike letters), so a code can be read out
// or typed, and a mistyped one is caught by the checksum.

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const B32_FIX: Record<string, string> = { O: '0', I: '1', L: '1', U: 'V' };

function toBase32(bytes: number[]): string {
  let bits = 0, acc = 0, out = '';
  for (const b of bytes) {
    acc = (acc << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(acc >> (bits - 5)) & 31]; bits -= 5; }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += B32[(acc << (5 - bits)) & 31];
  return out;
}

function fromBase32(s: string): number[] | null {
  let bits = 0, acc = 0;
  const out: number[] = [];
  for (const ch of s) {
    const v = B32.indexOf(ch);
    if (v < 0) return null;
    acc = (acc << 5) | v; bits += 5;
    if (bits >= 8) { out.push((acc >> (bits - 8)) & 255); bits -= 8; acc &= (1 << bits) - 1; }
  }
  return out;
}

function crc16(bytes: number[]): number {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}

const TAG_BIT = (t: StyleTag) => STYLE_TAGS.indexOf(t);

function writePattern(out: number[], p: Omit<Pattern, 'layer2'>): void {
  out.push(PATTERN_KINDS.indexOf(p.kind), p.colors.length);
  for (const c of p.colors) { const n = parseInt(c.slice(1), 16); out.push((n >> 16) & 255, (n >> 8) & 255, n & 255); }
  out.push(Math.round(p.scale * 40), p.angle + 90, Math.round((p.density ?? 0.5) * 100));
  out.push((p.seed >>> 24) & 255, (p.seed >>> 16) & 255, (p.seed >>> 8) & 255, p.seed & 255);
}

export function encodeGarment(input: Garment): string {
  const g = validateGarment(input);
  if (!g) throw new Error('not a garment');
  const out: number[] = [1];
  const flags = SLOTS.indexOf(g.slot) | (RARITIES.indexOf(g.rarity) << 3) | (g.pattern ? 32 : 0) | (g.pattern?.layer2 ? 64 : 0) | (g.details ? 128 : 0);
  out.push(flags, Math.max(0, CUTS[g.slot].indexOf(g.cut)), FABRICS.indexOf(g.fabric));
  const n = parseInt(g.base.slice(1), 16);
  out.push((n >> 16) & 255, (n >> 8) & 255, n & 255);
  const mask = g.tags.reduce((a, t) => a | (1 << TAG_BIT(t)), 0);
  out.push((mask >> 8) & 255, mask & 255);
  if (g.pattern) {
    writePattern(out, g.pattern);
    if (g.pattern.layer2) writePattern(out, g.pattern.layer2);
  }
  if (g.details) {
    const d = g.details;
    out.push((d.pocket ? 1 : 0) | (d.buttons ? 2 : 0) | (d.cuffs === 'rolled' ? 4 : 0) | (d.cuffs === 'contrast' ? 8 : 0) | (d.drawstring ? 16 : 0)
      | (d.wash !== undefined ? 32 : 0) | (d.distress !== undefined ? 64 : 0),
      Math.round((d.distress ?? 0) * 100), Math.round((d.wash ?? 0) * 100));
  }
  const name = new TextEncoder().encode(g.name);
  out.push(name.length, ...name);
  const sum = crc16(out);
  const head = [(sum >> 8) & 255, sum & 255];
  const body = toBase32(out);
  const groups = body.match(/.{1,5}/g) ?? [];
  return ['VH', toBase32(head).slice(0, 4), ...groups].join('-');
}

/** Reads a share code back. Spaces, dashes and case do not matter; a typo or a cut-off code gives null. */
export function decodeGarment(code: string): Garment | null {
  try {
    let s = code.toUpperCase().replace(/[^0-9A-Z]/g, '');
    if (!s.startsWith('VH')) return null;
    s = [...s.slice(2)].map((c) => B32_FIX[c] ?? c).join('');
    const checkBytes = fromBase32(s.slice(0, 4));
    const bytes = fromBase32(s.slice(4));
    if (!checkBytes || !bytes || bytes.length < 12) return null;
    const want = (checkBytes[0] << 8) | checkBytes[1];
    return crc16(bytes) === want ? readGarment(bytes) : null;
  } catch {
    return null;
  }
}

function readGarment(b: number[]): Garment | null {
  let i = 0;
  const take = () => { if (i >= b.length) throw new Error('short'); return b[i++]; };
  if (take() !== 1) return null;
  const flags = take();
  const slot = SLOTS[flags & 7];
  if (!slot) return null;
  const cut = CUTS[slot][take()] ?? CUTS[slot][0];
  const fabric = FABRICS[take()] ?? 'cotton';
  const colour = () => '#' + ((take() << 16) | (take() << 8) | take()).toString(16).padStart(6, '0');
  const base = colour();
  const mask = (take() << 8) | take();
  const tags = STYLE_TAGS.filter((_, k) => mask & (1 << k));
  const pattern = (): Omit<Pattern, 'layer2'> => {
    const kind = PATTERN_KINDS[take()];
    const n = take();
    const colors = Array.from({ length: n }, colour);
    const scale = take() / 40, angle = take() - 90, density = take() / 100;
    const seed = ((take() << 24) | (take() << 16) | (take() << 8) | take()) >>> 0;
    return { kind, colors, scale, angle, density, seed };
  };
  const g: Record<string, unknown> = { v: 1, slot, cut, fabric, base, tags, rarity: RARITIES[(flags >> 3) & 3] };
  if (flags & 32) { const p: Pattern = pattern(); if (flags & 64) p.layer2 = pattern(); g.pattern = p; }
  if (flags & 128) {
    const f = take(), distress = take() / 100, wash = take() / 100;
    g.details = {
      pocket: !!(f & 1), buttons: !!(f & 2), cuffs: f & 4 ? 'rolled' : f & 8 ? 'contrast' : undefined, drawstring: !!(f & 16),
      distress: f & 64 ? distress : undefined, wash: f & 32 ? wash : undefined,
    };
  }
  const len = take();
  const nameBytes = b.slice(i, i + len);
  if (nameBytes.length !== len) return null;
  g.name = new TextDecoder().decode(new Uint8Array(nameBytes));
  return validateGarment(g);
}

/** True when two garments draw the same (name and tags aside). */
export function sameCloth(a: Garment, b: Garment): boolean {
  const strip = (g: Garment) => JSON.stringify({ ...g, name: '', tags: [] });
  return strip(a) === strip(b);
}
