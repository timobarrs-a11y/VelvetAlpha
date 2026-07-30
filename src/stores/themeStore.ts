import { create } from 'zustand';

// Theme handling for the app. The palette lives in CSS variables (see
// src/index.css): :root holds the dark theme, html[data-theme="light"] the
// light theme. This store owns the *choice* and reflects it onto the <html>
// element. Dark is the default so the app is unchanged when a user has never
// picked a theme.

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'va-theme';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

function readStoredPreference(): ThemePreference {
  if (typeof localStorage === 'undefined') return 'dark';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'dark';
}

/** Reflect the resolved theme onto <html data-theme="..."> (light only; dark is
 *  the CSS default, so we clear the attribute to fall back to :root). */
function applyResolvedTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (resolved === 'light') {
    root.setAttribute('data-theme', 'light');
  } else {
    root.removeAttribute('data-theme');
  }
}

interface ThemeStoreState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  /** Set an explicit preference and persist it. */
  setPreference: (pref: ThemePreference) => void;
  /** Convenience: flip between light and dark (collapses 'system' to explicit). */
  toggle: () => void;
  /** Call once on app boot to sync store <-> DOM and start listening to the OS. */
  init: () => void;
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  preference: 'dark',
  resolved: 'dark',

  setPreference: (pref) => {
    const resolved = resolveTheme(pref);
    applyResolvedTheme(resolved);
    try { localStorage.setItem(STORAGE_KEY, pref); } catch { /* ignore */ }
    set({ preference: pref, resolved });
  },

  toggle: () => {
    const next: ThemePreference = get().resolved === 'dark' ? 'light' : 'dark';
    get().setPreference(next);
  },

  init: () => {
    const preference = readStoredPreference();
    const resolved = resolveTheme(preference);
    applyResolvedTheme(resolved);
    set({ preference, resolved });

    // Follow the OS when the user's preference is 'system'.
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        if (get().preference !== 'system') return;
        const r = systemPrefersDark() ? 'dark' : 'light';
        applyResolvedTheme(r);
        set({ resolved: r });
      };
      // addEventListener is supported in all target browsers; guard just in case.
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  },
}));
