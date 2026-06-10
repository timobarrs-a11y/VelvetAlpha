import { useState, useCallback } from 'react';
import { AvatarConfigV2 } from '../types/avatar-v2';

export interface FavoriteSlot {
  config: AvatarConfigV2;
  label?: string;
  savedAt: number;
}

const MAX_FAVORITES = 3;

function buildKey(namespace: string): string {
  return `avatar_favorites_${namespace}`;
}

function loadSlots(namespace: string): FavoriteSlot[] {
  try {
    const raw = localStorage.getItem(buildKey(namespace));
    if (!raw) return [];
    return JSON.parse(raw) as FavoriteSlot[];
  } catch {
    return [];
  }
}

function persistSlots(namespace: string, slots: FavoriteSlot[]): void {
  try {
    localStorage.setItem(buildKey(namespace), JSON.stringify(slots));
  } catch {}
}

export function useAvatarFavorites(namespace: string = 'default') {
  const [favorites, setFavorites] = useState<FavoriteSlot[]>(() => loadSlots(namespace));

  const addFavorite = useCallback((config: AvatarConfigV2, label?: string) => {
    setFavorites(prev => {
      const slot: FavoriteSlot = { config, label, savedAt: Date.now() };
      const next = [...prev, slot];
      if (next.length > MAX_FAVORITES) {
        next.shift();
      }
      persistSlots(namespace, next);
      return next;
    });
  }, [namespace]);

  const removeFavorite = useCallback((index: number) => {
    setFavorites(prev => {
      const next = prev.filter((_, i) => i !== index);
      persistSlots(namespace, next);
      return next;
    });
  }, [namespace]);

  const applyFavorite = useCallback((index: number): AvatarConfigV2 | null => {
    const slot = favorites[index];
    return slot ? slot.config : null;
  }, [favorites]);

  return { favorites, addFavorite, removeFavorite, applyFavorite, maxSlots: MAX_FAVORITES };
}
