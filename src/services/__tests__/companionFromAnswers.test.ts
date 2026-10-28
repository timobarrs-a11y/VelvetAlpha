import { describe, it, expect, vi } from 'vitest';

vi.mock('../companionService', () => ({ createCompanion: vi.fn() }));
vi.mock('../ambientProfileService', () => ({ ambientProfileService: { seedFromQuestionnaire: vi.fn() } }));
vi.mock('../voiceFidelityService', () => ({ seedVoiceBaseline: vi.fn() }));

import { matchDataFromAnswers } from '../companionFromAnswers';

const dials = {
  relationshipType: 'Female', connectionType: 'romantic', companionName: 'Mara',
  energy: 'Life of the party', humor: ['witty', 'warm'], directness: 'Tactful, but honest',
  openness: 'Opens Up Over Time', care: 'Listens First, Then Helps', warmth: 'banter', interests: ['pop', 'music'],
};

// Every dial the questionnaire asks becomes the one thing about the companion that it controls, and nothing is
// filled in for a question nobody was asked.
describe('what a companion is built from', () => {
  it('turns each answer into its own trait, in the words the chat and the house match on', () => {
    expect(matchDataFromAnswers({ ...dials, directness: 'Diplomatic & Tactful' }, null)).toMatchObject({
      energyPreference: 'Life of the party',
      humorStyle: 'Witty & Clever + Warm & Light',
      communicationStyle: 'Diplomatic & Tactful',
      emotionalOpenness: 'Opens Up Over Time',
      supportStyle: 'Listens First, Then Helps',
      flirtingStyle: 'Playful Teasing',
      companionName: 'Mara',
    });
  });

  it('works out how much she writes with her hands from her energy, not by asking', () => {
    const e = (energy: string) => matchDataFromAnswers({ ...dials, energy }, null).expressiveness;
    expect(e('Life of the party')).toBe('Very Animated');
    expect(e('Somewhere in between')).toBe('Balanced Expression');
    expect(e('In her own world')).toBe('Subtle & Minimal');
  });

  it('gives a friend no flirting style, and a one-pick humor is just that style', () => {
    const friend = matchDataFromAnswers({ ...dials, connectionType: 'friend', warmth: 'bold', humor: ['dry'] }, null);
    expect(friend.flirtingStyle).toBeUndefined();
    expect(friend.humorStyle).toBe('Sarcastic & Dry');
  });

  it('leaves out what nobody was asked, instead of making an answer up', () => {
    const m = matchDataFromAnswers(dials, null) as Record<string, unknown>;
    for (const key of ['conversationDepth', 'initiative', 'availabilityLevel', 'dynamicPreference', 'lifeContext', 'loveLanguage', 'confrontationStyle', 'sports']) {
      expect(m[key], key).toBeUndefined();
    }
  });
});
