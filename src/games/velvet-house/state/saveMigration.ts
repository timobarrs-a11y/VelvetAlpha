/**
 * Save schema versioning and migration.
 * v1 → v2 migration is additive: stores an RNG seed, keeps all v1 fields.
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
    rngSeed: (s.savedAt ?? Date.now()) >>> 0,
  };
}

export function isV2(s: SaveData): s is SaveDataV2 {
  return s.v === 2;
}

export { CURRENT_VERSION };
