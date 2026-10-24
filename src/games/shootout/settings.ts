// Shootout display settings kept on this device.

export type Look = 'arena' | 'retro';
const KEY = 'velvet.shootout.look';

export function getLook(): Look {
  try { return localStorage.getItem(KEY) === 'retro' ? 'retro' : 'arena'; } catch { return 'arena'; }
}
export function setLook(l: Look): void {
  try { localStorage.setItem(KEY, l); } catch { /* storage blocked */ }
}
