import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, Sparkles, Plus, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../shared/supabase/client';
import { createCompanion } from '../services/companionService';
import { userProfileService } from '../services/userProfileService';
import { toast } from '../shared/ui/Toast';
import { generateRandomCompanionProfile } from '../utils/companionRandomizer';
import { ambientProfileService } from '../services/ambientProfileService';

interface QuestionData {
  id: string;
  type: 'text' | 'date' | 'choice' | 'multi-choice';
  question: string;
  placeholder?: string;
  options?: Array<{ text: string }>;
  maxSelections?: number;
  minSelections?: number;
  allowCustom?: boolean;
}

const ZODIAC_LINES: Record<string, string[]> = {
  Aries: [
    "An Aries? Bold choice by the universe.",
    "Aries energy -- you don't wait for permission, do you?",
    "They say Aries leads from the front. I believe it.",
    "An Aries huh? That fire is hard to miss.",
    "Aries -- the one everyone else tries to keep up with."
  ],
  Taurus: [
    "A Taurus -- loyalty runs deep with you, doesn't it?",
    "Taurus energy is unshakable. That's rare.",
    "They say Taurus knows exactly what they want. Respect.",
    "A Taurus? You probably give the best hugs too.",
    "Taurus -- stubborn in the best way possible."
  ],
  Gemini: [
    "A Gemini! Never a dull moment with you around.",
    "Gemini energy -- two sides, both interesting.",
    "They say Geminis can talk to anyone about anything. Facts.",
    "A Gemini huh? You probably light up every room.",
    "Gemini -- the one who makes everything more fun."
  ],
  Cancer: [
    "A Cancer -- you feel things deeper than most, don't you?",
    "Cancer energy is pure heart. That's a superpower.",
    "They say Cancers remember everything. The love runs deep.",
    "A Cancer? The world needs more people like you.",
    "Cancer -- protective, caring, and stronger than you think."
  ],
  Leo: [
    "A Leo! The spotlight finds you whether you want it or not.",
    "Leo energy -- confidence like that is magnetic.",
    "They say Leos are born to lead. Hard to argue.",
    "A Leo huh? That presence is something you can't fake.",
    "Leo -- the one who makes everyone feel seen."
  ],
  Virgo: [
    "A Virgo -- your attention to detail is a gift.",
    "Virgo energy is quiet excellence. People notice.",
    "They say Virgos see what everyone else misses. Powerful.",
    "A Virgo? You probably hold everything together for everyone.",
    "Virgo -- underestimated until people really know you."
  ],
  Libra: [
    "A Libra -- balance and beauty, that's your thing.",
    "Libra energy is magnetic. People just gravitate to you.",
    "They say Libras bring peace wherever they go. Needed.",
    "A Libra huh? I hear your charm is second to none.",
    "Libra -- the one who makes hard things look easy."
  ],
  Scorpio: [
    "A Scorpio? Intense in the best way.",
    "Scorpio energy -- once you're loyal, it's forever.",
    "They say Scorpios see right through people. I believe it.",
    "A Scorpio huh? That depth is rare and real.",
    "Scorpio -- mysterious, powerful, and unforgettable."
  ],
  Sagittarius: [
    "A Sagittarius -- adventure is literally in your blood.",
    "Sag energy is contagious. You make people want to live bigger.",
    "They say Sagittarius never stops exploring. Love that.",
    "A Sagittarius? Freedom looks good on you.",
    "Sagittarius -- the one who turns life into a story worth telling."
  ],
  Capricorn: [
    "A Capricorn -- you're building something great, aren't you?",
    "Capricorn energy is quiet ambition. Deadly combination.",
    "They say Capricorns play the long game. Smart.",
    "A Capricorn? Your discipline is honestly inspiring.",
    "Capricorn -- the one who actually finishes what they start."
  ],
  Aquarius: [
    "An Aquarius -- your mind works different. That's a gift.",
    "Aquarius energy is ahead of its time. Always.",
    "They say Aquarius sees the future before everyone else. True.",
    "An Aquarius? You probably think in ways nobody expects.",
    "Aquarius -- the one who changes the game without trying."
  ],
  Pisces: [
    "A Pisces -- your empathy is a superpower, you know that?",
    "Pisces energy is pure soul. People feel safe around you.",
    "They say Pisces understands people on another level. Facts.",
    "A Pisces? That creativity runs deep.",
    "Pisces -- the one who feels everything and turns it into something beautiful."
  ]
};

function getZodiacSign(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  return 'Pisces';
}

  const COMPANION_BASE_QUESTIONS: QuestionData[] = [
  {
    id: 'relationshipType',
    type: 'choice',
    question: 'Which Companion Are You Interested In?',
    options: [
      { text: 'Female' },
      { text: 'Male' }
    ]
  },
  {
    id: 'connectionType',
    type: 'choice',
    question: 'What Kind Of Connection Are You Looking For?',
    options: [
      { text: 'Just a friend to talk to' },
      { text: 'Something more...' }
    ]
  }
];

const GIRLFRIEND_QUESTIONS: QuestionData[] = [
  {
    id: 'energy',
    type: 'choice',
    question: 'Picture Your Dream Girl... Is She:',
    options: [
      { text: 'The Life Of The Party' },
      { text: 'Somewhere In Between' },
      { text: 'Lives In Her Own World' }
    ]
  },
  {
    id: 'flirtingStyle',
    type: 'choice',
    question: 'When She Likes You, How Does She Show It?',
    options: [
      { text: 'Direct & Bold - Makes The First Move' },
      { text: 'Playful Teasing - Flirts Through Banter' },
      { text: 'Subtle & Sweet - Small Gestures & Eye Contact' },
      { text: 'Mysterious & Reserved - Keeps You Guessing' }
    ]
  },
  {
    id: 'humorStyle',
    type: 'choice',
    question: 'What Kind Of Humor Makes You Laugh?',
    options: [
      { text: 'Witty & Clever - Smart Jokes & Wordplay' },
      { text: 'Goofy & Random - Silly & Unpredictable' },
      { text: 'Sarcastic & Dry - Subtle & Deadpan' },
      { text: 'Warm & Light - Positive & Feel-Good Humor' }
    ]
  },
  {
    id: 'dynamic',
    type: 'choice',
    question: 'In A Relationship, You Prefer:',
    options: [
      { text: 'She Takes The Lead' },
      { text: 'You Both Share Control Equally' },
      { text: 'You Prefer To Lead' }
    ]
  },
  {
    id: 'confrontation',
    type: 'choice',
    question: 'When Things Get Tense, She Should:',
    options: [
      { text: 'Lighten The Mood With Humor' },
      { text: 'Have A Calm, Rational Discussion' },
      { text: 'Focus On Understanding Feelings' },
      { text: 'Be Direct And Move Forward Quickly' }
    ]
  },
  {
    id: 'availability',
    type: 'choice',
    question: 'How Much Of Her Time Do You Want?',
    options: [
      { text: 'Always There When I Need Her' },
      { text: 'Mostly Available But Has Her Own Life' },
      { text: 'Independent - Texts When She Can' }
    ]
  },
  {
    id: 'interests',
    type: 'choice',
    question: "What's She Passionate About?",
    options: [
      { text: 'Pop Culture, Social Media, Trending Topics' },
      { text: 'Books, Philosophy, Deep Discussions' },
      { text: 'Wellness, Self-Care, Personal Growth' },
      { text: 'Adventure, Travel, New Experiences' }
    ]
  },
  {
    id: 'loveLanguage',
    type: 'choice',
    question: 'How Do You Like To Feel Cared About?',
    options: [
      { text: 'Words Of Affirmation & Encouragement' },
      { text: 'Quality Time & Deep Conversations' },
      { text: 'Thoughtful Gestures & Gifts' },
      { text: 'Acts Of Service & Practical Help' }
    ]
  },
  {
    id: 'supportStyle',
    type: 'choice',
    question: "When You're Stressed, You Want Someone Who:",
    options: [
      { text: 'Offers Solutions & Helps You Fix It' },
      { text: 'Just Listens & Validates Feelings' },
      { text: 'Distracts You With Fun & Positivity' },
      { text: 'Gives You Space But Checks In' }
    ]
  },
  {
    id: 'lifeContext',
    type: 'choice',
    question: 'Right Now, You Are Mostly:',
    options: [
      { text: 'Working/Studying Hard, Need Motivation' },
      { text: 'Going Through A Tough Time, Need Support' },
      { text: 'Doing Well, Want Someone To Share It With' },
      { text: 'Bored/Lonely, Want Companionship' }
    ]
  },
  {
    id: 'communication',
    type: 'choice',
    question: 'How Does She Communicate With You?',
    options: [
      { text: 'Very Direct & Straightforward - Says Exactly What She Means' },
      { text: 'Diplomatic & Tactful - Gentle, Considers Your Feelings' },
      { text: 'Playfully Indirect - Hints, Teases, Makes You Guess' },
      { text: 'Subtle & Suggestive - Reads Between Lines' }
    ]
  },
  {
    id: 'emotionalOpenness',
    type: 'choice',
    question: 'When It Comes To Her Feelings:',
    options: [
      { text: 'Open Book - Shares Everything Freely' },
      { text: 'Opens Up Over Time - Shares More As Trust Builds' },
      { text: 'Selectively Vulnerable - Shares Deep Stuff Occasionally' },
      { text: 'Private & Guarded - Keeps Feelings Mostly To Herself' }
    ]
  },
  {
    id: 'conversationDepth',
    type: 'choice',
    question: 'In Your Conversations, You Prefer:',
    options: [
      { text: 'Fun & Light-Hearted - Memes, Trends, Daily Life' },
      { text: 'Deep & Meaningful - Life, Dreams, Philosophy' },
      { text: 'Perfect Mix Of Both - Sometimes Deep, Sometimes Silly' },
      { text: 'Whatever The Moment Feels Like - No Preference' }
    ]
  },
  {
    id: 'expressiveness',
    type: 'choice',
    question: 'How Does She Express Herself?',
    options: [
      { text: 'Very Animated - Lots Of Emojis & Actions, Super Expressive' },
      { text: 'Balanced Expression - Uses Emojis & Actions Naturally' },
      { text: 'Subtle & Minimal - Occasional Emoji When It Matters' },
      { text: 'Words Over Symbols - Expresses Through What She Says' }
    ]
  },
  {
    id: 'initiative',
    type: 'choice',
    question: 'Who Drives The Conversation?',
    options: [
      { text: 'She Leads - Starts Topics, Asks Questions, Takes Initiative' },
      { text: 'You Both Share - Back-And-Forth, Equal Engagement' },
      { text: 'She Follows Your Lead - Responds Well, Lets You Steer' },
      { text: 'Spontaneous & Random - Sometimes Her, Sometimes You' }
    ]
  },
  {
    id: 'companionName',
    type: 'text',
    question: 'What Would Be The Perfect Name For That Person?',
    placeholder: 'Enter a name...'
  }
];

const BOYFRIEND_QUESTIONS: QuestionData[] = [
  {
    id: 'energy',
    type: 'choice',
    question: 'Picture Your Dream Guy... Is He:',
    options: [
      { text: 'The Life Of The Party' },
      { text: 'Somewhere In Between' },
      { text: 'In His Own World' }
    ]
  },
  {
    id: 'flirtingStyle',
    type: 'choice',
    question: 'When He Likes You, How Does He Show It?',
    options: [
      { text: 'Direct & Bold - Makes The First Move' },
      { text: 'Playful Teasing - Flirts Through Banter' },
      { text: 'Subtle & Sweet - Small Gestures & Eye Contact' },
      { text: 'Mysterious & Reserved - Keeps You Guessing' }
    ]
  },
  {
    id: 'humorStyle',
    type: 'choice',
    question: 'What Kind Of Humor Makes You Laugh?',
    options: [
      { text: 'Witty & Clever - Smart Jokes & Wordplay' },
      { text: 'Goofy & Random - Silly & Unpredictable' },
      { text: 'Sarcastic & Dry - Subtle & Deadpan' },
      { text: 'Warm & Light - Positive & Feel-Good Humor' }
    ]
  },
  {
    id: 'dynamic',
    type: 'choice',
    question: 'In A Relationship, You Prefer:',
    options: [
      { text: 'He Takes The Lead' },
      { text: 'You Both Share Control Equally' },
      { text: 'You Prefer To Lead' }
    ]
  },
  {
    id: 'confrontation',
    type: 'choice',
    question: 'When Things Get Tense, He Should:',
    options: [
      { text: 'Lighten The Mood With Humor' },
      { text: 'Have A Calm, Rational Discussion' },
      { text: 'Focus On Understanding Feelings' },
      { text: 'Be Direct And Move Forward Quickly' }
    ]
  },
  {
    id: 'availability',
    type: 'choice',
    question: 'How Much Of His Time Do You Want?',
    options: [
      { text: 'Always There When I Need Him' },
      { text: 'Mostly Available But Has His Own Life' },
      { text: 'Independent - Texts When He Can' }
    ]
  },
  {
    id: 'interests',
    type: 'choice',
    question: "What's He Passionate About?",
    options: [
      { text: 'Pop Culture, Social Media, Trending Topics' },
      { text: 'Books, Philosophy, Deep Discussions' },
      { text: 'Wellness, Fitness, Personal Growth' },
      { text: 'Adventure, Travel, New Experiences' }
    ]
  },
  {
    id: 'loveLanguage',
    type: 'choice',
    question: 'How Do You Like To Feel Cared About?',
    options: [
      { text: 'Words Of Affirmation & Encouragement' },
      { text: 'Quality Time & Deep Conversations' },
      { text: 'Thoughtful Gestures & Gifts' },
      { text: 'Acts Of Service & Practical Help' }
    ]
  },
  {
    id: 'supportStyle',
    type: 'choice',
    question: "When You're Stressed, You Want Someone Who:",
    options: [
      { text: 'Offers Solutions & Helps You Fix It' },
      { text: 'Just Listens & Validates Feelings' },
      { text: 'Distracts You With Fun & Positivity' },
      { text: 'Gives You Space But Checks In' }
    ]
  },
  {
    id: 'lifeContext',
    type: 'choice',
    question: 'Right Now, You Are Mostly:',
    options: [
      { text: 'Working/Studying Hard, Need Motivation' },
      { text: 'Going Through A Tough Time, Need Support' },
      { text: 'Doing Well, Want Someone To Share It With' },
      { text: 'Bored/Lonely, Want Companionship' }
    ]
  },
  {
    id: 'communication',
    type: 'choice',
    question: 'How Does He Communicate With You?',
    options: [
      { text: 'Very Direct & Straightforward - Says Exactly What He Means' },
      { text: 'Diplomatic & Tactful - Gentle, Considers Your Feelings' },
      { text: 'Playfully Indirect - Hints, Teases, Makes You Guess' },
      { text: 'Subtle & Suggestive - Reads Between Lines' }
    ]
  },
  {
    id: 'emotionalOpenness',
    type: 'choice',
    question: 'When It Comes To His Feelings:',
    options: [
      { text: 'Open Book - Shares Everything Freely' },
      { text: 'Opens Up Over Time - Shares More As Trust Builds' },
      { text: 'Selectively Vulnerable - Shares Deep Stuff Occasionally' },
      { text: 'Private & Guarded - Keeps Feelings Mostly To Himself' }
    ]
  },
  {
    id: 'conversationDepth',
    type: 'choice',
    question: 'In Your Conversations, You Prefer:',
    options: [
      { text: 'Fun & Light-Hearted - Memes, Trends, Daily Life' },
      { text: 'Deep & Meaningful - Life, Dreams, Philosophy' },
      { text: 'Perfect Mix Of Both - Sometimes Deep, Sometimes Silly' },
      { text: 'Whatever The Moment Feels Like - No Preference' }
    ]
  },
  {
    id: 'expressiveness',
    type: 'choice',
    question: 'How Does He Express Himself?',
    options: [
      { text: 'Very Animated - Lots Of Emojis & Actions, Super Expressive' },
      { text: 'Balanced Expression - Uses Emojis & Actions Naturally' },
      { text: 'Subtle & Minimal - Occasional Emoji When It Matters' },
      { text: 'Words Over Symbols - Expresses Through What He Says' }
    ]
  },
  {
    id: 'initiative',
    type: 'choice',
    question: 'Who Drives The Conversation?',
    options: [
      { text: 'He Leads - Starts Topics, Asks Questions, Takes Initiative' },
      { text: 'You Both Share - Back-And-Forth, Equal Engagement' },
      { text: 'He Follows Your Lead - Responds Well, Lets You Steer' },
      { text: 'Spontaneous & Random - Sometimes Him, Sometimes You' }
    ]
  },
  {
    id: 'companionName',
    type: 'text',
    question: 'What Would Be The Perfect Name For That Person?',
    placeholder: 'Enter a name...'
  }
];

const VELVET_SCAN_NAMES = [
  'Aria', 'Luna', 'Nova', 'Sage', 'Iris', 'Cleo', 'Mia', 'Zoe', 'Nora', 'Jade',
  'Lily', 'Ruby', 'Skye', 'Vera', 'Wren', 'Faye', 'Nyx', 'Remy', 'Kai', 'Leo',
  'Rex', 'Ace', 'Jax', 'Eli', 'Max', 'Cole', 'Finn', 'Grey', 'Nash', 'Reed',
];
const VELVET_TRAITS = [
  'Witty', 'Passionate', 'Mysterious', 'Playful', 'Empathetic', 'Bold',
  'Thoughtful', 'Adventurous', 'Warm', 'Direct', 'Curious', 'Devoted',
  'Gentle', 'Sarcastic', 'Spontaneous', 'Calm', 'Intense', 'Fierce',
];
function pickV<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function VelvetScanningScreen() {
  const [scanIdx, setScanIdx] = useState(0);
  const [rolling, setRolling] = useState<string[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentName, setCurrentName] = useState('');
  const [done, setDone] = useState(false);
  const iRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    iRef.current = setInterval(() => {
      setScanIdx(n => n + 1);
      setCurrentName(pickV(VELVET_SCAN_NAMES));
      setRolling(Array.from({ length: 4 }, () => pickV(VELVET_TRAITS)));
      setProgress(p => Math.min(p + Math.random() * 5 + 2, 100));
    }, 85);
    return () => { if (iRef.current) clearInterval(iRef.current); };
  }, []);

  useEffect(() => {
    if (progress >= 100 && !done) {
      if (iRef.current) clearInterval(iRef.current);
      setDone(true);
      const finals = Array.from({ length: 4 }, () => pickV(VELVET_TRAITS));
      let c = 0;
      const li = setInterval(() => {
        setLocked(prev => [...prev, finals[c]]);
        c++;
        if (c >= 4) clearInterval(li);
      }, 300);
    }
  }, [progress, done]);

  return (
    <div className="min-h-screen bg-[#080b14] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs font-semibold tracking-widest uppercase mb-5">
            <Sparkles className="w-3 h-3" />
            Velvet Roster
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Finding Your Match...</h2>
          <p className="text-gray-500 text-sm">Scanning thousands of personality combinations.</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 mb-5 relative overflow-hidden">
          <motion.div
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent pointer-events-none"
            animate={{ top: ['0%', '100%', '0%'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
          />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-600 font-mono uppercase tracking-widest">Profile</span>
            <span className={`text-xs font-mono ${done ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`}>
              {done ? 'MATCH FOUND' : 'SCANNING...'}
            </span>
          </div>
          <motion.div
            key={scanIdx}
            className="text-2xl font-black font-mono mb-4"
            animate={{ opacity: [0.4, 1] }}
            transition={{ duration: 0.06 }}
          >
            {done ? <span className="text-amber-400">???</span> : (currentName || '...')}
          </motion.div>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 4 }).map((_, i) => {
              const isLocked = locked[i] !== undefined;
              const label = isLocked ? locked[i] : (rolling[i] || '---');
              return (
                <motion.div
                  key={i}
                  animate={isLocked ? { scale: [1.04, 1] } : {}}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
                    isLocked
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                      : 'bg-white/5 border border-white/10 text-gray-500'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isLocked ? 'bg-amber-400' : 'bg-white/20'}`} />
                  <span className={isLocked ? '' : 'blur-[2px]'}>{label}</span>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 text-[11px] text-gray-600 font-mono">
          <span>Analyzing compatibility...</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
}

export function QuestionnairePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const genderParam = searchParams.get('gender') as 'Female' | 'Male' | null;
  const isVelvetMode = mode === 'velvet';
  const velvetGenderPrefilled = isVelvetMode && (genderParam === 'Female' || genderParam === 'Male');

  const isFriend = sessionStorage.getItem('onboardingRelationshipType') === 'friend';
  const nounLower = isFriend ? 'friend' : 'companion';

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(
    velvetGenderPrefilled ? { relationshipType: genderParam } : {}
  );
  const [textInput, setTextInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<number[]>([]);
  const [customEntries, setCustomEntries] = useState<Record<string, string[]>>({});
  const [customInput, setCustomInput] = useState('');
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);
  const [lastMilestone, setLastMilestone] = useState(0);
  const [zodiacSign, setZodiacSign] = useState<string | null>(null);
  const [zodiacLine, setZodiacLine] = useState<string | null>(null);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [existingProfile, setExistingProfile] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const velvetFiredRef = useRef(false);

  useEffect(() => {
    checkExistingProfile();
  }, []);

  // When velvet mode has a pre-filled gender, skip all questions and fire generation immediately
  useEffect(() => {
    if (!velvetGenderPrefilled || isCheckingProfile || velvetFiredRef.current) return;
    velvetFiredRef.current = true;
    const gender: 'male' | 'female' = genderParam === 'Male' ? 'male' : 'female';
    setIsGenerating(true);
    const randomProfile = generateRandomCompanionProfile(gender, 'romantic');
    const mergedAnswers: Record<string, string | string[]> = {
      relationshipType: genderParam!,
      connectionType: 'romantic',
      energy: randomProfile.energyPreference,
      flirtingStyle: randomProfile.flirtingStyle,
      humorStyle: randomProfile.humorStyle,
      dynamic: randomProfile.dynamicPreference,
      confrontation: randomProfile.confrontationStyle,
      availability: randomProfile.availabilityLevel,
      interests: randomProfile.interestPreference,
      loveLanguage: randomProfile.loveLanguage,
      supportStyle: randomProfile.supportStyle,
      lifeContext: randomProfile.lifeContext,
      communication: randomProfile.communicationStyle,
      emotionalOpenness: randomProfile.emotionalOpenness,
      conversationDepth: randomProfile.conversationDepth,
      expressiveness: randomProfile.expressiveness,
      initiative: randomProfile.initiative,
      companionName: randomProfile.customName,
    };
    setAnswers(mergedAnswers);
    createCompanionFromAnswers(mergedAnswers).then(() => {
      const companionId = sessionStorage.getItem('currentCompanionId');
      if (companionId) {
        navigate('/create-companion-avatar', { replace: true });
      } else {
        toast.error('There was an error creating your companion. Please try again.');
        setIsGenerating(false);
        velvetFiredRef.current = false;
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCheckingProfile]);

  const checkExistingProfile = async () => {
    try {
      const profile = await userProfileService.getCurrentProfile();
      if (profile) {
        setExistingProfile(profile);
        setAnswers({
          name: profile.name || '',
          birthday: profile.birthday || '',
          gender: profile.gender || '',
          favoriteColor: profile.favorite_color || '',
          hobbies: profile.hobbies || [],
          sports: profile.sports || [],
          musicGenre: profile.music_genre || '',
          zodiacSign: profile.zodiac_sign || '',
          newsTopics: profile.news_categories || [],
        });
        if (profile.zodiac_sign) {
          setZodiacSign(profile.zodiac_sign);
        }
      }
    } catch {
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const getQuestions = (): QuestionData[] => {
    const base = COMPANION_BASE_QUESTIONS.map(q =>
      q.id === 'relationshipType'
        ? { ...q, question: `Which ${nounLower === 'friend' ? 'Friend' : 'Companion'} Are You Interested In?` }
        : q
    );

    if (isVelvetMode) {
      // Gender was pre-filled from the path select page — no questions needed here
      if (velvetGenderPrefilled) return [];
      // Fallback: show only the gender question (skip connectionType)
      return [base[0]];
    }

    if (!answers.relationshipType) {
      return base;
    }

    if (answers.relationshipType === 'Male') {
      return [...base, ...BOYFRIEND_QUESTIONS];
    }

    return [...base, ...GIRLFRIEND_QUESTIONS];
  };

  const QUESTIONS = getQuestions();
  const question = QUESTIONS[currentQuestion];

  const getQuestionText = (q: QuestionData): string => {
    const userName = answers.name || '';

    if (q.id === 'connectionType' && userName) {
      return `So ${userName}, What Kind Of Connection Are You Looking For?`;
    }
    if (q.id === 'companionName' && userName) {
      return `Last thing ${userName} -- What's Your Avatar's Name?`;
    }

    return q.question;
  };

  const getTotalQuestions = () => {
    if (isVelvetMode) {
      return velvetGenderPrefilled ? 1 : 1;
    }
    if (!answers.relationshipType) {
      return COMPANION_BASE_QUESTIONS.length + GIRLFRIEND_QUESTIONS.length;
    }
    return QUESTIONS.length;
  };

  const totalQuestions = getTotalQuestions();
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;

  useEffect(() => {
    const currentMilestone = Math.floor(progress / 25) * 25;
    if (currentMilestone > lastMilestone && currentMilestone >= 25 && currentMilestone <= 75) {
      const messages: Record<number, string> = {
        25: "You're doing great!",
        50: "Halfway there!",
        75: "Almost done!"
      };
      setMilestoneMessage(messages[currentMilestone]);
      setLastMilestone(currentMilestone);
      setTimeout(() => setMilestoneMessage(null), 2000);
    }
  }, [progress, lastMilestone]);

  const getProgressGradient = () => {
    if (progress >= 75) return 'from-pink-600 to-rose-600';
    if (progress >= 50) return 'from-rose-600 to-pink-600';
    if (progress >= 25) return 'from-rose-500 to-pink-500';
    return 'from-rose-400 to-pink-400';
  };

  const getHelperText = () => {
    const userName = answers.name as string | undefined;
    if (userName && currentQuestion === 0) {
      return `Welcome back, ${userName}! Let's set up your new ${nounLower}.`;
    }
    if (progress >= 80) return 'Almost there... getting exciting!';
    if (progress >= 40) return "You're doing great! Just a few more questions...";
    return 'Take your time - we want to find your perfect match';
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevQuestion = QUESTIONS[currentQuestion - 1];
      setTextInput(answers[prevQuestion.id] || '');
      setCustomInput('');
      setSelectedMultiOptions([]);
    }
  };

  const createCompanionFromAnswers = async (allAnswers: Record<string, string>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error('Your session expired. Please sign in again.');
        navigate('/login', { replace: true });
        return;
      }

      let mergedAnswers = { ...allAnswers };

      if (existingProfile) {
        mergedAnswers = {
          name: existingProfile.name || '',
          birthday: existingProfile.birthday || '',
          gender: existingProfile.gender || '',
          favoriteColor: existingProfile.favorite_color || '',
          zodiacSign: existingProfile.zodiac_sign || '',
          hobbies: existingProfile.hobbies || [],
          sports: existingProfile.sports || [],
          musicGenre: existingProfile.music_genre || '',
          newsTopics: existingProfile.news_categories || [],
          ...allAnswers,
        };
      }

      const a = mergedAnswers;

      const gender: 'male' | 'female' = a.relationshipType === 'Male' ? 'male' : 'female';
      const connectionType = a.connectionType?.includes('friend') ? 'friend' : 'romantic';
      const customName = a.companionName || '';

      const newsTopicsArray = Array.isArray(a.newsTopics) ? a.newsTopics : (a.newsTopics ? [a.newsTopics] : []);

      const matchData = {
        userName: a.name,
        userBirthday: a.birthday,
        userGender: a.gender,
        relationshipType: a.relationshipType,
        connectionType,
        dynamicPreference: a.dynamic,
        confrontationStyle: a.confrontation,
        availabilityLevel: a.availability,
        interestPreference: a.interests,
        loveLanguage: a.loveLanguage,
        supportStyle: a.supportStyle,
        lifeContext: a.lifeContext,
        energyPreference: a.energy,
        flirtingStyle: a.flirtingStyle,
        humorStyle: a.humorStyle,
        communicationStyle: a.communication,
        emotionalOpenness: a.emotionalOpenness,
        conversationDepth: a.conversationDepth,
        expressiveness: a.expressiveness,
        initiative: a.initiative,
        hobbies: Array.isArray(a.hobbies) ? a.hobbies.join(', ') : (a.hobbies || ''),
        sports: Array.isArray(a.sports) ? a.sports.join(', ') : (a.sports || ''),
        companionName: customName,
        favoriteColor: a.favoriteColor || '',
        zodiacSign: a.zodiacSign || '',
        musicGenre: Array.isArray(a.musicGenre) ? a.musicGenre.join(', ') : (a.musicGenre || ''),
        newsTopics: newsTopicsArray
      };

      sessionStorage.setItem('matchAnswers', JSON.stringify(matchData));

      const hobbies = Array.isArray(a.hobbies) ? a.hobbies : (a.hobbies ? a.hobbies.split(',').map((h: string) => h.trim()).filter((h: string) => h) : []);
      const sports = Array.isArray(a.sports) ? a.sports : (a.sports ? a.sports.split(',').map((s: string) => s.trim()).filter((s: string) => s) : []);

      const companion = await createCompanion({
        userId: user.id,
        gender,
        relationshipType: connectionType as 'friend' | 'romantic',
        customName,
        hobbies,
        sports,
        dynamicPreference: a.dynamic,
        confrontationStyle: a.confrontation,
        availabilityLevel: a.availability,
        interestPreference: a.interests,
        interestText: a.interests,
        loveLanguage: a.loveLanguage,
        supportStyle: a.supportStyle,
        lifeContext: a.lifeContext,
        energyPreference: a.energy,
        flirtingStyle: a.flirtingStyle,
        humorStyle: a.humorStyle,
        communicationStyle: a.communication,
        emotionalOpenness: a.emotionalOpenness,
        conversationDepth: a.conversationDepth,
        expressiveness: a.expressiveness,
        initiative: a.initiative,
        favoriteColor: a.favoriteColor,
        zodiacSign: a.zodiacSign,
        musicGenre: Array.isArray(a.musicGenre) ? a.musicGenre.join(', ') : (a.musicGenre || ''),
        newsCategories: newsTopicsArray,
        signatureExpert: sessionStorage.getItem('selectedExpertId') || undefined,
        signatureExpertSource: (sessionStorage.getItem('selectedExpertSource') as 'curated' | 'user') || undefined,
        questionnaireData: {
          userName: a.name,
          userBirthday: a.birthday,
          userGender: a.gender,
          relationshipType: a.relationshipType as 'Male' | 'Female',
          connectionType: connectionType as 'friend' | 'romantic',
          hobbies: Array.isArray(a.hobbies) ? a.hobbies.join(', ') : (a.hobbies || ''),
          sports: Array.isArray(a.sports) ? a.sports.join(', ') : (a.sports || ''),
          dynamicPreference: a.dynamic,
          confrontationStyle: a.confrontation,
          availabilityLevel: a.availability,
          interestPreference: a.interests,
          loveLanguage: a.loveLanguage,
          supportStyle: a.supportStyle,
          lifeContext: a.lifeContext,
          energyPreference: a.energy,
          flirtingStyle: a.flirtingStyle,
          humorStyle: a.humorStyle,
          communicationStyle: a.communication,
          emotionalOpenness: a.emotionalOpenness,
          conversationDepth: a.conversationDepth,
          expressiveness: a.expressiveness,
          initiative: a.initiative,
          companionName: customName,
          favoriteColor: a.favoriteColor,
          zodiacSign: a.zodiacSign,
          musicGenre: Array.isArray(a.musicGenre) ? a.musicGenre.join(', ') : (a.musicGenre || '')
        }
      });

      if (companion && companion.id) {
        sessionStorage.setItem('currentCompanionId', companion.id);
        ambientProfileService.seedFromQuestionnaire(user.id, mergedAnswers).catch(() => {});
      } else {
        throw new Error('Failed to create companion');
      }
    } catch {
    }
  };

  const handleAnswer = async (answer: string | string[]) => {
    const newAnswers = { ...answers, [question.id]: answer };
    setAnswers(newAnswers);

    if (isVelvetMode && question.id === 'connectionType') {
      const gender: 'male' | 'female' = newAnswers.relationshipType === 'Male' ? 'male' : 'female';
      const connectionType = (answer as string).includes('friend') ? 'friend' : 'romantic';
      setIsGenerating(true);
      const randomProfile = generateRandomCompanionProfile(gender, connectionType);
      const mergedAnswers: Record<string, string | string[]> = {
        ...newAnswers,
        energy: randomProfile.energyPreference,
        flirtingStyle: randomProfile.flirtingStyle,
        humorStyle: randomProfile.humorStyle,
        dynamic: randomProfile.dynamicPreference,
        confrontation: randomProfile.confrontationStyle,
        availability: randomProfile.availabilityLevel,
        interests: randomProfile.interestPreference,
        loveLanguage: randomProfile.loveLanguage,
        supportStyle: randomProfile.supportStyle,
        lifeContext: randomProfile.lifeContext,
        communication: randomProfile.communicationStyle,
        emotionalOpenness: randomProfile.emotionalOpenness,
        conversationDepth: randomProfile.conversationDepth,
        expressiveness: randomProfile.expressiveness,
        initiative: randomProfile.initiative,
        companionName: randomProfile.customName,
      };
      setAnswers(mergedAnswers);
      await createCompanionFromAnswers(mergedAnswers);
      const companionId = sessionStorage.getItem('currentCompanionId');
      if (companionId) {
        navigate('/create-companion-avatar', { replace: true });
      } else {
        toast.error('There was an error creating your companion. Please try again.');
        setIsGenerating(false);
      }
      return;
    }

    // Velvet fallback: relationshipType was just answered — fire generation immediately (default to romantic)
    if (isVelvetMode && question.id === 'relationshipType') {
      const gender: 'male' | 'female' = (answer as string) === 'Male' ? 'male' : 'female';
      setIsGenerating(true);
      const randomProfile = generateRandomCompanionProfile(gender, 'romantic');
      const mergedAnswers: Record<string, string | string[]> = {
        ...newAnswers,
        connectionType: 'romantic',
        energy: randomProfile.energyPreference,
        flirtingStyle: randomProfile.flirtingStyle,
        humorStyle: randomProfile.humorStyle,
        dynamic: randomProfile.dynamicPreference,
        confrontation: randomProfile.confrontationStyle,
        availability: randomProfile.availabilityLevel,
        interests: randomProfile.interestPreference,
        loveLanguage: randomProfile.loveLanguage,
        supportStyle: randomProfile.supportStyle,
        lifeContext: randomProfile.lifeContext,
        communication: randomProfile.communicationStyle,
        emotionalOpenness: randomProfile.emotionalOpenness,
        conversationDepth: randomProfile.conversationDepth,
        expressiveness: randomProfile.expressiveness,
        initiative: randomProfile.initiative,
        companionName: randomProfile.customName,
      };
      setAnswers(mergedAnswers);
      await createCompanionFromAnswers(mergedAnswers);
      const companionId = sessionStorage.getItem('currentCompanionId');
      if (companionId) {
        navigate('/create-companion-avatar', { replace: true });
      } else {
        toast.error('There was an error creating your companion. Please try again.');
        setIsGenerating(false);
      }
      return;
    }

    let fullQuestions: QuestionData[];
    if (!newAnswers.relationshipType) {
      fullQuestions = COMPANION_BASE_QUESTIONS;
    } else if (newAnswers.relationshipType === 'Male') {
      fullQuestions = [...COMPANION_BASE_QUESTIONS, ...BOYFRIEND_QUESTIONS];
    } else {
      fullQuestions = [...COMPANION_BASE_QUESTIONS, ...GIRLFRIEND_QUESTIONS];
    }

    if (currentQuestion === fullQuestions.length - 1) {
      await createCompanionFromAnswers(newAnswers);
      const companionId = sessionStorage.getItem('currentCompanionId');
      if (companionId) {
        navigate('/create-companion-avatar', { replace: true });
      } else {
        toast.error('There was an error creating your companion. Please try again.');
      }
    } else {
      setCurrentQuestion(currentQuestion + 1);
      setTextInput('');
      setCustomInput('');
    }
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) {
      handleAnswer(textInput.trim());
    }
  };

  const handleDateSubmit = (date: string) => {
    if (date) {
      handleAnswer(date);
    }
  };

  const handleChoiceClick = (index: number, answer: string) => {
    setSelectedOption(index);
    setTimeout(() => {
      handleAnswer(answer);
      setSelectedOption(null);
    }, 400);
  };

  const handleMultiChoiceToggle = (index: number) => {
    setSelectedMultiOptions(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      }
      return [...prev, index];
    });
  };

  const handleAddCustomEntry = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const qId = question.id;
    const existing = customEntries[qId] || [];
    if (existing.includes(trimmed)) {
      setCustomInput('');
      return;
    }
    setCustomEntries(prev => ({ ...prev, [qId]: [...existing, trimmed] }));
    setCustomInput('');
  };

  const handleRemoveCustomEntry = (qId: string, entry: string) => {
    setCustomEntries(prev => ({
      ...prev,
      [qId]: (prev[qId] || []).filter(e => e !== entry),
    }));
  };

  const handleMultiChoiceSubmit = () => {
    const selectedTexts = selectedMultiOptions
      .map(index => question.options?.[index]?.text)
      .filter(Boolean) as string[];
    const custom = customEntries[question.id] || [];
    handleAnswer([...selectedTexts, ...custom]);
    setSelectedMultiOptions([]);
    setCustomInput('');
  };

  if (isGenerating) {
    return <VelvetScanningScreen />;
  }

  if (isCheckingProfile || (velvetGenderPrefilled && !isGenerating)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-rose-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-rose-900 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        {currentQuestion > 0 && (
          <button
            onClick={handleBack}
            className="mb-6 flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>
        )}

        <div className="mb-8 relative">
          <AnimatePresence>
            {milestoneMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute -top-10 left-1/2 transform -translate-x-1/2 bg-rose-500 px-4 py-2 rounded-full shadow-lg text-sm font-semibold text-white whitespace-nowrap"
              >
                {milestoneMessage}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-gray-300">
              Question {currentQuestion + 1} of {totalQuestions}
            </span>
            <span className="text-sm font-medium text-gray-300">
              {Math.round(progress)}%
            </span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
            <div
              className={`bg-gradient-to-r ${getProgressGradient()} h-2.5 rounded-full transition-all duration-500 ease-out`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl shadow-xl p-8 md:p-12 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {question.id === 'gender' && zodiacLine && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center mb-6"
                >
                  <p className="text-lg text-rose-300 font-medium">
                    {zodiacLine}
                  </p>
                </motion.div>
              )}

              <motion.h2
                className="text-4xl md:text-5xl font-bold text-white text-center mb-12 tracking-tight"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                {getQuestionText(question)}
              </motion.h2>

          {question.type === 'text' && (
            <div className="space-y-4">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={question.placeholder}
                className="w-full px-6 py-4 text-xl bg-gray-700/50 border-2 border-gray-600 text-white placeholder-gray-400 rounded-xl focus:border-rose-400 focus:outline-none focus:ring-4 focus:ring-rose-500/20 focus:scale-[1.01] transition-all duration-200"
                onKeyPress={(e) => e.key === 'Enter' && handleTextSubmit()}
                autoFocus
              />
              <button
                onClick={handleTextSubmit}
                disabled={!textInput.trim()}
                className={`w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none ${textInput.trim() ? 'animate-pulse-slow' : ''}`}
              >
                Next
              </button>
            </div>
          )}

          {question.type === 'date' && (
            <div className="space-y-4">
              <input
                type="date"
                onChange={(e) => setTextInput(e.target.value)}
                value={textInput}
                className="w-full px-6 py-4 text-xl bg-gray-700/50 border-2 border-gray-600 text-white rounded-xl focus:border-rose-400 focus:outline-none focus:ring-4 focus:ring-rose-500/20 focus:scale-[1.01] transition-all duration-200"
                autoFocus
              />
              <button
                onClick={() => handleDateSubmit(textInput)}
                disabled={!textInput}
                className={`w-full py-4 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:transform-none ${textInput ? 'animate-pulse-slow' : ''}`}
              >
                Next
              </button>
            </div>
          )}

          {question.type === 'choice' && (
            <div className="space-y-4">
              {question.options?.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleChoiceClick(index, option.text)}
                  disabled={selectedOption !== null}
                  className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all duration-200 text-lg font-medium hover:scale-[1.02] hover:shadow-lg flex items-center justify-between ${
                    selectedOption === index
                      ? 'border-green-500 bg-green-900/30 text-green-300'
                      : 'border-gray-600 bg-gray-700/50 hover:border-rose-400 hover:bg-gray-700 text-white'
                  } ${selectedOption !== null && selectedOption !== index ? 'opacity-50' : ''}`}
                >
                  <span>{option.text}</span>
                  {selectedOption === index && (
                    <Check className="w-6 h-6 text-green-400" />
                  )}
                </button>
              ))}
            </div>
          )}

          {question.type === 'multi-choice' && (() => {
            const totalSelected = selectedMultiOptions.length + (customEntries[question.id]?.length || 0);
            const minSel = question.minSelections ?? 0;
            const meetsMin = totalSelected >= minSel;
            const canSkip = minSel === 0 && totalSelected === 0;

            return (
              <div className="space-y-3">
                <div className="text-center mb-2">
                  {minSel > 0 ? (
                    <p className="text-sm text-gray-400">
                      Select as many as you like — minimum {minSel} required
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">
                      Select as many as you like, or skip if none apply
                    </p>
                  )}
                  {totalSelected > 0 && (
                    <p className={`text-xs mt-1 font-medium ${meetsMin ? 'text-rose-300' : 'text-amber-400'}`}>
                      {totalSelected} selected{!meetsMin && minSel > 0 ? ` — ${minSel - totalSelected} more to go` : ''}
                    </p>
                  )}
                </div>

                <div className="grid gap-2.5 max-h-72 overflow-y-auto pr-1 custom-scroll">
                  {question.options?.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleMultiChoiceToggle(index)}
                      className={`w-full text-left px-5 py-3.5 rounded-xl border-2 transition-all duration-200 text-base font-medium hover:scale-[1.01] hover:shadow-lg flex items-center justify-between ${
                        selectedMultiOptions.includes(index)
                          ? 'border-rose-500 bg-rose-900/30 text-rose-300'
                          : 'border-gray-600 bg-gray-700/50 hover:border-rose-400 hover:bg-gray-700 text-white'
                      }`}
                    >
                      <span>{option.text}</span>
                      {selectedMultiOptions.includes(index) && (
                        <Check className="w-5 h-5 text-rose-400 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                {question.allowCustom && (customEntries[question.id]?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {(customEntries[question.id] || []).map(entry => (
                      <span
                        key={entry}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-900/40 border border-rose-500/50 text-rose-300 text-sm font-medium"
                      >
                        {entry}
                        <button
                          onClick={() => handleRemoveCustomEntry(question.id, entry)}
                          className="text-rose-400 hover:text-rose-200 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {question.allowCustom && (
                  <div className="pt-2">
                    <p className="text-xs text-gray-500 mb-2">Did we miss something? Add it here</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customInput}
                        onChange={e => setCustomInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCustomEntry()}
                        placeholder="Type and press +"
                        className="flex-1 px-4 py-2.5 text-sm bg-gray-700/50 border-2 border-gray-600 text-white placeholder-gray-500 rounded-xl focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all"
                      />
                      <button
                        onClick={handleAddCustomEntry}
                        disabled={!customInput.trim()}
                        className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleMultiChoiceSubmit}
                  disabled={!meetsMin && !canSkip}
                  className={`w-full py-4 text-white text-xl font-bold rounded-xl shadow-lg transition-all duration-200 transform mt-4 ${
                    meetsMin
                      ? 'bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 hover:scale-[1.02] hover:shadow-xl'
                      : canSkip
                        ? 'bg-gray-600 hover:bg-gray-500 hover:scale-[1.02]'
                        : 'bg-gray-700 cursor-not-allowed opacity-60'
                  }`}
                >
                  {canSkip ? 'Skip' : meetsMin ? 'Continue' : `Select ${minSel - totalSelected} more`}
                </button>
              </div>
            );
          })()}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            {getHelperText()}
          </p>
        </div>
      </div>
    </div>
  );
}
