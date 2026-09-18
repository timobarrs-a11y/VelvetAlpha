import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Check, Plus, X, Heart,
  BookOpen, Gamepad2, Utensils, MapPin, Camera, Palette, PenTool, Music,
  Film, Dumbbell, Sprout, Compass, ShoppingBag, Cpu, Puzzle, Wrench,
  TrendingUp, Trophy, Tv, Wine, Building, Moon, Car, Home, Sunrise,
} from 'lucide-react';
import type {
  Question,
  QuestionContext,
  QuestionnaireDefinition,
  TapQuestion,
  GridQuestion,
  SwipeQuestion,
  ScrubQuestion,
  PreviewQuestion,
  BeatQuestion,
} from './types';
import { resolveQuestionText } from './companionBank';
import { tpl } from './pronouns';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  BookOpen, Gamepad2, Utensils, MapPin, Camera, Palette, PenTool, Music,
  Film, Dumbbell, Heart, Sprout, Compass, ShoppingBag, Cpu, Puzzle, Wrench,
  TrendingUp, Trophy, Tv, Wine, Building, Moon, Car, Home, Sunrise,
};

function loadIcon(name: string): React.ComponentType<{ className?: string; size?: number }> | null {
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
}

export function QuestionnaireShell({
  definition,
  context,
  onComplete,
  onAnswer,
  onBack,
  showOrb = false,
  renderOrb,
}: QuestionnaireShellProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
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
  const dragStartRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const scrubTrackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const questions = definition.questions;
  const question = questions[currentIdx];
  const totalQuestions = questions.length;
  const startProgress = definition.startProgress ?? 0;
  const progress = startProgress + ((currentIdx + 1) / totalQuestions) * (100 - startProgress);

  const ctx: QuestionContext = { ...context, answers };

  const currentChapter = definition.chapters.find(ch =>
    ch.questionIds.includes(question?.id)
  );

  const chapterIndex = currentChapter
    ? definition.chapters.indexOf(currentChapter)
    : 0;

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
      if (Array.isArray(existing)) {
        const presetValues = gridQ.options.map(o => o.value);
        const indices = existing
          .map(v => presetValues.indexOf(v))
          .filter(i => i >= 0);
        const customs = existing.filter(v => !presetValues.includes(v));
        setSelectedGridOptions(indices);
        setCustomEntries(customs);
      } else {
        setSelectedGridOptions([]);
        setCustomEntries([]);
      }
      setCustomInput('');
    }
    if (question?.archetype === 'tap' && !(question as TapQuestion).options) {
      const existing = answers[question.id] as string | undefined;
      if (existing) setTextInput(existing);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (question?.archetype === 'beat') {
      setBeatVisible(true);
      const beatQ = question as BeatQuestion;
      const duration = beatQ.beat.durationMs ?? 1500;
      setTimeout(() => {
        setBeatVisible(false);
        advance();
      }, duration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  const advance = useCallback(() => {
    if (currentIdx >= totalQuestions - 1) {
      onComplete(answers);
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
    setTimeout(() => advance(), question.archetype === 'tap' ? 350 : 100);
  };

  const handleBack = () => {
    if (currentIdx > 0) {
      const prevIdx = currentIdx - 1;
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
    setSelectedGridOptions(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleGridSubmit = () => {
    const gridQ = question as GridQuestion;
    const selectedValues = selectedGridOptions
      .map(i => gridQ.options[i]?.value)
      .filter(Boolean) as string[];
    handleAnswer([...selectedValues, ...customEntries]);
    setSelectedGridOptions([]);
    setCustomEntries([]);
  };

  const handleScrubChange = (value: number) => {
    setScrubValue(value);
  };

  const handleScrubSubmit = () => {
    const scrubQ = question as ScrubQuestion;
    const label = tpl(scrubQ.config.valueLabels[scrubValue] || String(scrubValue), ctx);
    handleAnswer(label);
  };

  const handleSwipeComplete = (direction: 'left' | 'right') => {
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
        advance();
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

  const questionText = resolveQuestionText(question, ctx);

  if (question.archetype === 'beat') {
    const beatQ = question as BeatQuestion;
    const beatText = tpl(beatQ.beat.template(ctx), ctx);
    return (
      <BeatRenderer
        text={beatText}
        visible={beatVisible}
        showOrb={showOrb}
        renderOrb={renderOrb}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080b14] flex flex-col items-center justify-center p-6 relative">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-rose-600/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[500px] h-[400px] rounded-full bg-pink-600/5 blur-[100px]" />
      </div>

      {showOrb && renderOrb && (
        <div className="relative z-10 mb-6">
          {renderOrb()}
        </div>
      )}

      <div className="max-w-2xl w-full relative z-10">
        {currentIdx > 0 && (
          <button
            onClick={handleBack}
            className="mb-4 flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
            <span className="text-sm font-medium">Back</span>
          </button>
        )}

        <ProgressBar
          progress={progress}
          chapterLabel={currentChapter ? tpl(currentChapter.label, ctx) : ''}
          chapterIndex={chapterIndex}
          totalChapters={definition.chapters.length}
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
              <motion.h2
                className="text-2xl md:text-3xl font-bold text-white text-center mb-8 tracking-tight leading-snug"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
              >
                {questionText}
              </motion.h2>

              {question.archetype === 'tap' && !(question as TapQuestion).options && (
                <TapTextRenderer
                  question={question as TapQuestion}
                  textInput={textInput}
                  setTextInput={setTextInput}
                  onSubmit={() => textInput.trim() && handleAnswer(textInput.trim())}
                  inputRef={inputRef}
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
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({
  progress,
  chapterLabel,
  chapterIndex,
  totalChapters,
}: {
  progress: number;
  chapterLabel: string;
  chapterIndex: number;
  totalChapters: number;
}) {
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
          className="bg-gradient-to-r from-rose-500 to-pink-500 h-1.5 rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

function TapTextRenderer({
  question,
  textInput,
  setTextInput,
  onSubmit,
  inputRef,
}: {
  question: TapQuestion;
  textInput: string;
  setTextInput: (v: string) => void;
  onSubmit: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const isDate = question.id === 'birthday';
  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type={isDate ? 'date' : 'text'}
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        placeholder={question.placeholder}
        className="w-full px-6 py-4 text-xl bg-white/5 border-2 border-white/10 text-white placeholder-gray-600 rounded-2xl focus:border-rose-400/60 focus:outline-none focus:ring-4 focus:ring-rose-500/15 transition-all duration-200"
        autoFocus
      />
      <button
        onClick={onSubmit}
        disabled={!textInput.trim() && !isDate}
        className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-800 text-white text-lg font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:transform-none disabled:text-gray-500"
      >
        Next
      </button>
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
      {options.map((option, index) => (
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
}: {
  question: GridQuestion;
  selectedOptions: number[];
  onToggle: (index: number) => void;
  customEntries: string[];
  setCustomEntries: (v: string[]) => void;
  customInput: string;
  setCustomInput: (v: string) => void;
  onSubmit: () => void;
}) {
  const totalSelected = selectedOptions.length + customEntries.length;
  const minSel = question.minSelections ?? 0;
  const meetsMin = totalSelected >= minSel;
  const canSkip = minSel === 0 && totalSelected === 0;
  const cols = question.columns ?? 3;
  const gridClass = cols === 4 ? 'grid grid-cols-2 sm:grid-cols-4' : cols === 2 ? 'grid grid-cols-2' : 'grid grid-cols-2 sm:grid-cols-3';

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
                  ? 'border-rose-500/60 bg-rose-900/20 text-rose-300'
                  : 'border-white/10 bg-white/[0.03] hover:border-rose-400/30 hover:bg-white/[0.06] text-white'
              }`}
            >
              {option.color && (
                <div
                  className="w-8 h-8 rounded-full border-2 border-white/20"
                  style={{ backgroundColor: option.color }}
                />
              )}
              {Icon && !option.color && <Icon className="w-6 h-6" />}
              <span className="text-xs font-medium text-center">{option.label}</span>
              {isSelected && <Check className="w-4 h-4 text-rose-400" />}
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

      <button
        onClick={onSubmit}
        disabled={!meetsMin && !canSkip}
        className={`w-full py-4 text-white text-lg font-bold rounded-2xl shadow-lg transition-all duration-200 transform ${
          meetsMin
            ? 'bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 hover:scale-[1.01]'
            : canSkip
              ? 'bg-white/10 hover:bg-white/15 hover:scale-[1.01]'
              : 'bg-white/5 cursor-not-allowed opacity-50'
        }`}
      >
        {canSkip ? 'Skip' : meetsMin ? 'Continue' : `Select ${minSel - totalSelected} more`}
      </button>
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
  onSelect: (value: string) => void;
  selectedOption: number | null;
  setSelectedOption: (v: number | null) => void;
}) {
  return (
    <div className="space-y-3">
      {question.bubbles.map((bubble, index) => (
        <button
          key={index}
          onClick={() => {
            setSelectedOption(index);
            setTimeout(() => {
              onSelect(bubble.value);
              setSelectedOption(null);
            }, 400);
          }}
          disabled={selectedOption !== null}
          className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-200 ${
            selectedOption === index
              ? 'border-green-500/60 bg-green-900/20'
              : 'border-white/10 bg-white/[0.03] hover:border-rose-400/40 hover:bg-white/[0.06]'
          } ${selectedOption !== null && selectedOption !== index ? 'opacity-40' : ''}`}
        >
          <p className="text-xs text-rose-400/70 font-semibold mb-2 uppercase tracking-wider">{bubble.voice}</p>
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
          {selectedOption === index && <Check className="w-5 h-5 text-green-400 mt-2" />}
        </button>
      ))}
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
  trackRef: React.RefObject<HTMLDivElement | null>;
  ctx: QuestionContext;
}) {
  const { config } = question;
  const leftLabel = tpl(config.leftLabel, ctx);
  const rightLabel = tpl(config.rightLabel, ctx);
  const valueLabels = config.valueLabels.map(l => tpl(l, ctx));
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
        <div ref={trackRef} className="relative h-2 bg-white/10 rounded-full">
          <div
            className="absolute h-full rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all"
            style={{ width: `${(value / config.max) * 100}%` }}
          />
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-lg cursor-grab active:cursor-grabbing"
            style={{ left: `calc(${(value / config.max) * 100}% - 12px)` }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0}
            onDrag={(_, info) => {
              const trackWidth = trackRef.current?.offsetWidth || 300;
              const newValue = Math.round(Math.max(0, Math.min(config.max, value + (info.delta.x / trackWidth) * config.max)));
              onChange(newValue);
            }}
          />
        </div>
      </div>

      <button
        onClick={onSubmit}
        className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-lg font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.01]"
      >
        Next
      </button>
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
  cardRef: React.RefObject<HTMLDivElement | null>;
}) {
  const card = question.cards[cardIndex];
  if (!card) return null;
  const rotation = dragX * 0.05;
  const opacity = Math.max(0, 1 - Math.abs(dragX) / 400);

  return (
    <div className="relative h-80 flex items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex gap-3 mb-4">
          <button
            onClick={() => onSwipe('left')}
            className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
          >
            {card.left.label}
          </button>
          <button
            onClick={() => onSwipe('right')}
            className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all text-sm font-medium"
          >
            {card.right.label}
          </button>
        </div>
      </div>

      <motion.div
        ref={cardRef}
        className="absolute w-full max-w-sm h-72 rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl flex flex-col items-center justify-center p-8 cursor-grab active:cursor-grabbing"
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
        <p className="text-lg text-white text-center mb-8 font-medium">{card.prompt}</p>
        <div className="flex gap-8">
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
              <Heart className="w-5 h-5 text-rose-400" />
            </div>
            <span className="text-xs text-gray-500">{card.left.label}</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-xs text-gray-500">{card.right.label}</span>
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-6">Swipe or tap a side</p>
      </motion.div>

      <div className="absolute -bottom-2 text-xs text-gray-600">
        {cardIndex + 1} of {question.cards.length}
      </div>
    </div>
  );
}

function BeatRenderer({
  text,
  visible,
  showOrb,
  renderOrb,
}: {
  text: string;
  visible: boolean;
  showOrb?: boolean;
  renderOrb?: () => ReactNode;
}) {
  return (
    <motion.div
      className="min-h-screen bg-[#080b14] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.4 }}
    >
      {showOrb && renderOrb && (
        <div className="mb-6">{renderOrb()}</div>
      )}
      <motion.p
        className="text-2xl md:text-3xl font-bold text-white text-center max-w-lg px-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 12 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {text}
      </motion.p>
    </motion.div>
  );
}
