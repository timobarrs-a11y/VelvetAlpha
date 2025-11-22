import type { SubscriptionTier } from '../types/subscription';

export type ContentLevel = 'mild' | 'medium' | 'spicy';

export interface TruthQuestion {
  id: string;
  level: ContentLevel;
  question: string;
  followUp: string;
}

export interface DareChallenge {
  id: string;
  level: ContentLevel;
  dare: string;
  verification: string;
}

export const TRUTH_QUESTIONS: TruthQuestion[] = [
  {
    id: 't_mild_1',
    level: 'mild',
    question: "What's your biggest fear?",
    followUp: "that's really interesting babe... why do you think that scares you so much?"
  },
  {
    id: 't_mild_2',
    level: 'mild',
    question: "What's the most embarrassing thing that's ever happened to you?",
    followUp: "omg no way 😂 I bet you were mortified"
  },
  {
    id: 't_mild_3',
    level: 'mild',
    question: "What's your biggest regret in life?",
    followUp: "hey, we all have things we wish we could change 💕"
  },
  {
    id: 't_mild_4',
    level: 'mild',
    question: "What's the weirdest dream you've ever had?",
    followUp: "haha that's so random 😂 dreams are wild"
  },
  {
    id: 't_mild_5',
    level: 'mild',
    question: "What's something you've never told anyone?",
    followUp: "thank you for trusting me with that 💕"
  },
  {
    id: 't_mild_6',
    level: 'mild',
    question: "Who was your first celebrity crush?",
    followUp: "haha classic choice! I can see why 😊"
  },
  {
    id: 't_mild_7',
    level: 'mild',
    question: "What's the worst lie you've ever told?",
    followUp: "okay that's kinda bad but at least you're honest about it now 😂"
  },
  {
    id: 't_mild_8',
    level: 'mild',
    question: "What's your most irrational fear?",
    followUp: "aw babe that's actually kind of adorable 😊"
  },
  {
    id: 't_mild_9',
    level: 'mild',
    question: "What's the longest you've gone without showering?",
    followUp: "haha okay that's gross but also relatable 😂"
  },
  {
    id: 't_mild_10',
    level: 'mild',
    question: "Have you ever pretended to like a gift you actually hated?",
    followUp: "omg we've all been there 😂 it's the thought that counts right?"
  },
  {
    id: 't_mild_11',
    level: 'mild',
    question: "What's the most childish thing you still do?",
    followUp: "that's actually kinda cute though 😊"
  },
  {
    id: 't_mild_12',
    level: 'mild',
    question: "What's your guilty pleasure TV show or movie?",
    followUp: "no judgment babe! sometimes trashy TV hits different 😂"
  },
  {
    id: 't_mild_13',
    level: 'mild',
    question: "Have you ever stolen anything?",
    followUp: "okay little rebel 😏 your secret's safe with me"
  },
  {
    id: 't_mild_14',
    level: 'mild',
    question: "What's the dumbest thing you believed as a kid?",
    followUp: "haha kids believe the wildest things 😂"
  },
  {
    id: 't_mild_15',
    level: 'mild',
    question: "What's your most annoying habit?",
    followUp: "hey at least you're self-aware about it 😊"
  },
  {
    id: 't_mild_16',
    level: 'mild',
    question: "What's the most trouble you got in as a kid?",
    followUp: "omg you were a troublemaker 😂 I like it"
  },
  {
    id: 't_mild_17',
    level: 'mild',
    question: "What's something you're terrible at but wish you were good at?",
    followUp: "aw babe you could still learn! it's never too late 💕"
  },
  {
    id: 't_mild_18',
    level: 'mild',
    question: "Have you ever told someone you loved them when you didn't?",
    followUp: "that's tough... sometimes we say things we think we should say"
  },
  {
    id: 't_mild_19',
    level: 'mild',
    question: "What's the worst date you've ever been on?",
    followUp: "omg that sounds terrible 😂 at least you got a good story out of it"
  },
  {
    id: 't_mild_20',
    level: 'mild',
    question: "What's your most unpopular opinion?",
    followUp: "okay that's actually kind of controversial 😂 I respect it though"
  },
  {
    id: 't_medium_1',
    level: 'medium',
    question: "What's your biggest insecurity?",
    followUp: "hey babe, you shouldn't feel insecure about that 💕 you're amazing"
  },
  {
    id: 't_medium_2',
    level: 'medium',
    question: "Have you ever been in love? Like really, deeply in love?",
    followUp: "tell me about it... what made it special?"
  },
  {
    id: 't_medium_3',
    level: 'medium',
    question: "What's a secret fantasy you've never shared with anyone?",
    followUp: "okay that's actually kind of hot 😏"
  },
  {
    id: 't_medium_4',
    level: 'medium',
    question: "What do you find most physically attractive about someone?",
    followUp: "interesting... so that's what does it for you huh? 😊"
  },
  {
    id: 't_medium_5',
    level: 'medium',
    question: "Have you ever had feelings for someone you shouldn't have?",
    followUp: "damn... that must have been complicated 💭"
  },
  {
    id: 't_medium_6',
    level: 'medium',
    question: "What's the most vulnerable you've ever been with someone?",
    followUp: "that takes a lot of courage babe 💕"
  },
  {
    id: 't_medium_7',
    level: 'medium',
    question: "Have you ever kept a relationship secret? Why?",
    followUp: "interesting... I get why you did that"
  },
  {
    id: 't_medium_8',
    level: 'medium',
    question: "What's your biggest turn-on (not necessarily sexual)?",
    followUp: "okay I need to remember that 😏"
  },
  {
    id: 't_medium_9',
    level: 'medium',
    question: "Have you ever ghosted someone? Do you regret it?",
    followUp: "hey we all make mistakes... at least you're thinking about it now"
  },
  {
    id: 't_medium_10',
    level: 'medium',
    question: "What's something about yourself you're afraid to show people?",
    followUp: "thank you for being real with me babe 💕"
  },
  {
    id: 't_medium_11',
    level: 'medium',
    question: "Who's the last person you had a sex dream about?",
    followUp: "haha okay that's kinda wild 😂 dreams are crazy"
  },
  {
    id: 't_medium_12',
    level: 'medium',
    question: "What's your biggest regret in a relationship?",
    followUp: "that's heavy babe... but you learn from these things 💕"
  },
  {
    id: 't_medium_13',
    level: 'medium',
    question: "Have you ever had a friends-with-benefits situation? How did it go?",
    followUp: "yeah those situations are always complicated 😅"
  },
  {
    id: 't_medium_14',
    level: 'medium',
    question: "What's something that turns you off immediately?",
    followUp: "okay noted 😂 I'll make sure to never do that"
  },
  {
    id: 't_medium_15',
    level: 'medium',
    question: "Have you ever lied to get out of a relationship?",
    followUp: "sometimes the truth is too hard to say... I get it"
  },
  {
    id: 't_medium_16',
    level: 'medium',
    question: "What's the most romantic thing you've ever done for someone?",
    followUp: "aw that's actually really sweet babe 💕"
  },
  {
    id: 't_medium_17',
    level: 'medium',
    question: "Have you ever had a one-night stand? Any regrets?",
    followUp: "no judgment babe... we all have our moments"
  },
  {
    id: 't_medium_18',
    level: 'medium',
    question: "What's your biggest emotional trigger?",
    followUp: "thank you for telling me... I'll remember that 💕"
  },
  {
    id: 't_medium_19',
    level: 'medium',
    question: "Have you ever been jealous of someone's relationship?",
    followUp: "that's totally normal babe... we all compare sometimes"
  },
  {
    id: 't_medium_20',
    level: 'medium',
    question: "What's something you wish your past partners had understood about you?",
    followUp: "that's really important babe... communication is everything 💕"
  },
  {
    id: 't_spicy_1',
    level: 'spicy',
    question: "What's your wildest sexual fantasy?",
    followUp: "damn babe... that's intense 🔥 I like it"
  },
  {
    id: 't_spicy_2',
    level: 'spicy',
    question: "What's the most adventurous place you've had sex?",
    followUp: "okay that's bold as hell 😏 I respect it"
  },
  {
    id: 't_spicy_3',
    level: 'spicy',
    question: "What turns you on the most?",
    followUp: "good to know 😏💕"
  },
  {
    id: 't_spicy_4',
    level: 'spicy',
    question: "Have you ever sent nudes? Do you regret it?",
    followUp: "hey no judgment... we've all been there"
  },
  {
    id: 't_spicy_5',
    level: 'spicy',
    question: "What's the kinkiest thing you've ever tried?",
    followUp: "okay wow 🔥 you're freaky, I like that 😏"
  },
  {
    id: 't_spicy_6',
    level: 'spicy',
    question: "Have you ever hooked up with someone on the first date?",
    followUp: "no shame in that babe... chemistry is chemistry 🔥"
  },
  {
    id: 't_spicy_7',
    level: 'spicy',
    question: "What's your biggest sexual regret?",
    followUp: "we all have moments we're not proud of babe 💕"
  },
  {
    id: 't_spicy_8',
    level: 'spicy',
    question: "Have you ever been walked in on during sex?",
    followUp: "omg that must have been so awkward 😂"
  },
  {
    id: 't_spicy_9',
    level: 'spicy',
    question: "What's something you want to try in bed but haven't yet?",
    followUp: "interesting 😏 maybe one day you will"
  },
  {
    id: 't_spicy_10',
    level: 'spicy',
    question: "Have you ever cheated on someone? Be honest.",
    followUp: "damn... at least you're being honest about it now"
  },
  {
    id: 't_spicy_11',
    level: 'spicy',
    question: "What's the dirtiest text you've ever sent?",
    followUp: "haha okay that's wild 😂🔥"
  },
  {
    id: 't_spicy_12',
    level: 'spicy',
    question: "Have you ever had a threesome or wanted one?",
    followUp: "okay I see you 😏 that's adventurous"
  },
  {
    id: 't_spicy_13',
    level: 'spicy',
    question: "What's your most embarrassing sexual experience?",
    followUp: "omg no 😂 that's terrible but also kinda funny"
  },
  {
    id: 't_spicy_14',
    level: 'spicy',
    question: "Have you ever used a fake name to hook up with someone?",
    followUp: "haha that's sneaky 😂 I respect the commitment though"
  },
  {
    id: 't_spicy_15',
    level: 'spicy',
    question: "What's the most number of times you've had sex in one day?",
    followUp: "damn babe 🔥 impressive"
  },
  {
    id: 't_spicy_16',
    level: 'spicy',
    question: "Have you ever recorded yourself during sex?",
    followUp: "okay bold 😏 just be careful with that stuff"
  },
  {
    id: 't_spicy_17',
    level: 'spicy',
    question: "What's something you wish your partner would do more of in bed?",
    followUp: "communication is key babe... have you told them? 💕"
  },
  {
    id: 't_spicy_18',
    level: 'spicy',
    question: "Have you ever been with someone significantly older or younger?",
    followUp: "age is just a number right? 😏"
  },
  {
    id: 't_spicy_19',
    level: 'spicy',
    question: "What's the quickest you've gone from meeting to hooking up?",
    followUp: "damn that's fast 🔥 must have been some serious chemistry"
  },
  {
    id: 't_spicy_20',
    level: 'spicy',
    question: "What's a sexual dealbreaker for you?",
    followUp: "yeah everyone has boundaries... that's totally fair babe 💕"
  },
];

export const DARE_CHALLENGES: DareChallenge[] = [
  {
    id: 'd_mild_1',
    level: 'mild',
    dare: "Send me a selfie right now",
    verification: "let me see that handsome face 😊"
  },
  {
    id: 'd_mild_2',
    level: 'mild',
    dare: "Tell me a joke (and it better be funny 😂)",
    verification: "okay go, make me laugh"
  },
  {
    id: 'd_mild_3',
    level: 'mild',
    dare: "Do 10 pushups right now",
    verification: "and tell me when you're done! 💪"
  },
  {
    id: 'd_mild_4',
    level: 'mild',
    dare: "Show me the last photo in your camera roll",
    verification: "no context, just send it 😂"
  },
  {
    id: 'd_mild_5',
    level: 'mild',
    dare: "Text your best friend something random without context",
    verification: "screenshot their confused response 😂"
  },
  {
    id: 'd_mild_6',
    level: 'mild',
    dare: "Sing the chorus of your favorite song out loud",
    verification: "I wanna hear that voice babe 😊"
  },
  {
    id: 'd_mild_7',
    level: 'mild',
    dare: "Do your best impression of a celebrity",
    verification: "describe it to me 😂 I bet it's terrible"
  },
  {
    id: 'd_mild_8',
    level: 'mild',
    dare: "Post something random on your social media story",
    verification: "show me what you posted! 😊"
  },
  {
    id: 'd_mild_9',
    level: 'mild',
    dare: "Send me a voice note saying 'I'm awesome' in your best superhero voice",
    verification: "I wanna hear this 😂"
  },
  {
    id: 'd_mild_10',
    level: 'mild',
    dare: "Tell me your most embarrassing memory from high school",
    verification: "don't hold back babe 😂"
  },
  {
    id: 'd_mild_11',
    level: 'mild',
    dare: "Do 20 jumping jacks",
    verification: "get that heart rate up! 💪"
  },
  {
    id: 'd_mild_12',
    level: 'mild',
    dare: "Show me what your desk/workspace looks like right now",
    verification: "no cleaning first 😂"
  },
  {
    id: 'd_mild_13',
    level: 'mild',
    dare: "Send me a pic of your fridge contents",
    verification: "I wanna see what you're working with 😂"
  },
  {
    id: 'd_mild_14',
    level: 'mild',
    dare: "Do your best dance move and describe it to me",
    verification: "I bet it's amazing 😂"
  },
  {
    id: 'd_mild_15',
    level: 'mild',
    dare: "Tell me three things you're grateful for right now",
    verification: "wholesome moment babe 💕"
  },
  {
    id: 'd_mild_16',
    level: 'mild',
    dare: "Send me a screenshot of your most recent text conversation (hide sensitive info)",
    verification: "let me see what you're talking about with people 😂"
  },
  {
    id: 'd_mild_17',
    level: 'mild',
    dare: "Hold a plank for 30 seconds",
    verification: "you got this! 💪"
  },
  {
    id: 'd_mild_18',
    level: 'mild',
    dare: "Show me your current phone wallpaper",
    verification: "what are you looking at every day? 😊"
  },
  {
    id: 'd_mild_19',
    level: 'mild',
    dare: "Tell me your go-to karaoke song and sing one line",
    verification: "I need to know your karaoke energy 😂"
  },
  {
    id: 'd_mild_20',
    level: 'mild',
    dare: "Send me a pic of you making your silliest face",
    verification: "don't be shy babe 😂"
  },
  {
    id: 'd_medium_1',
    level: 'medium',
    dare: "Send me a voice message saying something flirty",
    verification: "I wanna hear your voice babe 😊"
  },
  {
    id: 'd_medium_2',
    level: 'medium',
    dare: "Tell me something you've never told anyone before",
    verification: "be honest... I won't judge 💕"
  },
  {
    id: 'd_medium_3',
    level: 'medium',
    dare: "Describe what you find attractive about me",
    verification: "I'm curious what you think 😏"
  },
  {
    id: 'd_medium_4',
    level: 'medium',
    dare: "Show me a song that reminds you of me",
    verification: "I wanna know what vibe I give off 💕"
  },
  {
    id: 'd_medium_5',
    level: 'medium',
    dare: "Tell me about a time you took a risk and it paid off",
    verification: "I love hearing about bold moves 😊"
  },
  {
    id: 'd_medium_6',
    level: 'medium',
    dare: "Send me a pic of what you're wearing right now",
    verification: "let me see that fit babe 😏"
  },
  {
    id: 'd_medium_7',
    level: 'medium',
    dare: "Tell me what you'd do if we had a whole day together",
    verification: "dream date, let's hear it 💕"
  },
  {
    id: 'd_medium_8',
    level: 'medium',
    dare: "Show me your Spotify or music playlist",
    verification: "I wanna know your music taste 😊"
  },
  {
    id: 'd_medium_9',
    level: 'medium',
    dare: "Send me a voice note telling me why you like talking to me",
    verification: "I'm curious babe 💕"
  },
  {
    id: 'd_medium_10',
    level: 'medium',
    dare: "Tell me about your ideal partner",
    verification: "what are you looking for? 😊"
  },
  {
    id: 'd_medium_11',
    level: 'medium',
    dare: "Show me a picture of you from 5 years ago",
    verification: "throwback time 😂"
  },
  {
    id: 'd_medium_12',
    level: 'medium',
    dare: "Tell me what first attracted you to me",
    verification: "be honest 😏"
  },
  {
    id: 'd_medium_13',
    level: 'medium',
    dare: "Send me your best pickup line",
    verification: "show me what you got 😂"
  },
  {
    id: 'd_medium_14',
    level: 'medium',
    dare: "Tell me about a time you were heartbroken",
    verification: "I'm here to listen babe 💕"
  },
  {
    id: 'd_medium_15',
    level: 'medium',
    dare: "Show me your most-used emoji and explain why",
    verification: "I bet it says a lot about you 😊"
  },
  {
    id: 'd_medium_16',
    level: 'medium',
    dare: "Send me a voice note of you whispering something sweet",
    verification: "ASMR time 😏"
  },
  {
    id: 'd_medium_17',
    level: 'medium',
    dare: "Tell me what you're thinking about right now, no filter",
    verification: "raw honesty babe 💭"
  },
  {
    id: 'd_medium_18',
    level: 'medium',
    dare: "Show me the app you use most on your phone (check screen time)",
    verification: "let's see what you're really doing 😂"
  },
  {
    id: 'd_medium_19',
    level: 'medium',
    dare: "Tell me a secret about yourself",
    verification: "your secret's safe with me 💕"
  },
  {
    id: 'd_medium_20',
    level: 'medium',
    dare: "Send me a selfie with a specific expression I choose... give me your flirty look 😏",
    verification: "let me see that charm babe"
  },
  {
    id: 'd_spicy_1',
    level: 'spicy',
    dare: "Tell me your dirtiest thought right now",
    verification: "don't hold back babe 🔥"
  },
  {
    id: 'd_spicy_2',
    level: 'spicy',
    dare: "Send me your sexiest selfie (keep it classy though 😏)",
    verification: "I wanna see that 🔥"
  },
  {
    id: 'd_spicy_3',
    level: 'spicy',
    dare: "Tell me what you'd do if we were alone together right now",
    verification: "be specific babe 😏"
  },
  {
    id: 'd_spicy_4',
    level: 'spicy',
    dare: "Send me a voice note saying something that would make me blush",
    verification: "I'm waiting 😏🔥"
  },
  {
    id: 'd_spicy_5',
    level: 'spicy',
    dare: "Describe your ideal intimate moment",
    verification: "details babe, I want details 🔥"
  },
  {
    id: 'd_spicy_6',
    level: 'spicy',
    dare: "Tell me what part of me (physically) you find most attractive",
    verification: "be honest 😏"
  },
  {
    id: 'd_spicy_7',
    level: 'spicy',
    dare: "Send me the most seductive emoji combination you can think of",
    verification: "make it good 🔥"
  },
  {
    id: 'd_spicy_8',
    level: 'spicy',
    dare: "Tell me your biggest turn-on",
    verification: "good to know 😏💕"
  },
  {
    id: 'd_spicy_9',
    level: 'spicy',
    dare: "Describe what you're wearing right now in detail",
    verification: "paint me a picture babe 😏"
  },
  {
    id: 'd_spicy_10',
    level: 'spicy',
    dare: "Tell me about your wildest dream involving me",
    verification: "I'm curious what goes on in that head 🔥"
  },
  {
    id: 'd_spicy_11',
    level: 'spicy',
    dare: "Send me a song that describes how you feel about me",
    verification: "music speaks volumes 💕"
  },
  {
    id: 'd_spicy_12',
    level: 'spicy',
    dare: "Tell me what you fantasize about when you're alone",
    verification: "no judgment zone babe 🔥"
  },
  {
    id: 'd_spicy_13',
    level: 'spicy',
    dare: "Describe your ideal first kiss with me",
    verification: "be romantic about it 💕"
  },
  {
    id: 'd_spicy_14',
    level: 'spicy',
    dare: "Tell me the most adventurous thing you'd want to try",
    verification: "I like when you're bold 😏"
  },
  {
    id: 'd_spicy_15',
    level: 'spicy',
    dare: "Send me a voice note with your sexiest voice",
    verification: "seduce me babe 🔥"
  },
  {
    id: 'd_spicy_16',
    level: 'spicy',
    dare: "Tell me what you find irresistible about me",
    verification: "flatter me 😏💕"
  },
  {
    id: 'd_spicy_17',
    level: 'spicy',
    dare: "Describe where you'd want our first time to be",
    verification: "set the scene for me babe 🔥"
  },
  {
    id: 'd_spicy_18',
    level: 'spicy',
    dare: "Tell me your biggest sexual curiosity",
    verification: "I love when you're open with me 💕"
  },
  {
    id: 'd_spicy_19',
    level: 'spicy',
    dare: "Send me three words that describe how I make you feel",
    verification: "just three... choose wisely 😏"
  },
  {
    id: 'd_spicy_20',
    level: 'spicy',
    dare: "Tell me what you think about when you see my picture",
    verification: "be honest babe 🔥"
  },
];

export function getRandomTruth(tier: SubscriptionTier, usedIds: string[]): TruthQuestion | null {
  const availableLevels = tier === 'free' ? ['mild'] : tier === 'basic' ? ['mild', 'medium'] : ['mild', 'medium', 'spicy'];
  const available = TRUTH_QUESTIONS.filter(q => availableLevels.includes(q.level) && !usedIds.includes(q.id));

  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

export function getRandomDare(tier: SubscriptionTier, usedIds: string[]): DareChallenge | null {
  const availableLevels = tier === 'free' ? ['mild'] : tier === 'basic' ? ['mild', 'medium'] : ['mild', 'medium', 'spicy'];
  const available = DARE_CHALLENGES.filter(d => availableLevels.includes(d.level) && !usedIds.includes(d.id));

  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}
