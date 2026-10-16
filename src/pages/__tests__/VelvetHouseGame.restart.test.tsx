import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const db = vi.hoisted(() => ({
  cloud: null as Record<string, unknown> | null,
  history: [] as Record<string, unknown>[],
}));

vi.mock('../../shared/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
    },
  },
}));

vi.mock('../../services/companionService', () => ({ getCompanion: async () => null }));

vi.mock('../../services/velvetHouseDatabase', () => ({
  loadVelvetHouseSave: vi.fn(async () => db.cloud),
  saveVelvetHouseProgress: vi.fn(async (_id: string, save: Record<string, unknown>, force = false) => {
    if (!force && db.cloud && (db.cloud.day as number) > (save.day as number)) return;
    db.cloud = save;
  }),
  saveVelvetHouseHistory: vi.fn(async (_id: string, save: Record<string, unknown>) => {
    db.history.push(save);
  }),
  maybeSnapshotHistory: vi.fn(async () => {}),
}));

import { VelvetHouseGame } from '../VelvetHouseGame';

const SAVE_KEY = 'velvet-house-v1:c1';
const RESTART_KEY = 'velvet-restart-pending:c1';

function mount() {
  return render(
    <MemoryRouter initialEntries={['/games/velvet-house?companion=c1']}>
      <VelvetHouseGame />
    </MemoryRouter>,
  );
}

async function iframeOf(container: HTMLElement) {
  let frame: HTMLIFrameElement | null = null;
  await waitFor(() => {
    frame = container.querySelector('iframe');
    expect(frame).not.toBeNull();
  });
  return frame as unknown as HTMLIFrameElement;
}

function fromGame(frame: HTMLIFrameElement, data: unknown) {
  window.dispatchEvent(new MessageEvent('message', { data, source: frame.contentWindow }));
}

describe('VelvetHouseGame restart', () => {
  beforeEach(() => {
    localStorage.clear();
    db.cloud = { v: 1, day: 12, minutes: 600 };
    db.history = [];
  });

  it('uploads the fresh game over a more advanced cloud save after a restart', async () => {
    const { container, unmount } = mount();
    const frame = await iframeOf(container);
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).day).toBe(12);

    // The game wipes its save, announces the restart, then reloads.
    localStorage.removeItem(SAVE_KEY);
    act(() => fromGame(frame, { type: 'velvet:restarted', game: 'velvet-house', day: 1 }));
    expect(localStorage.getItem(RESTART_KEY)).not.toBeNull();

    // After the reload the fresh game writes its first save, then the host syncs.
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, day: 1, minutes: 380 }));
    window.dispatchEvent(new Event('beforeunload'));

    await waitFor(() => expect(db.cloud?.day).toBe(1));
    expect(db.history).toContainEqual({ v: 1, day: 12, minutes: 600 });
    await waitFor(() => expect(localStorage.getItem(RESTART_KEY)).toBeNull());
    unmount();
  });

  it('keeps the fresh local game if the page reopens before the restart reached the cloud', async () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, day: 1, minutes: 380 }));
    localStorage.setItem(RESTART_KEY, '1');

    const { container, unmount } = mount();
    await iframeOf(container);
    expect(JSON.parse(localStorage.getItem(SAVE_KEY)!).day).toBe(1);

    window.dispatchEvent(new Event('beforeunload'));
    await waitFor(() => expect(db.cloud?.day).toBe(1));
    unmount();
  });

  it('still refuses to roll back a cloud save without a restart', async () => {
    const { container, unmount } = mount();
    await iframeOf(container);

    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: 1, day: 1, minutes: 380 }));
    window.dispatchEvent(new Event('beforeunload'));

    await new Promise((r) => setTimeout(r, 20));
    expect(db.cloud?.day).toBe(12);
    unmount();
  });
});
