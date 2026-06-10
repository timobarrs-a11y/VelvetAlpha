import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';
import { petService, PetState, PetStats, DEFAULT_PET_STATE, xpToLevel } from '../services/petService';
import { supabase } from '../shared/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PetActions {
  pet():         void;
  fedByDrag():   void;
  brushStroke(): void;
}

export interface CatPosition {
  cx:      number;
  cy:      number;
  surface: 'floor' | 'wall_r' | 'ceiling' | 'wall_l' | 'air';
}

interface PetContextValue {
  enabled:        boolean;
  released:       boolean;
  petName:        string;
  animalType:     'cat' | 'bunny';
  stats:          PetStats;
  actionsRef:     React.MutableRefObject<PetActions | null>;
  catPosRef:      React.MutableRefObject<CatPosition>;
  setEnabled:     (v: boolean) => void;
  setReleased:    (v: boolean) => void;
  setAnimalType:  (v: 'cat' | 'bunny') => void;
  setPetName:     (name: string) => void;
  handleStats:    (s: PetStats) => void;
  pendingLevelUp: number | null;
  clearLevelUp:   () => void;
  isLoading:      boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const PetContext = createContext<PetContextValue | null>(null);

export function usePet(): PetContextValue {
  const ctx = useContext(PetContext);
  if (!ctx) throw new Error('usePet must be used inside PetProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface PetProviderProps {
  companionId: string | null;
  children:    React.ReactNode;
}

export function PetProvider({ companionId, children }: PetProviderProps) {
  const [userId, setUserId]               = useState<string | null>(null);
  const [enabled, setEnabled]             = useState(false);
  const [released, setReleased]           = useState(false);
  const [petName, setPetNameState]        = useState(DEFAULT_PET_STATE.petName);
  const [animalType, setAnimalTypeState]  = useState<'cat' | 'bunny'>(DEFAULT_PET_STATE.animalType);
  const [stats, setStats]                 = useState<PetStats>({ ...DEFAULT_PET_STATE });
  const [pendingLevelUp, setPendingLevelUp] = useState<number | null>(null);
  const [isLoading, setIsLoading]         = useState(true);

  const actionsRef = useRef<PetActions | null>(null);
  const catPosRef  = useRef<CatPosition>({ cx: 0, cy: 0, surface: 'floor' });

  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLevel    = useRef(1);
  const currentStats = useRef<PetStats & { petName: string; animalType: string }>({ ...DEFAULT_PET_STATE });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId || !companionId) { setIsLoading(false); return; }
    (async () => {
      setIsLoading(true);
      let state = await petService.load(userId, companionId);
      if (!state) state = await petService.init(userId, companionId);
      if (state) {
        setPetNameState(state.petName);
        setAnimalTypeState(state.animalType);
        const s: PetStats = { hunger: state.hunger, mood: state.mood, clean: state.clean, xp: state.xp, level: state.level };
        setStats(s);
        lastLevel.current = state.level;
        currentStats.current = { ...s, petName: state.petName, animalType: state.animalType };
      }
      setEnabled(true);
      setReleased(true);
      setIsLoading(false);
    })();
  }, [userId, companionId]);

  useEffect(() => {
    const flush = () => { if (userId && companionId) petService.save(userId, companionId, currentStats.current); };
    window.addEventListener('beforeunload', flush);
    return () => window.removeEventListener('beforeunload', flush);
  }, [userId, companionId]);

  const handleStats = useCallback((incoming: PetStats) => {
    setStats(incoming);
    // Read petName/animalType from the ref so this callback stays stable
    // across name/type updates — prevents dependent effect restarts.
    currentStats.current = { ...incoming, petName: currentStats.current.petName, animalType: currentStats.current.animalType };
    const newLevel = xpToLevel(incoming.xp);
    if (newLevel > lastLevel.current) { lastLevel.current = newLevel; setPendingLevelUp(newLevel); }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (userId && companionId) petService.save(userId, companionId, currentStats.current);
    }, 5000);
  }, [userId, companionId]);

  const setPetName = useCallback(async (name: string) => {
    setPetNameState(name);
    currentStats.current.petName = name;
    if (userId && companionId) await petService.rename(userId, companionId, name);
  }, [userId, companionId]);

  const setAnimalType = useCallback((v: 'cat' | 'bunny') => {
    setAnimalTypeState(v);
    currentStats.current.animalType = v;
  }, []);

  const clearLevelUp = useCallback(() => setPendingLevelUp(null), []);

  return (
    <PetContext.Provider value={{
      enabled, released, petName, animalType, stats,
      actionsRef, catPosRef,
      setEnabled, setReleased, setAnimalType, setPetName,
      handleStats, pendingLevelUp, clearLevelUp, isLoading,
    }}>
      {children}
    </PetContext.Provider>
  );
}
