import { revivePet, type Pet } from '../state/pets';
import { validateGarment } from '../state/garment';
import { migrateSave, isCurrentContent } from '../state/saveMigration';
import { INITIAL_OBJS, STARTER_RUG_IDS, STARTER_TV_IDS, STARTER_OFFICE_IDS, OFFICE_LAYOUT, type ObjectInstance } from '../state/objects';
import { type AgentId, type AgentLook } from '../state/agents';
import { type CharacterLook } from '../state/types';
import { type WallMode } from '../art/houseArt.js';
import { createHousehold, type HouseholdState } from '../state/household';
import { parseLife, type LifeState } from '../state/life';
import { BOTTOM_STYLES } from '../state/clothing';

/** The size of the picture's view space: 640 x 440 for the house, bigger for a bigger floor (kept in step with the floor on show: see `viewSizeFor`). */
export const VIEW = { w: 640, h: 440 };

const VELVET_COMPANION_ID = (() => {
  try { return new URLSearchParams(location.search).get('companion') || ''; } catch { return ''; }
})();

// The live game keeps its own save slot. The legacy game uses `velvet-house-v1:<id>`, and sharing it meant
// each could overwrite the other's progress.
/** The demo (`?demo=1`) plays the same game in its own save slot, so it never touches a real house or its cloud copy. */
export const IS_DEMO = (() => { try { return new URLSearchParams(location.search).has('demo'); } catch { return false; } })();
export const SAVE_KEY = IS_DEMO
  ? `velvet-sims-demo${VELVET_COMPANION_ID ? `:${VELVET_COMPANION_ID}` : ''}`
  : VELVET_COMPANION_ID ? `velvet-sims:${VELVET_COMPANION_ID}` : 'velvet-sims';
const LEGACY_SAVE_KEY = VELVET_COMPANION_ID ? `velvet-house-v1:${VELVET_COMPANION_ID}` : 'velvet-house-v1';
/** The demo runs faster so the garden's growing and dying can be watched in minutes, not days. */
export const SPEEDS = IS_DEMO ? [1, 10, 60, 180] : [1, 3, 10];
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

export function nameFrom(v: unknown, fallback: string, max = 16): string {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback;
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
  life: LifeState;
  /** The pets, their food in the cupboard, and the counter their ids come from. */
  pets: Pet[];
  petFood: number;
  petSeq: number;
}

/** How this page is running. `attract` is the title screen's living backdrop: a throwaway house that never saves. */
export const run = { attract: false };

export function loadWorld(): World {
  let day = 1;
  let minutes = 6 * 60 + 20;
  let objs: ObjectInstance[] = INITIAL_OBJS.map((o) => ({ ...o }));
  let save: Record<string, unknown> | null = null;
  try {
    // First run on the new slot: carry the house over from the old one (migrated, so the old copy stays as it was).
    if (!run.attract && !IS_DEMO && localStorage.getItem(SAVE_KEY) === null) {
      const old = migrateSave(JSON.parse(localStorage.getItem(LEGACY_SAVE_KEY) ?? 'null'));
      if (old) localStorage.setItem(SAVE_KEY, JSON.stringify(old));
    }
    const raw = run.attract ? null : localStorage.getItem(SAVE_KEY);
    const migrated = raw ? migrateSave(JSON.parse(raw)) : null;
    // A house from before the story is not carried over: everyone starts again with the move-in.
    const s = isCurrentContent(migrated) ? migrated : null;
    if (migrated && !s) localStorage.removeItem(SAVE_KEY);
    if (s) {
      save = s as unknown as Record<string, unknown>;
      if (typeof s.day === 'number') day = s.day;
      if (typeof s.minutes === 'number') minutes = s.minutes;
      if (Array.isArray(s.objs) && s.objs.length) objs = s.objs as unknown as ObjectInstance[];
      // A house from before the rugs were pieces gets the two it used to have painted on the floor, once. A rug the player
      // already put away (or one that is in the house) is not added again.
      const saved = s as unknown as { flags?: Record<string, unknown>; storage?: Array<{ id?: string }> };
      // The same for the TV, from when it was part of the living room wall.
      const once = (ids: string[]) => {
        for (const id of ids) {
          const piece = INITIAL_OBJS.find((o) => o.id === id);
          if (piece && !objs.some((o) => o.id === id) && !(saved.storage ?? []).some((o) => o?.id === id)) objs.push({ ...piece });
        }
      };
      if (!saved.flags?.rugObjects) once(STARTER_RUG_IDS);
      if (!saved.flags?.tvObject) once(STARTER_TV_IDS);
      // The office came later: a house saved before it is given its pieces once (no content-version change, nothing of the player's is touched).
      if (saved.flags?.officeLayout !== OFFICE_LAYOUT) { objs = objs.filter((o) => o.level !== 5); once(STARTER_OFFICE_IDS); }
      // A small piece whose table is gone goes back on the floor.
      for (const o of objs) if (o.on && !objs.some((h) => h.id === o.on)) { delete o.on; delete o.z; }
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
  // Bills are separate now (state/finance.ts): the old single bill is retired.
  household.bill = null;
  household.nextBillAt = null;
  const life = parseLife(save?.life, day);
  const pets = Array.isArray(save?.pets) ? (save!.pets as unknown[]).map(revivePet).filter((p): p is Pet => !!p) : [];
  const petFood = typeof save?.petFood === 'number' ? save!.petFood as number : 6;
  const petSeq = Math.max(typeof save?.petSeq === 'number' ? save!.petSeq as number : 0, ...pets.map(p => Number((p.id.match(/\d+$/) || ['0'])[0])));
  return { day, minutes, objs, save, household, life, pets, petFood, petSeq };
}
