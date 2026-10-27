import type { GridOption, QuestionnaireDefinition } from './types';
import { NICKNAME_MIN, validateNickname } from './nicknames';

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

const ZODIAC_SYMBOLS: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋', Leo: '♌', Virgo: '♍',
  Libra: '♎', Scorpio: '♏', Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};

/** "none" means they'd rather not have a sign. */
const NO_SIGN = 'none';

/**
 * Their sign: the one they picked on a cusp, else the one they confirmed,
 * else the one their birthday gives.
 */
export function resolveZodiac(answers: Record<string, string | string[]>): string | null {
  for (const key of ['zodiacCusp', 'zodiacConfirm', 'zodiacSign']) {
    const picked = answers[key];
    if (typeof picked === 'string' && picked.trim()) return picked === NO_SIGN ? null : picked;
  }
  return deriveZodiac(answers.birthday as string);
}

// ─── Interests: what they already do and like ───────────────────────────

const HOBBY_OPTIONS: GridOption[] = [
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
];

const MUSIC_OPTIONS: GridOption[] = [
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
];

const ENTERTAINMENT_OPTIONS: GridOption[] = [
  { label: 'Movies', value: 'Movies', icon: 'Film' },
  { label: 'TV Shows', value: 'TV Shows', icon: 'Tv' },
  { label: 'Anime', value: 'Anime', icon: 'Sparkles' },
  { label: 'Documentaries', value: 'Documentaries', icon: 'Clapperboard' },
  { label: 'Reality TV', value: 'Reality TV', icon: 'Tv' },
  { label: 'Stand-up Comedy', value: 'Stand-up Comedy', icon: 'Laugh' },
  { label: 'Theater', value: 'Theater/Plays', icon: 'Drama' },
  { label: 'Podcasts', value: 'Podcasts', icon: 'Mic' },
  { label: 'YouTube', value: 'YouTube', icon: 'Youtube' },
  { label: 'Twitch', value: 'Twitch/Streaming', icon: 'Gamepad2' },
  { label: 'Books', value: 'Books', icon: 'BookOpen' },
  { label: 'Manga', value: 'Manga', icon: 'BookOpen' },
];

const TECH_OPTIONS: GridOption[] = [
  { label: 'AI & ML', value: 'AI & Machine Learning', icon: 'Cpu' },
  { label: 'Gadgets', value: 'Gadgets/Hardware', icon: 'Cpu' },
  { label: 'Programming', value: 'Programming/Coding', icon: 'Code' },
  { label: 'Crypto', value: 'Crypto/Web3', icon: 'Coins' },
  { label: 'Gaming Tech', value: 'Gaming Tech', icon: 'Gamepad2' },
  { label: 'Startups', value: 'Startups/Entrepreneurship', icon: 'Rocket' },
  { label: 'Science', value: 'Science/Space', icon: 'Atom' },
  { label: 'Cars', value: 'Cars/EVs', icon: 'Car' },
  { label: 'Tech News', value: 'Tech News', icon: 'Newspaper' },
];

const LIFESTYLE_OPTIONS: GridOption[] = [
  { label: 'Food & Drink', value: 'Food & Drink', icon: 'Utensils' },
  { label: 'Wine & Spirits', value: 'Wine & Spirits', icon: 'Wine' },
  { label: 'Home Decor', value: 'Home Decor', icon: 'Home' },
  { label: 'Plants', value: 'Plants/Gardening', icon: 'Sprout' },
  { label: 'Skincare', value: 'Skincare/Beauty', icon: 'Heart' },
  { label: 'Fashion', value: 'Fashion/Style', icon: 'ShoppingBag' },
  { label: 'Fitness', value: 'Fitness/Wellness', icon: 'Dumbbell' },
  { label: 'Mindfulness', value: 'Mindfulness/Self-care', icon: 'Heart' },
  { label: 'Travel', value: 'Travel/Adventure', icon: 'Compass' },
  { label: 'Sustainability', value: 'Sustainability/Eco', icon: 'Leaf' },
  { label: 'Parenting', value: 'Parenting/Family', icon: 'Heart' },
  { label: 'Pets', value: 'Pets/Animals', icon: 'Cat' },
];

const SPORTS_OPTIONS: GridOption[] = [
  { label: 'Basketball', value: 'Basketball', icon: 'Dumbbell' },
  { label: 'Football', value: 'Football', icon: 'Dumbbell' },
  { label: 'Soccer', value: 'Soccer', icon: 'Dumbbell' },
  { label: 'Baseball', value: 'Baseball', icon: 'Dumbbell' },
  { label: 'Tennis', value: 'Tennis', icon: 'Dumbbell' },
  { label: 'MMA / Boxing', value: 'MMA/Boxing', icon: 'Dumbbell' },
  { label: 'Golf', value: 'Golf', icon: 'Dumbbell' },
  { label: 'Running', value: 'Running', icon: 'Dumbbell' },
  { label: 'Cycling', value: 'Cycling', icon: 'Dumbbell' },
  { label: 'Swimming', value: 'Swimming', icon: 'Dumbbell' },
  { label: 'Skateboarding', value: 'Skateboarding', icon: 'Dumbbell' },
  { label: 'Esports', value: 'Esports', icon: 'Gamepad2' },
];

/** Where each interest tab is saved, and which answer key it uses. */
export const INTEREST_KEYS = ['hobbies', 'musicGenre', 'entertainmentInterests', 'techInterests', 'lifestyleInterests', 'sportsInterests'] as const;

// ─── Someday: things they've always wanted to try ───────────────────────
// Concrete, verb-first options, a nudge per tab to bring a memory forward.
// See docs/onboarding/questionnaire-plan.md, "Act 1, screen 8: Someday".

export const SOMEDAY_TABS: Array<{ id: string; label: string; nudge: string; options: string[] }> = [
  {
    id: 'work', label: 'Work', nudge: "Ever looked at someone's job and thought, I'd be good at that?",
    options: [
      'Tech & IT', 'Healthcare', 'Teaching', 'Design', 'Law', 'Finance', 'Psychology & counselling',
      'Trades (electrician, carpentry)', 'Cooking professionally', 'Writing & media', 'Aviation', 'Fitness coaching',
      'Start my own business', 'Get a promotion', 'Go back to school',
    ],
  },
  {
    id: 'skills', label: 'Skills', nudge: 'Something you watched someone do and thought, I could learn that',
    options: ['Learn to code', 'Play an instrument', 'Speak another language', 'Cook properly', 'Learn to dance', 'Fix things around the house', 'Learn to swim', 'Drive', 'Photography'],
  },
  {
    id: 'body', label: 'Body', nudge: "Something you'd do if you felt fitter",
    options: ['Run a 5K', 'Do a pull-up', 'Learn a martial art', 'Try yoga', 'Hike a mountain', "Get a good night's sleep", 'Climb'],
  },
  {
    id: 'places', label: 'Places', nudge: "Somewhere you've said \"one day\" about",
    options: ['See the Northern Lights', 'Road trip', "Visit where my family's from", 'Live abroad for a while', 'See a wonder of the world', 'Go somewhere on my own'],
  },
  {
    id: 'experiences', label: 'Experiences', nudge: "Something you'd regret never doing",
    options: ['See my team play live', 'Go to a festival', 'Skydive', 'Learn to sail', 'Do stand-up', 'Volunteer', 'Run a marathon'],
  },
  {
    id: 'creative', label: 'Creative', nudge: 'Something you made as a kid and stopped',
    options: ['Write a book', 'Paint or draw', 'Make music', 'Start a podcast or channel', 'Make a short film', 'Build something with my hands'],
  },
  {
    id: 'money', label: 'Money & home', nudge: "Something you'd sort out if you had a free weekend",
    options: ['Start investing', 'Buy a home', 'Pay off debt', 'Get organised', 'Grow my own food', 'Get a pet'],
  },
  {
    id: 'people', label: 'People', nudge: "Someone you'd like to be closer to, or a crowd you'd like to belong to",
    options: ['Make new friends', 'Find a partner', 'Reconnect with family', 'Find my people locally', 'Mentor someone'],
  },
];

export interface SomedayPick {
  tab: string;
  value: string;
  custom?: boolean;
}

const somedayKey = (tabId: string) => `someday_${tabId}`;

/** The Someday screen's answers as the list saved on the profile. */
export function somedayFromAnswers(answers: Record<string, string | string[]>): SomedayPick[] {
  return SOMEDAY_TABS.flatMap(tab => {
    const picked = answers[somedayKey(tab.id)];
    if (!Array.isArray(picked)) return [];
    return picked.map(value => ({ tab: tab.label, value, ...(tab.options.includes(value) ? {} : { custom: true }) }));
  });
}

/** The saved list back into the Someday screen's answers, to resume. */
export function answersFromSomeday(picks: SomedayPick[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const tab of SOMEDAY_TABS) {
    const values = picks.filter(p => p.tab === tab.label).map(p => p.value);
    if (values.length) out[somedayKey(tab.id)] = values;
  }
  return out;
}

// ─── Act 1: the quick questionnaire ─────────────────────────────────────
// nickname → real name (optional) → color → birthday → zodiac → gender → interests → Someday.
// Each answer is saved as it's given. The "wavelength" questions are asked by
// Atlas in conversation now.

export const PERSONAL_QUESTIONNAIRE: QuestionnaireDefinition = {
  startProgress: 10,
  chapters: [
    { id: 'identity', label: 'Who you are', questionIds: ['nickname', 'name', 'favoriteColor', 'birthday', 'zodiacCusp', 'zodiacConfirm', 'gender'] },
    { id: 'taste', label: 'What you love', questionIds: ['interests'] },
    { id: 'someday', label: 'Someday', questionIds: ['someday'] },
  ],
  questions: [
    {
      // Nicknames come first: it is how people see you in Spaces and when they reach out.
      id: 'nickname',
      archetype: 'tap',
      chapter: 'identity',
      question: "We don't like to call people by their first names here, what do people call you?",
      confidence: 'confirmed',
      placeholder: 'Your nickname',
      required: true,
      minLength: NICKNAME_MIN,
      validate: validateNickname,
      pickForMe: true,
      hint: "No nickname? Create one now! It's what people will see, so keep it free of anything that gives away who you are.",
    },
    {
      // Optional, and the same id as before so saved answers and resuming keep working.
      id: 'name',
      archetype: 'tap',
      chapter: 'identity',
      question: (ctx) => {
        const nick = (ctx.answers.nickname as string | undefined)?.trim();
        return nick
          ? `Nice to meet you, ${nick}. We won't show this to anyone without your permission, but what's your real name?`
          : "We won't show this to anyone without your permission, but what's your real name?";
      },
      confidence: 'confirmed',
      placeholder: 'Your real name (optional)',
      minLength: 2,
      optional: true,
      skipLabel: 'Skip for now',
      hint: "Optional. You can skip this and add it later.",
    },
    {
      id: 'favoriteColor',
      archetype: 'grid',
      chapter: 'identity',
      question: () => "What's your favorite color?",
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
        const who = (ctx.answers.nickname as string | undefined)?.trim();
        return who ? `When were you born, ${who}?` : 'When were you born?';
      },
      confidence: 'confirmed',
      placeholder: 'Select your birthday',
      // Sign-up already asks for it (for the age check), so this is rarely shown.
      skipIf: (ctx) => !!ctx.answers.birthday,
    },
    {
      id: 'zodiacCusp',
      archetype: 'tap',
      chapter: 'identity',
      question: "You're born on a cusp. Which sign feels more you?",
      confidence: 'confirmed',
      autoAdvance: true,
      skipIf: (ctx) => !getCuspSigns(ctx.answers.birthday as string),
      options: (ctx) => {
        const cusp = getCuspSigns(ctx.answers.birthday as string);
        if (!cusp) return [];
        return [
          { text: `${cusp[0]} ${ZODIAC_SYMBOLS[cusp[0]] ?? ''}`.trim(), value: cusp[0] },
          { text: `${cusp[1]} ${ZODIAC_SYMBOLS[cusp[1]] ?? ''}`.trim(), value: cusp[1] },
        ];
      },
    },
    {
      id: 'zodiacConfirm',
      archetype: 'tap',
      chapter: 'identity',
      question: (ctx) => {
        const sign = deriveZodiac(ctx.answers.birthday as string);
        return sign ? `${sign} ${ZODIAC_SYMBOLS[sign] ?? ''}, sound right?`.replace(' ,', ',') : 'Your sign?';
      },
      confidence: 'confirmed',
      autoAdvance: true,
      // Shown when the birthday gives one sign; cusp birthdays choose above.
      skipIf: (ctx) => !deriveZodiac(ctx.answers.birthday as string) || !!getCuspSigns(ctx.answers.birthday as string),
      options: (ctx) => {
        const sign = deriveZodiac(ctx.answers.birthday as string);
        if (!sign) return [];
        return [
          { text: "That's me", value: sign },
          { text: "I don't follow the stars", value: NO_SIGN },
        ];
      },
    },
    {
      id: 'gender',
      archetype: 'tap',
      chapter: 'identity',
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
      id: 'interests',
      archetype: 'tabs',
      chapter: 'taste',
      question: 'What are you into?',
      subtitle: 'Tap anything that\'s you. A few picks are enough for your feed to know where to start.',
      confidence: 'tapped',
      minSelections: 3,
      tabs: [
        { id: 'hobbies', label: 'Hobbies', answerKey: 'hobbies', options: HOBBY_OPTIONS, allowCustom: true },
        { id: 'music', label: 'Music', answerKey: 'musicGenre', options: MUSIC_OPTIONS, allowCustom: true },
        { id: 'watch', label: 'Watch & read', answerKey: 'entertainmentInterests', options: ENTERTAINMENT_OPTIONS, allowCustom: true },
        { id: 'tech', label: 'Tech', answerKey: 'techInterests', options: TECH_OPTIONS, allowCustom: true },
        { id: 'lifestyle', label: 'Lifestyle', answerKey: 'lifestyleInterests', options: LIFESTYLE_OPTIONS, allowCustom: true },
        { id: 'sports', label: 'Sports', answerKey: 'sportsInterests', options: SPORTS_OPTIONS, allowCustom: true },
      ],
    },
    {
      id: 'someday',
      archetype: 'tabs',
      chapter: 'someday',
      question: "Things you've always been curious about",
      subtitle: 'Not what you do now. What you\'d try if someone handed you the time. Tap anything that makes you think "one day…"',
      confidence: 'tapped',
      minSelections: 0,
      skipLabel: 'Skip for now',
      tabs: SOMEDAY_TABS.map(tab => ({
        id: tab.id,
        label: tab.label,
        nudge: tab.nudge,
        answerKey: somedayKey(tab.id),
        options: tab.options.map(o => ({ label: o, value: o })),
        allowCustom: true,
      })),
    },
  ],
};
