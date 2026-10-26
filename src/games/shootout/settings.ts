// Shootout display settings kept on this device.

export type Look = 'arena' | 'retro';
const KEY = 'velvet.shootout.look';

export function getLook(): Look {
  try { return localStorage.getItem(KEY) === 'retro' ? 'retro' : 'arena'; } catch { return 'arena'; }
}
export function setLook(l: Look): void {
  try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
}

/** The angle you shoot from. First person is the default; the timing is the same from every one. */
export type View = 'first' | 'sideline' | 'courtside' | 'behind' | 'baseline' | 'above';
export const VIEWS: View[] = ['first', 'sideline', 'courtside', 'behind', 'baseline', 'above'];
export const VIEW_NAMES: Record<View, string> = { first: 'First person', sideline: 'Sideline', courtside: 'Courtside', behind: 'Behind', baseline: 'Baseline', above: 'Above the rim' };
const VIEW_KEY = 'velvet.shootout.view';

export function getView(): View {
  try { const v = localStorage.getItem(VIEW_KEY) as View | null; return v && VIEWS.includes(v) ? v : 'first'; } catch { return 'first'; }
}
export function setView(v: View): void {
  try { localStorage.setItem(VIEW_KEY, v); } catch { /* storage blocked */ }
}
