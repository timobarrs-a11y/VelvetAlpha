import { loadVelvetHouseSaveCopies } from '../../services/velvetHouseDatabase';
import { migrateSave, isCurrentContent } from '../../games/velvet-house/state/saveMigration';

/** The day a companion's house has reached (this browser's copy first, then the account's), or null if there is no house. */
export async function houseDay(companionId: string): Promise<number | null> {
  const dayOf = (raw: unknown): number | null => {
    try {
      const s = migrateSave(raw as never) as unknown as { day?: unknown } | null;
      return s && isCurrentContent(s as never) && typeof s.day === 'number' ? s.day : null;
    } catch { return null; }
  };
  try {
    const local = dayOf(JSON.parse(localStorage.getItem(`velvet-sims:${companionId}`) ?? 'null'));
    if (local !== null) return local;
  } catch { /* unreadable local copy: try the account */ }
  try {
    const copies = await loadVelvetHouseSaveCopies(companionId);
    return dayOf(copies?.v2 ?? copies?.v1 ?? null);
  } catch { return null; }
}
