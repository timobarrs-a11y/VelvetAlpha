import { describe, it, expect, vi } from 'vitest';
import { useAvatarEditor, announceAvatarSaved, onAvatarSaved } from '../avatarEditorStore';
import { migrateAvatarConfig } from '../../utils/avatarConfig';

describe('avatar editor store', () => {
  it('opens on whichever face was tapped, and closes', () => {
    useAvatarEditor.getState().open({ kind: 'companion', id: 'c1' });
    expect(useAvatarEditor.getState().target).toEqual({ kind: 'companion', id: 'c1' });
    useAvatarEditor.getState().open({ kind: 'user' });
    expect(useAvatarEditor.getState().target).toEqual({ kind: 'user' });
    useAvatarEditor.getState().close();
    expect(useAvatarEditor.getState().target).toBeNull();
  });

  it('tells everything showing an avatar about a save, until it stops listening', () => {
    const seen = vi.fn();
    const off = onAvatarSaved(seen);
    const config = migrateAvatarConfig({ hairStyle: 'bun' });
    announceAvatarSaved({ target: { kind: 'companion', id: 'c1' }, config });
    expect(seen).toHaveBeenCalledWith({ target: { kind: 'companion', id: 'c1' }, config });
    off();
    announceAvatarSaved({ target: { kind: 'user' }, config });
    expect(seen).toHaveBeenCalledTimes(1);
  });
});
