export type ClothSlot = 'top' | 'bottom' | 'shoes' | 'hat' | 'glasses';

export interface ClothDef {
  key: string;
  slot: ClothSlot;
  style: string;
  name: string;
  price: number;
  colors: string[];
  tags: string[];
}

export interface OwnedCloth {
  slot: ClothSlot;
  style: string;
  col: string;
  name: string;
  id: string;
  // Second colour, for signature tops (the tie, the vest).
  accent?: string;
}

export interface LookState {
  top: string;
  topStyle: string;
  bottom: string;
  pants: string;
  shoes: string;
  hat: string;
  hatColor: string;
  glasses: string;
  glassColor: string;
}

export const CLOTHES: ClothDef[] = [
  { key: 'tee', slot: 'top', style: 'tee', name: 'Classic tee', price: 20, colors: ['#F2EEE8', '#2B2B30', '#C2413A', '#4A5DA8', '#7FB069', '#E0A43A'], tags: ['minimal', 'modern'] },
  { key: 'tank', slot: 'top', style: 'tank', name: 'Tank top', price: 18, colors: ['#F2EEE8', '#2B2B30', '#D24A7A', '#5FB8D6'], tags: ['playful', 'bold'] },
  { key: 'hoodie', slot: 'top', style: 'hoodie', name: 'Hoodie', price: 45, colors: ['#8E9C96', '#2B2B30', '#C2413A', '#E0A43A', '#6E3C50'], tags: ['cozy'] },
  { key: 'sweater', slot: 'top', style: 'sweater', name: 'Striped sweater', price: 55, colors: ['#2E3B57', '#F2EEE8', '#3F5B4C', '#A8553A'], tags: ['cozy', 'vintage'] },
  { key: 'flannel', slot: 'top', style: 'flannel', name: 'Flannel shirt', price: 40, colors: ['#A63A2C', '#3F5B4C', '#2E3B57'], tags: ['vintage', 'natural', 'cozy'] },
  { key: 'blazer', slot: 'top', style: 'blazer', name: 'Blazer', price: 95, colors: ['#2B2B30', '#C9B79C', '#6E3C50', '#2E3B57'], tags: ['luxe', 'modern'] },
  { key: 'denim', slot: 'top', style: 'denim', name: 'Denim jacket', price: 75, colors: ['#5A7CA8', '#2E3B57', '#C9CED6'], tags: ['vintage', 'industrial'] },
  { key: 'puffer', slot: 'top', style: 'puffer', name: 'Puffer coat', price: 110, colors: ['#E0A43A', '#2B2B30', '#C2413A', '#F2EEE8'], tags: ['bold', 'cozy'] },
  { key: 'dress', slot: 'top', style: 'dress', name: 'Sundress', price: 60, colors: ['#F2B48A', '#F3B6C8', '#7FB069', '#F5EBD8', '#2B2B30'], tags: ['soft', 'playful'] },
  { key: 'jersey', slot: 'top', style: 'jersey', name: 'Basketball jersey', price: 50, colors: ['#552583', '#C2413A', '#0E7C3A', '#1D428A'], tags: ['bold', 'playful'] },
  { key: 'jeans', slot: 'bottom', style: 'pants', name: 'Jeans', price: 40, colors: ['#3D5B8A', '#2E3B57', '#9EB3CF', '#2B2B30'], tags: ['minimal'] },
  { key: 'joggers', slot: 'bottom', style: 'pants', name: 'Joggers', price: 30, colors: ['#8E9C96', '#2B2B30', '#C9B79C'], tags: ['cozy'] },
  { key: 'chinos', slot: 'bottom', style: 'pants', name: 'Chinos', price: 40, colors: ['#C9B79C', '#5A6A3A', '#F2EEE8'], tags: ['modern'] },
  { key: 'shorts', slot: 'bottom', style: 'shorts', name: 'Shorts', price: 25, colors: ['#C9B79C', '#3D5B8A', '#7FB069', '#2B2B30'], tags: ['playful'] },
  { key: 'skirt', slot: 'bottom', style: 'skirt', name: 'Skirt', price: 35, colors: ['#2B2B30', '#D24A7A', '#C9A24A', '#3F5B4C'], tags: ['soft', 'playful'] },
  { key: 'sneakers', slot: 'shoes', style: 'shoe', name: 'Sneakers', price: 45, colors: ['#F2EEE8', '#2B2B30', '#C2413A'], tags: ['modern'] },
  { key: 'boots', slot: 'shoes', style: 'shoe', name: 'Boots', price: 70, colors: ['#5A3E2E', '#2B2B30', '#C9A24A'], tags: ['vintage'] },
  { key: 'slides', slot: 'shoes', style: 'shoe', name: 'Slides', price: 15, colors: ['#2B2B30', '#F3B6C8', '#5FB8D6'], tags: ['playful'] },
  { key: 'beanie', slot: 'hat', style: 'beanie', name: 'Beanie', price: 20, colors: ['#C2413A', '#2B2B30', '#E0A43A', '#8E9C96'], tags: ['cozy'] },
  { key: 'cap', slot: 'hat', style: 'cap', name: 'Baseball cap', price: 25, colors: ['#2E3B57', '#C2413A', '#2B2B30', '#F2EEE8'], tags: ['playful'] },
  { key: 'bucket', slot: 'hat', style: 'bucket', name: 'Bucket hat', price: 30, colors: ['#C9B79C', '#7FB069', '#2B2B30'], tags: ['playful', 'vintage'] },
  { key: 'sunhat', slot: 'hat', style: 'sunhat', name: 'Sun hat', price: 35, colors: ['#E8D9B0', '#F2EEE8'], tags: ['soft', 'natural'] },
  { key: 'round', slot: 'glasses', style: 'round', name: 'Round glasses', price: 40, colors: ['#2B2B30', '#C9A24A'], tags: ['vintage'] },
  { key: 'shades', slot: 'glasses', style: 'shades', name: 'Sunglasses', price: 35, colors: ['#1B1A1F', '#5A3E2E'], tags: ['bold'] },
];

export function clothByKey(key: string): ClothDef | undefined {
  return CLOTHES.find(c => c.key === key);
}

export function clothId(key: string): string {
  return 'c-' + key;
}

export function wearOn(look: LookState, pc: OwnedCloth): void {
  switch (pc.slot) {
    case 'top': look.topStyle = pc.style; look.top = pc.col; break;
    case 'bottom': look.bottom = pc.style; look.pants = pc.col; break;
    case 'shoes': look.shoes = pc.col; break;
    case 'hat': look.hat = pc.style; look.hatColor = pc.col; break;
    case 'glasses': look.glasses = pc.style; look.glassColor = pc.col; break;
  }
}

// Putting a closet piece on a game character (its look keeps colours, not styles, for legs).
export function wearOnAgent(look: { top: string; topStyle: string; bottom: string; accent?: string }, pc: OwnedCloth): void {
  if (pc.slot === 'top') { look.topStyle = pc.style; look.top = pc.col; look.accent = pc.accent; }
  if (pc.slot === 'bottom') look.bottom = pc.col;
}

// The avatar's outfit, sent by the host: worn by default, kept in the closet.
export interface SignatureOutfit { style: string; color: string; accent: string; bottom: string; key: string }
export const SIGNATURE_STYLES = new Set(['tee', 'linen', 'blazer', 'chef', 'labcoat', 'pirate']);
const HEX6 = /^#[0-9a-f]{6}$/i;

export function validOutfit(raw: unknown): SignatureOutfit | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.style !== 'string' || !SIGNATURE_STYLES.has(o.style)) return null;
  if (![o.color, o.accent, o.bottom].every(c => typeof c === 'string' && HEX6.test(c))) return null;
  if (typeof o.key !== 'string' || o.key.length > 200) return null;
  return { style: o.style, color: o.color as string, accent: o.accent as string, bottom: o.bottom as string, key: o.key };
}

export function defaultCloset(look: LookState, mayaLook: LookState, pantsCol: string, shoeCol: string): OwnedCloth[] {
  return [
    { slot: 'top', style: 'tee', col: look.top, name: 'Old tee', id: 'c-tee' },
    { slot: 'top', style: 'tee', col: mayaLook.top, name: 'Favorite tee', id: 'c-tee' },
    { slot: 'bottom', style: 'pants', col: pantsCol, name: 'Old jeans', id: 'c-jeans' },
    { slot: 'shoes', style: 'shoe', col: shoeCol, name: 'Beat-up sneakers', id: 'c-sneakers' },
  ];
}
