import { describe, it, expect } from 'vitest';
import { generateRandomCompanionProfile, randomMatchAnswers, randomFreeVoice } from '../companionRandomizer';
import { FEMALE_NAMES, MALE_NAMES } from '../../data/companionNames';
import { SIGNATURE_VOICES } from '../../config/signatureVoices';
import { COMPANION_QUESTIONNAIRE } from '../../features/questionnaire/companionBank';

const RUNS = 200;
const strings = (o: Record<string, unknown>) => Object.values(o).filter((v): v is string => typeof v === 'string').join(' | ');

describe('a random companion', () => {
  it('has a name from its own gender\'s list, never the other\'s', () => {
    for (let i = 0; i < RUNS; i++) {
      expect(MALE_NAMES).toContain(generateRandomCompanionProfile('male', 'friend').customName);
      expect(FEMALE_NAMES).toContain(generateRandomCompanionProfile('female', 'romantic').customName);
    }
  });

  it('never has a trait worded for the other gender', () => {
    for (let i = 0; i < RUNS; i++) {
      expect(strings(randomMatchAnswers('male', 'romantic'))).not.toMatch(/\b(she|her|hers|herself)\b/i);
      expect(strings(randomMatchAnswers('female', 'friend'))).not.toMatch(/\b(he|him|his|himself)\b/i);
      expect(strings(generateRandomCompanionProfile('male', 'friend'))).not.toMatch(/\b(she|her|hers|herself)\b/i);
      expect(strings(generateRandomCompanionProfile('female', 'romantic'))).not.toMatch(/\b(he|him|his|himself)\b/i);
    }
  });

  it('is the gender and the kind of connection they chose, in the questionnaire\'s own values', () => {
    expect(randomMatchAnswers('male', 'friend')).toMatchObject({ relationshipType: 'Male', connectionType: 'friend' });
    expect(randomMatchAnswers('female', 'romantic')).toMatchObject({ relationshipType: 'Female', connectionType: 'romantic' });
  });

  it('answers every question the companion questionnaire asks, with values it offers', () => {
    const offered = (id: string) => (COMPANION_QUESTIONNAIRE.questions.find(q => q.id === id) as unknown as { bubbles?: { value: string }[]; options?: { value: string }[] });
    for (let i = 0; i < RUNS; i++) {
      const a = randomMatchAnswers(i % 2 ? 'male' : 'female', i % 3 ? 'romantic' : 'friend');
      expect(offered('voice').bubbles!.map(b => b.value)).toContain(a.voice);
      expect(offered('warmth').bubbles!.map(b => b.value)).toContain(a.warmth);
      expect(a.interests).toHaveLength(2);
      expect(new Set(a.interests).size).toBe(2);
      for (const v of a.interests as string[]) expect(offered('interests') ? (COMPANION_QUESTIONNAIRE.questions.find(q => q.id === 'interests') as unknown as { options: { value: string }[] }).options.map(o => o.value) : []).toContain(v);
      expect(typeof a.companionName).toBe('string');
      expect(a.companionName).toBeTruthy();
    }
  });

  it('never gives a friend the flirty way of showing care', () => {
    for (let i = 0; i < RUNS; i++) expect(randomMatchAnswers('female', 'friend').warmth).not.toBe('bold');
  });

  it('names a man from the men\'s list and a woman from the women\'s, and picks a free voice for them', () => {
    for (let i = 0; i < RUNS; i++) {
      const m = randomMatchAnswers('male', 'romantic');
      const f = randomMatchAnswers('female', 'romantic');
      expect(MALE_NAMES).toContain(m.companionName);
      expect(FEMALE_NAMES).toContain(f.companionName);
      expect(SIGNATURE_VOICES.find(v => v.id === m.signatureVoice)?.premium).toBe(false);
      expect(SIGNATURE_VOICES.find(v => v.id === f.signatureVoice)?.premium).toBe(false);
    }
  });
});

describe('a random voice', () => {
  it('is free and suits the gender', () => {
    for (let i = 0; i < RUNS; i++) {
      for (const g of ['male', 'female'] as const) {
        const id = randomFreeVoice(g);
        const voice = SIGNATURE_VOICES.find(v => v.id === id)!;
        expect(voice.premium).toBe(false);
        expect([g, 'neutral']).toContain(voice.gender);
      }
    }
  });
});

describe('the name lists', () => {
  it('share no name, and each is only that gender\'s', () => {
    expect(FEMALE_NAMES.filter(n => MALE_NAMES.includes(n))).toEqual([]);
    expect(new Set(FEMALE_NAMES).size).toBe(FEMALE_NAMES.length);
    expect(new Set(MALE_NAMES).size).toBe(MALE_NAMES.length);
    for (const unisex of ['Alex', 'Jordan', 'Avery', 'Cameron', 'Parker', 'Angel', 'Ariel', 'Harper', 'Kennedy']) {
      expect([...FEMALE_NAMES, ...MALE_NAMES]).not.toContain(unisex);
    }
  });
});
