import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../../shared/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
const { runHousesOp, fetchFriendHouse } = await import('../velvetHouseVisits');

const OWNER = '0b0e3f8a-8f1c-4d2a-9e51-2c4b7d9a1e00';

describe('friends\' houses for the game', () => {
  beforeEach(() => rpc.mockReset());

  it('lists friends with their names and days, as the game reads them', async () => {
    rpc.mockResolvedValue({ data: [{ owner_id: OWNER, owner_name: 'Bo', day: 12 }, { owner_id: null }, { owner_id: 'x', owner_name: null, day: null }], error: null });
    expect(await runHousesOp('friends')).toEqual({ ok: true, data: [{ ownerId: OWNER, name: 'Bo', day: 12 }, { ownerId: 'x', name: 'A friend', day: null }] });
    expect(rpc).toHaveBeenCalledWith('velvet_house_friend_houses');
  });

  it('reads and sets whether the player\'s house is open', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await runHousesOp('open')).toEqual({ ok: true, data: true });
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await runHousesOp('setOpen', false)).toEqual({ ok: true, data: false });
    expect(rpc).toHaveBeenLastCalledWith('velvet_house_set_visits_open', { p_open: false });
    expect(await runHousesOp('setOpen')).toEqual({ ok: false });
  });

  it('says no on an error, and asks for a house only by an account id', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    expect(await runHousesOp('friends')).toEqual({ ok: false });
    expect(await fetchFriendHouse(OWNER)).toBeNull();
    rpc.mockReset();
    expect(await fetchFriendHouse('not-an-id')).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: { day: 3, objs: [] }, error: null });
    expect(await fetchFriendHouse(OWNER)).toEqual({ day: 3, objs: [] });
  });
});
