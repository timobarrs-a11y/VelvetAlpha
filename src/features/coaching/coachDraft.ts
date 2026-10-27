// A message waiting to be typed into a coach's chat box on the next page: the Atlas plan screen sends people to the
// lobby, where the coach's chat pops up, and the question they chose to ask is already in the box.

const KEY = 'velvet.coachDraft';
const MAX_AGE_MS = 10 * 60 * 1000;

export function stashCoachDraft(companionId: string, text: string, now = Date.now()): void {
  try { sessionStorage.setItem(KEY, JSON.stringify({ companionId, text, at: now })); } catch { /* storage blocked: they just type it */ }
}

/** The waiting message for this coach, once: it is used up whether or not it was for them. */
export function takeCoachDraft(companionId: string, now = Date.now()): string | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { companionId?: string; text?: string; at?: number };
    if (saved.companionId !== companionId) return null;
    sessionStorage.removeItem(KEY);
    if (typeof saved.text !== 'string' || !saved.text) return null;
    return typeof saved.at === 'number' && now - saved.at <= MAX_AGE_MS ? saved.text : null;
  } catch { return null; }
}
