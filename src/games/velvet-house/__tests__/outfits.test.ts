import { describe, it, expect } from 'vitest';
import { occasionForAct, seasonOccasion, nextAuto, NEW_AUTO, wornRefs, outfitFor, type SavedOutfit } from '../state/outfits';
import type { OwnedCloth } from '../state/clothing';
import { generateGarment } from '../state/garment';

const piece = (id: string, slot: 'top' | 'bottom', col = '#112233', style = 'tee'): OwnedCloth => ({ id, slot, style, col, name: id });
const closet: OwnedCloth[] = [piece('t-day', 'top'), piece('t-gym', 'top', '#445566'), piece('b-day', 'bottom', '#222222', 'pants'), piece('b-gym', 'bottom', '#333333', 'shorts')];
const outfits: SavedOutfit[] = [
  { id: 'o1', name: 'Gym', occasion: 'workout', top: { id: 't-gym', col: '#445566' }, bottom: { id: 'b-gym', col: '#333333' } },
  { id: 'o2', name: 'Day', occasion: 'everyday', top: { id: 't-day', col: '#112233' }, bottom: { id: 'b-day', col: '#222222' } },
];
const dayWorn = { top: { id: 't-day', col: '#112233' }, bottom: { id: 'b-day', col: '#222222' } };

describe('occasions', () => {
  it('knows what an activity calls for', () => {
    expect(occasionForAct('lift')).toBe('workout');
    expect(occasionForAct('nap')).toBe('sleep');
    expect(occasionForAct('freelance')).toBe('work');
    expect(occasionForAct('tv')).toBeNull();
    expect(occasionForAct(null)).toBeNull();
  });
  it('wears seasonal outfits in their season only', () => {
    expect(seasonOccasion(3)).toBe('winter');
    expect(seasonOccasion(1)).toBe('summer');
    expect(seasonOccasion(0)).toBeNull();
  });
});

describe('changing automatically', () => {
  it('changes into the workout outfit when the workout starts and back when it ends', () => {
    let r = nextAuto(NEW_AUTO, { act: 'lift', seasonIdx: 0, worn: dayWorn }, outfits, closet);
    expect(r.move!.wear.top!.id).toBe('t-gym');
    expect(r.state.active).toBe('workout');
    expect(r.state.prior).toEqual(dayWorn);
    // Still working out: nothing more to do.
    expect(nextAuto(r.state, { act: 'lift', seasonIdx: 0, worn: { top: { id: 't-gym', col: '#445566' } } }, outfits, closet).move).toBeNull();
    r = nextAuto(r.state, { act: null, seasonIdx: 0, worn: {} }, outfits, closet);
    expect(r.move!.wear.top!.id).toBe('t-day');
    expect(r.state).toEqual(NEW_AUTO);
  });

  it('goes back to what they were wearing when there is no everyday outfit', () => {
    const only = outfits.slice(0, 1);
    const on = nextAuto(NEW_AUTO, { act: 'workout', seasonIdx: 0, worn: dayWorn }, only, closet);
    const off = nextAuto(on.state, { act: null, seasonIdx: 0, worn: {} }, only, closet);
    expect(off.move!.wear).toEqual(dayWorn);
  });

  it('does nothing for an occasion with no saved outfit, and does not change on every tick', () => {
    expect(nextAuto(NEW_AUTO, { act: 'nap', seasonIdx: 0, worn: dayWorn }, outfits, closet).move).toBeNull();
    expect(nextAuto(NEW_AUTO, { act: 'tv', seasonIdx: 0, worn: dayWorn }, outfits, closet).move).toBeNull();
  });

  it('ignores an outfit whose pieces have left the closet', () => {
    expect(outfitFor(outfits, 'workout', closet.slice(0, 2))).toBeUndefined();
  });

  it('puts on a winter outfit in winter, and switches between occasions without forgetting the original', () => {
    const winter: SavedOutfit = { id: 'o3', name: 'Cosy', occasion: 'winter', top: { id: 't-gym', col: '#445566' } };
    const all = [...outfits, winter];
    const w = nextAuto(NEW_AUTO, { act: null, seasonIdx: 3, worn: dayWorn }, all, closet);
    expect(w.state.active).toBe('winter');
    const g = nextAuto(w.state, { act: 'lift', seasonIdx: 3, worn: {} }, all, closet);
    expect(g.state.active).toBe('workout');
    expect(g.state.prior).toEqual(dayWorn);
  });
});

describe('what is worn', () => {
  it('finds designed and plain pieces by what they look like', () => {
    const garment = generateGarment(5, { slot: 'top' });
    const designed: OwnedCloth = { id: 'g-1', slot: 'top', style: 'tee', col: garment.base, name: 'D', recipe: garment };
    const c = [designed, ...closet];
    expect(wornRefs({ top: garment.base, topStyle: 'tee', bottom: '#222222', bottomStyle: 'pants', topGarment: garment }, c).top!.id).toBe('g-1');
    expect(wornRefs({ top: '#112233', topStyle: 'tee', bottom: '#222222', bottomStyle: 'pants' }, c)).toEqual(dayWorn);
  });
});
