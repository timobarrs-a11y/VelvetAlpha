import { create } from 'zustand';
import type { AvatarConfigV2 } from '../types/avatar-v2';

// Quick avatar editing from anywhere a face is shown: tap a face, edit, save.
// Companions and coaches are both rows in `companions`; your own avatar lives
// on your profile.
export type AvatarEditTarget = { kind: 'companion'; id: string } | { kind: 'user' };

interface AvatarEditorState {
  target: AvatarEditTarget | null;
  open: (target: AvatarEditTarget) => void;
  close: () => void;
}

export const useAvatarEditor = create<AvatarEditorState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));

// Anything showing an avatar can listen for saves and update in place.
export interface AvatarSaved {
  target: AvatarEditTarget;
  config: AvatarConfigV2;
}

const SAVED_EVENT = 'velvet:avatar-saved';

export function announceAvatarSaved(detail: AvatarSaved): void {
  window.dispatchEvent(new CustomEvent<AvatarSaved>(SAVED_EVENT, { detail }));
}

export function onAvatarSaved(cb: (saved: AvatarSaved) => void): () => void {
  const listener = (e: Event) => cb((e as CustomEvent<AvatarSaved>).detail);
  window.addEventListener(SAVED_EVENT, listener);
  return () => window.removeEventListener(SAVED_EVENT, listener);
}
