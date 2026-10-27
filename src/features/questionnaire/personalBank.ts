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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The month in a birthday ("2026-10-29" gives "October"), or null. */
export function birthMonthName(birthday: string): string | null {
  const m = /^\d{4}-(\d{2})-\d{2}/.exec(birthday ?? '');
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 12 ? MONTH_NAMES[n - 1] : null;
}

/**
 * The two signs a birth month can be: the one carried over from the month before and the one that
 * starts in it. Asking beats working it out from the day, since sign dates shift a day between sources.
 */
export function monthSigns(birthday: string): [string, string] | null {
  const m = /^\d{4}-(\d{2})-\d{2}/.exec(birthday ?? '');
  const month = m ? Number(m[1]) : 0;
  if (month < 1 || month > 12) return null;
  const starts = ZODIAC_RANGES.find(([sm]) => sm === month)?.[2];
  const prev = month === 1 ? 12 : month - 1;
  const carried = ZODIAC_RANGES.find(([sm]) => sm === prev)?.[2];
  return starts && carried ? [carried, starts] : null;
}

/** Why a birthday is not allowed, or null when it is fine. Velvet is for adults. */
export function validateBirthday(text: string, today: Date = new Date()): string | null {
  if (!text) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return 'Pick your birthday from the calendar.';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d || y < 1900) return "That doesn't look like a real date.";
  let age = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < mo || (today.getUTCMonth() + 1 === mo && today.getUTCDate() < d)) age -= 1;
  if (age < 0) return "That date hasn't happened yet.";
  if (age < 18) return 'Velvet is for people 18 and over.';
  return null;
}

/** "none" means they'd rather not have a sign. */
const NO_SIGN = 'none';

/**
 * Their sign: the one they picked for their birth month, else the one they
 * confirmed or picked on a cusp in the old questions, else the one their birthday gives.
 */
export function resolveZodiac(answers: Record<string, string | string[]>): string | null {
  for (const key of ['zodiac', 'zodiacCusp', 'zodiacConfirm', 'zodiacSign']) {
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
// nickname → color → birthday → zodiac → gender → interests → Someday → four "wavelength" questions →
// favorite hero → real name (optional). Each answer is saved as it's given. The wavelength answers shape
// how a coach or assistant works with them (when to push, how to talk, what to do when they're upset), so
// they are asked here, by Dez, and nowhere else.

/** Suggestions for the favorite superhero question; anyone else can be typed in. */
export const HERO_BANK = [
  'Spider-Man', 'Batman', 'Superman', 'Wonder Woman', 'Iron Man', 'Captain America', 'Black Panther', 'Thor',
  'Hulk', 'Black Widow', 'Wolverine', 'Storm', 'Deadpool', 'The Flash', 'Aquaman', 'Green Lantern',
  'Batgirl', 'Catwoman', 'Ms. Marvel', 'Captain Marvel', 'Doctor Strange', 'Scarlet Witch', 'Ant-Man', 'Daredevil',
  'Nightwing', 'Supergirl', 'Mr. Incredible', 'Elastigirl', 'Hellboy', 'Spawn',
] as const;

/** Why a favorite hero answer is not allowed, or null when it is fine. */
export function validateHero(text: string): string | null {
  const t = text.trim();
  if (t.length > 60) return 'Keep it under 60 characters.';
  if (/@|https?:|www\./i.test(t)) return "Just the hero's name, please.";
  return null;
}

export const PERSONAL_QUESTIONNAIRE: QuestionnaireDefinition = {
  startProgress: 10,
  chapters: [
    { id: 'identity', label: 'Who you are', questionIds: ['nickname', 'favoriteColor', 'birthday', 'zodiac', 'gender'] },
    { id: 'taste', label: 'What you love', questionIds: ['interests'] },
    { id: 'someday', label: 'Someday', questionIds: ['someday'] },
    { id: 'wavelength', label: 'How you tick', questionIds: ['conflictResponse', 'connection', 'decisionStyle', 'motivation'] },
    { id: 'finish', label: 'Last bits', questionIds: ['favoriteHero', 'name'] },
  ],
  questions: [
    {
      // Nicknames come first: it is how people see you in Spaces and when they reach out.
      id: 'nickname',
      archetype: 'tap',
      chapter: 'identity',
      question: "Hey, I'm Dez! We don't call ya by your first name around here, what do people call you?",
      confidence: 'confirmed',
      placeholder: 'Your nickname',
      required: true,
      minLength: NICKNAME_MIN,
      validate: validateNickname,
      nicknameBank: true,
      skipLabel: 'Skip, pick one for me',
      hint: "No nickname? Create one now! It's what people will see, so keep it free of anything that gives away who you are.",
    },
    {
      id: 'favoriteColor',
      archetype: 'grid',
      chapter: 'identity',
      question: (ctx) => {
        const who = (ctx.answers.nickname as string | undefined)?.trim();
        return who ? `${who}! Now that's a name I can work with. What's your favorite color?` : "What's your favorite color?";
      },
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
        return who
          ? `When's your birthday, ${who}? It's filled in from sign-up. Fix it if it's off.`
          : "When's your birthday? It's filled in from sign-up. Fix it if it's off.";
      },
      confidence: 'confirmed',
      placeholder: 'Select your birthday',
      // Always asked: it corrects a sign-up mistake and is how older accounts get their age checked.
      // A birthday already on the profile is only a starting point, so it does not count as progress.
      prefilled: true,
      validate: (text) => validateBirthday(text),
    },
    {
      id: 'zodiac',
      archetype: 'tap',
      chapter: 'identity',
      question: (ctx) => {
        const month = birthMonthName(ctx.answers.birthday as string);
        const pair = monthSigns(ctx.answers.birthday as string);
        if (!month || !pair) return 'Which sign are you?';
        const a = (sign: string) => (/^[AEIOU]/.test(sign) ? 'an' : 'a');
        return `${month}, huh? That makes you ${a(pair[0])} ${pair[0]} or ${a(pair[1])} ${pair[1]}. Which one's you?`;
      },
      confidence: 'confirmed',
      autoAdvance: true,
      skipIf: (ctx) => !monthSigns(ctx.answers.birthday as string),
      options: (ctx) => {
        const pair = monthSigns(ctx.answers.birthday as string);
        if (!pair) return [];
        return [
          ...pair.map(sign => ({ text: `${sign} ${ZODIAC_SYMBOLS[sign] ?? ''}`.trim(), value: sign })),
          { text: "I don't follow the stars", value: NO_SIGN },
        ];
      },
    },
    {
      id: 'gender',
      archetype: 'tap',
      chapter: 'identity',
      question: 'Now, how do you identify?',
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
      question: (ctx) => {
        const who = (ctx.answers.nickname as string | undefined)?.trim();
        return who ? `So what are you into, ${who}?` : 'So what are you into?';
      },
      subtitle: "Tap anything that's you. Even try out some things you may not think you like.",
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
      question: "What have you always been curious about?",
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
    {
      id: 'conflictResponse',
      archetype: 'tap',
      chapter: 'wavelength',
      question: "Four quick ones about how you tick, so your coach gets you right. When you're upset, what helps more?",
      confidence: 'confirmed',
      autoAdvance: true,
      options: [
        { text: 'Logical solutions: help me figure it out', value: 'solutions' },
        { text: 'Emotional understanding: hear me out first', value: 'empathy' },
      ],
    },
    {
      id: 'connection',
      archetype: 'tap',
      chapter: 'wavelength',
      question: 'And how do you like to talk with folks?',
      confidence: 'confirmed',
      autoAdvance: true,
      options: [
        { text: 'Deep, proper one-on-one conversation', value: 'deep' },
        { text: 'Lively back-and-forth banter', value: 'lively' },
      ],
    },
    {
      id: 'decisionStyle',
      archetype: 'tap',
      chapter: 'wavelength',
      question: 'Big decision coming up. What do you trust?',
      confidence: 'confirmed',
      autoAdvance: true,
      options: [
        { text: 'My gut: I know the right call when I feel it', value: 'intuitive' },
        { text: 'Research: I want every option laid out first', value: 'analytical' },
      ],
    },
    {
      id: 'motivation',
      archetype: 'tap',
      chapter: 'wavelength',
      question: 'Last of the four. What gets you moving on something hard?',
      confidence: 'confirmed',
      autoAdvance: true,
      options: [
        { text: "My own drive: I do it because I want to", value: 'internal' },
        { text: 'Someone counting on me', value: 'external' },
      ],
    },
    {
      // Shown on their profile card and the billboard outside their house: another thing to bond over.
      id: 'favoriteHero',
      archetype: 'tap',
      chapter: 'finish',
      question: "Every town needs its heroes. Who's your favorite superhero?",
      confidence: 'tapped',
      placeholder: 'Type a hero, or pick one below',
      optional: true,
      skipLabel: 'Skip for now',
      hint: 'It shows on your profile and your billboard, so neighbors can find their fellow fans.',
      validate: validateHero,
      suggestions: [...HERO_BANK],
    },
    {
      // Optional, and the same id as before so saved answers and resuming keep working.
      id: 'name',
      archetype: 'tap',
      chapter: 'finish',
      question: (ctx) => {
        const nick = (ctx.answers.nickname as string | undefined)?.trim();
        return `Alright, ${nick || 'friend'}, last question. Atlas needs to know your first name.`;
      },
      confidence: 'confirmed',
      placeholder: 'Your first name',
      minLength: 2,
      optional: true,
      skipLabel: 'Skip for now',
      hint: "Only Atlas uses it, and it's never shown to anyone. You can skip this and add it later.",
    },
  ],
};
