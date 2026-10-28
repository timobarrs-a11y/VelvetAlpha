import { describe, it, expect } from 'vitest';
import { SIGNATURE_VOICES, getVoiceById, getVoicesByCategory, canUseVoice } from '../signatureVoices';
import { VOICE_PROMPTS, getVoicePrompt } from '../../../supabase/functions/_shared/signatureVoicePrompts';
import { VOICE_NEWS_CATEGORIES, voiceNewsFor } from '../voiceNewsCategories';
import { randomVoice } from '../../utils/companionRandomizer';

// The voices live in three places: the app's list (what people pick from), the edge functions' copy (what the
// companion is actually told), and the news lens each one reads the news through. These keep them in step.

describe('signature voices, app and server', () => {
  it('the server has every voice the app offers, word for word, and nothing else', () => {
    expect(Object.keys(VOICE_PROMPTS).sort()).toEqual(SIGNATURE_VOICES.map(v => v.id).sort());
    for (const v of SIGNATURE_VOICES) {
      expect(VOICE_PROMPTS[v.id].name).toBe(v.name);
      expect(VOICE_PROMPTS[v.id].instruction).toBe(v.instruction);
      expect(VOICE_PROMPTS[v.id].examples).toEqual(v.examples ?? []);
    }
  });

  it('every voice has what the picker shows, and an id that is used once', () => {
    expect(new Set(SIGNATURE_VOICES.map(v => v.id)).size).toBe(SIGNATURE_VOICES.length);
    for (const v of SIGNATURE_VOICES) {
      expect(v.name && v.description && v.sample && v.instruction).toBeTruthy();
      expect(['male', 'female', 'neutral']).toContain(v.gender);
      expect(['standard', 'anime', 'culture']).toContain(v.category);
    }
  });

  it('all of them are open to everyone', () => {
    for (const v of SIGNATURE_VOICES) {
      expect(v.premium).toBe(false);
      expect(canUseVoice(v.id, false)).toBe(true);
    }
  });

  it('the picker shows every voice for the gender it suits, so none is unreachable', () => {
    for (const gender of ['male', 'female'] as const) {
      const shown = new Set(['standard', 'anime', 'culture'].flatMap(c => getVoicesByCategory(gender, c as 'standard').map(v => v.id)));
      const suited = SIGNATURE_VOICES.filter(v => v.gender === gender || v.gender === 'neutral').map(v => v.id);
      expect([...shown].sort()).toEqual(suited.sort());
    }
  });

  it('a voice that is not known falls back to the classic for the gender', () => {
    expect(getVoiceById('nope').id).toBe(SIGNATURE_VOICES[0].id);
    expect(getVoicePrompt('nope', 'female').name).toBe(VOICE_PROMPTS.classic_female.name);
    expect(getVoicePrompt(null, 'male').name).toBe(VOICE_PROMPTS.classic_male.name);
  });

  it('a woman is never given the male classic (the old column default), nor a man the female one', () => {
    expect(getVoicePrompt('classic_male', 'female')).toBe(VOICE_PROMPTS.classic_female);
    expect(getVoicePrompt('classic_female', 'male')).toBe(VOICE_PROMPTS.classic_male);
    expect(getVoicePrompt('classic_male', 'male')).toBe(VOICE_PROMPTS.classic_male);
    expect(getVoicePrompt('tsundere', 'female')).toBe(VOICE_PROMPTS.tsundere);
  });

  it('a random match can only be given a real voice that suits the gender', () => {
    for (let i = 0; i < 300; i++) {
      for (const g of ['male', 'female'] as const) {
        const id = randomVoice(g);
        const v = SIGNATURE_VOICES.find(x => x.id === id)!;
        expect(v).toBeTruthy();
        expect([g, 'neutral']).toContain(v.gender);
      }
    }
  });
});

describe('the news each voice reads', () => {
  it('has a lens for every voice, and none for a voice that no longer exists', () => {
    const ids = SIGNATURE_VOICES.map(v => v.id);
    for (const id of ids) expect(VOICE_NEWS_CATEGORIES[id], `no news lens for ${id}`).toBeTruthy();
    for (const key of Object.keys(VOICE_NEWS_CATEGORIES)) expect(ids, `${key} is not a voice`).toContain(key);
  });

  it('is complete: categories, keywords, sources and a line on how they see it', () => {
    for (const [id, c] of Object.entries(VOICE_NEWS_CATEGORIES)) {
      expect(c.categories.length, id).toBeGreaterThan(0);
      expect(c.keywords.length, id).toBeGreaterThan(2);
      expect(c.sources.length, id).toBeGreaterThan(0);
      expect(c.personality_filter.length, id).toBeGreaterThan(30);
      for (const cat of c.categories) expect(['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology'], id).toContain(cat);
    }
  });

  it('falls back to the classic lens for a voice it does not know', () => {
    expect(voiceNewsFor('nope')).toBe(VOICE_NEWS_CATEGORIES.classic_male);
    expect(voiceNewsFor(null)).toBe(VOICE_NEWS_CATEGORIES.classic_male);
    expect(voiceNewsFor('jock').categories).toEqual(['sports']);
  });
});
