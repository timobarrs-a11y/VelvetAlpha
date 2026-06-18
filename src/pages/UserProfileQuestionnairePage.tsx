import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Plus, X, Sparkles, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { userProfileService } from '../services/userProfileService';
import { toast } from '../shared/ui/Toast';

interface QuestionData {
  id: string;
  type: 'text' | 'date' | 'choice' | 'multi-choice';
  question: string | ((answers: Record<string, string | string[]>) => string);
  placeholder?: string;
  options?: Array<{ text: string }>;
  maxSelections?: number;
  minSelections?: number;
  allowCustom?: boolean;
  afterNote?: (answers: Record<string, string | string[]>) => string | null;
}

const ZODIAC_LINES: Record<string, string> = {
  Aries: "An Aries -- that fire is hard to miss.",
  Taurus: "A Taurus -- loyalty runs deep with you.",
  Gemini: "A Gemini! Never a dull moment.",
  Cancer: "A Cancer -- you feel things deeper than most.",
  Leo: "A Leo! The spotlight finds you whether you want it or not.",
  Virgo: "A Virgo -- your attention to detail is a gift.",
  Libra: "A Libra -- balance and beauty, that's your thing.",
  Scorpio: "A Scorpio? Intense in the best way.",
  Sagittarius: "A Sagittarius -- adventure is literally in your blood.",
  Capricorn: "A Capricorn -- you're building something great, aren't you?",
  Aquarius: "An Aquarius -- your mind works different. That's a gift.",
  Pisces: "A Pisces -- your empathy is a superpower.",
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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const MONTH_ZODIAC_OPTIONS: [string, string][] = [
  ['Capricorn', 'Aquarius'],   // January
  ['Aquarius', 'Pisces'],      // February
  ['Pisces', 'Aries'],         // March
  ['Aries', 'Taurus'],         // April
  ['Taurus', 'Gemini'],        // May
  ['Gemini', 'Cancer'],        // June
  ['Cancer', 'Leo'],           // July
  ['Leo', 'Virgo'],            // August
  ['Virgo', 'Libra'],          // September
  ['Libra', 'Scorpio'],        // October
  ['Scorpio', 'Sagittarius'],  // November
  ['Sagittarius', 'Capricorn'],// December
];

function getZodiacOptionsForBirthday(dateString: string): { monthName: string; options: [string, string] } {
  const date = new Date(dateString);
  const monthIndex = date.getUTCMonth();
  return { monthName: MONTH_NAMES[monthIndex], options: MONTH_ZODIAC_OPTIONS[monthIndex] };
}

const COLOR_ACCENTS: Record<string, { border: string; glow: string; progress: string; tag: string }> = {
  Red:     { border: 'border-red-500/60',    glow: 'shadow-red-500/20',    progress: 'from-red-500 to-rose-600',       tag: 'bg-red-500/20 text-red-300 border-red-500/40' },
  Pink:    { border: 'border-pink-500/60',   glow: 'shadow-pink-500/20',   progress: 'from-pink-500 to-rose-500',      tag: 'bg-pink-500/20 text-pink-300 border-pink-500/40' },
  Orange:  { border: 'border-orange-500/60', glow: 'shadow-orange-500/20', progress: 'from-orange-500 to-amber-500',   tag: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  Yellow:  { border: 'border-yellow-500/60', glow: 'shadow-yellow-500/20', progress: 'from-yellow-400 to-amber-400',   tag: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  Green:   { border: 'border-green-500/60',  glow: 'shadow-green-500/20',  progress: 'from-green-500 to-emerald-500',  tag: 'bg-green-500/20 text-green-300 border-green-500/40' },
  Teal:    { border: 'border-teal-500/60',   glow: 'shadow-teal-500/20',   progress: 'from-teal-500 to-cyan-500',      tag: 'bg-teal-500/20 text-teal-300 border-teal-500/40' },
  Cyan:    { border: 'border-cyan-500/60',   glow: 'shadow-cyan-500/20',   progress: 'from-cyan-500 to-sky-500',       tag: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
  Blue:    { border: 'border-blue-500/60',   glow: 'shadow-blue-500/20',   progress: 'from-blue-500 to-sky-500',       tag: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  Purple:  { border: 'border-violet-500/60', glow: 'shadow-violet-500/20', progress: 'from-violet-500 to-purple-600',  tag: 'bg-violet-500/20 text-violet-300 border-violet-500/40' },
  Magenta: { border: 'border-fuchsia-500/60',glow: 'shadow-fuchsia-500/20',progress: 'from-fuchsia-500 to-pink-500',   tag: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40' },
  White:   { border: 'border-gray-300/60',   glow: 'shadow-gray-300/20',   progress: 'from-gray-300 to-white',         tag: 'bg-white/20 text-gray-200 border-white/40' },
  Gray:    { border: 'border-gray-400/60',   glow: 'shadow-gray-400/20',   progress: 'from-gray-400 to-slate-500',     tag: 'bg-gray-400/20 text-gray-300 border-gray-400/40' },
  Black:   { border: 'border-gray-600/60',   glow: 'shadow-gray-600/20',   progress: 'from-gray-700 to-gray-900',      tag: 'bg-gray-700/40 text-gray-300 border-gray-600/40' },
};

const DEFAULT_ACCENT = { border: 'border-rose-500/60', glow: 'shadow-rose-500/20', progress: 'from-rose-500 to-pink-500', tag: 'bg-rose-500/20 text-rose-300 border-rose-500/40' };

const INTRO_SLIDES = [
  {
    icon: '01',
    heading: 'First, tell us about you.',
    body: 'Before we build what you like, we must understand who you are. We need to ask a few core questions.',
  },
  {
    icon: '02',
    heading: 'Then, build your companion.',
    body: 'You\'ll shape their personality, vibe, and name — completely your call.',
  },
  {
    icon: '03',
    heading: 'The whole platform adapts.',
    body: 'Your feed, your videos, your conversations — all built around your answers.',
  },
];

function OnboardingPopup({ onConfirm }: { onConfirm: () => void }) {
  const [slide, setSlide] = useState(0);
  const [exiting, setExiting] = useState(false);

  const next = () => {
    if (slide < INTRO_SLIDES.length - 1) {
      setSlide(s => s + 1);
    } else {
      setExiting(true);
      setTimeout(onConfirm, 500);
    }
  };

  const isLast = slide === INTRO_SLIDES.length - 1;
  const current = INTRO_SLIDES[slide];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="absolute inset-0 bg-[#080b14]/95 backdrop-blur-md" />

      <motion.div
        className="relative w-full max-w-lg"
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: exiting ? 0.95 : 1, opacity: exiting ? 0 : 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl shadow-black/60 p-10">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <motion.div
            className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-rose-500/10 blur-3xl pointer-events-none"
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="flex justify-center gap-2 mb-10">
            {INTRO_SLIDES.map((_, i) => (
              <motion.div
                key={i}
                className="h-1 rounded-full transition-all duration-500"
                animate={{
                  width: i === slide ? 32 : 8,
                  backgroundColor: i <= slide ? 'rgb(244 63 94)' : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={slide}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="text-center mb-10"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-semibold tracking-widest uppercase mb-6">
                <Sparkles className="w-3 h-3" />
                Step {current.icon}
              </div>

              <h2 className="text-3xl sm:text-4xl font-black text-white mb-4 tracking-tight leading-tight">
                {current.heading}
              </h2>

              <p className="text-gray-400 text-base leading-relaxed max-w-sm mx-auto">
                {current.body}
              </p>
            </motion.div>
          </AnimatePresence>

          <motion.button
            onClick={next}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className="group w-full relative flex items-center justify-center gap-3 py-4 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-600 text-white font-bold text-lg shadow-xl shadow-rose-500/30 hover:shadow-rose-500/50 transition-all duration-300"
          >
            <span>{isLast ? "Let's go" : 'Next'}</span>
            <motion.div
              animate={isLast ? { x: [0, 4, 0] } : {}}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <ChevronRight className="w-5 h-5" />
            </motion.div>
            <div className="absolute inset-0 rounded-2xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.button>

          {slide < INTRO_SLIDES.length - 1 && (
            <button
              onClick={() => { setExiting(true); setTimeout(onConfirm, 500); }}
              className="w-full mt-3 py-2 text-sm text-gray-600 hover:text-gray-400 transition-colors"
            >
              Skip intro
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

const QUESTIONS: QuestionData[] = [
  {
    id: 'name',
    type: 'text',
    question: 'First Things First... What Should I Call You?',
    placeholder: 'Enter your name',
  },
  {
    id: 'birthday',
    type: 'date',
    question: (a) => {
      const name = a.name as string;
      return name ? `Hey ${name}! When Were You Born?` : 'When Were You Born?';
    },
  },
  {
    id: 'zodiacSign',
    type: 'choice',
    question: (a) => {
      const birthday = a.birthday as string;
      if (!birthday) return "What's Your Zodiac Sign?";
      const { monthName, options } = getZodiacOptionsForBirthday(birthday);
      return `${monthName}?! Nice! So would that make you a ${options[0]} or a ${options[1]}?`;
    },
    options: [], // dynamically set based on birthday
  },
  {
    id: 'gender',
    type: 'choice',
    question: (a) => {
      const name = a.name as string;
      return name ? `How Do You Identify, ${name}?` : 'How Do You Identify?';
    },
    afterNote: (a) => {
      const zodiac = a.zodiacSign as string;
      return zodiac ? ZODIAC_LINES[zodiac] || null : null;
    },
    options: [
      { text: 'Male' },
      { text: 'Female' },
      { text: 'Non-binary' },
      { text: 'Prefer not to say' },
    ],
  },
  {
    id: 'favoriteColor',
    type: 'choice',
    question: (a) => {
      const name = a.name as string;
      return name ? `Got it, ${name}. What's Your Favorite Color?` : "What's Your Favorite Color?";
    },
    options: [
      { text: 'Red' }, { text: 'Pink' }, { text: 'Orange' }, { text: 'Yellow' },
      { text: 'Green' }, { text: 'Teal' }, { text: 'Cyan' }, { text: 'Blue' },
      { text: 'Purple' }, { text: 'Magenta' }, { text: 'White' }, { text: 'Gray' },
      { text: 'Black' },
    ],
  },
  {
    id: 'hobbies',
    type: 'multi-choice',
    question: (a) => {
      const name = a.name as string;
      return name ? `Nice, ${name}. What Are Your Favorite Hobbies?` : 'What Are Your Favorite Hobbies?';
    },
    minSelections: 3,
    allowCustom: true,
    options: [
      { text: 'Reading' }, { text: 'Gaming' }, { text: 'Cooking' }, { text: 'Baking' },
      { text: 'Hiking' }, { text: 'Photography' }, { text: 'Drawing/Painting' },
      { text: 'Writing' }, { text: 'Music (Playing/Listening)' }, { text: 'Movies/TV Shows' },
      { text: 'Fitness/Working Out' }, { text: 'Yoga/Meditation' }, { text: 'Dancing' },
      { text: 'Gardening' }, { text: 'DIY/Crafts' }, { text: 'Travel/Exploring' },
      { text: 'Fashion/Shopping' }, { text: 'Cars/Motorcycles' }, { text: 'Tech/Gadgets' },
      { text: 'Board Games/Puzzles' },
    ],
  },
  {
    id: 'musicGenre',
    type: 'multi-choice',
    question: (a) => {
      const name = a.name as string;
      return name ? `What's Your Music Vibe, ${name}?` : "What's Your Music Vibe?";
    },
    minSelections: 1,
    allowCustom: true,
    options: [
      { text: 'R&B/Soul' }, { text: 'Hip-Hop/Rap' }, { text: 'Pop' },
      { text: 'Rock/Alternative' }, { text: 'Lo-fi/Chill' }, { text: 'Country' },
      { text: 'Jazz' }, { text: 'Classical' }, { text: 'Electronic/EDM' },
      { text: 'Reggae/Dancehall' }, { text: 'Latin' }, { text: 'Metal/Hard Rock' },
      { text: 'Folk/Acoustic' }, { text: 'Gospel/Christian' }, { text: 'A Little Bit Of Everything' },
    ],
  },
  {
    id: 'sports',
    type: 'multi-choice',
    question: (a) => {
      const name = a.name as string;
      return name ? `Any Sports You Follow Or Play, ${name}?` : 'Any Sports You Follow Or Play?';
    },
    minSelections: 0,
    allowCustom: true,
    options: [
      { text: 'Basketball' }, { text: 'Football (American)' }, { text: 'Soccer (Football)' },
      { text: 'Baseball' }, { text: 'Tennis' }, { text: 'Golf' }, { text: 'Hockey (Ice)' },
      { text: 'Volleyball' }, { text: 'Swimming' }, { text: 'Running/Track' },
      { text: 'Boxing/MMA' }, { text: 'Wrestling' }, { text: 'Gymnastics' },
      { text: 'Skiing/Snowboarding' }, { text: 'Surfing' }, { text: 'Skateboarding' },
      { text: 'Cycling' }, { text: 'Martial Arts' }, { text: 'Cricket' }, { text: 'Rugby' },
      { text: 'Badminton' }, { text: 'Table Tennis' }, { text: 'Formula 1/Racing' },
      { text: 'E-Sports' }, { text: 'Not Into Sports' },
    ],
  },
  {
    id: 'newsTopics',
    type: 'multi-choice',
    question: (a) => {
      const name = a.name as string;
      return name ? `Last one, ${name}. What News Topics Interest You?` : 'What News Topics Interest You?';
    },
    minSelections: 0,
    allowCustom: true,
    options: [
      { text: 'Politics' }, { text: 'Science & Technology' }, { text: 'World News' },
      { text: 'Business & Finance' }, { text: 'Sports' }, { text: 'Entertainment' },
      { text: 'Health & Wellness' }, { text: 'Climate & Environment' },
    ],
  },
];

export function UserProfileQuestionnairePage() {
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const [popupDone, setPopupDone] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [textInput, setTextInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<number[]>([]);
  const [customEntries, setCustomEntries] = useState<Record<string, string[]>>({});
  const [customInput, setCustomInput] = useState('');
  const [milestoneMessage, setMilestoneMessage] = useState<string | null>(null);
  const [lastMilestone, setLastMilestone] = useState(0);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const seen = sessionStorage.getItem('userQuestionnaireIntroDone');
    if (!seen) {
      setShowPopup(true);
    } else {
      setPopupDone(true);
    }
    checkExistingProfile();
  }, []);

  useEffect(() => {
    if (popupDone && inputRef.current) {
      inputRef.current.focus();
    }
  }, [popupDone, currentQuestion]);

  const checkExistingProfile = async () => {
    try {
      const profile = await userProfileService.getCurrentProfile();
      if (profile) {
        const hasCore = !!(
          profile.name && profile.name !== 'babe' &&
          profile.birthday && profile.gender && profile.favorite_color
        );
        if (hasCore) {
          navigate('/intent-select', { replace: true });
          return;
        }
      }
    } catch {
    } finally {
      setIsCheckingProfile(false);
    }
  };

  const handlePopupConfirm = () => {
    sessionStorage.setItem('userQuestionnaireIntroDone', '1');
    setShowPopup(false);
    setPopupDone(true);
  };

  const question = QUESTIONS[currentQuestion];
  const totalQuestions = QUESTIONS.length;
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;

  const favoriteColor = answers.favoriteColor as string | undefined;
  const accent = (favoriteColor && COLOR_ACCENTS[favoriteColor]) ? COLOR_ACCENTS[favoriteColor] : DEFAULT_ACCENT;

  const getQuestionText = (q: QuestionData): string => {
    if (typeof q.question === 'function') return q.question(answers);
    return q.question;
  };

  const getAfterNote = (q: QuestionData): string | null => {
    if (q.afterNote) return q.afterNote(answers);
    return null;
  };

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
      setTimeout(() => setMilestoneMessage(null), 2500);
    }
  }, [progress, lastMilestone]);

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      const prevQuestion = QUESTIONS[currentQuestion - 1];
      const prev = answers[prevQuestion.id];
      setTextInput(typeof prev === 'string' ? prev : '');
      setSelectedMultiOptions([]);
      setCustomInput('');
    }
  };

  const handleAnswer = async (answer: string | string[]) => {
    const newAnswers = { ...answers, [question.id]: answer };

    setAnswers(newAnswers);

    if (currentQuestion === QUESTIONS.length - 1) {
      try {
        await userProfileService.saveUserLevelAnswers({
          name: String(newAnswers.name || ''),
          birthday: String(newAnswers.birthday || ''),
          gender: String(newAnswers.gender || ''),
          favoriteColor: String(newAnswers.favoriteColor || ''),
          zodiacSign: String(newAnswers.zodiacSign || ''),
          hobbies: Array.isArray(newAnswers.hobbies) ? newAnswers.hobbies.join(',') : String(newAnswers.hobbies || ''),
          sports: Array.isArray(newAnswers.sports) ? newAnswers.sports.join(',') : String(newAnswers.sports || ''),
          musicGenre: Array.isArray(newAnswers.musicGenre) ? newAnswers.musicGenre.join(', ') : String(newAnswers.musicGenre || ''),
          newsTopics: Array.isArray(newAnswers.newsTopics) ? newAnswers.newsTopics : [],
        });
      } catch {
        toast.error('Something went wrong saving your profile. Please try again.');
        return;
      }
      navigate('/companion-path', { replace: true });
      return;
    }

    setCurrentQuestion(currentQuestion + 1);
    setTextInput('');
    setCustomInput('');
    setSelectedMultiOptions([]);
  };

  const handleTextSubmit = () => {
    if (textInput.trim()) handleAnswer(textInput.trim());
  };

  const handleDateSubmit = (date: string) => {
    if (date) handleAnswer(date);
  };

  const handleChoiceClick = (index: number, answer: string) => {
    setSelectedOption(index);
    setTimeout(() => {
      handleAnswer(answer);
      setSelectedOption(null);
    }, 400);
  };

  const handleMultiChoiceToggle = (index: number) => {
    setSelectedMultiOptions(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleAddCustomEntry = () => {
    const trimmed = customInput.trim();
    if (!trimmed) return;
    const qId = question.id;
    const existing = customEntries[qId] || [];
    if (existing.includes(trimmed)) { setCustomInput(''); return; }
    setCustomEntries(prev => ({ ...prev, [qId]: [...existing, trimmed] }));
    setCustomInput('');
  };

  const handleRemoveCustomEntry = (qId: string, entry: string) => {
    setCustomEntries(prev => ({ ...prev, [qId]: (prev[qId] || []).filter(e => e !== entry) }));
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

  if (isCheckingProfile) {
    return (
      <div className="min-h-screen bg-[#080b14] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500" />
      </div>
    );
  }

  const afterNote = getAfterNote(question);

  return (
    <div className="min-h-screen bg-[#080b14] flex items-center justify-center p-6 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-rose-600/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[400px] rounded-full bg-pink-600/5 blur-[100px]" />
      </div>

      <AnimatePresence>
        {showPopup && <OnboardingPopup onConfirm={handlePopupConfirm} />}
      </AnimatePresence>

      <motion.div
        className="max-w-2xl w-full relative z-10"
        animate={{ opacity: showPopup ? 0.3 : 1, filter: showPopup ? 'blur(4px)' : 'blur(0px)' }}
        transition={{ duration: 0.4 }}
      >
        {currentQuestion > 0 && (
          <button
            onClick={handleBack}
            className="mb-6 flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back</span>
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
            <div className="flex items-center gap-2">
              {answers.name && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${accent.tag}`}
                >
                  {answers.name as string}
                </motion.span>
              )}
              {answers.zodiacSign && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300"
                >
                  {answers.zodiacSign as string}
                </motion.span>
              )}
            </div>
            <span className="text-sm font-medium text-gray-500">
              {currentQuestion + 1} / {totalQuestions}
            </span>
          </div>

          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <motion.div
              className={`bg-gradient-to-r ${accent.progress} h-1.5 rounded-full`}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>

        <div className={`bg-white/[0.03] border ${favoriteColor ? accent.border : 'border-white/10'} rounded-3xl shadow-2xl ${favoriteColor ? accent.glow : ''} p-8 md:p-12 overflow-hidden relative transition-all duration-700`}>
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentQuestion}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {afterNote && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-center mb-5"
                >
                  <p className="text-base text-rose-300 font-medium">{afterNote}</p>
                </motion.div>
              )}

              <motion.h2
                className="text-3xl md:text-4xl font-black text-white text-center mb-10 tracking-tight leading-snug"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
              >
                {getQuestionText(question)}
              </motion.h2>

              {question.type === 'text' && (
                <div className="space-y-4">
                  <input
                    ref={inputRef}
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder={question.placeholder}
                    className="w-full px-6 py-4 text-xl bg-white/5 border-2 border-white/10 text-white placeholder-gray-600 rounded-2xl focus:border-rose-400/60 focus:outline-none focus:ring-4 focus:ring-rose-500/15 transition-all duration-200"
                    onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                    autoFocus
                  />
                  <button
                    onClick={handleTextSubmit}
                    disabled={!textInput.trim()}
                    className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-800 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:transform-none disabled:text-gray-500"
                  >
                    Next
                  </button>
                </div>
              )}

              {question.type === 'date' && (
                <div className="space-y-4">
                  <input
                    ref={inputRef}
                    type="date"
                    onChange={(e) => setTextInput(e.target.value)}
                    value={textInput}
                    className="w-full px-6 py-4 text-xl bg-white/5 border-2 border-white/10 text-white rounded-2xl focus:border-rose-400/60 focus:outline-none focus:ring-4 focus:ring-rose-500/15 transition-all duration-200"
                    autoFocus
                  />
                  <button
                    onClick={() => handleDateSubmit(textInput)}
                    disabled={!textInput}
                    className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-800 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:transform-none disabled:text-gray-500"
                  >
                    Next
                  </button>
                </div>
              )}

              {question.type === 'choice' && (() => {
                let choiceOptions = question.options || [];
                if (question.id === 'zodiacSign' && answers.birthday) {
                  const { options } = getZodiacOptionsForBirthday(answers.birthday as string);
                  choiceOptions = options.map(sign => ({ text: sign }));
                }
                return (
                <div className="space-y-3">
                  {choiceOptions.map((option, index) => (
                    <button
                      key={index}
                      onClick={() => handleChoiceClick(index, option.text)}
                      disabled={selectedOption !== null}
                      className={`w-full text-left px-6 py-4 rounded-2xl border-2 transition-all duration-200 text-base font-medium hover:scale-[1.01] hover:shadow-lg flex items-center justify-between ${
                        selectedOption === index
                          ? 'border-green-500/60 bg-green-900/20 text-green-300'
                          : 'border-white/10 bg-white/[0.03] hover:border-rose-400/40 hover:bg-white/[0.06] text-white'
                      } ${selectedOption !== null && selectedOption !== index ? 'opacity-40' : ''}`}
                    >
                      <span>{option.text}</span>
                      {selectedOption === index && <Check className="w-5 h-5 text-green-400 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
                );
              })()}

              {question.type === 'multi-choice' && (() => {
                const totalSelected = selectedMultiOptions.length + (customEntries[question.id]?.length || 0);
                const minSel = question.minSelections ?? 0;
                const meetsMin = totalSelected >= minSel;
                const canSkip = minSel === 0 && totalSelected === 0;

                return (
                  <div className="space-y-3">
                    <div className="text-center mb-1">
                      {minSel > 0 ? (
                        <p className="text-sm text-gray-500">
                          Select as many as you like — minimum {minSel} required
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">
                          Select as many as you like, or skip if none apply
                        </p>
                      )}
                      {totalSelected > 0 && (
                        <p className={`text-xs mt-1 font-semibold ${meetsMin ? 'text-rose-300' : 'text-amber-400'}`}>
                          {totalSelected} selected{!meetsMin && minSel > 0 ? ` — ${minSel - totalSelected} more to go` : ''}
                        </p>
                      )}
                    </div>

                    <div className="grid gap-2 max-h-64 overflow-y-auto pr-1 custom-scroll">
                      {question.options?.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleMultiChoiceToggle(index)}
                          className={`w-full text-left px-5 py-3 rounded-xl border-2 transition-all duration-200 text-sm font-medium hover:scale-[1.005] flex items-center justify-between ${
                            selectedMultiOptions.includes(index)
                              ? 'border-rose-500/60 bg-rose-900/20 text-rose-300'
                              : 'border-white/10 bg-white/[0.03] hover:border-rose-400/30 hover:bg-white/[0.06] text-white'
                          }`}
                        >
                          <span>{option.text}</span>
                          {selectedMultiOptions.includes(index) && (
                            <Check className="w-4 h-4 text-rose-400 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>

                    {question.allowCustom && (customEntries[question.id]?.length || 0) > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(customEntries[question.id] || []).map(entry => (
                          <span
                            key={entry}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-900/30 border border-rose-500/40 text-rose-300 text-xs font-medium"
                          >
                            {entry}
                            <button
                              onClick={() => handleRemoveCustomEntry(question.id, entry)}
                              className="text-rose-400 hover:text-rose-200 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {question.allowCustom && (
                      <div className="pt-1">
                        <p className="text-xs text-gray-600 mb-2">Did we miss something? Add it here</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={customInput}
                            onChange={e => setCustomInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddCustomEntry()}
                            placeholder="Type and press +"
                            className="flex-1 px-4 py-2.5 text-sm bg-white/5 border-2 border-white/10 text-white placeholder-gray-600 rounded-xl focus:border-rose-400/40 focus:outline-none focus:ring-2 focus:ring-rose-500/15 transition-all"
                          />
                          <button
                            onClick={handleAddCustomEntry}
                            disabled={!customInput.trim()}
                            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-white/10 disabled:cursor-not-allowed text-white transition-colors"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleMultiChoiceSubmit}
                      disabled={!meetsMin && !canSkip}
                      className={`w-full py-4 text-white text-lg font-bold rounded-2xl shadow-lg transition-all duration-200 transform mt-3 ${
                        meetsMin
                          ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 hover:scale-[1.01] hover:shadow-xl'
                          : canSkip
                            ? 'bg-white/10 hover:bg-white/15 hover:scale-[1.01]'
                            : 'bg-white/5 cursor-not-allowed opacity-50'
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

        <div className="mt-5 text-center">
          <p className="text-xs text-gray-600">
            {currentQuestion >= QUESTIONS.length - 2
              ? 'Almost there...'
              : currentQuestion >= Math.floor(QUESTIONS.length / 2)
                ? "You're doing great! Just a few more questions..."
                : 'Take your time — this is how we make everything personal'}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
