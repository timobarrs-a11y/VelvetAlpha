import { describe, it, expect } from 'vitest';
import { canUse, itemId, parseItemId, howToGet, lookItems, resolveLookForDisplay, simsShopItems, EARNING_LIVE } from '../avatarCatalog';
import { STARTER_ONLY } from '../avatarItems';
import { migrateAvatarConfig } from '../../utils/avatarConfig';

describe('avatar catalog', () => {
  it('reads and writes item ids, and rejects anything else', () => {
    expect(itemId('hairStyle', 'bantu_knots')).toBe('hairStyle:bantu_knots');
    expect(parseItemId('hairColor:#e07a9f')).toEqual({ slot: 'hairColor', value: '#e07a9f' });
    expect(parseItemId('skinTone:#3a2010')).toBeNull();
    expect(parseItemId('hairStyle:<script>')).toBeNull();
  });

  it('treats pants like any other wardrobe slot', () => {
    expect(parseItemId('bottom:leather')).toEqual({ slot: 'bottom', value: 'leather' });
    expect(parseItemId('bottomColor:#17171b')).toEqual({ slot: 'bottomColor', value: '#17171b' });
    expect(howToGet(itemId('bottom', 'leather'))).toEqual({ how: 'member' });
    expect(howToGet(itemId('bottom', 'jeans'))).toEqual({ how: 'free' });
    expect(howToGet(itemId('outfit', 'rockstar'))).toEqual({ how: 'member' });
    expect(howToGet(itemId('headwear', 'snapback'))).toEqual({ how: 'member' });
    expect(howToGet(itemId('headwear', 'nurse_cap'))).toEqual({ how: 'free' });
    expect(lookItems({ outfit: 'rockstar', bottom: 'leather', headwear: 'bandana' })).toEqual([
      'outfit:rockstar', 'bottom:leather', 'headwear:bandana',
    ]);
  });

  it('never makes who someone is into an item', () => {
    for (const slot of ['skinTone', 'eyeShape', 'noseShape', 'lipShape', 'faceShape', 'eyeColor']) {
      expect(parseItemId(`${slot}:anything`)).toBeNull();
    }
  });

  it('keeps the wardrobe tiers: members and medals', () => {
    expect(howToGet('outfit:pirate')).toEqual({ how: 'member' });
    expect(howToGet('headwear:top_hat')).toEqual({ how: 'medal', medal: 'hat-trick' });
    expect(canUse('outfit:pirate', STARTER_ONLY)).toEqual({ ok: false, need: 'membership' });
    expect(canUse('outfit:pirate', { member: true, earned: [] }).ok).toBe(true);
  });

  it('counts anything owned, whatever its rule', () => {
    expect(canUse('outfit:pirate', { member: false, earned: [], owned: ['outfit:pirate'] }).ok).toBe(true);
    expect(canUse('headwear:top_hat', { member: false, earned: [], owned: ['headwear:top_hat'] }).ok).toBe(true);
  });

  it('lists the Velvet Sims shop, and leaves shop and reward items open until earning goes live', () => {
    expect(simsShopItems()).toContainEqual({ id: 'hairStyle:bantu_knots', price: 150 });
    expect(howToGet('hairColor:#e07a9f')).toEqual({ how: 'reward', reward: 'dyed-hair' });
    expect(canUse('hairStyle:bantu_knots', STARTER_ONLY).ok).toBe(!EARNING_LIVE);
    expect(canUse('hairStyle:afro', STARTER_ONLY).ok).toBe(true);
  });

  it('finds every item a look is wearing', () => {
    const look = migrateAvatarConfig({ gender: 'female', hairStyle: 'bob', hairColor: '#2a1f1a', outfit: 'pirate', headwear: 'tricorn', earrings: 'hoops' });
    expect(lookItems(look)).toEqual(expect.arrayContaining(['hairStyle:bob', 'outfit:pirate', 'headwear:tricorn', 'earrings:hoops']));
  });

  it("shows a look someone can't use with fallbacks, and never changes the saved one", () => {
    const look = migrateAvatarConfig({ gender: 'male', outfit: 'pirate', headwear: 'tricorn' });
    const shown = resolveLookForDisplay(look, STARTER_ONLY);
    expect(shown.outfit).toBe('linen');
    expect(shown.headwear).toBe('none');
    expect(look.outfit).toBe('pirate');
    expect(resolveLookForDisplay(look, { member: false, earned: [], owned: ['outfit:pirate', 'headwear:tricorn'] }).outfit).toBe('pirate');
  });
});
