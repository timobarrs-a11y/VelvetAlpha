import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, ChevronRight, ChevronLeft, Plus, X, Heart,
  PartyPopper, Loader2, Sparkles,
} from 'lucide-react';
import { realPeopleService } from '../services/realPeopleService';

interface SurveyAnswers {
  name: string;
  birthday: string;
  city: string;
  state: string;
  favorite_color: string;
  hobbies: string[];
  favorite_foods: string[];
  dietary_restrictions: string[];
  favorite_tv_shows: string[];
  movie_genres: string[];
  sports_teams: string[];
  music_genres: string[];
  travel_destinations: string[];
  clothing_size_shirt: string;
  clothing_size_shoe: string;
  clothing_size_dress: string;
  ring_size: string;
  things_mentioned_wanting: string;
}

const EMPTY_ANSWERS: SurveyAnswers = {
  name: '', birthday: '', city: '', state: '', favorite_color: '',
  hobbies: [], favorite_foods: [], dietary_restrictions: [],
  favorite_tv_shows: [], movie_genres: [], sports_teams: [],
  music_genres: [], travel_destinations: [],
  clothing_size_shirt: '', clothing_size_shoe: '',
  clothing_size_dress: '', ring_size: '', things_mentioned_wanting: '',
};

interface StepDef {
  id: keyof SurveyAnswers;
  title: string;
  subtitle: string;
  type: 'text' | 'date' | 'choice' | 'multi' | 'freetext';
  options?: string[];
  allowCustom?: boolean;
  minSelections?: number;
  placeholder?: string;
  optional?: boolean;
}

const STEPS: StepDef[] = [
  {
    id: 'name',
    title: "Let's start with your name",
    subtitle: "So we can personalize everything for you.",
    type: 'text',
    placeholder: 'Your first name',
  },
  {
    id: 'birthday',
    title: 'When is your birthday?',
    subtitle: "We'll never miss it — and we'll make sure the people who care about you don't either.",
    type: 'date',
  },
  {
    id: 'city',
    title: 'What city do you live in?',
    subtitle: "This helps us find events, experiences, and spots near you that you'd actually love.",
    type: 'text',
    placeholder: 'e.g. Orlando',
    optional: true,
  },
  {
    id: 'state',
    title: 'And which state?',
    subtitle: 'Just the two-letter abbreviation is fine.',
    type: 'text',
    placeholder: 'e.g. FL',
    optional: true,
  },
  {
    id: 'favorite_color',
    title: 'What is your favorite color?',
    subtitle: 'Some people use this for gift wrapping, nail polish, flowers — the little details.',
    type: 'choice',
    options: ['Red', 'Pink', 'Orange', 'Yellow', 'Green', 'Teal', 'Blue', 'Purple', 'Black', 'White', 'Gray'],
    optional: true,
  },
  {
    id: 'hobbies',
    title: 'What do you love doing?',
    subtitle: 'Pick everything that sounds like you. This helps us suggest experiences and gifts you would genuinely enjoy.',
    type: 'multi',
    allowCustom: true,
    minSelections: 1,
    options: [
      'Reading', 'Gaming', 'Cooking', 'Baking', 'Hiking', 'Photography',
      'Drawing / Painting', 'Writing', 'Music', 'Movies & TV', 'Working Out',
      'Yoga / Meditation', 'Dancing', 'Gardening', 'DIY / Crafts', 'Travel',
      'Fashion / Shopping', 'Cars', 'Tech Gadgets', 'Board Games',
      'Fishing', 'Golf', 'Tennis', 'Skiing / Snowboarding', 'Surfing',
      'Knitting / Crochet', 'Collecting', 'Astronomy', 'Birdwatching',
    ],
  },
  {
    id: 'favorite_foods',
    title: 'What are your favorite foods?',
    subtitle: 'Be specific! Sushi? Tacos? Thai? Italian? This powers restaurant recommendations and foodie gifts.',
    type: 'multi',
    allowCustom: true,
    minSelections: 1,
    options: [
      'Italian', 'Mexican', 'Japanese / Sushi', 'Chinese', 'Thai', 'Indian',
      'Mediterranean', 'French', 'Korean', 'Vietnamese', 'BBQ', 'Burgers',
      'Pizza', 'Seafood', 'Steak', 'Vegan / Plant-based', 'Breakfast / Brunch',
      'Desserts / Sweets', 'Coffee', 'Wine', 'Craft Beer', 'Cocktails',
    ],
  },
  {
    id: 'dietary_restrictions',
    title: 'Any dietary restrictions?',
    subtitle: "We never want to recommend a steakhouse to a vegetarian. This makes sure every food suggestion is safe for you.",
    type: 'multi',
    allowCustom: true,
    minSelections: 0,
    optional: true,
    options: [
      'Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free',
      'Nut allergy', 'Shellfish allergy', 'Halal', 'Kosher', 'Keto',
      'Low-carb', 'Diabetic / Low-sugar', 'No caffeine',
    ],
  },
  {
    id: 'favorite_tv_shows',
    title: 'What shows are you into?',
    subtitle: "Current obsessions or all-time favorites. This helps us suggest live tapings, conventions, merch, and similar shows.",
    type: 'multi',
    allowCustom: true,
    minSelections: 0,
    optional: true,
    options: [
      'The Office', 'Friends', 'Stranger Things', 'Game of Thrones',
      'Breaking Bad', 'The Crown', 'Succession', 'Wednesday',
      'Yellowstone', 'The Bear', 'Ted Lasso', 'Bridgerton',
      'Anime', 'Reality TV', 'True Crime Docs', 'Nature Docs',
    ],
  },
  {
    id: 'movie_genres',
    title: 'What kind of movies do you love?',
    subtitle: 'This helps us find film festivals, outdoor screenings, and movie-themed experiences you would enjoy.',
    type: 'multi',
    allowCustom: true,
    minSelections: 0,
    optional: true,
    options: [
      'Action', 'Comedy', 'Drama', 'Horror', 'Thriller', 'Sci-Fi',
      'Fantasy', 'Romance', 'Documentary', 'Animation', 'Musicals',
      'Superhero', 'Indie / Arthouse', 'Foreign Films', 'Classic Cinema',
    ],
  },
  {
    id: 'sports_teams',
    title: 'Any sports teams you root for?',
    subtitle: "Name them! This is how we find game tickets, watch parties, and sports experiences near you. Go specific — 'Lakers', 'Manchester United', 'Yankees'.",
    type: 'multi',
    allowCustom: true,
    minSelections: 0,
    optional: true,
    options: [
      'Basketball', 'Football (NFL)', 'Soccer', 'Baseball', 'Hockey',
      'Tennis', 'Golf', 'NASCAR / F1', 'UFC / Boxing', 'College Sports',
    ],
  },
  {
    id: 'music_genres',
    title: "What's your music taste?",
    subtitle: "This helps us find concerts, festivals, and vinyl gifts you'd actually love.",
    type: 'multi',
    allowCustom: true,
    minSelections: 0,
    optional: true,
    options: [
      'R&B / Soul', 'Hip-Hop / Rap', 'Pop', 'Rock / Alternative',
      'Lo-fi / Chill', 'Country', 'Jazz', 'Classical', 'EDM / Electronic',
      'Reggae / Dancehall', 'Latin', 'Metal', 'Folk / Acoustic',
      'Gospel', 'K-Pop', 'A bit of everything',
    ],
  },
  {
    id: 'travel_destinations',
    title: 'Where would you love to travel?',
    subtitle: "Dream destinations — near or far. This helps us find flight deals, weekend trips, and travel gift ideas.",
    type: 'multi',
    allowCustom: true,
    minSelections: 0,
    optional: true,
    options: [
      'New York City', 'Los Angeles', 'Miami', 'Las Vegas', 'Chicago',
      'New Orleans', 'Hawaii', 'Paris', 'London', 'Tokyo',
      'Italy', 'Greece', 'Caribbean Cruise', 'National Parks',
      'A tropical beach', 'A ski trip', 'A road trip',
    ],
  },
  {
    id: 'clothing_size_shirt',
    title: 'Shirt size? (optional)',
    subtitle: 'For clothing gifts — S, M, L, XL, or a specific measurement.',
    type: 'text',
    placeholder: 'e.g. Medium',
    optional: true,
  },
  {
    id: 'clothing_size_shoe',
    title: 'Shoe size? (optional)',
    subtitle: 'So we never recommend the wrong size sneakers.',
    type: 'text',
    placeholder: 'e.g. 9',
    optional: true,
  },
  {
    id: 'clothing_size_dress',
    title: 'Dress size? (optional)',
    subtitle: 'If applicable — S, M, L, or a number.',
    type: 'text',
    placeholder: 'e.g. 6',
    optional: true,
  },
  {
    id: 'ring_size',
    title: 'Ring size? (optional)',
    subtitle: 'Only if you know it — this one is for special occasions.',
    type: 'text',
    placeholder: 'e.g. 7',
    optional: true,
  },
  {
    id: 'things_mentioned_wanting',
    title: 'Anything you have been wanting?',
    subtitle: "The stuff you have mentioned wanting but never bought yourself. Gadgets, experiences, that one restaurant you want to try — anything goes. Be as specific as you like.",
    type: 'freetext',
    placeholder: 'e.g. A new espresso machine, a hot air balloon ride, a weekend in Nashville...',
    optional: true,
  },
];

type PageState = 'loading' | 'invalid' | 'survey' | 'submitting' | 'done';

export default function PersonSurveyPage() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>('loading');
  const [personName, setPersonName] = useState('');
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>(EMPTY_ANSWERS);
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      return;
    }
    (async () => {
      try {
        const info = await realPeopleService.getPersonViaToken(token);
        if (!info) {
          setPageState('invalid');
          return;
        }
        setPersonName(info.name || '');
        if (info.name) setAnswers(a => ({ ...a, name: info.name }));
        setPageState('survey');
      } catch {
        setPageState('invalid');
      }
    })();
  }, [token]);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  const canProceed = useCallback(() => {
    if (step.optional) return true;
    const val = answers[step.id];
    if (step.type === 'multi') {
      const min = step.minSelections ?? 1;
      return Array.isArray(val) && val.length >= min;
    }
    if (step.type === 'freetext' || step.type === 'text' || step.type === 'date') {
      return typeof val === 'string' && val.trim().length > 0;
    }
    if (step.type === 'choice') {
      return typeof val === 'string' && val.trim().length > 0;
    }
    return true;
  }, [answers, step]);

  const toggleArrayValue = (field: keyof SurveyAnswers, value: string) => {
    setAnswers(prev => {
      const arr = prev[field] as string[];
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter(v => v !== value) };
      }
      return { ...prev, [field]: [...arr, value] };
    });
  };

  const addCustomValue = (field: keyof SurveyAnswers) => {
    const raw = customInputs[field]?.trim();
    if (!raw) return;
    setAnswers(prev => {
      const arr = prev[field] as string[];
      if (arr.includes(raw)) return prev;
      return { ...prev, [field]: [...arr, raw] };
    });
    setCustomInputs(prev => ({ ...prev, [field]: '' }));
  };

  const handleNext = async () => {
    if (!canProceed()) return;

    if (isLastStep) {
      if (!token) return;
      setPageState('submitting');
      setSubmitError('');
      try {
        const ok = await realPeopleService.submitSurvey(token, {
          name: answers.name || undefined,
          birthday: answers.birthday || undefined,
          city: answers.city || undefined,
          state: answers.state || undefined,
          favorite_color: answers.favorite_color || undefined,
          hobbies: answers.hobbies.length ? answers.hobbies : undefined,
          favorite_foods: answers.favorite_foods.length ? answers.favorite_foods : undefined,
          dietary_restrictions: answers.dietary_restrictions.length ? answers.dietary_restrictions : undefined,
          favorite_tv_shows: answers.favorite_tv_shows.length ? answers.favorite_tv_shows : undefined,
          movie_genres: answers.movie_genres.length ? answers.movie_genres : undefined,
          sports_teams: answers.sports_teams.length ? answers.sports_teams : undefined,
          music_genres: answers.music_genres.length ? answers.music_genres : undefined,
          travel_destinations: answers.travel_destinations.length ? answers.travel_destinations : undefined,
          clothing_size_shirt: answers.clothing_size_shirt || undefined,
          clothing_size_shoe: answers.clothing_size_shoe || undefined,
          clothing_size_dress: answers.clothing_size_dress || undefined,
          ring_size: answers.ring_size || undefined,
          things_mentioned_wanting: answers.things_mentioned_wanting || undefined,
        });
        if (ok) {
          setPageState('done');
        } else {
          setSubmitError('Something went wrong saving your answers. Please try again.');
          setPageState('survey');
        }
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to submit survey.');
        setPageState('survey');
      }
      return;
    }

    setStepIndex(i => i + 1);
  };

  const handleBack = () => {
    if (stepIndex > 0) setStepIndex(i => i - 1);
  };

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  // ===== Loading state =====
  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-[#08090d] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // ===== Invalid/expired token =====
  if (pageState === 'invalid') {
    return (
      <div className="min-h-screen bg-[#08090d] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-5">
          <X className="w-7 h-7 text-white/30" />
        </div>
        <h1 className="text-white font-bold text-xl mb-2">This link is not valid</h1>
        <p className="text-white/40 text-sm max-w-xs">
          The survey link may have expired or been revoked. Ask the person who sent it to share a new one.
        </p>
      </div>
    );
  }

  // ===== Done state =====
  if (pageState === 'done') {
    return (
      <div className="min-h-screen bg-[#08090d] flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="w-20 h-20 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mb-6"
        >
          <PartyPopper className="w-10 h-10 text-emerald-400" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-white font-black text-2xl mb-3"
        >
          You are all set!
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-white/50 text-sm max-w-sm leading-relaxed"
        >
          Your preferences have been saved. The person who sent you this link can now
          find gifts, events, and experiences you will genuinely love. You can close this page.
        </motion.p>
      </div>
    );
  }

  // ===== Survey =====
  const currentValue = answers[step.id];
  const isMulti = step.type === 'multi';
  const arrValue = isMulti ? (currentValue as string[]) : [];

  return (
    <div className="min-h-screen bg-[#08090d] text-white flex flex-col">
      {/* Progress bar */}
      <div className="flex-shrink-0 pt-6 px-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-white/40 font-medium tracking-wide uppercase">Preference Survey</span>
          </div>
          <span className="text-xs text-white/30 font-medium">
            {stepIndex + 1} / {STEPS.length}
          </span>
        </div>
        <div className="h-1 rounded-full bg-white/8 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex flex-col justify-center max-w-lg w-full mx-auto px-6 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={stepIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="flex-1"
          >
            {personName && stepIndex === 0 && (
              <div className="mb-4 text-sm text-emerald-400/70">
                Hi {personName}! Someone who cares about you wants to know what you love.
              </div>
            )}
            <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{step.title}</h2>
            <p className="text-white/45 text-sm leading-relaxed mb-6">{step.subtitle}</p>

            {/* Text input */}
            {(step.type === 'text' || step.type === 'freetext') && (
              <textarea
                value={currentValue as string}
                onChange={e => setAnswers(prev => ({ ...prev, [step.id]: e.target.value }))}
                placeholder={step.placeholder}
                rows={step.type === 'freetext' ? 4 : 1}
                className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/40 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none transition-colors resize-none leading-relaxed"
                onKeyDown={e => {
                  if (e.key === 'Enter' && step.type !== 'freetext' && !e.shiftKey) {
                    e.preventDefault();
                    handleNext();
                  }
                }}
              />
            )}

            {/* Date input */}
            {step.type === 'date' && (
              <input
                type="date"
                value={currentValue as string}
                onChange={e => setAnswers(prev => ({ ...prev, [step.id]: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 focus:border-emerald-500/40 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none transition-colors"
              />
            )}

            {/* Choice (single select) */}
            {step.type === 'choice' && step.options && (
              <div className="flex flex-wrap gap-2">
                {step.options.map(opt => {
                  const selected = currentValue === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswers(prev => ({ ...prev, [step.id]: opt }))}
                      className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        selected
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/25'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Multi-choice */}
            {isMulti && step.options && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {step.options.map(opt => {
                    const selected = arrValue.includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => toggleArrayValue(step.id, opt)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-medium transition-all ${
                          selected
                            ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/25'
                        }`}
                      >
                        {selected && <Check className="w-3.5 h-3.5" />}
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* Custom values already added */}
                {arrValue.filter(v => !step.options!.includes(v)).map(v => (
                  <div key={v} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-sm text-emerald-200">
                    {v}
                    <button onClick={() => toggleArrayValue(step.id, v)} className="text-emerald-300/50 hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {/* Custom input */}
                {step.allowCustom && (
                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      value={customInputs[step.id] || ''}
                      onChange={e => setCustomInputs(prev => ({ ...prev, [step.id]: e.target.value }))}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addCustomValue(step.id);
                        }
                      }}
                      placeholder="Add your own..."
                      className="flex-1 bg-white/5 border border-white/10 focus:border-emerald-500/40 rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none transition-colors"
                    />
                    <button
                      onClick={() => addCustomValue(step.id)}
                      disabled={!customInputs[step.id]?.trim()}
                      className="px-3 py-2 bg-white/8 hover:bg-white/14 border border-white/12 rounded-xl text-white text-sm font-medium transition-all disabled:opacity-40 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add
                    </button>
                  </div>
                )}

                {step.minSelections === 0 && arrValue.length === 0 && (
                  <p className="text-xs text-white/30 pt-1">No worries if none of these apply — just skip ahead.</p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {submitError && (
          <p className="text-sm text-red-400/80 mt-4">{submitError}</p>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-shrink-0 px-6 pb-8 max-w-lg w-full mx-auto">
        <div className="flex items-center gap-3">
          {stepIndex > 0 && (
            <button
              onClick={handleBack}
              disabled={pageState === 'submitting'}
              className="flex items-center gap-1 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm font-medium transition-all disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={!canProceed() || pageState === 'submitting'}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/20"
          >
            {pageState === 'submitting' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : isLastStep ? (
              <>
                <Sparkles className="w-4 h-4" />
                Submit
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
        {step.optional && (
          <p className="text-center text-xs text-white/25 mt-3">
            This question is optional — skip if you prefer
          </p>
        )}
      </div>
    </div>
  );
}
