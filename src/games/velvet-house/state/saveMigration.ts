/**
 * Save schema versioning and migration.
 * v1 → v2 migration renames hard-coded character names to player/partner,
 * groups fields logically, and adds a forward-compatible extension bag.
 * v1 stays valid in the cloud column for rollback safety.
 */
import type { SaveData, SaveDataV1, SaveDataV2, SaveDataV3 } from './types';

const CURRENT_VERSION = 3 as const;
/** 1 = before the story and Dez. 2 = the first save that has them. 3 = walls down from the start and the box in the kitchen gap (every earlier house starts over). */
export const CONTENT_VERSION = 3;
/** Saves older than this are not carried over: everyone starts again with the move-in. */
export const MIN_CONTENT_VERSION = 3;
/** The content version a save was made with (anything older than the story counts as 1). */
export const isCurrentContent = (s: { contentVersion?: unknown } | null | undefined): boolean => !!s && typeof s.contentVersion === 'number' && s.contentVersion >= MIN_CONTENT_VERSION;

export function migrateSave(raw: unknown): SaveDataV3 | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (s.v === 1) return migrateV2toV3(migrateV1toV2(s as unknown as SaveDataV1));
  if (s.v === 2) return migrateV2toV3(s as unknown as SaveDataV2);
  if (s.v === 3) return s as unknown as SaveDataV3;
  // A save from a newer version of the game: leave it alone rather than guess.
  return null;
}

// What a house level's looks hold. Older builds wrote character looks (skin, hair...) in this slot, or nothing at all.
const isHouseLook = (l: unknown): boolean => !!l && typeof l === 'object' && 'floor' in (l as object) && 'paint' in (l as object);

/**
 * v2 to v3: adds `rev` and `contentVersion`. If the looks were lost by the old save bug, they are cleared and
 * flagged (`ext.looksLost`) so the host can restore them from the cloud copy (see repairFromV1).
 */
export function migrateV2toV3(s: SaveDataV2): SaveDataV3 {
  const out = { ...s, v: 3, rev: 0, contentVersion: 1 } as unknown as SaveDataV3;
  const looks = (s as unknown as { LOOKS?: unknown[] }).LOOKS;
  const lost = !Array.isArray(looks) || looks.length === 0 || !looks.every(isHouseLook);
  if (lost) {
    (out as unknown as { LOOKS: unknown[] }).LOOKS = [];
    out.ext = { ...(s.ext ?? {}), looksLost: true };
  }
  return out;
}

/**
 * Brings back what the old save bug destroyed, from the untouched v1 copy in the cloud (the column the live
 * game never overwrote). Only fills what is missing; never replaces data the save has.
 */
export function repairFromV1(save: SaveDataV3, cloudV1: Record<string, unknown> | null): SaveDataV3 {
  if (!cloudV1) return save;
  const out = { ...save } as unknown as Record<string, unknown>;
  const ext = { ...(save.ext ?? {}) } as Record<string, unknown>;
  const empty = (v: unknown) => v === undefined || v === null || (Array.isArray(v) && v.length === 0);
  if (ext.looksLost && Array.isArray(cloudV1.LOOKS) && cloudV1.LOOKS.length && cloudV1.LOOKS.every(isHouseLook)) {
    out.LOOKS = cloudV1.LOOKS;
    for (const k of ['ROOMLOOK', 'WALLOBJS', 'yard']) if (cloudV1[k] !== undefined) out[k] = cloudV1[k];
    delete ext.looksLost;
  }
  for (const k of ['pets', 'dirt', 'career', 'mcareer']) {
    const mine = out[k];
    const theirs = cloudV1[k];
    const mineIsDefault = empty(mine) || (k.endsWith('career') && (mine as { level?: number; perf?: number })?.level === 0 && (mine as { perf?: number })?.perf === 0);
    if (mineIsDefault && !empty(theirs)) out[k] = theirs;
  }
  out.ext = ext;
  return out as unknown as SaveDataV3;
}

function migrateV1toV2(s: SaveDataV1): SaveDataV2 {
  return {
    ...s,
    v: 2,
    // Rename hard-coded names to player/partner
    player: {
      name: s.simName,
      look: s.look,
      needs: s.jordan?.needs,
      skills: s.jordan?.skills,
      mood: s.jordan?.mood,
    },
    partner: {
      name: s.partnerName,
      look: s.mayaLook,
      needs: s.maya?.needs,
      skills: s.maya?.skills,
      mood: s.maya?.mood,
    },
    // rngSeed from savedAt or current time
    rngSeed: (s.savedAt ?? Date.now()) >>> 0,
    // Forward-compatible extension bag — unknown fields survive migration
    ext: {},
  };
}

export function isV2(s: SaveData): s is SaveDataV2 {
  return s.v === 2;
}

export function isV3(s: SaveData): s is SaveDataV3 {
  return s.v === 3;
}

export { CURRENT_VERSION };
