import { validateGarment } from '../state/garment';
import { migrateSave } from '../state/saveMigration';
import { INITIAL_OBJS, type ObjectInstance } from '../state/objects';
import { type AgentId, type AgentLook } from '../state/agents';
import { type CharacterLook } from '../state/types';
import { type WallMode } from '../art/houseArt.js';
import { createHousehold, type HouseholdState } from '../state/household';
import { BOTTOM_STYLES } from '../state/clothing';

export const VIEW_W = 640;
export const VIEW_H = 440;

const VELVET_COMPANION_ID = (() => {
  try { return new URLSearchParams(location.search).get('companion') || ''; } catch { return ''; }
})();

// The live game keeps its own save slot. The legacy game uses `velvet-house-v1:<id>`, and sharing it meant
// each could overwrite the other's progress.
export const SAVE_KEY = VELVET_COMPANION_ID ? `velvet-sims:${VELVET_COMPANION_ID}` : 'velvet-sims';
const LEGACY_SAVE_KEY = VELVET_COMPANION_ID ? `velvet-house-v1:${VELVET_COMPANION_ID}` : 'velvet-house-v1';
export const SPEEDS = [1, 3, 10];
export const WALL_MODES: { mode: WallMode; label: string }[] = [
  { mode: 'cut', label: 'Cutaway' },
  { mode: 'up', label: 'Walls up' },
  { mode: 'down', label: 'Walls down' },
];

export const DEFAULT_LOOKS: Record<AgentId, AgentLook> = {
  jordan: { skin: '#C68E6A', hair: '#2B1D16', top: '#3E6E8E', topStyle: 'tee', bottom: '#2F3542', longHair: false },
  maya: { skin: '#8D5A3B', hair: '#1E1412', top: '#B5523B', topStyle: 'tee', bottom: '#3B3140', longHair: true },
};

const HEX = /^#[0-9a-f]{6}$/i;

export function lookFrom(saved: unknown, fallback: AgentLook): AgentLook {
  const l = (saved && typeof saved === 'object' ? saved : {}) as Partial<CharacterLook>;
  return {
    skin: HEX.test(l.skin ?? '') ? l.skin! : fallback.skin,
    hair: HEX.test(l.hairColor ?? '') ? l.hairColor! : fallback.hair,
    top: HEX.test(l.top ?? '') ? l.top! : fallback.top,
    topStyle: typeof (l as { topStyle?: unknown }).topStyle === 'string' ? (l as { topStyle: string }).topStyle : fallback.topStyle,
    bottom: HEX.test((l as { bottom?: string }).bottom ?? '') ? (l as { bottom: string }).bottom : fallback.bottom,
    accent: HEX.test((l as { accent?: string }).accent ?? '') ? (l as { accent: string }).accent : undefined,
    bottomStyle: BOTTOM_STYLES.has((l as { bottomStyle?: string }).bottomStyle ?? '') ? (l as { bottomStyle: string }).bottomStyle : undefined,
    bottomAccent: HEX.test((l as { bottomAccent?: string }).bottomAccent ?? '') ? (l as { bottomAccent: string }).bottomAccent : undefined,
    topGarment: validateGarment((l as { topGarment?: unknown }).topGarment) ?? undefined,
    bottomGarment: validateGarment((l as { bottomGarment?: unknown }).bottomGarment) ?? undefined,
    longHair: typeof l.hair === 'string' ? /long|wav|curl|bun|pony|braid|loc/i.test(l.hair) : fallback.longHair,
  };
}

export function nameFrom(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, 16) : fallback;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export interface World {
  day: number;
  minutes: number;
  objs: ObjectInstance[];
  save: Record<string, unknown> | null;
  household: HouseholdState;
}

export function loadWorld(): World {
  let day = 1;
  let minutes = 6 * 60 + 20;
  let objs: ObjectInstance[] = INITIAL_OBJS.map((o) => ({ ...o }));
  let save: Record<string, unknown> | null = null;
  try {
    // First run on the new slot: carry the house over from the old one (migrated, so the old copy stays as it was).
    if (localStorage.getItem(SAVE_KEY) === null) {
      const old = migrateSave(JSON.parse(localStorage.getItem(LEGACY_SAVE_KEY) ?? 'null'));
      if (old) localStorage.setItem(SAVE_KEY, JSON.stringify(old));
    }
    const raw = localStorage.getItem(SAVE_KEY);
    const s = raw ? migrateSave(JSON.parse(raw)) : null;
    if (s) {
      save = s as unknown as Record<string, unknown>;
      if (typeof s.day === 'number') day = s.day;
      if (typeof s.minutes === 'number') minutes = s.minutes;
      if (Array.isArray(s.objs) && s.objs.length) objs = s.objs as unknown as ObjectInstance[];
    }
  } catch { /* start fresh */ }
  const household = createHousehold();
  if (save) {
    if (typeof save.money === 'number') household.money = save.money;
    if (typeof save.power === 'boolean') household.power = save.power;
    if (typeof save.dishes === 'number') household.dishes = save.dishes;
    if (typeof save.laundryPile === 'number') household.laundryPile = save.laundryPile;
    if (save.fridge && typeof save.fridge === 'object') {
      const f = save.fridge as { basic?: number; fresh?: number };
      if (typeof f.basic === 'number') household.fridge.basic = f.basic;
      if (typeof f.fresh === 'number') household.fridge.fresh = f.fresh;
    }
    if (save.bill && typeof save.bill === 'object') {
      household.bill = save.bill as HouseholdState['bill'];
    }
    if (typeof save.nextBillAt === 'number') household.nextBillAt = save.nextBillAt;
  }
  return { day, minutes, objs, save, household };
}
