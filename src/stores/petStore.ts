import { create } from 'zustand';
import { useRef } from 'react';
import { petService, PetState, DEFAULT_PET_STATE } from '../services/petService';
import { supabase } from '../shared/supabase/client';
import { getLv, LXP, LUNLOCK } from '../components/pet/AnimalSprite';

export interface PetStats {
  hunger: number;
  mood: number;
  clean: number;
  xp: number;
  level: number;
}

interface PetStoreState {
  enabled: boolean;
  name: string;
  animalType: 'cat' | 'bunny';
  stats: PetStats;
  pendingLevelUp: number | null;
  isLoading: boolean;
  _userId: string | null;
  _companionId: string | null;
  _lastLevel: number;
  _saveTimer: ReturnType<typeof setTimeout> | null;
  _currentStats: PetStats & { petName: string; animalType: string };
}

interface PetStoreActions {
  init: (userId: string, companionId: string) => Promise<void>;
  handleStats: (s: PetStats) => void;
  clearLevelUp: () => void;
  setName: (name: string) => Promise<void>;
  setAnimalType: (v: 'cat' | 'bunny') => void;
  flushSave: () => void;
}

export const usePetStore = create<PetStoreState & PetStoreActions>((set, get) => ({
  enabled: false,
  name: DEFAULT_PET_STATE.petName,
  animalType: DEFAULT_PET_STATE.animalType,
  stats: { hunger: DEFAULT_PET_STATE.hunger, mood: DEFAULT_PET_STATE.mood, clean: DEFAULT_PET_STATE.clean, xp: DEFAULT_PET_STATE.xp, level: DEFAULT_PET_STATE.level },
  pendingLevelUp: null,
  isLoading: false,
  _userId: null,
  _companionId: null,
  _lastLevel: 1,
  _saveTimer: null,
  _currentStats: { ...DEFAULT_PET_STATE },

  init: async (userId: string, companionId: string) => {
    set({ isLoading: true, _userId: userId, _companionId: companionId });
    let state = await petService.load(userId, companionId);
    if (!state) state = await petService.init(userId, companionId);
    if (state) {
      const s: PetStats = { hunger: state.hunger, mood: state.mood, clean: state.clean, xp: state.xp, level: state.level };
      set({
        name: state.petName,
        animalType: state.animalType,
        stats: s,
        _lastLevel: state.level,
        _currentStats: { ...s, petName: state.petName, animalType: state.animalType },
      });
    }
    set({ enabled: true, isLoading: false });

    window.addEventListener('beforeunload', get().flushSave);
  },

  handleStats: (incoming: PetStats) => {
    const { _lastLevel, _saveTimer, _userId, _companionId, _currentStats, flushSave } = get();
    const newLevel = getLv(incoming.xp);
    set({ stats: incoming });
    const next = { ...incoming, petName: _currentStats.petName, animalType: _currentStats.animalType };
    set({ _currentStats: next });
    if (newLevel > _lastLevel) {
      set({ _lastLevel: newLevel, pendingLevelUp: newLevel });
    }
    if (_saveTimer) clearTimeout(_saveTimer);
    const timer = setTimeout(() => {
      const { _userId: uid, _companionId: cid, _currentStats: cs } = get();
      if (uid && cid) petService.save(uid, cid, cs);
    }, 5000);
    set({ _saveTimer: timer });
  },

  clearLevelUp: () => set({ pendingLevelUp: null }),

  setName: async (name: string) => {
    const { _userId, _companionId, _currentStats } = get();
    set({ name });
    const next = { ..._currentStats, petName: name };
    set({ _currentStats: next });
    if (_userId && _companionId) await petService.rename(_userId, _companionId, name);
  },

  setAnimalType: (v: 'cat' | 'bunny') => {
    const { _currentStats } = get();
    set({ animalType: v, _currentStats: { ..._currentStats, animalType: v } });
  },

  flushSave: () => {
    const { _userId, _companionId, _currentStats } = get();
    if (_userId && _companionId) petService.save(_userId, _companionId, _currentStats);
  },
}));

export function usePetRefs() {
  const actionsRef = useRef<any>(null);
  const catPosRef = useRef<{ cx: number; cy: number; surface: string }>({ cx: 0, cy: 0, surface: 'floor' });
  return { actionsRef, catPosRef };
}
