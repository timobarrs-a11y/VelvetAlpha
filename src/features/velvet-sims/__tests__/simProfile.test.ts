import { describe, it, expect } from 'vitest';
import { buildHeadSprites, buildBodySprites, signatureOutfit, buildProfile, buildWardrobe, avatarFromGameLook, buildAvatarLook } from '../simProfile';
import { migrateAvatarConfig } from '../../../utils/avatarConfig';
import { validHeadSvgs } from '../../../games/velvet-house/state/headSprites';
import { validWardrobe, validOutfit, SIGNATURE_STYLES } from '../../../games/velvet-house/state/clothing';
import { PERSONAS } from '../../../data/avatarItems';
import { validBodySvgs, HAND_SPRITE } from '../../../games/velvet-house/state/bodySprites';
import { validOutfit } from '../../../games/velvet-house/state/clothing';
import { STARTER_ONLY } from '../../../data/avatarItems';

const pirate = { gender: 'male', hairStyle: 'short', outfit: 'pirate', outfitColor: '#5a1f2b', outfitAccent: '#c9a24a', headwear: 'tricorn', _version: 4 };

describe('Velvet Sims profile', () => {
  it('sends head frames the game accepts, as standalone SVG images', () => {
    const sprites = buildHeadSprites(migrateAvatarConfig(pirate));
    expect(Object.keys(validHeadSvgs(sprites) ?? {})).toHaveLength(7);
    expect(sprites.neutral.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
  });

  it('sends hands in the avatar\'s skin tone that the game accepts, sized the way the game draws them', () => {
    const hands = buildBodySprites(migrateAvatarConfig({ ...pirate, skinTone: '#8d5524' }));
    expect(Object.keys(validBodySvgs(hands) ?? {})).toHaveLength(4);
    expect(hands.relaxed.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(hands.fist).toContain('viewBox="0 0 ' + HAND_SPRITE.w + ' ' + HAND_SPRITE.h + '"');
    // Shaded from the skin tone, so a different skin gives a different hand.
    expect(hands.relaxed).not.toEqual(buildBodySprites(migrateAvatarConfig({ ...pirate, skinTone: '#f1c9a5' })).relaxed);
  });

  it('turns the wardrobe into a game outfit the game accepts', () => {
    const outfit = signatureOutfit(migrateAvatarConfig(pirate));
    expect(outfit).toMatchObject({ style: 'pirate', color: '#EFE6D2', accent: '#5a1f2b' });
    expect(validOutfit(outfit)).not.toBeNull();
    expect(signatureOutfit(migrateAvatarConfig({ outfit: 'suit', outfitColor: '#1f2a44', outfitAccent: '#8a2d3b' })))
      .toMatchObject({ style: 'blazer', color: '#1f2a44', accent: '#8a2d3b', bottom: '#1f2a44' });
  });

  it('dresses a lapsed member in the fallback, as everywhere else', () => {
    const companion = { custom_name: 'Maya', gender: 'female', avatar_config: pirate, hobbies: [] };
    const msg = buildProfile(null, companion as never, true, STARTER_ONLY);
    const look = msg.companion.look as { outfit: { style: string }; sprites: unknown; top?: string };
    expect(look.outfit.style).toBe('linen');
    expect(look.sprites).toBeTruthy();
    // The signature outfit sets the top colour, not the favourite colour.
    expect(look.top).toBeUndefined();
  });

  it('leaves the original game exactly as it was without the avatar option', () => {
    const companion = { custom_name: 'Maya', gender: 'female', avatar_config: pirate, hobbies: [], favorite_color: 'teal' };
    const look = buildProfile(null, companion as never, true).companion.look as Record<string, unknown>;
    expect(look.sprites).toBeUndefined();
    expect(look.top).toBe('#3D6B73');
  });
});

describe('Velvet Sims wardrobe', () => {
  const MEMBER = { member: true, earned: [] as string[], owned: [] as string[] };
  const personaLook = (id: string) => migrateAvatarConfig({ gender: 'male', ...PERSONAS.find(p => p.id === id)!.look });

  it('sends each persona as a game outfit with its shirt style, pants cut and trim', () => {
    for (const p of PERSONAS) {
      const o = signatureOutfit(personaLook(p.id));
      expect(validOutfit(o), p.id).not.toBeNull();
      expect(SIGNATURE_STYLES.has(o.style), p.id).toBe(true);
    }
    expect(signatureOutfit(personaLook('cheerleader'))).toMatchObject({ style: 'cheer', bottomStyle: 'cheer_skirt', bottom: '#c2262e', bottomAccent: '#f4f1ea' });
    expect(signatureOutfit(personaLook('rapper'))).toMatchObject({ style: 'streetwear', bottomStyle: 'baggy' });
    expect(signatureOutfit(personaLook('lawyer'))).toMatchObject({ style: 'blazer', bottomStyle: 'trousers', bottom: '#1f2a44' });
  });

  it('keeps the game pants as they were for an avatar that never picked any', () => {
    expect(signatureOutfit(migrateAvatarConfig({ outfit: 'pirate' }))).toMatchObject({ bottom: '#4A3A2A', bottomStyle: 'breeches' });
    expect(signatureOutfit(migrateAvatarConfig({ outfit: 'tee' }))).toMatchObject({ bottom: '#3D5B8A', bottomStyle: 'jeans' });
  });

  it('changes the signature key when only the pants change, so the game puts them on', () => {
    const a = signatureOutfit(personaLook('chef')), b = signatureOutfit({ ...personaLook('chef'), bottom: 'leather', bottomColor: '#16161a' });
    expect(a.key).not.toBe(b.key);
  });

  it('lists every piece and persona a member may wear, in a form the game accepts', () => {
    const w = validWardrobe(buildWardrobe(MEMBER, 'chef_hat'))!;
    expect(w.personas.map(p => p.id)).toEqual(PERSONAS.map(p => p.id));
    expect(w.pieces.filter(p => p.slot === 'top')).toHaveLength(12);
    expect(w.pieces.filter(p => p.slot === 'bottom')).toHaveLength(11);
    expect(w.hat).toBe('chef_hat');
    // Lawyers and presidents wear their own navy trousers, not the plain pair.
    expect(w.personas.find(p => p.id === 'lawyer')?.bottomCol).toBe('#1f2a44');
    expect(w.personas.find(p => p.id === 'cop')?.bottomCol).toBeUndefined();
  });

  it('leaves out what someone without a plan may not wear', () => {
    const w = validWardrobe(buildWardrobe({ member: false, earned: [], owned: [] }))!;
    const ids = w.pieces.map(p => p.id);
    for (const locked of ['w-top-rockstar', 'w-bottom-leather', 'w-hat-snapback', 'w-hat-tricorn', 'w-top-pirate']) expect(ids, locked).not.toContain(locked);
    for (const free of ['w-top-cop', 'w-bottom-jeans', 'w-hat-nurse_cap']) expect(ids, free).toContain(free);
    expect(w.personas.map(p => p.id)).toEqual(['lawyer', 'chef', 'doctor', 'cop', 'nurse', 'cheerleader']);
  });

  it('sends the wardrobe with the player only', () => {
    const player = { name: 'Sam', nickname: null, avatar_config: { gender: 'male', outfit: 'cop', headwear: 'cop_cap' }, favorite_color: null };
    const companion = { custom_name: 'Maya', gender: 'female', avatar_config: { gender: 'female' }, hobbies: [] };
    const msg = buildProfile(player, companion as never, true, MEMBER);
    expect((msg.player.look as { wardrobe?: { hat?: string } }).wardrobe?.hat).toBe('cop_cap');
    expect((msg.companion.look as { wardrobe?: unknown }).wardrobe).toBeUndefined();
  });
});

describe('changing clothes in the game', () => {
  it('turns the game shirt into the avatar outfit, with the colours it was sent', () => {
    expect(avatarFromGameLook({ top: { style: 'cop', color: '#2c4a7a', accent: '#c9a24a' } })).toEqual({ outfit: 'cop', outfitColor: '#2c4a7a', outfitAccent: '#c9a24a' });
    expect(avatarFromGameLook({ top: { style: 'blazer', color: '#1f2a44' } })).toEqual({ outfit: 'suit', outfitColor: '#1f2a44' });
    // A hoodie or flannel from the game's shop has no avatar match: a tee in the same colour.
    expect(avatarFromGameLook({ top: { style: 'flannel', color: '#a63a2c' } })).toEqual({ outfit: 'tee', outfitColor: '#a63a2c' });
    // The pirate's vest colour travels as the accent, over a cream shirt.
    expect(avatarFromGameLook({ top: { style: 'pirate', color: '#EFE6D2', accent: '#5a1f2b' } })).toEqual({ outfit: 'pirate', outfitColor: '#5a1f2b' });
  });

  it('turns game pants into avatar pants, with their trim', () => {
    expect(avatarFromGameLook({ bottom: { style: 'cheer_skirt', color: '#c2262e', accent: '#f4f1ea' } })).toEqual({ bottom: 'cheer_skirt', bottomColor: '#c2262e', bottomAccent: '#f4f1ea' });
    // The shop's plain pants are jeans; an unknown cut changes nothing.
    expect(avatarFromGameLook({ bottom: { style: 'pants', color: '#3d5b8a' } })).toMatchObject({ bottom: 'jeans', bottomColor: '#3d5b8a' });
    expect(avatarFromGameLook({ bottom: { style: 'spacesuit', color: '#3d5b8a' } })).toEqual({});
  });

  it('takes a hat only if it is an avatar hat, and ignores bad colours', () => {
    expect(avatarFromGameLook({ hat: 'nurse_cap' })).toEqual({ headwear: 'nurse_cap' });
    expect(avatarFromGameLook({ hat: 'beanie' })).toEqual({ headwear: 'beanie' });
    expect(avatarFromGameLook({ hat: 'sombrero' })).toEqual({});
    expect(avatarFromGameLook({ top: { style: 'cop', color: 'red' } })).toEqual({});
  });

  it('answers a hat change with fresh head frames and hands the game accepts', () => {
    const m = buildAvatarLook(migrateAvatarConfig({ headwear: 'hair_bow' }));
    expect(m).toMatchObject({ type: 'velvet:avatarLook', who: 'player' });
    expect(Object.keys(validHeadSvgs(m.sprites) ?? {})).toHaveLength(7);
    expect(m.sprites.neutral).toContain('<svg');
  });
});
