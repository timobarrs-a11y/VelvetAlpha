/**
 * Save schema versioning and migration.
 * v1 → v2 migration renames hard-coded character names to player/partner,
 * groups fields logically, and adds a forward-compatible extension bag.
 * v1 stays valid in the cloud column for rollback safety.
 */
import type { SaveData, SaveDataV1, SaveDataV2 } from './types';

const CURRENT_VERSION = 2 as const;

export function migrateSave(raw: unknown): SaveDataV2 | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (s.v === 1) return migrateV1toV2(s as unknown as SaveDataV1);
  if (s.v === 2) return s as unknown as SaveDataV2;
  return null;
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

export { CURRENT_VERSION };
