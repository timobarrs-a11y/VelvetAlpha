// Nickname ideas for people who do not have one, and the rules a nickname has to follow.

export type NicknameKind = 'funny' | 'classic' | 'screen' | 'cozy';

/**
 * A bank of nicknames for people who do not have one: funny ones, the classic kind a friend
 * would give you, and screen names. Suggestions mix all of them. Everything here is friendly
 * and has to pass validateNickname (a test checks).
 */
export const NICKNAME_BANK: Record<NicknameKind, string[]> = {
  funny: [
    'Captain Snacks', 'Professor Pancake', 'Sir Naps-a-Lot', 'Lord of the Fries', 'Taco Tuesday',
    'Noodle Bandit', 'Couch Potato', 'Mr. Bubbles', 'Dr. Doughnut', 'Waffle House Hero',
    'Sneaky Burrito', 'Big Cheese', 'Cereal Killer', 'Pickle Rick Jr', 'Meatball Marvin',
    'Banana Hammock Hero', 'Karaoke Kevin', 'Snack Attack', 'Grumpy Muffin', 'Chaos Goblin',
    'Dad Joke Dealer', 'Professional Napper', 'Fashionably Late', 'Wi-Fi Wizard', 'Gym Rat Maybe',
    'Pizza Philosopher', 'Brunch Baron', 'Spreadsheet Sorcerer', 'Retired Mayor', 'The Sock Thief',
    'Fancy Pants', 'Mildly Dangerous', 'Cuddle Bandit', 'Plot Twist', 'Main Character',
    'Side Quest', 'Unpaid Intern', 'Nacho Average Joe', 'Sir Reginald Fluff', 'Tiny Dancer',
  ],
  classic: [
    'Ace', 'Champ', 'Tank', 'Sparky', 'Slick', 'Rocky', 'Bubba', 'Scooter', 'Peanut', 'Lucky',
    'Hawk', 'Maverick', 'Duke', 'Tiny', 'Doc', 'Skip', 'Chief', 'Sarge', 'Buddy', 'Chip',
    'Pistol', 'Moose', 'Jinx', 'Smokey', 'Rebel', 'Ziggy', 'Bear', 'Blaze', 'Tigger', 'Cookie',
    'Sunshine', 'Shortstop', 'Stretch', 'Twinkle', 'Dynamo', 'Goose', 'Maverick Jr', 'Boomer', 'Butch', 'Kiddo',
    'Bean', 'Dutch', 'Biscuit', 'Cricket', 'Gizmo', 'Hotshot', 'Ladybug', 'Mac', 'Pep', 'Sunny',
  ],
  screen: [
    'NightOwl', 'PixelPirate', 'CoolBreeze99', 'ShadowFox', 'TurboTaco', 'LazerLlama', 'GamerGuru', 'SirLagsALot', 'NinjaNoodle', 'ByteMe',
    'xXSparkXx', 'DarkHorse23', 'StarDust_88', 'MidnightRider', 'CyberSamurai', 'QuantumKat', 'NeonNomad', 'RetroRocket', 'AlphaWolf7', 'ZeroCool',
    'IceBreaker', 'ThunderPaw', 'GhostRider21', 'CrimsonTide', 'PhantomPhoenix', 'ElectricEel', 'RapidRaccoon', 'SkyWalker_9', 'TheRealDeal', 'VoltViper',
    'MadMax_42', 'CosmicCrusader', 'BlueMoon77', 'SilentStorm', 'HyperHippo', 'GlitchGoblin', 'OnyxOwl', 'TurboTurtle', 'PlayerTwo', 'LevelUp_1',
  ],
  cozy: [
    'Sunny Otter', 'Quiet Comet', 'Cozy Fox', 'Lucky Maple', 'Gentle Panda', 'Swift Falcon', 'Misty Willow', 'Golden Ember', 'Happy Pebble', 'Calm Harbor',
    'Brave Sparrow', 'Mellow Lantern', 'Wild Meadow', 'Silver River', 'Dreamy Orbit', 'Steady Cedar', 'Merry Koala', 'Amber Breeze', 'Humble Heron', 'Twilight Clover',
    'Velvet Raven', 'Breezy Tulip', 'Clever Lynx', 'Daring Compass', 'Lively Marble', 'Rustic Summit', 'Bright Aurora', 'Bold Thistle', 'Spark Moon', 'Cosmic Wolf',
  ],
};

const KINDS = Object.keys(NICKNAME_BANK) as NicknameKind[];

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 24;

/**
 * One random nickname from the bank, different from `exclude` (so pressing the button again
 * gives a new one). The kind is picked first, so funny, classic, screen-name and cozy ones
 * all turn up. Pass a seeded random in tests.
 */
export function pickNickname(exclude = '', random: () => number = Math.random): string {
  for (let i = 0; i < 20; i++) {
    const kind = KINDS[Math.floor(random() * KINDS.length)];
    const list = NICKNAME_BANK[kind];
    const pick = list[Math.floor(random() * list.length)];
    if (pick.toLowerCase() !== exclude.trim().toLowerCase()) return pick;
  }
  return NICKNAME_BANK.classic[0];
}

/**
 * Why a nickname is not allowed, or null when it is fine. It stays private to people who do
 * not know you, so no emails, links or phone numbers.
 */
export function validateNickname(value: string): string | null {
  const text = value.trim();
  if (text.length < NICKNAME_MIN) return `At least ${NICKNAME_MIN} characters.`;
  if (text.length > NICKNAME_MAX) return `Keep it to ${NICKNAME_MAX} characters or fewer.`;
  if (/[@/\\]|https?:|www\./i.test(text) || /\d{7,}/.test(text.replace(/[\s.-]/g, ''))) {
    return 'Leave out emails, links and phone numbers to keep your nickname private.';
  }
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(text)) return "Use letters, numbers, spaces and . _ ' - only.";
  return null;
}
