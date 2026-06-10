import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles, Brain, Zap, Activity, ArrowRight, Check } from 'lucide-react';
import { saveReflectionAtom } from '../services/reflectionAtomService';
import { toast } from '../shared/ui/Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'situation' | 'thought' | 'emotion' | 'body' | 'behavior' | 'outcome' | 'review';

const STEP_ORDER: Step[] = ['situation', 'thought', 'emotion', 'body', 'behavior', 'outcome', 'review'];

const EMOTIONS = [
  'anxious', 'sad', 'angry', 'frustrated', 'overwhelmed',
  'hopeful', 'calm', 'guilty', 'ashamed', 'lonely',
  'happy', 'relieved', 'confused', 'scared', 'numb',
];

const BODY_SIGNALS = [
  'tight chest', 'racing heart', 'heavy shoulders', 'stomach knot',
  'shallow breathing', 'clenched jaw', 'headache', 'fatigue',
  'restless', 'nothing noticeable',
];

const INTENSITY_LABELS: Record<number, string> = {
  1: 'Barely there',
  2: 'Very mild',
  3: 'Mild',
  4: 'Noticeable',
  5: 'Moderate',
  6: 'Getting strong',
  7: 'Strong',
  8: 'Very strong',
  9: 'Intense',
  10: 'Overwhelming',
};

export function CBTReflectionModal({ open, onClose, onSaved }: Props) {
  const [step, setStep] = useState<Step>('situation');
  const [saving, setSaving] = useState(false);

  const [situation, setSituation] = useState('');
  const [automaticThought, setAutomaticThought] = useState('');
  const [emotion, setEmotion] = useState('');
  const [customEmotion, setCustomEmotion] = useState('');
  const [emotionIntensity, setEmotionIntensity] = useState(5);
  const [bodySignal, setBodySignal] = useState('');
  const [behavior, setBehavior] = useState('');
  const [outcome, setOutcome] = useState('');

  const currentIndex = STEP_ORDER.indexOf(step);
  const progress = ((currentIndex) / (STEP_ORDER.length - 1)) * 100;

  const resolvedEmotion = emotion === '__custom__' ? customEmotion.trim() : emotion;

  function reset() {
    setStep('situation');
    setSituation('');
    setAutomaticThought('');
    setEmotion('');
    setCustomEmotion('');
    setEmotionIntensity(5);
    setBodySignal('');
    setBehavior('');
    setOutcome('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function canAdvance(): boolean {
    switch (step) {
      case 'situation': return situation.trim().length > 0;
      case 'thought': return true;
      case 'emotion': return resolvedEmotion.length > 0;
      case 'body': return true;
      case 'behavior': return true;
      case 'outcome': return true;
      case 'review': return true;
    }
  }

  function advance() {
    const next = STEP_ORDER[currentIndex + 1];
    if (next) setStep(next);
  }

  function back() {
    const prev = STEP_ORDER[currentIndex - 1];
    if (prev) setStep(prev);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await saveReflectionAtom({
        situation: situation.trim() || undefined,
        automaticThought: automaticThought.trim() || undefined,
        emotion: resolvedEmotion || undefined,
        emotionIntensity,
        bodySignal: bodySignal || undefined,
        behavior: behavior.trim() || undefined,
        outcome: outcome.trim() || undefined,
      });
      toast.success('Reflection saved');
      reset();
      onSaved();
      onClose();
    } catch {
      toast.error('Could not save reflection — please try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
          >
            <div
              className="pointer-events-auto w-full sm:max-w-lg bg-[#0d1424] border border-white/8 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
              style={{ maxHeight: '90dvh' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Brain className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-semibold leading-none">Log a Reflection</p>
                    <p className="text-white/35 text-xs mt-0.5">
                      Step {currentIndex + 1} of {STEP_ORDER.length}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/8 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 pb-3 shrink-0">
                <div className="w-full h-0.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-amber-500 rounded-full"
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 pb-5">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -16 }}
                    transition={{ duration: 0.18 }}
                  >
                    {step === 'situation' && (
                      <StepWrapper
                        icon={<Zap className="w-4 h-4 text-sky-400" />}
                        iconBg="bg-sky-500/10 border-sky-500/20"
                        title="What happened?"
                        hint="Describe the moment or situation that shifted your mood. Just the facts — no interpretation needed."
                      >
                        <textarea
                          autoFocus
                          rows={4}
                          value={situation}
                          onChange={(e) => setSituation(e.target.value.slice(0, 500))}
                          placeholder="e.g. My manager asked me to redo the report I spent three hours on..."
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-sky-500/40 focus:bg-white/[0.06] transition-all"
                        />
                        <div className="flex justify-end mt-1">
                          <span className={`text-xs ${situation.length >= 480 ? 'text-amber-400' : 'text-white/20'}`}>
                            {situation.length}/500
                          </span>
                        </div>
                      </StepWrapper>
                    )}

                    {step === 'thought' && (
                      <StepWrapper
                        icon={<Brain className="w-4 h-4 text-amber-400" />}
                        iconBg="bg-amber-500/10 border-amber-500/20"
                        title="What went through your mind?"
                        hint="The first thought or interpretation that came up. It doesn't have to be rational — just honest."
                        optional
                      >
                        <textarea
                          autoFocus
                          rows={3}
                          value={automaticThought}
                          onChange={(e) => setAutomaticThought(e.target.value.slice(0, 300))}
                          placeholder="e.g. My work is never good enough. I should just give up..."
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-amber-500/40 focus:bg-white/[0.06] transition-all"
                        />
                        <div className="flex justify-end mt-1">
                          <span className={`text-xs ${automaticThought.length >= 280 ? 'text-amber-400' : 'text-white/20'}`}>
                            {automaticThought.length}/300
                          </span>
                        </div>
                      </StepWrapper>
                    )}

                    {step === 'emotion' && (
                      <StepWrapper
                        icon={<Sparkles className="w-4 h-4 text-rose-400" />}
                        iconBg="bg-rose-500/10 border-rose-500/20"
                        title="What emotion was strongest?"
                        hint="Pick what fits best, or type your own."
                      >
                        <div className="flex flex-wrap gap-2 mb-4">
                          {EMOTIONS.map((e) => (
                            <button
                              key={e}
                              onClick={() => setEmotion(emotion === e ? '' : e)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                emotion === e
                                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                  : 'bg-white/[0.04] border-white/8 text-white/50 hover:text-white hover:border-white/20'
                              }`}
                            >
                              {e}
                            </button>
                          ))}
                          <button
                            onClick={() => setEmotion(emotion === '__custom__' ? '' : '__custom__')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                              emotion === '__custom__'
                                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                                : 'bg-white/[0.04] border-white/8 text-white/50 hover:text-white hover:border-white/20'
                            }`}
                          >
                            + other
                          </button>
                        </div>

                        {emotion === '__custom__' && (
                          <input
                            autoFocus
                            type="text"
                            value={customEmotion}
                            onChange={(e) => setCustomEmotion(e.target.value)}
                            placeholder="Name the emotion..."
                            className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-rose-500/40 focus:bg-white/[0.06] transition-all mb-4"
                          />
                        )}

                        {resolvedEmotion && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-white/40 text-xs">Intensity</span>
                              <span className="text-white text-xs font-medium">
                                {emotionIntensity}/10 — {INTENSITY_LABELS[emotionIntensity]}
                              </span>
                            </div>
                            <input
                              type="range"
                              min={1}
                              max={10}
                              value={emotionIntensity}
                              onChange={(e) => setEmotionIntensity(Number(e.target.value))}
                              className="w-full accent-rose-500"
                            />
                            <div className="flex justify-between text-white/20 text-xs mt-1">
                              <span>1</span>
                              <span>10</span>
                            </div>
                          </div>
                        )}
                      </StepWrapper>
                    )}

                    {step === 'body' && (
                      <StepWrapper
                        icon={<Activity className="w-4 h-4 text-emerald-400" />}
                        iconBg="bg-emerald-500/10 border-emerald-500/20"
                        title="Where did you feel it?"
                        hint="Physical sensations are often the earliest signals. Pick any that apply."
                        optional
                      >
                        <div className="flex flex-wrap gap-2">
                          {BODY_SIGNALS.map((s) => (
                            <button
                              key={s}
                              onClick={() => setBodySignal(bodySignal === s ? '' : s)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                bodySignal === s
                                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                  : 'bg-white/[0.04] border-white/8 text-white/50 hover:text-white hover:border-white/20'
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </StepWrapper>
                    )}

                    {step === 'behavior' && (
                      <StepWrapper
                        icon={<ArrowRight className="w-4 h-4 text-sky-400" />}
                        iconBg="bg-sky-500/10 border-sky-500/20"
                        title="What did you do next?"
                        hint="Your response or reaction. No judgment here — just what actually happened."
                        optional
                      >
                        <textarea
                          autoFocus
                          rows={3}
                          value={behavior}
                          onChange={(e) => setBehavior(e.target.value.slice(0, 300))}
                          placeholder="e.g. I went quiet, avoided eye contact, and started redoing it without asking why..."
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-sky-500/40 focus:bg-white/[0.06] transition-all"
                        />
                        <div className="flex justify-end mt-1">
                          <span className={`text-xs ${behavior.length >= 280 ? 'text-amber-400' : 'text-white/20'}`}>
                            {behavior.length}/300
                          </span>
                        </div>
                      </StepWrapper>
                    )}

                    {step === 'outcome' && (
                      <StepWrapper
                        icon={<Check className="w-4 h-4 text-teal-400" />}
                        iconBg="bg-teal-500/10 border-teal-500/20"
                        title="How did that turn out?"
                        hint="What happened as a result? Did it help, hurt, or leave things the same?"
                        optional
                      >
                        <textarea
                          autoFocus
                          rows={3}
                          value={outcome}
                          onChange={(e) => setOutcome(e.target.value.slice(0, 300))}
                          placeholder="e.g. The report got approved but I felt worse about myself afterward..."
                          className="w-full bg-white/[0.04] border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-teal-500/40 focus:bg-white/[0.06] transition-all"
                        />
                        <div className="flex justify-end mt-1">
                          <span className={`text-xs ${outcome.length >= 280 ? 'text-amber-400' : 'text-white/20'}`}>
                            {outcome.length}/300
                          </span>
                        </div>
                      </StepWrapper>
                    )}

                    {step === 'review' && (
                      <div>
                        <div className="mb-4">
                          <p className="text-white text-sm font-semibold mb-0.5">Ready to save</p>
                          <p className="text-white/35 text-xs">Review your reflection before logging it.</p>
                        </div>
                        <div className="space-y-2">
                          {situation && <ReviewRow label="What happened" value={situation} />}
                          {automaticThought && <ReviewRow label="Thought" value={automaticThought} />}
                          {resolvedEmotion && (
                            <ReviewRow label="Emotion" value={`${resolvedEmotion} (${emotionIntensity}/10)`} />
                          )}
                          {bodySignal && <ReviewRow label="Body signal" value={bodySignal} />}
                          {behavior && <ReviewRow label="What you did" value={behavior} />}
                          {outcome && <ReviewRow label="Outcome" value={outcome} />}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-3 shrink-0 border-t border-white/5">
                {currentIndex > 0 ? (
                  <button
                    onClick={back}
                    className="flex items-center gap-1.5 text-white/40 hover:text-white text-sm transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                ) : (
                  <div />
                )}

                {step === 'review' ? (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#0a0f1a] text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-[#0a0f1a]/30 border-t-[#0a0f1a] rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Save Reflection
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={advance}
                    disabled={!canAdvance()}
                    className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-white/8 hover:bg-white/12 text-white text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {step === 'outcome' ? 'Review' : 'Next'}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StepWrapper({
  icon,
  iconBg,
  title,
  hint,
  optional,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  hint: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${iconBg}`}>
          {icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-white text-sm font-semibold">{title}</p>
            {optional && (
              <span className="text-white/25 text-xs">optional</span>
            )}
          </div>
          <p className="text-white/35 text-xs mt-0.5 leading-relaxed">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
      <p className="text-white/30 text-xs mb-1">{label}</p>
      <p className="text-white/80 text-sm leading-relaxed">{value}</p>
    </div>
  );
}
