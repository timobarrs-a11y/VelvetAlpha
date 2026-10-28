import { describe, it, expect } from 'vitest';
import { generateRandomCompanionProfile, randomMatchAnswers, randomVoice } from '../companionRandomizer';
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
    const find = (id: string) => COMPANION_QUESTIONNAIRE.questions.find(q => q.id === id) as unknown as {
      bubbles?: { value: string }[]; options?: { value: string }[]; config?: { values?: string[]; valueLabels: string[] };
    };
    const stops = (id: string) => find(id).config!.values ?? find(id).config!.valueLabels;
    for (let i = 0; i < RUNS; i++) {
      const g = i % 2 ? 'male' : 'female';
      const a = randomMatchAnswers(g, i % 3 ? 'romantic' : 'friend');
      for (const id of ['directness', 'openness', 'care']) expect(stops(id), id).toContain(a[id]);
      expect(find('energy').config!.valueLabels.map(l => l.replace('{their}', g === 'male' ? 'his' : 'her'))).toContain(a.energy);
      const humors = a.humor as string[];
      expect(humors.length).toBeGreaterThanOrEqual(1);
      expect(humors.length).toBeLessThanOrEqual(2);
      expect(new Set(humors).size).toBe(humors.length);
      for (const h of humors) expect(find('humor').bubbles!.map(b => b.value)).toContain(h);
      // Only companions are asked how they flirt.
      if (a.connectionType === 'romantic') expect(find('warmth').bubbles!.map(b => b.value)).toContain(a.warmth);
      else expect(a.warmth).toBeUndefined();
      expect(a.interests).toHaveLength(2);
      expect(new Set(a.interests).size).toBe(2);
      for (const v of a.interests as string[]) expect(find('interests').options!.map(o => o.value)).toContain(v);
      expect(typeof a.companionName).toBe('string');
      expect(a.companionName).toBeTruthy();
    }
  });

  it('really varies: every dial, interests and names all come out different across a batch', () => {
    const batch = Array.from({ length: 300 }, () => randomMatchAnswers('female', 'romantic'));
    expect(new Set(batch.map(a => a.warmth)).size).toBe(4);
    for (const id of ['energy', 'directness', 'openness', 'care']) expect(new Set(batch.map(a => a[id])).size, id).toBe(3);
    expect(new Set(batch.map(a => String(a.humor))).size).toBeGreaterThan(5);
    expect(batch.some(a => (a.humor as string[]).length === 2)).toBe(true);
    expect(new Set(batch.map(a => String(a.interests))).size).toBeGreaterThan(10);
    expect(new Set(batch.map(a => a.companionName)).size).toBeGreaterThan(30);
  });

  it('names a man from the men\'s list and a woman from the women\'s, and picks a voice for them', () => {
    for (let i = 0; i < RUNS; i++) {
      const m = randomMatchAnswers('male', 'romantic');
      const f = randomMatchAnswers('female', 'romantic');
      expect(MALE_NAMES).toContain(m.companionName);
      expect(FEMALE_NAMES).toContain(f.companionName);
      expect(SIGNATURE_VOICES.map(v => v.id)).toContain(m.signatureVoice);
      expect(SIGNATURE_VOICES.map(v => v.id)).toContain(f.signatureVoice);
    }
  });
});

describe('a random voice', () => {
  it('draws from every voice a person can pick, never the professional (classic) one', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) { seen.add(randomVoice('male')); seen.add(randomVoice('female')); }
    const expected = SIGNATURE_VOICES.filter(v => v.category !== 'professional').map(v => v.id);
    for (const id of expected) expect(seen).toContain(id);
    expect(seen).not.toContain('classic_male');
    expect(seen).not.toContain('classic_female');
  });

  it('suits the gender, and any of them can come up (none is held back for a plan)', () => {
    for (let i = 0; i < RUNS; i++) {
      for (const g of ['male', 'female'] as const) {
        const id = randomVoice(g);
        const voice = SIGNATURE_VOICES.find(v => v.id === id)!;
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
