import { describe, it, expect } from 'vitest';
import { voiceAttire, voiceAttirePieces, attireUnlocks, ATTIRE_VOICE_IDS, PICKABLE_VOICE_IDS } from '../voiceAttire';
import { OUTFITS, BOTTOMS, HEADWEAR, STARTER_ONLY, resolveAvatarForDisplay } from '../../data/avatarItems';
import { DEFAULT_FEMALE_AVATAR_V2 } from '../../types/avatar-v2';

describe('signature attire', () => {
  it('every voice a person can pick has attire, and nothing else does', () => {
    expect([...ATTIRE_VOICE_IDS].sort()).toEqual([...PICKABLE_VOICE_IDS].sort());
    expect(voiceAttire('classic_male')).toBeNull();
    expect(voiceAttire(null)).toBeNull();
  });

  it('is made only of pieces that exist, and never needs a medal', () => {
    for (const id of ATTIRE_VOICE_IDS) {
      const a = voiceAttire(id)!;
      const o = OUTFITS.find(x => x.id === a.outfit), b = BOTTOMS.find(x => x.id === a.bottom), h = HEADWEAR.find(x => x.id === a.headwear);
      expect(o, `${id} outfit`).toBeTruthy();
      expect(b, `${id} bottom`).toBeTruthy();
      expect(h, `${id} headwear`).toBeTruthy();
      expect([o!.tier, b!.tier, h!.tier], id).not.toContain('earned');
    }
  });

  it('a free person is not stripped of their voice\'s attire, but is of anyone else\'s', () => {
    const mine = { ...DEFAULT_FEMALE_AVATAR_V2, ...voiceAttire('shakespearean')! };
    expect(resolveAvatarForDisplay(mine as never, STARTER_ONLY).outfit).toBe('linen');
    expect(resolveAvatarForDisplay(mine as never, attireUnlocks(STARTER_ONLY, 'shakespearean')).outfit).toBe('pirate');
    expect(resolveAvatarForDisplay(mine as never, attireUnlocks(STARTER_ONLY, 'cheerleader')).outfit).toBe('linen');
  });

  it('lists the shirt, pants and any hat as owned pieces', () => {
    expect(voiceAttirePieces('bad_boy')).toEqual(['outfit:rockstar', 'bottom:leather']);
    expect(voiceAttirePieces('homie')).toEqual(['outfit:streetwear', 'bottom:baggy', 'headwear:snapback']);
    expect(voiceAttirePieces('classic_female')).toEqual([]);
  });
});

describe('the database mirror of the attire', () => {
  it('lists the same shirt, pants and hat for every voice as the app does', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const dir = 'supabase/migrations';
    const file = readdirSync(dir).find(f => f.endsWith('_companion_voice_attire.sql'))!;
    const sql = readFileSync(`${dir}/${file}`, 'utf8');
    const rows = [...sql.matchAll(/\('([a-z_]+)', '([a-z_]+)', '([a-z_]+)', '([a-z_]+)'\)/g)].map(m => ({ voice: m[1], outfit: m[2], bottom: m[3], headwear: m[4] }));
    expect(rows.map(r => r.voice).sort()).toEqual([...ATTIRE_VOICE_IDS].sort());
    for (const r of rows) {
      const a = voiceAttire(r.voice)!;
      expect({ outfit: r.outfit, bottom: r.bottom, headwear: r.headwear }, r.voice).toEqual({ outfit: a.outfit, bottom: a.bottom, headwear: a.headwear });
    }
  });
});
