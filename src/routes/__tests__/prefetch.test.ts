import { describe, it, expect, vi } from 'vitest';

const loaded: string[] = [];
vi.mock('../../pages/HousePage', () => { loaded.push('HousePage'); return { default: () => null }; });
vi.mock('../../pages/GoalDetailPage', () => { loaded.push('GoalDetailPage'); return { default: () => null }; });

import { prefetchRoute } from '../prefetch';

describe('prefetchRoute', () => {
  it('fetches the page behind a link once, by its first path segment, and ignores paths it does not know', async () => {
    prefetchRoute('/spaces/abc?tab=crews');
    prefetchRoute('/spaces');
    prefetchRoute('/goal/123');
    prefetchRoute('/nowhere');
    await vi.waitFor(() => expect(loaded.sort()).toEqual(['GoalDetailPage', 'HousePage']));
  });
});
