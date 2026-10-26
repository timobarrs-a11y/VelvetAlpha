import { describe, it, expect } from 'vitest';
import {
  OUTFITS, BOTTOMS, HEADWEAR, FACE_ACCESSORIES, AVATAR_KITS, PERSONAS, STARTER_ONLY,
  itemUnlock, kitUnlock, kitTier, outfitItem, bottomItem, headwearItem, faceAccessoryItem, resolveAvatarForDisplay,
  resolveBottom, personaOf, personaPiece,
} from '../avatarItems';
import { migrateAvatarConfig, applyAvatarChange } from '../../utils/avatarConfig';

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

  it('keeps short cuts short when every hairstyle opens to everyone', () => {
    // Before version 4, these three names meant a short cut on a male avatar.
    expect(migrateAvatarConfig({ gender: 'male', hairStyle: 'sleek' }).hairStyle).toBe('slick_back');
    expect(migrateAvatarConfig({ gender: 'male', hairStyle: 'wavy', _version: 3 }).hairStyle).toBe('short_wavy');
    expect(migrateAvatarConfig({ gender: 'male', hairStyle: 'locs' }).hairStyle).toBe('locs_short');
    expect(migrateAvatarConfig({ gender: 'female', hairStyle: 'sleek' }).hairStyle).toBe('sleek');
    expect(migrateAvatarConfig({ gender: 'male', hairStyle: 'short' }).hairStyle).toBe('short');
  });

  it('never renames a style someone picked on the current version', () => {
    const picked = applyAvatarChange({ gender: 'male', hairStyle: 'short' }, { hairStyle: 'sleek' });
    expect(picked.hairStyle).toBe('sleek');
    expect(migrateAvatarConfig(picked).hairStyle).toBe('sleek');
  });

  it('reads an old config the old way before applying an edit', () => {
    const edited = applyAvatarChange({ gender: 'male', hairStyle: 'sleek' }, { eyeColor: '#4a8ccc' });
    expect(edited.hairStyle).toBe('slick_back');
  });
});

describe('personas', () => {
  const persona = (id: string) => PERSONAS.find(p => p.id === id)!;

  it('are the four kits that always existed plus six new ones', () => {
    expect(PERSONAS.map(p => p.id)).toEqual([
      'lawyer', 'chef', 'doctor', 'cop', 'nurse', 'cheerleader', 'pirate', 'rockstar', 'rapper', 'president',
    ]);
    expect(AVATAR_KITS).toBe(PERSONAS);
    expect(new Set(PERSONAS.map(p => p.id)).size).toBe(PERSONAS.length);
  });

  it('are a shirt, pants and a hat, all of which exist and match what the persona sets', () => {
    for (const p of PERSONAS) {
      expect(OUTFITS.map(o => o.id), p.id).toContain(p.top);
      expect(BOTTOMS.map(b => b.id), p.id).toContain(p.bottom);
      expect(HEADWEAR.map(h => h.id), p.id).toContain(p.hat);
      expect(p.look.outfit, p.id).toBe(p.top);
      expect(p.look.bottom, p.id).toBe(p.bottom);
      expect(p.look.headwear, p.id).toBe(p.hat);
    }
  });

  it('give every pants and shirt a starter fallback', () => {
    for (const b of BOTTOMS) expect(bottomItem(b.fallback).tier, b.id).toBe('starter');
    for (const o of OUTFITS) expect(outfitItem(o.fallback).tier, o.id).toBe('starter');
  });

  it('keep the free personas free and the premium ones for members', () => {
    for (const id of ['lawyer', 'chef', 'doctor', 'cop', 'nurse', 'cheerleader']) expect(kitTier(persona(id)), id).toBe('starter');
    for (const id of ['pirate', 'rockstar', 'rapper', 'president']) {
      expect(kitTier(persona(id)), id).toBe('member');
      expect(kitUnlock(persona(id), STARTER_ONLY).ok, id).toBe(false);
      expect(kitUnlock(persona(id), MEMBER).ok, id).toBe(true);
    }
  });

  it('can be mixed: chef whites with rockstar pants and a cheerleader bow', () => {
    const look = migrateAvatarConfig({
      gender: 'female', ...persona('chef').look, ...personaPiece(persona('rockstar'), 'bottom'), ...personaPiece(persona('cheerleader'), 'hat'),
    });
    expect(look.outfit).toBe('chef');
    expect(look.bottom).toBe('leather');
    expect(look.headwear).toBe('hair_bow');
    expect(personaOf(look)).toBeNull();
  });

  it('are recognised while all three pieces belong to the same one, whatever the colours', () => {
    const chef = migrateAvatarConfig({ gender: 'male', ...persona('chef').look });
    expect(personaOf(chef)?.id).toBe('chef');
    expect(personaOf({ ...chef, outfitColor: '#c2262e', bottomColor: '#3d5b8a' })?.id).toBe('chef');
    expect(personaOf({ ...chef, headwear: 'none' })).toBeNull();
  });
});

describe('pants', () => {
  it('match the shirt when none are picked, so avatars saved before pants keep the trousers they had', () => {
    const tee = resolveBottom(migrateAvatarConfig({ gender: 'male' }));
    expect(tee).toMatchObject({ id: 'jeans', color: '#3D5B8A', matched: true });
    expect(resolveBottom(migrateAvatarConfig({ outfit: 'pirate' }))).toMatchObject({ id: 'breeches', color: '#4A3A2A' });
    expect(resolveBottom(migrateAvatarConfig({ outfit: 'chef' }))).toMatchObject({ id: 'chef_pants', color: '#2B2B30' });
    expect(resolveBottom(migrateAvatarConfig({ outfit: 'labcoat' }))).toMatchObject({ id: 'trousers', color: '#3A4250' });
    expect(resolveBottom(migrateAvatarConfig({ outfit: 'linen' }))).toMatchObject({ id: 'trousers', color: '#6B5A45' });
    // A suit's trousers are the jacket's colour, however it is dyed.
    expect(resolveBottom(migrateAvatarConfig({ outfit: 'suit', outfitColor: '#334455' }))).toMatchObject({ id: 'trousers', color: '#334455' });
  });

  it('follow a new shirt until some are picked, then stay put', () => {
    const picked = { ...migrateAvatarConfig({ outfit: 'cop' }), bottom: 'baggy' as const };
    expect(resolveBottom(picked)).toMatchObject({ id: 'baggy', color: bottomItem('baggy').color, matched: false });
    expect(resolveBottom({ ...picked, outfit: 'chef' }).id).toBe('baggy');
    expect(resolveBottom({ ...picked, bottomColor: '#123456' }).color).toBe('#123456');
  });

  it('swap locked pants for a starter pair, with their own colours, and never touch the saved look', () => {
    const look = migrateAvatarConfig({ gender: 'male', ...PERSONAS.find(p => p.id === 'rockstar')!.look });
    const before = JSON.stringify(look);
    const shown = resolveAvatarForDisplay(look, STARTER_ONLY);
    expect(shown.outfit).toBe('tee');
    expect(shown.bottom).toBe('jeans');
    expect(shown.bottomColor).toBe(bottomItem('jeans').color);
    expect(JSON.stringify(look)).toBe(before);
    expect(resolveAvatarForDisplay(look, MEMBER)).toBe(look);
  });

  it('leave matched pants alone when only the shirt is locked: they follow the fallback shirt', () => {
    const shown = resolveAvatarForDisplay(migrateAvatarConfig({ outfit: 'pirate' }), STARTER_ONLY);
    expect(shown.bottom).toBeUndefined();
    expect(resolveBottom(shown).id).toBe('trousers');
  });
});
