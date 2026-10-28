import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Check, Plus, X, Heart, Sparkles,
  BookOpen, Gamepad2, Utensils, MapPin, Camera, Palette, PenTool, Music,
  Film, Dumbbell, Sprout, Compass, ShoppingBag, Cpu, Puzzle, Wrench,
  TrendingUp, Trophy, Tv, Wine, Building, Moon, Car, Home, Sunrise,
  Clapperboard, Laugh, Drama, Mic, Youtube, Code, Coins, Rocket, Atom,
  Newspaper, Leaf, Cat, type LucideIcon,
} from 'lucide-react';
import type {
  QuestionContext,
  QuestionnaireDefinition,
  TapQuestion,
  GridQuestion,
  SwipeQuestion,
  ScrubQuestion,
  PreviewQuestion,
  BeatQuestion,
  TabsQuestion,
} from './types';
import { resolveQuestionText } from './companionBank';
import { tpl } from './pronouns';
import { getColorHex } from './personalBank';
import { NICKNAME_BANK, pickNickname, type NicknameKind } from './nicknames';
import { HostDialogue, type QuestionnaireHost } from './HostDialogue';

const ICON_MAP: Record<string, LucideIcon> = {
  BookOpen, Gamepad2, Utensils, MapPin, Camera, Palette, PenTool, Music,
  Film, Dumbbell, Heart, Sprout, Compass, ShoppingBag, Cpu, Puzzle, Wrench,
  TrendingUp, Trophy, Tv, Wine, Building, Moon, Car, Home, Sunrise,
  Sparkles, Clapperboard, Laugh, Drama, Mic, Youtube, Code, Coins, Rocket,
  Atom, Newspaper, Leaf, Cat,
};

const NEXT_BUTTON_CLASS = 'inline-flex items-center justify-center h-12 w-48 max-w-full px-8 text-white text-base font-bold rounded-full shadow-lg transition-all duration-200';

function loadIcon(name: string): LucideIcon | null {
  return ICON_MAP[name] || null;
}

interface QuestionnaireShellProps {
  definition: QuestionnaireDefinition;
  context: QuestionContext;
  onComplete: (answers: Record<string, string | string[]>) => void;
  onAnswer?: (questionId: string, answer: string | string[], allAnswers: Record<string, string | string[]>) => void;
  onBack?: () => void;
  showOrb?: boolean;
  renderOrb?: () => ReactNode;
  /** Answers saved earlier, so a returning person picks up where they left off. */
  initialAnswers?: Record<string, string | string[]>;
  /** The question to start on when resuming. */
  initialIndex?: number;
  /** A character who asks the questions, typed out like dialogue. Without one it is a plain form. */
  host?: QuestionnaireHost;
}

export function QuestionnaireShell({
  definition,
  context,
  onComplete,
  onAnswer,
  onBack,
  showOrb = false,
  renderOrb,
  initialAnswers,
  initialIndex = 0,
  host,
}: QuestionnaireShellProps) {
  const [currentIdx, setCurrentIdx] = useState(Math.min(Math.max(initialIndex, 0), definition.questions.length - 1));
  const [answers, setAnswers] = useState<Record<string, string | string[]>>(initialAnswers ?? {});
  const [textInput, setTextInput] = useState('');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [selectedGridOptions, setSelectedGridOptions] = useState<number[]>([]);
  const [customEntries, setCustomEntries] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  const [scrubValue, setScrubValue] = useState(1);
  const [swipeIdx, setSwipeIdx] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [swipeDragX, setSwipeDragX] = useState(0);
  const [beatVisible, setBeatVisible] = useState(false);
  // With a host, the answer controls wait until the line has been said.
  const [lineDone, setLineDone] = useState(!host);
  // The host's remark on the answer just given, shown before the next question comes up.
  const [reaction, setReaction] = useState<{ text: string; answers: Record<string, string | string[]> } | null>(null);
  const [reactionDone, setReactionDone] = useState(false);
  useEffect(() => { setLineDone(!host); }, [currentIdx, host]);
  const dragStartRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const scrubTrackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentIdxRef = useRef(0);
  const questionIdx = useRef<Record<string, number>>({});
  const handleAnswerRef = useRef<(answer: string | string[]) => void>(() => {});

  const questions = definition.questions;
  const question = questions[currentIdx];
  const totalQuestions = questions.length;
  const startProgress = definition.startProgress ?? 0;
  const progress = startProgress + ((currentIdx + 1) / totalQuestions) * (100 - startProgress);

  const ctx: QuestionContext = { ...context, answers };
  currentIdxRef.current = currentIdx;
  questions.forEach((q, i) => { questionIdx.current[q.id] = i; });

  const currentChapter = definition.chapters.find(ch =>
    ch.questionIds.includes(question?.id)
  );

  const chapterIndex = currentChapter
    ? definition.chapters.indexOf(currentChapter)
    : 0;

  const accentColor = getColorHex(answers.favoriteColor as string) || undefined;

  useEffect(() => {
    if (question?.archetype === 'scrub') {
      const scrubQ = question as ScrubQuestion;
      const existing = answers[question.id] as string | undefined;
      const existingIdx = existing ? scrubQ.config.valueLabels.indexOf(existing) : -1;
      setScrubValue(existingIdx >= 0 ? existingIdx : scrubQ.config.default);
    }
    if (question?.archetype === 'grid') {
      const gridQ = question as GridQuestion;
      const existing = answers[question.id];
      const presetValues = gridQ.options.map(o => o.value);
      if (Array.isArray(existing)) {
        const indices = existing
          .map(v => presetValues.indexOf(v))
          .filter(i => i >= 0);
        const customs = existing.filter(v => !presetValues.includes(v));
        setSelectedGridOptions(indices);
        setCustomEntries(customs);
      } else if (typeof existing === 'string' && existing) {
        const idx = presetValues.indexOf(existing);
        setSelectedGridOptions(idx >= 0 ? [idx] : []);
        setCustomEntries([]);
      } else {
        setSelectedGridOptions([]);
        setCustomEntries([]);
      }
      setCustomInput('');
    }
    if (question?.archetype === 'tap' && !(question as TapQuestion).options) {
      const existing = answers[question.id] as string | undefined;
      if (existing) setTextInput(existing);
      else setTextInput('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (question?.archetype === 'beat') {
      setBeatVisible(true);
    }
    if (question?.skipIf?.({ ...context, answers })) {
      const timer = setTimeout(() => advance(), 50);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  // Pass the answers just given: state set in the same tick hasn't landed yet,
  // and finishing with the old answers would drop the last screen's.
  const advance = useCallback((latest?: Record<string, string | string[]>) => {
    if (currentIdx >= totalQuestions - 1) {
      onComplete(latest ?? answers);
    } else {
      setCurrentIdx(currentIdx + 1);
      setTextInput('');
      setSelectedOption(null);
      setSwipeDirection(null);
      setSwipeDragX(0);
      setSwipeIdx(0);
    }
  }, [currentIdx, totalQuestions, answers, onComplete]);

  const handleAnswer = (answer: string | string[]) => {
    const newAnswers = { ...answers, [question.id]: answer };
    setAnswers(newAnswers);
    onAnswer?.(question.id, answer, newAnswers);
    const remark = host ? question.reaction?.(answer, { ...context, answers: newAnswers }) : null;
    if (remark) {
      setTimeout(() => { setReactionDone(false); setReaction({ text: remark, answers: newAnswers }); }, question.archetype === 'tap' ? 350 : 100);
      return;
    }
    setTimeout(() => advance(newAnswers), question.archetype === 'tap' ? 350 : 100);
  };

  handleAnswerRef.current = handleAnswer;

  // Once the host has finished the remark, give it a moment to land, then go on.
  useEffect(() => {
    if (!reaction || !reactionDone) return;
    const timer = setTimeout(() => {
      const next = reaction.answers;
      setReaction(null);
      setReactionDone(false);
      advance(next);
    }, 900);
    return () => clearTimeout(timer);
  }, [reaction, reactionDone, advance]);

  const handleBack = () => {
    if (reaction) return;
    if (currentIdx > 0) {
      let prevIdx = currentIdx - 1;
      while (prevIdx > 0 && (questions[prevIdx].archetype === 'beat' || questions[prevIdx].skipIf?.(ctx))) {
        prevIdx--;
      }
      const prevQuestion = questions[prevIdx];
      const prevAnswer = answers[prevQuestion.id];

      if (prevQuestion.archetype === 'tap' && !(prevQuestion as TapQuestion).options && prevAnswer) {
        setTextInput(prevAnswer as string);
      } else {
        setTextInput('');
      }
      setSelectedOption(null);
      setCurrentIdx(prevIdx);
    } else if (onBack) {
      onBack();
    }
  };

  const handleTapOption = (index: number, value: string) => {
    setSelectedOption(index);
    setTimeout(() => {
      handleAnswer(value);
      setSelectedOption(null);
    }, 400);
  };

  const handleGridToggle = (index: number) => {
    const gridQ = question as GridQuestion;
    if (!gridQ.multiSelect) {
      const already = selectedGridOptions.includes(index);
      setSelectedGridOptions(already ? [] : [index]);
      // A single pick moves on by itself, but only when the person just made it. Going back restores the
      // old pick without advancing, so the answer can be changed.
      if (!already) {
        const questionId = question.id;
        const value = gridQ.options[index]?.value;
        window.setTimeout(() => {
          if (currentIdxRef.current !== questionIdx.current[questionId] || !value) return;
          setSelectedGridOptions([]);
          setCustomEntries([]);
          handleAnswerRef.current(value);
        }, 350);
      }
      return;
    }
    setSelectedGridOptions(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleGridSubmit = () => {
    const gridQ = question as GridQuestion;
    const selectedValues = selectedGridOptions
      .map(i => gridQ.options[i]?.value)
      .filter(Boolean) as string[];
    if (!gridQ.multiSelect) {
      handleAnswer(selectedValues[0] ?? '');
    } else {
      handleAnswer([...selectedValues, ...customEntries]);
    }
    setSelectedGridOptions([]);
    setCustomEntries([]);
  };

  /** A tabbed screen saves each tab under its own key. */
  const handleTabsSubmit = (picks: Record<string, string[]>) => {
    const newAnswers = { ...answers, ...picks, [question.id]: Object.values(picks).flat() };
    setAnswers(newAnswers);
    for (const [key, values] of Object.entries(picks)) onAnswer?.(key, values, newAnswers);
    onAnswer?.(question.id, newAnswers[question.id] as string[], newAnswers);
    setTimeout(() => advance(newAnswers), 100);
  };

  const handleScrubChange = (value: number) => {
    setScrubValue(value);
  };

  const handleScrubSubmit = () => {
    const scrubQ = question as ScrubQuestion;
    const label = tpl(scrubQ.config.values?.[scrubValue] ?? scrubQ.config.valueLabels[scrubValue] ?? String(scrubValue), ctx);
    handleAnswer(label);
  };

  const handleSwipeComplete = (direction: 'left' | 'right') => {
    if (swipeDirection !== null) return;
    const swipeQ = question as SwipeQuestion;
    const card = swipeQ.cards[swipeIdx];
    const value = direction === 'left' ? card.left.label : card.right.label;
    const existing = (answers[question.id] as string[]) || [];
    const newAnswers = { ...answers, [question.id]: [...existing, value] };
    setAnswers(newAnswers);
    onAnswer?.(question.id, newAnswers[question.id] as string[], newAnswers);
    setSwipeDirection(direction);
    setTimeout(() => {
      if (swipeIdx + 1 >= swipeQ.cards.length) {
        advance(newAnswers);
      } else {
        setSwipeIdx(swipeIdx + 1);
        setSwipeDirection(null);
        setSwipeDragX(0);
      }
    }, 300);
  };

  const handleSwipeDragStart = (clientX: number) => {
    dragStartRef.current = clientX;
  };

  const handleSwipeDragMove = (clientX: number) => {
    if (dragStartRef.current === null) return;
    const delta = clientX - dragStartRef.current;
    setSwipeDragX(delta);
  };

  const handleSwipeDragEnd = () => {
    if (Math.abs(swipeDragX) > 100) {
      handleSwipeComplete(swipeDragX > 0 ? 'right' : 'left');
    } else {
      setSwipeDragX(0);
    }
    dragStartRef.current = null;
  };

  if (question.archetype === 'beat') {
    const beatQ = question as BeatQuestion;
    const beatText = tpl(beatQ.beat.template(ctx), ctx);
    return (
      <BeatRenderer
        text={beatText}
        visible={beatVisible}
        showOrb={showOrb}
        renderOrb={renderOrb}
        confirmLabel={beatQ.beat.confirmLabel}
        accentColor={accentColor}
        progress={progress}
        chapterLabel={currentChapter ? tpl(currentChapter.label, ctx) : ''}
        chapterIndex={chapterIndex}
        totalChapters={definition.chapters.length}
        onBack={currentIdx > 0 || onBack ? handleBack : undefined}
        onConfirm={() => {
          setBeatVisible(false);
          advance();
        }}
      />
    );
  }

  const questionText = resolveQuestionText(question, ctx);

  return (
    <div className="min-h-screen bg-[#080b14] flex flex-col items-center justify-center p-6 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full blur-[120px] ${accentColor ? '' : 'bg-rose-600/5'}`}
          style={accentColor ? { backgroundColor: `${accentColor}14` } : undefined}
        />
        <div
          className={`absolute bottom-[-10%] right-[10%] w-[500px] h-[400px] rounded-full blur-[100px] ${accentColor ? '' : 'bg-pink-600/5'}`}
          style={accentColor ? { backgroundColor: `${accentColor}0f` } : undefined}
        />
      </div>

      {showOrb && renderOrb && (
        <div className="relative z-10 mb-6">
          {renderOrb()}
        </div>
      )}

      <div className="max-w-2xl w-full relative z-10">
        {(currentIdx > 0 || onBack) && (
          <button
            onClick={handleBack}
            className="mb-4 flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">{currentIdx === 0 ? 'Exit' : 'Back'}</span>
          </button>
        )}

        <ProgressBar
          progress={progress}
          chapterLabel={currentChapter ? tpl(currentChapter.label, ctx) : ''}
          chapterIndex={chapterIndex}
          totalChapters={definition.chapters.length}
          accentColor={accentColor}
        />

        <div className="bg-white/[0.03] border border-white/10 rounded-3xl shadow-2xl p-8 md:p-10 overflow-hidden relative mt-6">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {host && reaction ? (
                <HostDialogue key={`reaction-${currentIdx}`} host={host} text={reaction.text} accentColor={accentColor} onDone={() => setReactionDone(true)} />
              ) : host ? (
                <HostDialogue key={currentIdx} host={host} text={questionText} accentColor={accentColor} onDone={() => setLineDone(true)} />
              ) : (
                <motion.h2
                  className="text-2xl md:text-3xl font-bold text-center mb-8 tracking-tight leading-snug"
                  style={{ color: accentColor || '#ffffff' }}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 }}
                >
                  {questionText}
                </motion.h2>
              )}

              <div
                className={host ? 'transition-opacity duration-300' : undefined}
                style={host ? { opacity: lineDone && !reaction ? 1 : 0, pointerEvents: lineDone && !reaction ? 'auto' : 'none' } : undefined}
                aria-hidden={host && (!lineDone || reaction) ? true : undefined}
              >

              {question.archetype === 'tap' && !(question as TapQuestion).options && (
                <TapTextRenderer
                  question={question as TapQuestion}
                  textInput={textInput}
                  setTextInput={setTextInput}
                  onSubmit={() => {
                    const minLen = (question as TapQuestion).minLength;
                    if (minLen && textInput.trim().length < minLen) return;
                    if ((question as TapQuestion).validate?.(textInput)) return;
                    handleAnswer(textInput.trim());
                  }}
                  onSkip={(question as TapQuestion).optional ? () => handleAnswer('') : (question as TapQuestion).nicknameBank ? () => handleAnswer(pickNickname(textInput)) : undefined}
                  hint={typeof (question as TapQuestion).hint === 'function' ? ((question as TapQuestion).hint as (c: typeof ctx) => string)(ctx) : (question as TapQuestion).hint as string | undefined}
                  inputRef={inputRef}
                  accentColor={accentColor}
                />
              )}

              {question.archetype === 'tap' && (question as TapQuestion).options && (
                <TapOptionsRenderer
                  question={question as TapQuestion}
                  ctx={ctx}
                  selectedOption={selectedOption}
                  onOptionClick={handleTapOption}
                />
              )}

              {question.archetype === 'grid' && (
                <GridRenderer
                  question={question as GridQuestion}
                  selectedOptions={selectedGridOptions}
                  onToggle={handleGridToggle}
                  customEntries={customEntries}
                  setCustomEntries={setCustomEntries}
                  customInput={customInput}
                  setCustomInput={setCustomInput}
                  onSubmit={handleGridSubmit}
                  autoSubmit={!(question as GridQuestion).multiSelect}
                  accentColor={accentColor}
                />
              )}

              {question.archetype === 'tabs' && (
                <TabsRenderer
                  key={question.id}
                  question={question as TabsQuestion}
                  answers={answers}
                  onSubmit={handleTabsSubmit}
                  accentColor={accentColor}
                />
              )}

              {question.archetype === 'preview' && (
                <PreviewRenderer
                  question={question as PreviewQuestion}
                  onSelect={(value) => handleAnswer(value)}
                  selectedOption={selectedOption}
                  setSelectedOption={setSelectedOption}
                />
              )}

              {question.archetype === 'scrub' && (
                <ScrubRenderer
                  question={question as ScrubQuestion}
                  value={scrubValue}
                  onChange={handleScrubChange}
                  onSubmit={handleScrubSubmit}
                  trackRef={scrubTrackRef}
                  ctx={ctx}
                />
              )}

              {question.archetype === 'swipe' && (
                <SwipeRenderer
                  question={question as SwipeQuestion}
                  cardIndex={swipeIdx}
                  dragX={swipeDragX}
                  direction={swipeDirection}
                  onDragStart={handleSwipeDragStart}
                  onDragMove={handleSwipeDragMove}
                  onDragEnd={handleSwipeDragEnd}
                  onSwipe={handleSwipeComplete}
                  cardRef={cardRef}
                />
              )}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/**
 * Several multi-select groups on one screen, as tabs, each with an optional
 * nudge. Picks are chips rather than cards so a tab of ten options fits.
 */
function TabsRenderer({
  question,
  answers,
  onSubmit,
  accentColor,
}: {
  question: TabsQuestion;
  answers: Record<string, string | string[]>;
  onSubmit: (picks: Record<string, string[]>) => void;
  accentColor?: string;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const [picks, setPicks] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(question.tabs.map(t => {
      const existing = answers[t.answerKey];
      const list = Array.isArray(existing)
        ? existing
        : typeof existing === 'string' && existing ? existing.split(',').map(v => v.trim()).filter(Boolean) : [];
      return [t.answerKey, list];
    })),
  );
  const [customInput, setCustomInput] = useState('');
  const tab = question.tabs[activeTab];
  const selected = picks[tab.answerKey] ?? [];
  const total = Object.values(picks).reduce((n, list) => n + list.length, 0);
  const minSel = question.minSelections ?? 0;
  const tone = accentColor ?? '#f43f5e';

  const toggle = (value: string) => {
    setPicks(prev => {
      const list = prev[tab.answerKey] ?? [];
      return { ...prev, [tab.answerKey]: list.includes(value) ? list.filter(v => v !== value) : [...list, value] };
    });
  };

  const addCustom = () => {
    const value = customInput.trim();
    if (!value) return;
    setPicks(prev => {
      const list = prev[tab.answerKey] ?? [];
      return list.includes(value) ? prev : { ...prev, [tab.answerKey]: [...list, value] };
    });
    setCustomInput('');
  };

  const customs = selected.filter(v => !tab.options.some(o => o.value === v));
  const chipStyle = (on: boolean) => on
    ? { borderColor: `${tone}99`, backgroundColor: `${tone}33` }
    : { borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.03)' };

  return (
    <div className="space-y-4">
      {question.subtitle && <p className="text-sm text-gray-400 text-center -mt-4">{question.subtitle}</p>}

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist">
        {question.tabs.map((t, i) => {
          const count = (picks[t.answerKey] ?? []).length;
          const isActive = i === activeTab;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => { setActiveTab(i); setCustomInput(''); }}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold border transition-colors"
              style={isActive
                ? { borderColor: tone, backgroundColor: `${tone}26`, color: '#fff' }
                : { borderColor: 'rgba(255,255,255,0.12)', color: 'rgb(156 163 175)' }}
            >
              {t.label}{count > 0 && <span className="ml-1.5 opacity-80">{count}</span>}
            </button>
          );
        })}
      </div>

      {tab.nudge && <p className="text-sm italic text-gray-400">{tab.nudge}</p>}

      <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1 custom-scroll">
        {tab.options.map(option => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              onClick={() => toggle(option.value)}
              aria-pressed={isSelected}
              className="rounded-full px-3.5 py-2 text-sm border-2 transition-all duration-150 text-white"
              style={chipStyle(isSelected)}
            >
              {isSelected && <Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />}
              {option.label}
            </button>
          );
        })}
        {customs.map(value => (
          <button
            key={value}
            onClick={() => toggle(value)}
            aria-pressed
            aria-label={`Remove ${value}`}
            className="rounded-full px-3.5 py-2 text-sm border-2 text-white"
            style={chipStyle(true)}
          >
            <X className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
            {value}
          </button>
        ))}
      </div>

      {tab.allowCustom && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustom()}
            placeholder="Something else..."
            aria-label={`Add your own to ${tab.label}`}
            className="flex-1 px-4 py-2.5 text-sm bg-white/5 border-2 border-white/10 text-white placeholder-gray-600 rounded-xl focus:outline-none transition-all"
          />
          <button
            onClick={addCustom}
            disabled={!customInput.trim()}
            aria-label="Add"
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl disabled:bg-white/10 disabled:cursor-not-allowed text-white"
            style={customInput.trim() ? { backgroundColor: tone } : undefined}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col items-center gap-2 pt-1">
        {minSel > 0 && total < minSel && <p className="text-sm text-gray-500">Pick {minSel - total} more</p>}
        <button
          onClick={() => onSubmit(picks)}
          disabled={total < minSel}
          className={`${NEXT_BUTTON_CLASS} disabled:cursor-not-allowed`}
          style={total < minSel
            ? { background: 'rgb(55 65 81)' }
            : { background: accentColor ? `linear-gradient(to right, ${accentColor}, ${accentColor}dd)` : 'linear-gradient(to right, rgb(244 63 94), rgb(219 39 119))' }}
        >
          {total === 0 && minSel === 0 ? (question.skipLabel ?? 'Skip') : 'Next'}
        </button>
      </div>
    </div>
  );
}

function ProgressBar({
  progress,
  chapterLabel,
  chapterIndex,
  totalChapters,
  accentColor,
}: {
  progress: number;
  chapterLabel: string;
  chapterIndex: number;
  totalChapters: number;
  accentColor?: string;
}) {
  const gradient = accentColor
    ? `linear-gradient(to right, ${accentColor}, ${accentColor}cc)`
    : 'linear-gradient(to right, rgb(244 63 94), rgb(236 72 153))';
  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-medium text-gray-400">
          Chapter {chapterIndex + 1} of {totalChapters} -- {chapterLabel}
        </span>
        <span className="text-xs font-medium text-gray-500">
          {Math.round(progress)}%
        </span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
        <motion.div
          className="h-1.5 rounded-full"
          style={{ background: gradient }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

const NICKNAME_KIND_LABELS: Record<NicknameKind, string> = { funny: 'Funny', classic: 'Classic', screen: 'Screen names', cozy: 'Cozy' };

function TapTextRenderer({
  question,
  textInput,
  setTextInput,
  onSubmit,
  onSkip,
  hint,
  inputRef,
  accentColor,
}: {
  question: TapQuestion;
  textInput: string;
  setTextInput: (v: string) => void;
  onSubmit: () => void;
  onSkip?: () => void;
  hint?: string;
  inputRef: React.RefObject<HTMLInputElement>;
  accentColor?: string;
}) {
  const isDate = question.id === 'birthday';
  const minLen = question.minLength;
  const trimmed = textInput.trim();
  const invalid = trimmed.length > 0 ? question.validate?.(textInput) ?? null : null;
  const tooShort = !question.validate && minLen ? trimmed.length > 0 && trimmed.length < minLen : false;
  const canSubmit = isDate ? !!textInput && !question.validate?.(textInput) : trimmed.length >= (minLen ?? 1) && !(question.validate?.(textInput));
  const [bankKind, setBankKind] = useState<NicknameKind>('funny');


  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type={isDate ? 'date' : 'text'}
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && canSubmit && onSubmit()}
        placeholder={question.placeholder}
        className="w-full px-6 py-4 text-xl bg-white/5 border-2 border-white/10 text-white placeholder-gray-600 rounded-2xl focus:outline-none transition-all duration-200"
        style={accentColor ? { '--tw-ring-color': accentColor } as React.CSSProperties : undefined}
        autoFocus
      />
      {tooShort && (
        <p className="text-sm text-rose-400/80 text-center">
          {minLen} letters minimum
        </p>
      )}
      {invalid && <p role="alert" className="text-sm text-rose-400/80 text-center">{invalid}</p>}
      {hint && !invalid && <p className="text-sm text-gray-400 text-center">{hint}</p>}
      {question.nicknameBank && (
        <div className="space-y-3">
          <p className="text-center text-xs uppercase tracking-widest text-gray-500">Pick one, or type your own</p>
          <div role="tablist" aria-label="Nickname styles" className="flex flex-wrap items-center justify-center gap-1.5">
            {(Object.keys(NICKNAME_BANK) as NicknameKind[]).map(kind => (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={bankKind === kind}
                onClick={() => setBankKind(kind)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${bankKind === kind ? 'bg-white/15 border-white/30 text-white' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
              >
                {NICKNAME_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
          <div role="listbox" aria-label="Nicknames" className="flex flex-wrap items-center justify-center gap-2 max-h-44 overflow-y-auto px-1 py-1">
            {NICKNAME_BANK[bankKind].map(nick => (
              <button
                key={nick}
                type="button"
                role="option"
                aria-selected={trimmed === nick}
                onClick={() => setTextInput(nick)}
                className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${trimmed === nick ? 'bg-rose-500/25 border-rose-400/60 text-white' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
              >
                {nick}
              </button>
            ))}
          </div>
        </div>
      )}
      {question.suggestions && question.suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-center text-xs uppercase tracking-widest text-gray-500">Pick one, or type your own</p>
          <div role="listbox" aria-label="Suggestions" className="flex flex-wrap items-center justify-center gap-2 max-h-44 overflow-y-auto px-1 py-1">
            {question.suggestions.map(s => (
              <button
                key={s}
                type="button"
                role="option"
                aria-selected={trimmed === s}
                onClick={() => setTextInput(s)}
                className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${trimmed === s ? 'bg-rose-500/25 border-rose-400/60 text-white' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className={`${NEXT_BUTTON_CLASS} disabled:cursor-not-allowed`}
          style={!canSubmit
            ? { background: 'rgb(55 65 81)' }
            : { background: accentColor ? `linear-gradient(to right, ${accentColor}, ${accentColor}dd)` : 'linear-gradient(to right, rgb(244 63 94), rgb(219 39 119))' }}
        >
          Next
        </button>
        {onSkip && (
          <button
            onClick={onSkip}
            className="h-12 px-6 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-base font-medium rounded-full border border-white/10 transition-all duration-200"
          >
            {question.skipLabel || 'Skip'}
          </button>
        )}
      </div>
    </div>
  );
}

function TapOptionsRenderer({
  question,
  ctx,
  selectedOption,
  onOptionClick,
}: {
  question: TapQuestion;
  ctx: QuestionContext;
  selectedOption: number | null;
  onOptionClick: (index: number, value: string) => void;
}) {
  const options = typeof question.options === 'function' ? question.options(ctx) : question.options;
  return (
    <div className="space-y-3">
      {(options ?? []).map((option, index) => (
        <button
          key={index}
          onClick={() => onOptionClick(index, option.value || option.text)}
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
}

function GridRenderer({
  question,
  selectedOptions,
  onToggle,
  customEntries,
  setCustomEntries,
  customInput,
  setCustomInput,
  onSubmit,
  autoSubmit = false,
  accentColor,
}: {
  question: GridQuestion;
  selectedOptions: number[];
  onToggle: (index: number) => void;
  customEntries: string[];
  setCustomEntries: (v: string[]) => void;
  customInput: string;
  setCustomInput: (v: string) => void;
  onSubmit: () => void;
  autoSubmit?: boolean;
  accentColor?: string;
}) {
  const totalSelected = selectedOptions.length + customEntries.length;
  const minSel = question.minSelections ?? 0;
  const meetsMin = totalSelected >= minSel;
  const canSkip = minSel === 0 && totalSelected === 0;
  const cols = question.columns ?? 3;
  const gridClass = cols === 4 ? 'grid grid-cols-2 sm:grid-cols-4' : cols === 2 ? 'grid grid-cols-2' : 'grid grid-cols-2 sm:grid-cols-3';

  const selectedBorder = accentColor ? `${accentColor}99` : 'rgb(244 63 94 / 0.6)';
  const selectedBg = accentColor ? `${accentColor}33` : 'rgb(136 19 55 / 0.2)';
  const selectedText = accentColor || 'rgb(253 164 175)';

  return (
    <div className="space-y-4">
      {minSel > 0 && (
        <p className="text-sm text-gray-500 text-center">
          {totalSelected >= minSel
            ? `${totalSelected} selected`
            : `Select ${minSel - totalSelected} more`}
        </p>
      )}

      <div className={`${gridClass} gap-2.5 max-h-72 overflow-y-auto pr-1 custom-scroll`}>
        {question.options.map((option, index) => {
          const Icon = loadIcon(option.icon || '');
          const isSelected = selectedOptions.includes(index);
          return (
            <button
              key={index}
              onClick={() => onToggle(index)}
              className={`flex flex-col items-center gap-2 px-4 py-4 rounded-2xl border-2 transition-all duration-200 ${
                isSelected
                  ? 'text-white'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] text-white'
              }`}
              style={isSelected ? { borderColor: selectedBorder, backgroundColor: selectedBg } : undefined}
            >
              {option.color && (
                <div
                  className="w-8 h-8 rounded-full border-2 border-white/20"
                  style={{ backgroundColor: option.color }}
                />
              )}
              {Icon && !option.color && <Icon className="w-6 h-6" />}
              <span className="text-xs font-medium text-center">{option.label}</span>
              {isSelected && <Check className="w-4 h-4" style={{ color: selectedText }} />}
            </button>
          );
        })}
      </div>

      {question.allowCustom && customEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customEntries.map(entry => (
            <span
              key={entry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-900/30 border border-rose-500/40 text-rose-300 text-xs font-medium"
            >
              {entry}
              <button
                onClick={() => setCustomEntries(customEntries.filter(e => e !== entry))}
                className="text-rose-400 hover:text-rose-200"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {question.allowCustom && (
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && customInput.trim()) {
                setCustomEntries([...customEntries, customInput.trim()]);
                setCustomInput('');
              }
            }}
            placeholder="Add your own..."
            className="flex-1 px-4 py-2.5 text-sm bg-white/5 border-2 border-white/10 text-white placeholder-gray-600 rounded-xl focus:border-rose-400/40 focus:outline-none transition-all"
          />
          <button
            onClick={() => {
              if (customInput.trim()) {
                setCustomEntries([...customEntries, customInput.trim()]);
                setCustomInput('');
              }
            }}
            disabled={!customInput.trim()}
            className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-rose-500 hover:bg-rose-600 disabled:bg-white/10 disabled:cursor-not-allowed text-white"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {!autoSubmit && (
        <div className="flex justify-center">
        <button
          onClick={onSubmit}
          disabled={!meetsMin && !canSkip}
          className={`${NEXT_BUTTON_CLASS} whitespace-nowrap disabled:cursor-not-allowed`}
          style={!meetsMin && !canSkip
            ? { background: 'rgb(255 255 255 / 0.05)', opacity: 0.5 }
            : canSkip
              ? { background: 'rgb(255 255 255 / 0.1)' }
              : { background: `linear-gradient(to right, ${accentColor || 'rgb(244 63 94)'}, ${accentColor ? accentColor + 'dd' : 'rgb(219 39 119)'})` }}
        >
          {canSkip ? 'Skip' : meetsMin ? 'Continue' : `Select ${minSel - totalSelected} more`}
        </button>
        </div>
      )}
    </div>
  );
}

function PreviewRenderer({
  question,
  onSelect,
  selectedOption,
  setSelectedOption,
}: {
  question: PreviewQuestion;
  onSelect: (value: string | string[]) => void;
  selectedOption: number | null;
  setSelectedOption: (v: number | null) => void;
}) {
  const max = question.pickUpTo ?? 1;
  // More than one allowed: taps add and remove, in the order they were made, and Next sends the list.
  const [picked, setPicked] = useState<number[]>([]);
  const multi = max > 1;
  const bubbleButton = (bubble: PreviewQuestion['bubbles'][number], index: number) => {
    const rank = picked.indexOf(index);
    const on = multi ? rank >= 0 : selectedOption === index;
    return (
      <button
        key={index}
        onClick={() => {
          if (multi) {
            setPicked(prev => prev.includes(index) ? prev.filter(i => i !== index) : prev.length >= max ? prev : [...prev, index]);
            return;
          }
          setSelectedOption(index);
          setTimeout(() => {
            onSelect(bubble.value);
            setSelectedOption(null);
          }, 400);
        }}
        disabled={!multi && selectedOption !== null}
        aria-pressed={multi ? on : undefined}
        className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
          on
            ? 'border-green-500/60 bg-green-900/20'
            : 'border-white/10 bg-white/[0.03] hover:border-rose-400/40 hover:bg-white/[0.06]'
        } ${!multi && selectedOption !== null && selectedOption !== index ? 'opacity-40' : ''} ${multi && !on && picked.length >= max ? 'opacity-50' : ''}`}
      >
        <p className="text-xs text-rose-400/70 font-semibold mb-2 uppercase tracking-wider">
          {bubble.voice}{multi && rank === 0 && picked.length > 1 ? ' · main' : ''}{multi && rank === 1 ? ' · and a bit of this' : ''}
        </p>
        <div className="space-y-1.5">
          {bubble.messages.map((msg, i) => (
            <div
              key={i}
              className="inline-block px-4 py-2.5 rounded-2xl rounded-bl-md text-sm text-white"
              style={{
                background: 'linear-gradient(135deg, rgba(244,63,94,0.15) 0%, rgba(251,113,133,0.1) 100%)',
                border: '1px solid rgba(244,63,94,0.15)',
              }}
            >
              {msg}
            </div>
          ))}
        </div>
        {on && <Check className="w-5 h-5 text-green-400 mt-2" />}
      </button>
    );
  };
  return (
    <div className="space-y-3">
      {question.bubbles.map(bubbleButton)}
      {multi && (
        <div className="flex flex-col items-center gap-2 pt-1">
          {question.pickHint && <p className="text-sm text-gray-500">{question.pickHint}</p>}
          <button
            onClick={() => onSelect(picked.map(i => question.bubbles[i].value))}
            disabled={picked.length === 0}
            className={`${NEXT_BUTTON_CLASS} disabled:cursor-not-allowed`}
            style={picked.length === 0 ? { background: 'rgb(55 65 81)' } : { background: 'linear-gradient(to right, rgb(244 63 94), rgb(219 39 119))' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function ScrubRenderer({
  question,
  value,
  onChange,
  onSubmit,
  trackRef,
  ctx,
}: {
  question: ScrubQuestion;
  value: number;
  onChange: (v: number) => void;
  onSubmit: () => void;
  trackRef: React.RefObject<HTMLDivElement>;
  ctx: QuestionContext;
}) {
  const { config } = question;
  const leftLabel = tpl(config.leftLabel, ctx);
  const rightLabel = tpl(config.rightLabel, ctx);
  const valueLabels = config.valueLabels.map(l => tpl(l, ctx));
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);

  const computeValueFromPointer = useCallback((clientX: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newValue = Math.round(ratio * config.max);
    onChange(newValue);
  }, [config.max, onChange, trackRef]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    setIsDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    computeValueFromPointer(e.clientX);
  }, [computeValueFromPointer]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    computeValueFromPointer(e.clientX);
  }, [computeValueFromPointer]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    draggingRef.current = false;
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(Math.max(0, value - 1));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(Math.min(config.max, value + 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    }
  }, [config.max, value, onChange, onSubmit]);

  return (
    <div className="space-y-8 py-4">
      <div className="text-center">
        <motion.div
          key={value}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-white"
        >
          {valueLabels[value]}
        </motion.div>
      </div>

      <div className="relative px-4">
        <div className="flex justify-between text-xs text-gray-500 mb-3">
          <span>{leftLabel}</span>
          <span>{rightLabel}</span>
        </div>
        <div
          ref={trackRef}
          className="relative h-8 flex items-center cursor-pointer touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          <div className="absolute inset-x-0 h-2 bg-white/10 rounded-full">
            <div
              className="absolute h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all"
              style={{ width: `${(value / config.max) * 100}%` }}
            />
          </div>
          <div
            className="absolute w-6 h-6 rounded-full bg-white shadow-lg pointer-events-none transition-transform"
            style={{
              left: `calc(${(value / config.max) * 100}% - 12px)`,
              transform: isDragging ? 'scale(1.2)' : 'scale(1)',
            }}
          />
        </div>
        <input
          type="range"
          min={config.min}
          max={config.max}
          step={config.step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          onKeyDown={handleKeyDown}
          className="sr-only"
          aria-label={valueLabels[value]}
          aria-valuetext={valueLabels[value]}
        />
      </div>

      <div className="flex justify-center">
        <button
          onClick={onSubmit}
          className={`${NEXT_BUTTON_CLASS} bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 hover:shadow-xl`}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function SwipeRenderer({
  question,
  cardIndex,
  dragX,
  direction,
  onDragStart,
  onDragMove,
  onDragEnd,
  onSwipe,
  cardRef,
}: {
  question: SwipeQuestion;
  cardIndex: number;
  dragX: number;
  direction: 'left' | 'right' | null;
  onDragStart: (x: number) => void;
  onDragMove: (x: number) => void;
  onDragEnd: () => void;
  onSwipe: (dir: 'left' | 'right') => void;
  cardRef: React.RefObject<HTMLDivElement>;
}) {
  const card = question.cards[cardIndex];
  if (!card) return null;
  const rotation = dragX * 0.05;
  const opacity = Math.max(0, 1 - Math.abs(dragX) / 400);
  const LeftIcon = loadIcon(card.left.icon || '') || Heart;
  const RightIcon = loadIcon(card.right.icon || '') || Check;
  const isAnimating = direction !== null;

  const handleTap = (e: React.MouseEvent, dir: 'left' | 'right') => {
    e.stopPropagation();
    if (isAnimating) return;
    if (Math.abs(dragX) > 10) return;
    onSwipe(dir);
  };

  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div
        ref={cardRef}
        className="w-full max-w-sm min-h-[22rem] rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl flex flex-col items-center justify-center p-8 cursor-grab active:cursor-grabbing"
        style={{
          x: dragX,
          rotate: rotation,
          opacity: direction ? 0 : opacity,
        }}
        drag
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.7}
        onDragStart={(_, info) => onDragStart(info.point.x)}
        onDrag={(_, info) => onDragMove(info.point.x)}
        onDragEnd={() => onDragEnd()}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex gap-4 w-full justify-center items-stretch">
          <button
            onClick={(e) => handleTap(e, 'left')}
            className="flex-1 flex flex-col items-center justify-center gap-3 px-5 py-8 rounded-2xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all min-h-[12rem]"
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 flex items-center justify-center">
              <LeftIcon className="w-6 h-6 text-rose-400" />
            </div>
            <span className="text-sm text-gray-300 font-medium text-center leading-snug">{card.left.label}</span>
          </button>
          <button
            onClick={(e) => handleTap(e, 'right')}
            className="flex-1 flex flex-col items-center justify-center gap-3 px-5 py-8 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all min-h-[12rem]"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
              <RightIcon className="w-6 h-6 text-emerald-400" />
            </div>
            <span className="text-sm text-gray-300 font-medium text-center leading-snug">{card.right.label}</span>
          </button>
        </div>

        <p className="text-xs text-gray-600 mt-6">Swipe or tap a side</p>
      </motion.div>

      <div className="text-xs text-gray-600">
        {cardIndex + 1} of {question.cards.length}
      </div>
    </div>
  );
}

function BeatRenderer({
  text,
  visible,
  confirmLabel,
  accentColor,
  progress,
  chapterLabel,
  chapterIndex,
  totalChapters,
  onBack,
  onConfirm,
}: {
  text: string;
  visible: boolean;
  showOrb?: boolean;
  renderOrb?: () => ReactNode;
  confirmLabel?: string;
  accentColor?: string;
  progress: number;
  chapterLabel: string;
  chapterIndex: number;
  totalChapters: number;
  onBack?: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#080b14] flex flex-col items-center justify-center p-6 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full blur-[120px] ${accentColor ? '' : 'bg-rose-600/5'}`}
          style={accentColor ? { backgroundColor: `${accentColor}14` } : undefined}
        />
        <div
          className={`absolute bottom-[-10%] right-[10%] w-[500px] h-[400px] rounded-full blur-[100px] ${accentColor ? '' : 'bg-pink-600/5'}`}
          style={accentColor ? { backgroundColor: `${accentColor}0f` } : undefined}
        />
      </div>

      <div className="max-w-2xl w-full relative z-10">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-4 flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}

        <ProgressBar
          progress={progress}
          chapterLabel={chapterLabel}
          chapterIndex={chapterIndex}
          totalChapters={totalChapters}
          accentColor={accentColor}
        />

        <div className="bg-white/[0.03] border border-white/10 rounded-3xl shadow-2xl p-8 md:p-10 overflow-hidden relative mt-6">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 20 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                className="mb-6"
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: visible ? 1 : 0, rotate: visible ? 0 : -45 }}
                transition={{ duration: 0.5, delay: 0.15, type: 'spring', stiffness: 200 }}
              >
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{
                    background: accentColor ? `${accentColor}22` : 'rgba(244,63,94,0.15)',
                    border: `1px solid ${accentColor ? accentColor + '44' : 'rgba(244,63,94,0.3)'}`,
                  }}
                >
                  <Sparkles
                    className="w-6 h-6"
                    style={{ color: accentColor || 'rgb(244 63 94)' }}
                  />
                </div>
              </motion.div>

              <motion.p
                className="text-xl md:text-2xl font-bold text-white max-w-lg leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: visible ? 1 : 0 }}
                transition={{ duration: 0.4, delay: 0.25 }}
              >
                {text}
              </motion.p>

              <motion.button
                onClick={onConfirm}
                className={`mt-8 ${NEXT_BUTTON_CLASS} hover:scale-[1.02]`}
                style={{
                  background: accentColor
                    ? `linear-gradient(to right, ${accentColor}, ${accentColor}dd)`
                    : 'linear-gradient(to right, rgb(244 63 94), rgb(219 39 119))',
                }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }}
                transition={{ duration: 0.4, delay: 0.4 }}
              >
                {confirmLabel || 'Continue'}
              </motion.button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
