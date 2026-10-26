import { describe, it, expect } from 'vitest';
import { buildHeadSprites, buildBodySprites, signatureOutfit, buildProfile } from '../simProfile';
import { migrateAvatarConfig } from '../../../utils/avatarConfig';
import { validHeadSvgs } from '../../../games/velvet-house/state/headSprites';
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
