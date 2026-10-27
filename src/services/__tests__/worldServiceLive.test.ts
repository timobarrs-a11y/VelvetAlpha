import { describe, it, expect, vi } from 'vitest';

vi.mock('../../shared/supabase/client', () => ({ supabase: {} }));

import { cardToPlot, type WorldCard } from '../worldService';

const card = (over: Partial<WorldCard> = {}): WorldCard => ({
  user_id: 'u1', slot_index: 3, house: { style: 'standard' }, sign: {}, yard: {},
  is_member: false, earned: [], is_public: true, display_name: 'Leah', headline: null,
  goal_label: null, goal_pct: null, medals: [], medal_count: 0, spaces: [], new_neighbor: false,
  ...over,
});

describe('cardToPlot live marker', () => {
  it('marks a real person live', () => {
    expect(cardToPlot(card({ is_live: true })).profile.live).toBe(true);
  });
  it('does not mark a bot or seeded profile live', () => {
    expect(cardToPlot(card({ is_live: false })).profile.live).toBe(false);
  });
  it('is not live before the migration adds the column', () => {
    expect(cardToPlot(card()).profile.live).toBe(false);
  });
});
