import { describe, expect, it } from 'vitest';
import { bedside, cartEntry, createRoomService } from '../systems/roomService';
import { INITIAL_OBJS } from '../state/objects';

describe('room service', () => {
  it('comes in upstairs at the top of the stairs', () => {
    expect(cartEntry(2)).toEqual([0.75, 7.5]);
  });
  it('parks on the open side of the bed, clear of it', () => {
    const bed = INITIAL_OBJS.find((o) => o.type === 'bed')!;
    const [x, y] = bedside(bed);
    expect(x).toBeGreaterThan(bed.x + 2.5);
    expect(y).toBeGreaterThan(bed.y);
    expect(y).toBeLessThan(bed.y + 1.6);
  });
});

describe('the Victorian candelabra', () => {
  const sleeper = (level: number, act: string | null) => ({ level, task: act ? { act, phase: 'do' } : null, away: null });
  const setup = (people: unknown[]) => {
    let on = true; const logs: string[] = [];
    const g = { world: { objs: [{ id: 'c', type: 'tallcandelabra', level: 2, x: 1, y: 1, rot: 0 }] }, people, view: { t: 0 }, log: (m: string) => logs.push(m), house: {},
      art: { candlesOn: () => on, candles: (_: string, v: boolean) => { on = v; } } } as never;
    return { tick: createRoomService(g).candlesTick!, isOn: () => on, logs };
  };
  it('goes out by itself once someone on its floor is asleep', () => {
    const s = setup([sleeper(2, 'sleep'), sleeper(1, null)]);
    s.tick();
    expect(s.isOn()).toBe(false);
    expect(s.logs[0]).toMatch(/go out one by one/);
  });
  it('stays lit while everyone on its floor is awake, or asleep on another floor', () => {
    const s = setup([sleeper(2, 'read'), sleeper(1, 'sleep')]);
    s.tick();
    expect(s.isOn()).toBe(true);
  });
});
