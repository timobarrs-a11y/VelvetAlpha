// Field Notes — persistent record of which response types the player has
// discovered to be super/normal/weak against each emotional state.
// This turns the game's hidden "type chart" into visible, earned mastery.
// Stored in localStorage so progress carries across sessions and runs.

export type Eff = 'super' | 'normal' | 'weak';

type NotesMap = Record<string, Eff>; // key: `${emotion}:${type}`

const KEY = 'velvet_social_combat_field_notes';

function load(): NotesMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as NotesMap) : {};
  } catch {
    return {};
  }
}

function save(map: NotesMap): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — notes simply won't persist this session */
  }
}

const noteKey = (emotion: string, type: string) => `${emotion}:${type}`;

export function getFieldNotes(): NotesMap {
  return load();
}

export function isDiscovered(emotion: string, type: string): boolean {
  return noteKey(emotion, type) in load();
}

/**
 * Record a discovered matchup. Returns true only the FIRST time a given
 * emotion×type pairing is learned, so callers can celebrate the discovery.
 */
export function recordFieldNote(emotion: string, type: string, eff: Eff): boolean {
  const map = load();
  const k = noteKey(emotion, type);
  if (k in map) return false;
  map[k] = eff;
  save(map);
  return true;
}

export function discoveredCount(): number {
  return Object.keys(load()).length;
}
