import { useState, useRef, useEffect, useCallback } from 'react';
import { safeRandomUUID } from '../utils/uuid';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { upsertSchedule } from '../services/userScheduleService';
import { upsertGoal } from '../services/goalService';
import { localExplorerService } from '../services/localExplorerService';
import { BriefReadiness } from '../services/morningBriefService';

interface ChatMessage {
  id: string;
  role: 'navi' | 'user';
  content: string;
}

interface Props {
  readiness: BriefReadiness;
  onClose: () => void;
  onComplete: () => void;
}

// Step keys for the onboarding flow
type OnboardingStep =
  | 'intro'
  | 'schedule_work_type'
  | 'schedule_hours'
  | 'schedule_extras'
  | 'goals_prompt'
  | 'goals_collect'
  | 'location_ask'
  | 'wrap_up';

const WORK_TYPE_CHIPS = [
  { value: 'office', label: 'Office (9–5)', emoji: '🏢' },
  { value: 'remote', label: 'Work from home', emoji: '🏠' },
  { value: 'hybrid', label: 'Hybrid', emoji: '🔄' },
  { value: 'shift', label: 'Shift work', emoji: '🔁' },
  { value: 'freelance', label: 'Freelance / self-employed', emoji: '💼' },
  { value: 'student', label: 'Student', emoji: '🎓' },
  { value: 'none', label: 'Not working right now', emoji: '🌿' },
];

const HOUR_CHIPS = [
  { label: '7am–3pm', start: 7, end: 15 },
  { label: '8am–4pm', start: 8, end: 16 },
  { label: '9am–5pm', start: 9, end: 17 },
  { label: '10am–6pm', start: 10, end: 18 },
  { label: '12pm–8pm', start: 12, end: 20 },
  { label: 'Custom', start: null, end: null },
];

export function NaviOnboardingModal({ readiness, onClose, onComplete }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [step, setStep] = useState<OnboardingStep>('intro');
  const [isNaviTyping, setIsNaviTyping] = useState(false);
  const [savedData, setSavedData] = useState<{
    workType?: string;
    workStart?: number;
    workEnd?: number;
    hasCommute?: boolean;
    hasPickup?: boolean;
    goals?: string[];
    location?: string;
  }>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      userIdRef.current = user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addNaviMessage = useCallback((content: string) => {
    const msg: ChatMessage = {
      id: safeRandomUUID(),
      role: 'navi',
      content,
    };
    setMessages(prev => [...prev, msg]);
  }, []);

  const naviTypeThen = useCallback(async (content: string, delayMs = 700) => {
    setIsNaviTyping(true);
    await new Promise(r => setTimeout(r, delayMs));
    setIsNaviTyping(false);
    addNaviMessage(content);
  }, [addNaviMessage]);

  // Start the flow on mount
  useEffect(() => {
    const start = async () => {
      const missing = readiness.missing;
      const needsSchedule = missing.includes('schedule');
      const needsGoals = missing.includes('goals');
      const needsCalendar = missing.includes('calendar');

      const gaps: string[] = [];
      if (needsSchedule) gaps.push('your day shape');
      if (needsGoals) gaps.push('what you\'re working toward');
      if (needsCalendar) gaps.push('upcoming events');

      let intro = "Hey! I'm Navi — I put together your morning briefs. To make yours actually useful, I need to get a feel for your world.";

      if (gaps.length > 0) {
        intro += ` Specifically: ${gaps.join(' and ')}. This takes about a minute, and you only do it once.`;
      } else {
        intro += ' A couple quick questions and we\'ll have everything we need.';
      }

      await naviTypeThen(intro, 400);

      if (needsSchedule) {
        await naviTypeThen('First — what does your work situation look like?', 900);
        setStep('schedule_work_type');
      } else if (needsGoals) {
        await naviTypeThen('What are you working toward right now? Could be anything — fitness, reading, saving money, a creative project...', 900);
        setStep('goals_prompt');
      } else {
        await naviTypeThen('Actually, you\'re almost there. Let me just grab your location so I can surface local stuff in your brief.', 900);
        setStep('location_ask');
      }
    };
    start();
  }, []);

  const handleWorkTypeSelect = async (workType: string) => {
    setMessages(prev => [...prev, { id: safeRandomUUID(), role: 'user', content: WORK_TYPE_CHIPS.find(c => c.value === workType)?.label || workType }]);
    setSavedData(prev => ({ ...prev, workType }));

    if (workType === 'none' || workType === 'freelance') {
      await naviTypeThen('Got it. I\'ll keep the brief flexible — no morning routine assumptions.', 700);
      // Save schedule with no hours
      if (userIdRef.current) {
        await upsertSchedule(userIdRef.current, { work_type: workType as any }).catch(console.error);
      }
      await naviTypeThen('Now — what are you working toward right now? Any goals, even small ones?', 800);
      setStep('goals_prompt');
    } else {
      await naviTypeThen('What are your usual hours?', 700);
      setStep('schedule_hours');
    }
  };

  const handleHoursSelect = async (start: number | null, end: number | null, label: string) => {
    if (start === null) {
      // Custom — ask freeform
      setMessages(prev => [...prev, { id: safeRandomUUID(), role: 'user', content: label }]);
      await naviTypeThen('Sure — just tell me roughly when you start and finish (like "8 to 5" or "10am to 7pm").', 700);
      setStep('schedule_hours');
      return;
    }

    setMessages(prev => [...prev, { id: safeRandomUUID(), role: 'user', content: label }]);
    setSavedData(prev => ({ ...prev, workStart: start, workEnd: end ?? undefined }));

    await naviTypeThen('Got it. Any of these apply?', 600);
    setStep('schedule_extras');
  };

  const handleExtrasSubmit = async (hasCommute: boolean, hasPickup: boolean) => {
    setSavedData(prev => ({ ...prev, hasCommute, hasPickup }));

    const parts = [];
    if (hasCommute) parts.push('commute');
    if (hasPickup) parts.push('school pickup');
    const userText = parts.length > 0 ? parts.join(' + ') : 'Neither, just the hours';
    setMessages(prev => [...prev, { id: safeRandomUUID(), role: 'user', content: userText }]);

    if (userIdRef.current) {
      await upsertSchedule(userIdRef.current, {
        work_type: (savedData.workType ?? 'office') as any,
        work_start_hour: savedData.workStart ?? null,
        work_end_hour: savedData.workEnd ?? null,
        has_morning_commute: hasCommute,
        has_evening_commute: hasCommute,
        has_school_pickup: hasPickup,
        school_pickup_time: hasPickup ? 'afternoon' : null,
      }).catch(console.error);
    }

    await naviTypeThen('Perfect. I\'ve got your schedule locked in.', 600);
    await naviTypeThen('Now — what are you working toward right now? Anything you\'re trying to build, change, or finish?', 800);
    setStep('goals_prompt');
  };

  const handleGoalInput = async (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: safeRandomUUID(), role: 'user', content: text }]);
    setInputValue('');

    // Parse the goal text into a structured goal
    const goalText = text.trim();
    setSavedData(prev => ({ ...prev, goals: [...(prev.goals || []), goalText] }));

    if (userIdRef.current) {
      // Detect goal type heuristically
      const lower = goalText.toLowerCase();
      let goal_type: 'health_fitness' | 'reading' | 'creative' | 'habit' | 'deadline' = 'habit';
      if (/weight|gym|run|exercise|fit|lose|skate|swim|bike|hike|steps|calories/.test(lower)) goal_type = 'health_fitness';
      else if (/read|book|pages|chapters|kindle/.test(lower)) goal_type = 'reading';
      else if (/write|draw|paint|music|create|design|art|blog|podcast/.test(lower)) goal_type = 'creative';
      else if (/save|money|budget|debt|invest/.test(lower)) goal_type = 'habit';
      else if (/deadline|finish|ship|launch|due|project/.test(lower)) goal_type = 'deadline';

      await upsertGoal(userIdRef.current, {
        title: goalText,
        goal_type,
        status: 'active',
        start_date: new Date().toISOString().split('T')[0],
      }).catch(console.error);
    }

    await naviTypeThen(`"${goalText}" — love it. I\'ll keep an eye on that in your briefs.`, 700);
    await naviTypeThen('Anything else you\'re working on? Or should we move on?', 700);
    setStep('goals_collect');
  };

  const handleGoalDone = async () => {
    setMessages(prev => [...prev, { id: safeRandomUUID(), role: 'user', content: "That's it for now" }]);
    const location = await localExplorerService.getSavedLocation();
    if (!location) {
      await naviTypeThen('One more thing — what city are you in? I use this for local stuff in your brief.', 800);
      setStep('location_ask');
    } else {
      await wrapUp();
    }
  };

  const handleLocationInput = async (text: string) => {
    if (!text.trim()) return;
    const city = text.trim();
    setMessages(prev => [...prev, { id: safeRandomUUID(), role: 'user', content: city }]);
    setInputValue('');
    setSavedData(prev => ({ ...prev, location: city }));

    await localExplorerService.saveLocation({ city }).catch(console.error);

    await wrapUp();
  };

  const wrapUp = async () => {
    setStep('wrap_up');
    await naviTypeThen("That's everything I need. Your morning brief is going to be a lot more useful from here on.", 900);

    if (savedData.goals && savedData.goals.length > 0) {
      const firstGoal = savedData.goals[0].toLowerCase();
      const hasActivity = /skate|gym|run|swim|bike|hike|sport|fitness|yoga|dance/.test(firstGoal);
      if (hasActivity && savedData.location) {
        await naviTypeThen(
          `By the way — since you mentioned ${savedData.goals[0]}, I can look up spots near ${savedData.location} that could help. I'll drop those into future briefs when the timing is right.`,
          1200
        );
      }
    }

    await naviTypeThen("Go ahead and run your morning brief now.", 800);
    setTimeout(onComplete, 1400);
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;

    if (step === 'schedule_hours') {
      // Parse custom hours from freeform input
      const text = inputValue;
      const match = text.match(/(\d{1,2})(?::?\d{0,2})?\s*(?:am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::?\d{0,2})?\s*(?:am|pm)?/i);
      if (match) {
        let start = parseInt(match[1]);
        let end = parseInt(match[2]);
        const isStartPm = text.toLowerCase().includes('pm') && start < 12 && start !== 12;
        if (isStartPm) start += 12;
        if (end < start && end < 12) end += 12;
        setMessages(prev => [...prev, { id: safeRandomUUID(), role: 'user', content: text }]);
        setInputValue('');
        setSavedData(prev => ({ ...prev, workStart: start, workEnd: end }));
        naviTypeThen('Got it. Any of these apply?', 600).then(() => setStep('schedule_extras'));
      } else {
        handleGoalInput(text);
      }
    } else if (step === 'goals_prompt' || step === 'goals_collect') {
      handleGoalInput(inputValue);
    } else if (step === 'location_ask') {
      handleLocationInput(inputValue);
    } else {
      // Generic fallback
      setMessages(prev => [...prev, { id: safeRandomUUID(), role: 'user', content: inputValue }]);
      setInputValue('');
    }
  };

  const renderChips = () => {
    if (step === 'schedule_work_type') {
      return (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {WORK_TYPE_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => handleWorkTypeSelect(chip.value)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-all active:scale-95"
            >
              <span>{chip.emoji}</span>
              {chip.label}
            </button>
          ))}
        </div>
      );
    }

    if (step === 'schedule_hours') {
      return (
        <div className="flex flex-wrap gap-2 px-4 pb-2">
          {HOUR_CHIPS.map(chip => (
            <button
              key={chip.label}
              onClick={() => handleHoursSelect(chip.start, chip.end, chip.label)}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-all active:scale-95"
            >
              {chip.label}
            </button>
          ))}
        </div>
      );
    }

    if (step === 'schedule_extras') {
      return <ScheduleExtrasChips onSubmit={handleExtrasSubmit} />;
    }

    if (step === 'goals_collect') {
      return (
        <div className="flex gap-2 px-4 pb-2">
          <button
            onClick={handleGoalDone}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 transition-all"
          >
            That's it for now
          </button>
          <button
            onClick={() => {
              setMessages(prev => [...prev, { id: safeRandomUUID(), role: 'user', content: 'Add another goal' }]);
              setStep('goals_prompt');
            }}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100 transition-all"
          >
            Add another
          </button>
        </div>
      );
    }

    return null;
  };

  const showInput = step === 'schedule_hours' || step === 'goals_prompt' || step === 'goals_collect' || step === 'location_ask';

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: '85vh', boxShadow: '0 40px 100px rgba(0,0,0,0.25)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-teal-500 flex items-center justify-center shadow-md">
              <MapPin className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-gray-900">Navi</p>
              <p className="text-[10.5px] text-teal-600 font-medium">Setting up your morning brief</p>
            </div>
            <button
              onClick={onClose}
              className="ml-auto flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-snug ${
                    msg.role === 'navi'
                      ? 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      : 'bg-teal-500 text-white rounded-tr-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}

            {isNaviTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="bg-gray-100 px-3.5 py-2.5 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                  {[0, 150, 300].map(delay => (
                    <div
                      key={delay}
                      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chips */}
          <AnimatePresence>
            {!isNaviTyping && renderChips() && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex-shrink-0"
              >
                {renderChips()}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          {showInput && (
            <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100 flex-shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                placeholder={
                  step === 'location_ask' ? 'Enter your city...'
                  : step === 'schedule_hours' ? 'e.g. 9am to 5pm...'
                  : 'Tell me about a goal...'
                }
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-[13px] placeholder-gray-400 focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400/20"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="w-9 h-9 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all active:scale-95"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function ScheduleExtrasChips({ onSubmit }: { onSubmit: (commute: boolean, pickup: boolean) => void }) {
  const [commute, setCommute] = useState(false);
  const [pickup, setPickup] = useState(false);

  return (
    <div className="px-4 pb-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCommute(c => !c)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
            commute
              ? 'bg-teal-500 text-white border-teal-500'
              : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
          }`}
        >
          🚌 I commute
        </button>
        <button
          onClick={() => setPickup(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
            pickup
              ? 'bg-teal-500 text-white border-teal-500'
              : 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
          }`}
        >
          🏫 School pickup
        </button>
      </div>
      <button
        onClick={() => onSubmit(commute, pickup)}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white bg-teal-500 hover:bg-teal-600 transition-all"
      >
        That's my routine
      </button>
    </div>
  );
}
