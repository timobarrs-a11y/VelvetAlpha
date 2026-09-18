import type { Question, QuestionnaireDefinition } from './types';

const COLOR_HEX_MAP: Record<string, string> = {
  Red: '#ef4444', Pink: '#ec4899', Orange: '#f97316', Yellow: '#eab308',
  Green: '#22c55e', Teal: '#14b8a6', Cyan: '#06b6d4', Blue: '#3b82f6',
  Purple: '#8b5cf6', Magenta: '#d946ef', White: '#f8fafc', Black: '#1e293b',
};

export function getColorHex(colorName: string): string | undefined {
  return COLOR_HEX_MAP[colorName];
}

const ZODIAC_RANGES: [number, number, string][] = [
  [3, 21, 'Aries'], [4, 20, 'Taurus'], [5, 21, 'Gemini'],
  [6, 21, 'Cancer'], [7, 23, 'Leo'], [8, 23, 'Virgo'],
  [9, 23, 'Libra'], [10, 23, 'Scorpio'], [11, 22, 'Sagittarius'],
  [12, 22, 'Capricorn'], [1, 20, 'Aquarius'], [2, 19, 'Pisces'],
];

export function deriveZodiac(birthday: string): string | null {
  if (!birthday) return null;
  const date = new Date(birthday);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  for (const [m, d, sign] of ZODIAC_RANGES) {
    if (month === m && day >= d) return sign;
    const nextM = m === 12 ? 1 : m + 1;
    if (month === nextM && day < d) return sign;
  }
  return null;
}

const CUSP_DAYS: Record<string, [string, string]> = {
  '3-19': ['Pisces', 'Aries'], '3-20': ['Pisces', 'Aries'], '3-21': ['Pisces', 'Aries'],
  '4-18': ['Aries', 'Taurus'], '4-19': ['Aries', 'Taurus'], '4-20': ['Aries', 'Taurus'],
  '5-19': ['Taurus', 'Gemini'], '5-20': ['Taurus', 'Gemini'], '5-21': ['Taurus', 'Gemini'],
  '6-19': ['Gemini', 'Cancer'], '6-20': ['Gemini', 'Cancer'], '6-21': ['Gemini', 'Cancer'],
  '7-22': ['Cancer', 'Leo'], '7-23': ['Cancer', 'Leo'], '7-24': ['Cancer', 'Leo'],
  '8-21': ['Leo', 'Virgo'], '8-22': ['Leo', 'Virgo'], '8-23': ['Leo', 'Virgo'],
  '9-22': ['Virgo', 'Libra'], '9-23': ['Virgo', 'Libra'], '9-24': ['Virgo', 'Libra'],
  '10-22': ['Libra', 'Scorpio'], '10-23': ['Libra', 'Scorpio'], '10-24': ['Libra', 'Scorpio'],
  '11-20': ['Scorpio', 'Sagittarius'], '11-21': ['Scorpio', 'Sagittarius'], '11-22': ['Scorpio', 'Sagittarius'],
  '12-20': ['Sagittarius', 'Capricorn'], '12-21': ['Sagittarius', 'Capricorn'], '12-22': ['Sagittarius', 'Capricorn'],
  '1-18': ['Capricorn', 'Aquarius'], '1-19': ['Capricorn', 'Aquarius'], '1-20': ['Capricorn', 'Aquarius'],
  '2-17': ['Aquarius', 'Pisces'], '2-18': ['Aquarius', 'Pisces'], '2-19': ['Aquarius', 'Pisces'],
};

export function getCuspSigns(birthday: string): [string, string] | null {
  if (!birthday) return null;
  const date = new Date(birthday);
  const key = `${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
  return CUSP_DAYS[key] || null;
}

export function resolveZodiac(answers: Record<string, string | string[]>): string | null {
  const userSelected = answers.zodiacSign as string;
  if (userSelected && userSelected.trim()) return userSelected;
  return deriveZodiac(answers.birthday as string);
}

export const PERSONAL_QUESTIONNAIRE: QuestionnaireDefinition = {
  startProgress: 20,
  chapters: [
    { id: 'identity', label: 'Who you are', questionIds: ['name', 'nickname', 'favoriteColor', 'birthday', 'zodiacCusp', 'beat1'] },
    { id: 'taste', label: 'Your taste', questionIds: ['gender', 'hobbies', 'musicGenre'] },
    { id: 'signals', label: 'Your vibe', questionIds: ['tasteDeck', 'beat2'] },
    { id: 'wavelength', label: 'Your wavelength', questionIds: ['recharge', 'conflictResponse', 'structure', 'connection', 'beat3'] },
  ],
  questions: [
    {
      id: 'name',
      archetype: 'tap',
      chapter: 'identity',
      question: 'First things first -- what should I call you?',
      confidence: 'confirmed',
      placeholder: 'Enter your name',
      minLength: 3,
    },
    {
      id: 'nickname',
      archetype: 'tap',
      chapter: 'identity',
      question: (ctx) => {
        const name = ctx.answers.name as string;
        return name ? `Nice to meet you, ${name}. What do your friends call you?` : 'What do your friends call you?';
      },
      confidence: 'confirmed',
      placeholder: 'Enter a nickname (or skip)',
      optional: true,
      skipLabel: 'Skip',
    },
    {
      id: 'favoriteColor',
      archetype: 'grid',
      chapter: 'identity',
      question: "What's your favorite color?",
      confidence: 'tapped',
      columns: 4,
      options: [
        { label: 'Red', value: 'Red', color: '#ef4444' },
        { label: 'Pink', value: 'Pink', color: '#ec4899' },
        { label: 'Orange', value: 'Orange', color: '#f97316' },
        { label: 'Yellow', value: 'Yellow', color: '#eab308' },
        { label: 'Green', value: 'Green', color: '#22c55e' },
        { label: 'Teal', value: 'Teal', color: '#14b8a6' },
        { label: 'Cyan', value: 'Cyan', color: '#06b6d4' },
        { label: 'Blue', value: 'Blue', color: '#3b82f6' },
        { label: 'Purple', value: 'Purple', color: '#8b5cf6' },
        { label: 'Magenta', value: 'Magenta', color: '#d946ef' },
        { label: 'White', value: 'White', color: '#f8fafc' },
        { label: 'Black', value: 'Black', color: '#1e293b' },
      ],
    },
    {
      id: 'birthday',
      archetype: 'tap',
      chapter: 'identity',
      question: (ctx) => {
        const name = ctx.answers.name as string;
        return name ? `When were you born, ${name}?` : 'When were you born?';
      },
      confidence: 'confirmed',
      placeholder: 'Select your birthday',
    },
    {
      id: 'zodiacCusp',
      archetype: 'tap',
      chapter: 'identity',
      question: 'Interesting -- you\'re born on a cusp. Which sign feels more you?',
      confidence: 'confirmed',
      autoAdvance: true,
      options: (ctx) => {
        const cusp = getCuspSigns(ctx.answers.birthday as string);
        if (!cusp) return [];
        return [
          { text: cusp[0], value: cusp[0] },
          { text: cusp[1], value: cusp[1] },
        ];
      },
    },
    {
      id: 'beat1',
      archetype: 'beat',
      chapter: 'identity',
      beat: {
        template: (ctx) => {
          const zodiac = resolveZodiac(ctx.answers);
          const name = ctx.answers.name as string;
          const nickname = ctx.answers.nickname as string;
          if (zodiac && name && nickname && nickname.trim()) {
            return `A ${zodiac}! That explains a lot. ${name}, or should I say ${nickname} -- that's Chapter 1 locked in. Next up: your taste.`;
          }
          if (zodiac && name) {
            return `A ${zodiac}! That explains a lot, ${name}. That's Chapter 1 locked in. Next up: your taste.`;
          }
          if (zodiac) {
            return `A ${zodiac}! That explains a lot. That's Chapter 1 locked in. Next up: your taste.`;
          }
          if (name && nickname && nickname.trim()) {
            return `${name}, or should I say ${nickname} -- that's Chapter 1 locked in. Next up: your taste.`;
          }
          if (name) {
            return `${name}, that's Chapter 1 locked in. Next up: your taste.`;
          }
          return "That's Chapter 1 locked in. Next up: your taste.";
        },
        confirmLabel: 'On to my taste',
      },
    },
    {
      id: 'gender',
      archetype: 'tap',
      chapter: 'taste',
      question: 'How do you identify?',
      confidence: 'confirmed',
      autoAdvance: true,
      options: [
        { text: 'Male', value: 'Male' },
        { text: 'Female', value: 'Female' },
        { text: 'Non-binary', value: 'Non-binary' },
        { text: 'Prefer not to say', value: 'unspecified' },
      ],
    },
    {
      id: 'hobbies',
      archetype: 'grid',
      chapter: 'taste',
      question: 'What are your favorite hobbies?',
      confidence: 'tapped',
      multiSelect: true,
      minSelections: 3,
      allowCustom: true,
      columns: 3,
      options: [
        { label: 'Reading', value: 'Reading', icon: 'BookOpen' },
        { label: 'Gaming', value: 'Gaming', icon: 'Gamepad2' },
        { label: 'Cooking', value: 'Cooking', icon: 'Utensils' },
        { label: 'Hiking', value: 'Hiking', icon: 'MapPin' },
        { label: 'Photography', value: 'Photography', icon: 'Camera' },
        { label: 'Drawing', value: 'Drawing/Painting', icon: 'Palette' },
        { label: 'Writing', value: 'Writing', icon: 'PenTool' },
        { label: 'Music', value: 'Music (Playing/Listening)', icon: 'Music' },
        { label: 'Movies & TV', value: 'Movies/TV Shows', icon: 'Film' },
        { label: 'Fitness', value: 'Fitness/Working Out', icon: 'Dumbbell' },
        { label: 'Yoga', value: 'Yoga/Meditation', icon: 'Heart' },
        { label: 'Dancing', value: 'Dancing', icon: 'Music' },
        { label: 'Gardening', value: 'Gardening', icon: 'Sprout' },
        { label: 'DIY & Crafts', value: 'DIY/Crafts', icon: 'Wrench' },
        { label: 'Travel', value: 'Travel/Exploring', icon: 'Compass' },
        { label: 'Fashion', value: 'Fashion/Shopping', icon: 'ShoppingBag' },
        { label: 'Tech', value: 'Tech/Gadgets', icon: 'Cpu' },
        { label: 'Board Games', value: 'Board Games/Puzzles', icon: 'Puzzle' },
      ],
    },
    {
      id: 'musicGenre',
      archetype: 'grid',
      chapter: 'taste',
      question: "What's your music vibe?",
      confidence: 'tapped',
      multiSelect: true,
      minSelections: 1,
      allowCustom: true,
      columns: 3,
      options: [
        { label: 'R&B / Soul', value: 'R&B/Soul', icon: 'Music' },
        { label: 'Hip-Hop', value: 'Hip-Hop/Rap', icon: 'Music' },
        { label: 'Pop', value: 'Pop', icon: 'Music' },
        { label: 'Rock', value: 'Rock/Alternative', icon: 'Music' },
        { label: 'Lo-fi', value: 'Lo-fi/Chill', icon: 'Music' },
        { label: 'Country', value: 'Country', icon: 'Music' },
        { label: 'Jazz', value: 'Jazz', icon: 'Music' },
        { label: 'Classical', value: 'Classical', icon: 'Music' },
        { label: 'EDM', value: 'Electronic/EDM', icon: 'Music' },
        { label: 'Reggae', value: 'Reggae/Dancehall', icon: 'Music' },
        { label: 'Latin', value: 'Latin', icon: 'Music' },
        { label: 'A bit of everything', value: 'A Little Bit Of Everything', icon: 'Music' },
      ],
    },
    {
      id: 'tasteDeck',
      archetype: 'swipe',
      chapter: 'signals',
      question: 'Quick round -- just tell me what sounds better.',
      confidence: 'play',
      cards: [
        {
          prompt: 'Late night gaming session',
          left: { label: 'Gaming night', icon: 'Gamepad2' },
          right: { label: 'Sunrise hike', icon: 'Sunrise' },
        },
        {
          prompt: 'Home-cooked dinner',
          left: { label: 'Cook at home', icon: 'Utensils' },
          right: { label: 'Try a new restaurant', icon: 'MapPin' },
        },
        {
          prompt: 'Weekend plan',
          left: { label: 'Road trip', icon: 'Car' },
          right: { label: 'Stay in & recharge', icon: 'Home' },
        },
        {
          prompt: 'How you watch sports',
          left: { label: 'Live at the game', icon: 'Trophy' },
          right: { label: 'On the couch', icon: 'Tv' },
        },
        {
          prompt: 'Night out',
          left: { label: 'Dive bar', icon: 'Wine' },
          right: { label: 'Rooftop spot', icon: 'Building' },
        },
        {
          prompt: 'Morning routine',
          left: { label: 'Gym at 6am', icon: 'Dumbbell' },
          right: { label: 'Sleep in', icon: 'Moon' },
        },
      ],
    },
    {
      id: 'beat2',
      archetype: 'beat',
      chapter: 'signals',
      beat: {
        template: (ctx) => {
          const name = ctx.answers.name as string;
          return name ? `That's a lot to work with, ${name}.` : "That's a lot to work with.";
        },
        durationMs: 1500,
      },
    },
    {
      id: 'recharge',
      archetype: 'tap',
      chapter: 'wavelength',
      question: 'After a long week, you\'d rather...',
      confidence: 'confirmed',
      autoAdvance: true,
      options: [
        { text: 'Recharge alone -- quiet time, good music, maybe a show', value: 'alone' },
        { text: 'Be around people -- friends, energy, going out', value: 'people' },
      ],
    },
    {
      id: 'conflictResponse',
      archetype: 'tap',
      chapter: 'wavelength',
      question: 'When you\'re upset, what helps you more?',
      confidence: 'confirmed',
      autoAdvance: true,
      options: [
        { text: 'Logical solutions -- help me figure it out', value: 'solutions' },
        { text: 'Emotional understanding -- hear me out first', value: 'empathy' },
      ],
    },
    {
      id: 'structure',
      archetype: 'tap',
      chapter: 'wavelength',
      question: 'You prefer your days...',
      confidence: 'confirmed',
      autoAdvance: true,
      options: [
        { text: 'Planned out -- I like knowing what\'s next', value: 'planned' },
        { text: 'Spontaneous -- I like seeing where the day goes', value: 'spontaneous' },
      ],
    },
    {
      id: 'connection',
      archetype: 'tap',
      chapter: 'wavelength',
      question: 'You connect best through...',
      confidence: 'confirmed',
      autoAdvance: true,
      options: [
        { text: 'Deep one-on-one conversation', value: 'deep' },
        { text: 'Lively back-and-forth banter', value: 'lively' },
      ],
    },
    {
      id: 'beat3',
      archetype: 'beat',
      chapter: 'wavelength',
      beat: {
        template: (ctx) => {
          const name = ctx.answers.name as string;
          return name ? `Got your wavelength, ${name}. I'll tune to it.` : 'Got your wavelength. I\'ll tune to it.';
        },
        durationMs: 1500,
      },
    },
  ],
};
