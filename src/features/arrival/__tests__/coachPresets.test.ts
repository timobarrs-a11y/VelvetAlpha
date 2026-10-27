import { describe, it, expect } from 'vitest';
import { CATCH_ALL_PRESETS, COACH_PRESETS, helperPresetFor } from '../coachPresets';
import { getCuratedExperts } from '../../../config/signatureExperts';
import { HEADWEAR, OUTFITS } from '../../../data/avatarItems';

const all = [...Object.values(COACH_PRESETS), ...CATCH_ALL_PRESETS.male, ...CATCH_ALL_PRESETS.female];

describe('helper presets', () => {
  it('has a coach for every curated expert, and only for them', () => {
    const curated = getCuratedExperts().map(e => e.id).sort();
    expect(Object.keys(COACH_PRESETS).sort()).toEqual(curated);
  });

  it('gives everyone a different name', () => {
    const names = all.map(p => p.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('wears starter wardrobe only, so a lapsed plan never changes a helper', () => {
    const starterOutfits = new Set(OUTFITS.filter(o => o.tier === 'starter').map(o => o.id));
    const starterHats = new Set(HEADWEAR.filter(h => h.tier === 'starter').map(h => h.id));
    for (const p of all) {
      expect(starterOutfits.has(p.avatar.outfit ?? 'tee')).toBe(true);
      expect(starterHats.has(p.avatar.headwear ?? 'none')).toBe(true);
      expect(p.avatar.gender).toBe(p.gender);
    }
  });

  it('picks a coach by expert, and a stable catch-all otherwise', () => {
    expect(helperPresetFor({ expertId: 'chef_coach', helperGender: 'female', goalText: 'x', kind: 'coach' }).name).toBe('James');
    const a = helperPresetFor({ expertId: null, helperGender: 'female', goalText: 'Buy a home', kind: 'assistant' });
    const b = helperPresetFor({ expertId: null, helperGender: 'female', goalText: 'Buy a home', kind: 'assistant' });
    expect(a.id).toBe(b.id);
    expect(a.gender).toBe('female');
  });
});
