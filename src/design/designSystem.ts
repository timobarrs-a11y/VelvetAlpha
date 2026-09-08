/**
 * Velvet Design System — A/B variant runtime.
 *
 *  A = the current (pre-release) design language, as defined by the Velvet Lobby.
 *  B = the new, consistent dark-purple design system.
 *
 * The active variant is written to `<html data-design="a|b">` and every token in
 * `design-system.css` resolves from that attribute. Nothing else in the app needs
 * to know which variant is active — components consume `var(--ds-*)` tokens or the
 * `.ds-*` component classes and get the right look automatically.
 *
 * Resolution order (highest wins):
 *   1. `?design=a|b` query param (persisted once seen)
 *   2. localStorage `velvet.design`
 *   3. DEFAULT_VARIANT
 */
import { useSyncExternalStore } from 'react';

export type DesignVariant = 'a' | 'b';

export const DESIGN_VARIANTS: { id: DesignVariant; label: string; description: string }[] = [
  { id: 'a', label: 'A · Current',  description: 'The existing lobby look — navy-to-black gradient, solid feature tiles.' },
  { id: 'b', label: 'B · Velvet',   description: 'Unified dark-purple system — glass surfaces, accent-tinted tiles, one header.' },
];

export const DEFAULT_VARIANT: DesignVariant = 'b';
const STORAGE_KEY = 'velvet.design';

const listeners = new Set<() => void>();
let current: DesignVariant = DEFAULT_VARIANT;

function isVariant(v: unknown): v is DesignVariant {
  return v === 'a' || v === 'b';
}

function apply(variant: DesignVariant) {
  current = variant;
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.design = variant;
  }
  listeners.forEach(l => l());
}

/** Call once before first render (main.tsx) so there is no flash of the wrong variant. */
export function initDesignVariant(): DesignVariant {
  let resolved: DesignVariant = DEFAULT_VARIANT;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isVariant(stored)) resolved = stored;
  } catch { /* storage unavailable */ }

  try {
    const fromQuery = new URLSearchParams(window.location.search).get('design');
    if (isVariant(fromQuery)) {
      resolved = fromQuery;
      try { localStorage.setItem(STORAGE_KEY, fromQuery); } catch { /* ignore */ }
    }
  } catch { /* no window */ }

  apply(resolved);
  return resolved;
}

export function getDesignVariant(): DesignVariant {
  return current;
}

export function setDesignVariant(variant: DesignVariant) {
  if (!isVariant(variant) || variant === current) return;
  try { localStorage.setItem(STORAGE_KEY, variant); } catch { /* ignore */ }
  apply(variant);
}

export function toggleDesignVariant() {
  setDesignVariant(current === 'a' ? 'b' : 'a');
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** React hook — re-renders when the variant changes. */
export function useDesignVariant(): [DesignVariant, (v: DesignVariant) => void] {
  const variant = useSyncExternalStore(subscribe, getDesignVariant, () => DEFAULT_VARIANT);
  return [variant, setDesignVariant];
}
