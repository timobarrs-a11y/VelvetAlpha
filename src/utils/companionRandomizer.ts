import { getRandomName } from '../data/companionNames';
import { COMPANION_QUESTIONNAIRE } from '../features/questionnaire/companionBank';
import { makeContext, tpl } from '../features/questionnaire/pronouns';
import type { ScrubQuestion, PreviewQuestion, GridQuestion } from '../features/questionnaire/types';
import { SIGNATURE_VOICES } from '../config/signatureVoices';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface RandomCompanionProfile {
  gender: 'male' | 'female';
  /** A signature voice that suits the gender (every one is open to everyone). */
  signatureVoice: string;
  relationshipType: 'friend' | 'romantic';
  customName: string;
  energyPreference: string;
  flirtingStyle: string;
  humorStyle: string;
  dynamicPreference: string;
  confrontationStyle: string;
  availabilityLevel: string;
  interestPreference: string;
  interestText: string;
  loveLanguage: string;
  supportStyle: string;
  lifeContext: string;
  communicationStyle: string;
  emotionalOpenness: string;
  conversationDepth: string;
  expressiveness: string;
  initiative: string;
}

const INTEREST_TO_PROFILE: Record<string, { hobbies: string[]; news_categories: string[] }> = {
  'Pop Culture/Social Media': {
    hobbies: ['Movies/TV Shows', 'Music (Playing/Listening)', 'Fashion/Shopping', 'Gaming'],
    news_categories: ['entertainment', 'general'],
  },
  'Books/Philosophy': {
    hobbies: ['Reading', 'Writing', 'Board Games/Puzzles'],
    news_categories: ['general', 'science'],
  },
  'Wellness/Self-Care': {
    hobbies: ['Yoga/Meditation', 'Cooking', 'Gardening'],
    news_categories: ['health', 'entertainment'],
  },
  'Wellness/Fitness': {
    hobbies: ['Fitness/Working Out', 'Hiking', 'Yoga/Meditation'],
    news_categories: ['health', 'sports'],
  },
  'Adventure/Travel': {
    hobbies: ['Travel/Exploring', 'Hiking', 'Photography'],
    news_categories: ['general', 'science', 'entertainment'],
  },
};

export function deriveUserInterests(interestPreference: string): { hobbies: string[]; news_categories: string[] } {
  return INTEREST_TO_PROFILE[interestPreference] ?? INTEREST_TO_PROFILE['Pop Culture/Social Media'];
}

/** Any signature voice that suits this gender (a neutral one too). All of them are open to everyone. */
export function randomVoice(gender: 'male' | 'female'): string {
  const pool = SIGNATURE_VOICES.filter(v => (v.gender === gender || v.gender === 'neutral') && v.category !== 'professional');
  return pick(pool.length ? pool : SIGNATURE_VOICES).id;
}

export function generateRandomCompanionProfile(
  gender: 'male' | 'female',
  relationshipType: 'friend' | 'romantic'
): RandomCompanionProfile {
  return {
    gender,
    relationshipType,
    signatureVoice: randomVoice(gender),
    customName: getRandomName(gender),
    energyPreference: pick(['The Life Of The Party', 'Somewhere In Between', gender === 'female' ? 'Lives In Her Own World' : 'In His Own World']),
    flirtingStyle: pick(['Direct & Bold', 'Playful Teasing', 'Subtle & Sweet', 'Mysterious & Reserved']),
    humorStyle: pick(['Witty & Clever', 'Goofy & Random', 'Sarcastic & Dry', 'Warm & Light']),
    dynamicPreference: pick([
      gender === 'female' ? 'She Takes The Lead' : 'He Takes The Lead',
      'You Both Share Control Equally',
      'You Prefer To Lead',
    ]),
    confrontationStyle: pick([
      'Lighten The Mood With Humor',
      'Have A Calm Rational Discussion',
      'Focus On Understanding Feelings',
      'Be Direct And Move Forward Quickly',
    ]),
    availabilityLevel: pick([
      gender === 'female' ? 'Always There When I Need Her' : 'Always There When I Need Him',
      gender === 'female' ? 'Mostly Available But Has Her Own Life' : 'Mostly Available But Has His Own Life',
      gender === 'female' ? 'Independent - Texts When She Can' : 'Independent - Texts When He Can',
    ]),
    interestPreference: pick(['Pop Culture/Social Media', 'Books/Philosophy', gender === 'female' ? 'Wellness/Self-Care' : 'Wellness/Fitness', 'Adventure/Travel']),
    interestText: pick(['Pop Culture/Social Media', 'Books/Philosophy', gender === 'female' ? 'Wellness/Self-Care' : 'Wellness/Fitness', 'Adventure/Travel']),
    loveLanguage: pick(['Words Of Affirmation', 'Quality Time', 'Thoughtful Gestures & Gifts', 'Acts Of Service']),
    supportStyle: pick([
      'Offers Solutions & Helps You Fix It',
      'Just Listens & Validates',
      'Distracts With Fun & Positivity',
      'Gives Space But Checks In',
    ]),
    lifeContext: pick(['Working/Studying Hard', 'Going Through Tough Time', 'Doing Well', 'Bored/Lonely']),
    communicationStyle: pick(['Very Direct & Straightforward', 'Diplomatic & Tactful', 'Playfully Indirect', 'Subtle & Suggestive']),
    emotionalOpenness: pick(['Open Book', 'Opens Up Over Time', 'Selectively Vulnerable', 'Private & Guarded']),
    conversationDepth: pick(['Fun & Light-Hearted', 'Deep & Meaningful', 'Perfect Mix Of Both', 'Whatever The Moment Feels Like']),
    expressiveness: pick(['Very Animated', 'Balanced Expression', 'Subtle & Minimal', 'Words Over Symbols']),
    initiative: pick([
      gender === 'female' ? 'She Leads' : 'He Leads',
      'You Both Share',
      gender === 'female' ? 'She Follows Your Lead' : 'He Follows Your Lead',
      'Spontaneous & Random',
    ]),
  };
}

/**
 * A random match, in the words the setup questionnaire (companionBank) uses, for the gender and kind of
 * connection they chose: every dial, what they are into, a name and a signature voice. It reads its options
 * from the questionnaire itself, so a question that changes cannot leave this behind. The look is chosen next.
 * A friend is not asked how they flirt, so a random friend does not flirt either.
 */
export function randomMatchAnswers(gender: 'male' | 'female', connection: 'friend' | 'romantic'): Record<string, string | string[]> {
  const q = (id: string) => COMPANION_QUESTIONNAIRE.questions.find(x => x.id === id)!;
  const stops = (id: string): string[] => {
    const cfg = (q(id) as ScrubQuestion).config;
    return cfg.values ?? cfg.valueLabels;
  };
  const ctx = makeContext({}, gender === 'male' ? 'Male' : 'Female', connection === 'friend' ? 'friend' : 'companion');
  const humors = (q('humor') as PreviewQuestion).bubbles.map(b => b.value);
  const humor1 = pick(humors);
  // About one in three is a mix of two styles, the way real people are.
  const humor = Math.random() < 0.35 ? [humor1, pick(humors.filter(h => h !== humor1))] : [humor1];
  const interests = (q('interests') as GridQuestion).options.map(o => o.value);
  const first = pick(interests);
  const second = pick(interests.filter(i => i !== first));
  const out: Record<string, string | string[]> = {
    relationshipType: gender === 'male' ? 'Male' : 'Female',
    connectionType: connection,
    energy: tpl(pick(stops('energy')), ctx),
    humor,
    directness: pick(stops('directness')),
    openness: pick(stops('openness')),
    care: pick(stops('care')),
    interests: [first, second],
    companionName: getRandomName(gender),
    signatureVoice: randomVoice(gender),
  };
  if (connection === 'romantic') out.warmth = pick((q('warmth') as PreviewQuestion).bubbles.map(b => b.value));
  return out;
}
