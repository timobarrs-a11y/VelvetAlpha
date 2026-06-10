import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '../shared/supabase/client';
import {
  getDailyCheckinStatus,
  performDailyCheckin,
  updateActivePointer,
  updateCursorPrefs,
  UserCustomization,
  POINTER_SYMBOLS,
  CURSOR_COLOR_OPTIONS,
  BUTTON_HOVER_STYLES,
} from '../services/customizationService';

interface CustomizationContextValue {
  customization: UserCustomization | null;
  loading: boolean;
  checkedInToday: boolean;
  justUnlocked: string[];
  activePointerDef: typeof POINTER_SYMBOLS[number];
  activeCursorColor: typeof CURSOR_COLOR_OPTIONS[number];
  activeButtonHoverStyle: typeof BUTTON_HOVER_STYLES[number];
  setPointer: (key: string) => Promise<void>;
  setShowTrail: (show: boolean) => Promise<void>;
  setTrailStyle: (style: string) => Promise<void>;
  setAnimationStyle: (style: string) => Promise<void>;
  setCursorColor: (colorKey: string) => Promise<void>;
  setButtonHoverStyle: (style: string) => Promise<void>;
  setTranslucentUI: (enabled: boolean) => Promise<void>;
  setLeftRailCollapsed: (collapsed: boolean) => Promise<void>;
  dismissUnlockNotice: () => void;
}

const CustomizationContext = createContext<CustomizationContextValue | null>(null);

export function CustomizationProvider({ children }: { children: ReactNode }) {
  const [customization, setCustomization] = useState<UserCustomization | null>(null);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const userIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    userIdRef.current = user.id;

    const { alreadyCheckedIn, customization: c } = await getDailyCheckinStatus(user.id);
    setCustomization(c);
    setCheckedInToday(alreadyCheckedIn);
    setLoading(false);

    if (!alreadyCheckedIn) {
      const prevUnlocked = c.unlocked_pointers;
      const updated = await performDailyCheckin(user.id);
      const newOnes = updated.unlocked_pointers.filter(k => !prevUnlocked.includes(k));
      setCustomization(updated);
      setCheckedInToday(true);
      if (newOnes.length > 0) setJustUnlocked(newOnes);
    }
  }, []);

  useEffect(() => {
    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') load();
      if (event === 'SIGNED_OUT') {
        setCustomization(null);
        setCheckedInToday(false);
        setJustUnlocked([]);
        setLoading(false);
        userIdRef.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, [load]);

  const setPointer = useCallback(async (key: string) => {
    setCustomization(prev => {
      if (!prev) return prev;
      const sym = POINTER_SYMBOLS.find(s => s.key === key);
      const isUnlocked = sym?.unlockDay === 0 || prev.unlocked_pointers.includes(key);
      if (!isUnlocked) return prev;
      return { ...prev, active_pointer: key };
    });
    const uid = userIdRef.current;
    if (uid) updateActivePointer(uid, key).catch(() => {});
  }, []);

  const setShowTrail = useCallback(async (show: boolean) => {
    setCustomization(prev => prev ? { ...prev, show_trail: show } : prev);
    const uid = userIdRef.current;
    if (uid) updateCursorPrefs(uid, { show_trail: show }).catch(() => {});
  }, []);

  const setAnimationStyle = useCallback(async (style: string) => {
    setCustomization(prev => prev ? { ...prev, animation_style: style } : prev);
    const uid = userIdRef.current;
    if (uid) updateCursorPrefs(uid, { animation_style: style }).catch(() => {});
  }, []);

  const setTrailStyle = useCallback(async (style: string) => {
    setCustomization(prev => prev ? { ...prev, trail_style: style } : prev);
    const uid = userIdRef.current;
    if (uid) updateCursorPrefs(uid, { trail_style: style }).catch(() => {});
  }, []);

  const setCursorColor = useCallback(async (colorKey: string) => {
    setCustomization(prev => prev ? { ...prev, cursor_color: colorKey } : prev);
    const uid = userIdRef.current;
    if (uid) updateCursorPrefs(uid, { cursor_color: colorKey }).catch(() => {});
  }, []);

  const setButtonHoverStyle = useCallback(async (style: string) => {
    setCustomization(prev => prev ? { ...prev, button_hover_style: style } : prev);
    const uid = userIdRef.current;
    if (uid) updateCursorPrefs(uid, { button_hover_style: style }).catch(() => {});
  }, []);

  const setTranslucentUI = useCallback(async (enabled: boolean) => {
    setCustomization(prev => prev ? { ...prev, translucent_ui: enabled } : prev);
    const uid = userIdRef.current;
    if (uid) updateCursorPrefs(uid, { translucent_ui: enabled }).catch(() => {});
  }, []);

  const setLeftRailCollapsed = useCallback(async (collapsed: boolean) => {
    setCustomization(prev => prev ? { ...prev, left_rail_collapsed: collapsed } : prev);
    const uid = userIdRef.current;
    if (uid) updateCursorPrefs(uid, { left_rail_collapsed: collapsed }).catch(() => {});
  }, []);

  const dismissUnlockNotice = useCallback(() => setJustUnlocked([]), []);

  const activePointerDef = POINTER_SYMBOLS.find(s => s.key === customization?.active_pointer) ?? POINTER_SYMBOLS[0];

  const activeCursorColor = CURSOR_COLOR_OPTIONS.find(c => c.key === customization?.cursor_color)
    ?? CURSOR_COLOR_OPTIONS[0];

  const activeButtonHoverStyle = BUTTON_HOVER_STYLES.find(s => s.key === (customization?.button_hover_style ?? 'none'))
    ?? BUTTON_HOVER_STYLES[0];

  return (
    <CustomizationContext.Provider value={{
      customization,
      loading,
      checkedInToday,
      justUnlocked,
      activePointerDef,
      activeCursorColor,
      activeButtonHoverStyle,
      setPointer,
      setShowTrail,
      setTrailStyle,
      setAnimationStyle,
      setCursorColor,
      setButtonHoverStyle,
      setTranslucentUI,
      setLeftRailCollapsed,
      dismissUnlockNotice,
    }}>
      {children}
    </CustomizationContext.Provider>
  );
}

export function useCustomizationContext(): CustomizationContextValue {
  const ctx = useContext(CustomizationContext);
  if (!ctx) throw new Error('useCustomizationContext must be used inside CustomizationProvider');
  return ctx;
}
