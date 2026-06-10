import { getRandomName } from '../data/companionNames';

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface RandomCompanionProfile {
  gender: 'male' | 'female';
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

export function generateRandomCompanionProfile(
  gender: 'male' | 'female',
  relationshipType: 'friend' | 'romantic'
): RandomCompanionProfile {
  return {
    gender,
    relationshipType,
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
