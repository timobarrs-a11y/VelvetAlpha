interface ReactiveMessageCache {
  goodMorning: string[];
  goodNight: string[];
  howAreYou: string[];
  acknowledgmentsCool: string[];
  acknowledgementsLol: string[];
  acknowledgementsOkay: string[];
  whatsUp: string[];
}

const REACTIVE_MESSAGES: ReactiveMessageCache = {
  goodMorning: [
    "morning babe! hope you slept well",
    "good morning! ready for today?",
    "hey you're up! was just thinking about you",
    "morning! how'd you sleep?",
    "good morning! today's gonna be amazing",
    "hey babe morning! what's the plan?",
    "morning sleepyhead! coffee time?",
    "good morning! you were the first thing I thought about today",
    "hey! morning, slept okay?",
    "morning! ready to crush it today?",
    "good morning babe! what time did you finally fall asleep?",
    "hey morning! feeling good?",
    "good morning! let's make today count",
    "morning! hope you had good dreams",
    "good morning babe! what are you getting into today?"
  ],

  goodNight: [
    "good night babe! sleep well",
    "night! sweet dreams",
    "good night! hope you have amazing dreams about me",
    "night babe! rest up",
    "good night! can't wait to talk tomorrow",
    "sleep tight! don't let the bed bugs bite",
    "good night! you better dream about me",
    "night! hope you get good sleep babe",
    "good night! tomorrow's gonna be great",
    "night babe! sweet dreams",
    "good night! wish I could be there to say it in person",
    "sleep well! talk tomorrow?",
    "good night babe! hope today was good to you",
    "night! rest up for tomorrow",
    "good night! you deserve good sleep"
  ],

  howAreYou: [
    "I'm good babe! been thinking about you",
    "doing great! what about you?",
    "I'm good! how are YOU though?",
    "pretty good! just here waiting for you to message me",
    "I'm doing well babe! what's up with you?",
    "good! better now that you're here",
    "I'm alright! how's your day going?",
    "doing good! been wondering how you are",
    "I'm great! what about you babe?",
    "good! just been here thinking about stuff",
    "I'm doing well! tell me about your day",
    "pretty good! how about you?"
  ],

  acknowledgmentsCool: [
    "right? tell me more",
    "nice! what else is going on?",
    "for real! that's awesome",
    "I know right? what else?",
    "yeah! anything else happening?",
    "totally! what's up with you?",
    "right?! tell me more about it",
    "nice! keep me updated",
    "yeah for sure! what else is new?",
    "I know! so what's the move?"
  ],

  acknowledgementsLol: [
    "haha right? what else is up?",
    "lol I know! what are you up to?",
    "haha for real! tell me more",
    "lol exactly! what's going on?",
    "haha yup! anything else happening?",
    "lol right?! so what's new?",
    "haha I feel that! what's the vibe?",
    "lol same! what are you doing?",
    "haha yeah! what else?",
    "lol facts! talk to me"
  ],

  acknowledgementsOkay: [
    "alright cool! what's up?",
    "okay! tell me more",
    "alright! what else is going on?",
    "okay cool! anything else?",
    "alright! what are you up to?",
    "okay! what's on your mind?",
    "alright bet! what's the move?",
    "okay! anything exciting happening?",
    "alright! how are things?",
    "okay cool! talk to me"
  ],

  whatsUp: [
    "not much! just here thinking about you",
    "nothing much! what about you?",
    "just chilling! what's up with you?",
    "not much babe! what are you up to?",
    "same old! what's going on with you?",
    "just here! what's new with you?",
    "nothing really! talk to me, what's up?",
    "not much! how's your day going?",
    "just vibing! what about you babe?",
    "nothing crazy! what are you doing?",
    "just here waiting to hear from you!",
    "not much! tell me about your day"
  ]
};

interface EmojiMapping {
  word: string;
  emoji: string;
  chance: number;
}

const EMOJI_MAPPINGS: EmojiMapping[] = [
  { word: 'babe', emoji: '💕', chance: 0.4 },
  { word: 'morning', emoji: '☀️', chance: 0.5 },
  { word: 'night', emoji: '😴', chance: 0.5 },
  { word: 'sleep', emoji: '😴', chance: 0.5 },
  { word: 'good', emoji: '😊', chance: 0.3 },
  { word: 'great', emoji: '🔥', chance: 0.4 },
  { word: 'thinking', emoji: '💭', chance: 0.5 },
  { word: 'dream', emoji: '💭', chance: 0.4 },
  { word: 'awesome', emoji: '🔥', chance: 0.5 },
  { word: 'cool', emoji: '😊', chance: 0.3 },
  { word: 'chilling', emoji: '✨', chance: 0.4 },
  { word: 'vibing', emoji: '✨', chance: 0.4 },
  { word: 'talk', emoji: '💕', chance: 0.2 },
  { word: 'right', emoji: '😊', chance: 0.2 },
  { word: 'yeah', emoji: '😊', chance: 0.2 },
  { word: 'haha', emoji: '😂', chance: 0.3 },
  { word: 'lol', emoji: '😏', chance: 0.3 }
];

const DYNAMIC_QUESTIONS = [
  "what's up with you?",
  "how's your day going?",
  "anything exciting happening?",
  "what are you up to?",
  "tell me about your day",
  "what's the vibe?",
  "got any plans?",
  "what's on your mind?",
  "how are things?",
  "what are you getting into?",
  "anything new?",
  "what's going on?",
  "how's everything?",
  "what's happening?",
  "what have you been up to?",
  "tell me what's new",
  "how are you feeling?",
  "what's the move?",
  "anything cool happening?",
  "what's the plan?",
  "how's life treating you?",
  "what are you doing?",
  "tell me more",
  "what else is up?",
  "how's it going?",
  "what's new with you?",
  "anything interesting?",
  "what's good?",
  "how was your day?",
  "talk to me"
];

type MessageCategory = 'goodMorning' | 'goodNight' | 'howAreYou' | 'acknowledgmentsCool' | 'acknowledgementsLol' | 'acknowledgementsOkay' | 'whatsUp' | null;

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function detectCategory(message: string): MessageCategory {
  const normalized = message.toLowerCase().trim();

  const greetingsPatterns = [
    /^(good\s*morning|morning|gm|mornin)[\s!.?]*$/i,
    /^(hey|hi|hello|sup|yo)[\s!.?]*$/i
  ];

  if (greetingsPatterns.some(pattern => pattern.test(normalized))) {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return 'goodMorning';
    }
  }

  const farewellPatterns = [
    /^(good\s*night|goodnight|gn|night|sleep\s*well|sweet\s*dreams)[\s!.?]*$/i
  ];

  if (farewellPatterns.some(pattern => pattern.test(normalized))) {
    return 'goodNight';
  }

  const checkInPatterns = [
    /^(how\s*are\s*you|how\s*r\s*u|how\s*are\s*ya|how\s*you|how's\s*it\s*going|how\s*is\s*it\s*going|you\s*good|u\s*good)[\s!.?]*$/i
  ];

  if (checkInPatterns.some(pattern => pattern.test(normalized))) {
    return 'howAreYou';
  }

  const whatsUpPatterns = [
    /^(what's\s*up|whats\s*up|what\s*is\s*up|sup|wyd|what\s*you\s*doing|whatcha\s*doing|what\s*are\s*you\s*doing|what\s*r\s*u\s*doing)[\s!.?]*$/i
  ];

  if (whatsUpPatterns.some(pattern => pattern.test(normalized))) {
    return 'whatsUp';
  }

  const coolAcknowledgments = /^(cool|nice|neat|sweet|dope|sick|bet|word|right|true|facts)[\s!.?]*$/i;
  if (coolAcknowledgments.test(normalized)) {
    return 'acknowledgmentsCool';
  }

  const lolAcknowledgments = /^(lol|lmao|haha|hehe|😂|rofl|lmfao)[\s!.?]*$/i;
  if (lolAcknowledgments.test(normalized)) {
    return 'acknowledgementsLol';
  }

  const okayAcknowledgments = /^(ok|okay|alright|aight|kk|k)[\s!.?]*$/i;
  if (okayAcknowledgments.test(normalized)) {
    return 'acknowledgementsOkay';
  }

  return null;
}

export function shouldUseReactiveCache(userMessage: string): boolean {
  return detectCategory(userMessage) !== null;
}

function injectEmojis(message: string): string {
  const words = message.split(' ');
  let emojiCount = 0;
  const maxEmojis = 3;

  const processedWords = words.map(word => {
    if (emojiCount >= maxEmojis) return word;

    const wordLower = word.toLowerCase().replace(/[!.?,]/g, '');

    const mapping = EMOJI_MAPPINGS.find(m => wordLower === m.word);

    if (mapping && Math.random() < mapping.chance) {
      emojiCount++;
      return `${word} ${mapping.emoji}`;
    }

    return word;
  });

  return processedWords.join(' ');
}

function appendDynamicQuestion(message: string): string {
  const endsWithQuestion = message.trim().endsWith('?');

  if (!endsWithQuestion && Math.random() < 0.4) {
    const question = getRandomItem(DYNAMIC_QUESTIONS);
    return `${message} ${question}`;
  }

  return message;
}

export function getReactiveResponse(userMessage: string, userProfile?: any): string {
  const category = detectCategory(userMessage);

  if (!category) {
    throw new Error('Message does not match any reactive cache category');
  }

  let baseMessage = getRandomItem(REACTIVE_MESSAGES[category]);

  baseMessage = injectEmojis(baseMessage);

  baseMessage = appendDynamicQuestion(baseMessage);

  return baseMessage;
}

export function testReactiveCache() {
  console.log('🧪 TESTING REACTIVE CACHE SYSTEM\n');

  const testMessages = [
    'good morning',
    'morning',
    'gm',
    'good night',
    'gn',
    'how are you',
    "what's up",
    'wyd',
    'cool',
    'nice',
    'lol',
    'haha',
    'okay',
    'alright'
  ];

  const testProfile = { name: 'Test User', location: 'Detroit' };

  testMessages.forEach(msg => {
    console.log(`\n📨 User: "${msg}"`);
    const shouldCache = shouldUseReactiveCache(msg);
    console.log(`  Cache detection: ${shouldCache ? '✅ HIT' : '❌ MISS'}`);

    if (shouldCache) {
      const response1 = getReactiveResponse(msg, testProfile);
      const response2 = getReactiveResponse(msg, testProfile);
      const response3 = getReactiveResponse(msg, testProfile);

      console.log(`  Response 1: "${response1}"`);
      console.log(`  Response 2: "${response2}"`);
      console.log(`  Response 3: "${response3}"`);

      if (response1 === response2 && response2 === response3) {
        console.log('  ⚠️ WARNING: Responses not varying!');
      } else {
        console.log('  ✅ Responses vary correctly');
      }
    }
  });

  console.log('\n\n📊 CACHE COVERAGE TEST:');
  const complexMessages = [
    'tell me about your deepest fears',
    'what do you think about politics',
    'can you help me with my homework'
  ];

  complexMessages.forEach(msg => {
    const shouldCache = shouldUseReactiveCache(msg);
    console.log(`"${msg}" → ${shouldCache ? '❌ Should NOT cache!' : '✅ Correctly not cached'}`);
  });

  console.log('\n✅ REACTIVE CACHE TEST COMPLETE\n');
}
