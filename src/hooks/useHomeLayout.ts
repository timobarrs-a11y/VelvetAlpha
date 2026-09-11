import { useSyncExternalStore } from 'react';

export type HomeLayout = 'classic' | 'new';

const STORAGE_KEY = 'velvet.home_layout';
const DEFAULT: HomeLayout = 'new';

const listeners = new Set<() => void>();
let current: HomeLayout = DEFAULT;

function isLayout(v: unknown): v is HomeLayout {
  return v === 'classic' || v === 'new';
}

function resolve(): HomeLayout {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLayout(stored)) return stored;
  } catch { /* storage unavailable */ }
  return DEFAULT;
}

current = resolve();

export function getHomeLayout(): HomeLayout {
  return current;
}

export function setHomeLayout(layout: HomeLayout) {
  if (!isLayout(layout) || layout === current) return;
  current = layout;
  try { localStorage.setItem(STORAGE_KEY, layout); } catch { /* ignore */ }
  listeners.forEach(l => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function useHomeLayout(): [HomeLayout, (v: HomeLayout) => void] {
  const layout = useSyncExternalStore(subscribe, getHomeLayout, () => DEFAULT);
  return [layout, setHomeLayout];
}
