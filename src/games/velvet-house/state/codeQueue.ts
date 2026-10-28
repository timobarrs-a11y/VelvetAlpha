/**
 * Codes entered on the title screen. There is no house yet at the start menu, so a code typed there is checked and
 * saved, and redeemed when the player is in their house (systems/codeQueue.ts). Stored as a plain list of what was typed.
 */

export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export const QUEUE_MAX = 20;

export function readQueue(store: KeyValueStore, key: string): string[] {
  try {
    const v = JSON.parse(store.getItem(key) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, QUEUE_MAX) : [];
  } catch { return []; }
}

export function writeQueue(store: KeyValueStore, key: string, list: string[]): void {
  try { if (list.length) store.setItem(key, JSON.stringify(list.slice(0, QUEUE_MAX))); else store.removeItem(key); } catch { /* storage blocked */ }
}

export function enqueue(store: KeyValueStore, key: string, code: string): void {
  writeQueue(store, key, [...readQueue(store, key), code.trim()]);
}
