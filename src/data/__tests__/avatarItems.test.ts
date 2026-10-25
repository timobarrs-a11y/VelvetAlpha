import { describe, it, expect } from 'vitest';
import {
  OUTFITS, HEADWEAR, FACE_ACCESSORIES, AVATAR_KITS, STARTER_ONLY,
  itemUnlock, kitUnlock, kitTier, outfitItem, headwearItem, faceAccessoryItem, resolveAvatarForDisplay,
} from '../avatarItems';
import { migrateAvatarConfig } from '../../utils/avatarConfig';

const MEMBER = { member: true, earned: [] };
const pirate = migrateAvatarConfig({ gender: 'female', ...AVATAR_KITS.find(k => k.id === 'pirate')!.look });

describe('avatar item catalogue', () => {
  it('every fallback is a starter item, so a locked item always has something to show', () => {
    for (const o of OUTFITS) expect(outfitItem(o.fallback).tier).toBe('starter');
    for (const h of HEADWEAR) expect(headwearItem(h.fallback).tier).toBe('starter');
    for (const f of FACE_ACCESSORIES) expect(faceAccessoryItem(f.fallback).tier).toBe('starter');
  });

  it('earned items name the medal that unlocks them', () => {
    for (const item of [...OUTFITS, ...HEADWEAR, ...FACE_ACCESSORIES]) {
      if (item.tier === 'earned') expect(item.medal).toBeTruthy();
    }
  });

  it('kits only use items that exist', () => {
    for (const kit of AVATAR_KITS) {
      if (kit.look.outfit) expect(OUTFITS.map(o => o.id)).toContain(kit.look.outfit);
      if (kit.look.headwear) expect(HEADWEAR.map(h => h.id)).toContain(kit.look.headwear);
      if (kit.look.faceAccessory) expect(FACE_ACCESSORIES.map(f => f.id)).toContain(kit.look.faceAccessory);
    }
  });
});

describe('unlocks', () => {
  it('starter is open to everyone, member needs a plan, earned needs its medal', () => {
    expect(itemUnlock(outfitItem('suit'), STARTER_ONLY).ok).toBe(true);
    expect(itemUnlock(outfitItem('pirate'), STARTER_ONLY)).toEqual({ ok: false, need: 'membership' });
    expect(itemUnlock(outfitItem('pirate'), MEMBER).ok).toBe(true);
    expect(itemUnlock(headwearItem('top_hat'), MEMBER)).toEqual({ ok: false, need: 'hat-trick' });
    expect(itemUnlock(headwearItem('top_hat'), { member: false, earned: ['hat-trick'] }).ok).toBe(true);
  });

  it('a kit is as locked as its most locked item', () => {
    const lawyer = AVATAR_KITS.find(k => k.id === 'lawyer')!;
    const pirateKit = AVATAR_KITS.find(k => k.id === 'pirate')!;
    expect(kitTier(lawyer)).toBe('starter');
    expect(kitTier(pirateKit)).toBe('member');
    expect(kitUnlock(pirateKit, STARTER_ONLY).ok).toBe(false);
    expect(kitUnlock(pirateKit, MEMBER).ok).toBe(true);
  });
});

describe('resolveAvatarForDisplay', () => {
  it('leaves an allowed look untouched', () => {
    expect(resolveAvatarForDisplay(pirate, MEMBER)).toBe(pirate);
  });

  it('swaps locked items for their fallbacks, with the fallback outfit in its own colours', () => {
    const shown = resolveAvatarForDisplay(pirate, STARTER_ONLY);
    expect(shown.outfit).toBe('linen');
    expect(shown.outfitColor).toBe(outfitItem('linen').color);
    expect(shown.outfitAccent).toBe(outfitItem('linen').accent);
    expect(shown.headwear).toBe('none');
    expect(shown.faceAccessory).toBe('none');
    expect(shown.earrings).toBe('hoops');
  });

  it('never changes the saved look, so rejoining restores it', () => {
    const before = JSON.stringify(pirate);
    resolveAvatarForDisplay(pirate, STARTER_ONLY);
    expect(JSON.stringify(pirate)).toBe(before);
  });

  it('keeps earned items through a lapsed plan', () => {
    const look = { ...pirate, headwear: 'top_hat' as const };
    const shown = resolveAvatarForDisplay(look, { member: false, earned: ['hat-trick'] });
    expect(shown.headwear).toBe('top_hat');
    expect(shown.outfit).toBe('linen');
  });
});

describe('migrateAvatarConfig', () => {
  it('gives older saved avatars the navy tee they always wore', () => {
    const old = migrateAvatarConfig({ gender: 'male', skinTone: '#f4c2a0' });
    expect(old.outfit).toBe('tee');
    expect(old.outfitColor).toBe('#1e293b');
    expect(old.headwear).toBe('none');
    expect(old.faceAccessory).toBe('none');
  });
});
