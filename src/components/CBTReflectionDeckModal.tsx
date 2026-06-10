import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X, Sparkles, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { insertReflectionAtom } from "../services/reflectionAtomService";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

type StepId =
  | "situation"
  | "thought"
  | "emotion"
  | "intensity"
  | "body"
  | "behavior"
  | "outcome";

type Step = {
  id: StepId;
  title: string;
  helper?: string;
  placeholder?: string;
  kind: "textarea" | "select" | "range" | "input";
};

const STEPS: Step[] = [
  {
    id: "situation",
    title: "What happened?",
    helper: "One or two sentences. Keep it real.",
    placeholder: "Describe the moment or situation.",
    kind: "textarea",
  },
  {
    id: "thought",
    title: "What went through your mind in that moment?",
    helper: "The headline your mind wrote.",
    placeholder: "Write the exact thought as it showed up.",
    kind: "textarea",
  },
  {
    id: "emotion",
    title: "What emotion was strongest?",
    helper: "Pick the closest match — don't overthink it.",
    kind: "select",
  },
  {
    id: "intensity",
    title: "How intense was it (1–10)?",
    helper: "A quick rating helps patterns emerge over time.",
    kind: "range",
  },
  {
    id: "body",
    title: "Did you feel it anywhere in your body? (optional)",
    helper: "Tight chest, tense jaw, stomach drop…",
    placeholder: "Where did you feel it?",
    kind: "input",
  },
  {
    id: "behavior",
    title: "What did you do next? (optional)",
    helper: "What you did — or what you avoided doing.",
    placeholder: "What happened next?",
    kind: "input",
  },
  {
    id: "outcome",
    title: "How did that turn out? (optional)",
    helper: "Did it help? Did it cost something?",
    placeholder: "The result or consequence.",
    kind: "input",
  },
];

const EMOTIONS = [
  "Calm", "Happy", "Grateful", "Hopeful", "Excited",
  "Neutral",
  "Stressed", "Anxious", "Sad", "Angry", "Frustrated", "Overwhelmed", "Lonely", "Tired",
];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function CBTReflectionDeckModal({ isOpen, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [flip, setFlip] = useState(false);
  const current = STEPS[index];

  const [situation, setSituation] = useState("");
  const [thought, setThought] = useState("");
  const [emotion, setEmotion] = useState<string>("");
  const [intensity, setIntensity] = useState<number>(5);
  const [body, setBody] = useState("");
  const [behavior, setBehavior] = useState("");
  const [outcome, setOutcome] = useState("");

  const progress = useMemo(() => Math.round(((index + 1) / STEPS.length) * 100), [index]);

  const reset = () => {
    setSaving(false);
    setErr(null);
    setIndex(0);
    setFlip(false);
    setSituation("");
    setThought("");
    setEmotion("");
    setIntensity(5);
    setBody("");
    setBehavior("");
    setOutcome("");
  };

  const close = () => {
    if (!saving) {
      reset();
      onClose();
    }
  };

  const isStepValid = useMemo(() => {
    if (current.id === "situation") return situation.trim().length >= 3;
    if (current.id === "thought") return thought.trim().length >= 3;
    return true;
  }, [current.id, situation, thought]);

  const canSave = useMemo(() => {
    const core = situation.trim().length >= 3 && thought.trim().length >= 3;
    const hasSignal = !!emotion || behavior.trim().length >= 3 || outcome.trim().length >= 3;
    return core && hasSignal && !saving;
  }, [situation, thought, emotion, behavior, outcome, saving]);

  const go = (nextIndex: number) => {
    const ni = clamp(nextIndex, 0, STEPS.length - 1);
    if (ni === index) return;
    setFlip(f => !f);
    setTimeout(() => setIndex(ni), 130);
  };

  const next = () => go(index + 1);
  const prev = () => go(index - 1);

  const save = async () => {
    try {
      setErr(null);
      setSaving(true);

      await insertReflectionAtom({
        timestamp: Date.now(),
        situation: situation.trim(),
        automaticThought: thought.trim(),
        emotion: emotion || undefined,
        emotionIntensity: intensity,
        bodySignal: body.trim() || undefined,
        behavior: behavior.trim() || undefined,
        outcome: outcome.trim() || undefined,
      });

      setSaving(false);
      onSaved?.();
      close();
    } catch (e: unknown) {
      setSaving(false);
      setErr(e instanceof Error ? e.message : "Failed to save reflection.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/70" onClick={close} />

      <div className="absolute inset-x-0 top-16 sm:top-20 mx-auto w-[92%] sm:w-[720px]">
        <div className="rounded-2xl border border-white/10 bg-[#0d1424] shadow-2xl overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="text-white font-semibold leading-tight">Reflection Deck</div>
                <div className="text-white/40 text-xs mt-0.5">
                  Flip through 7 cards. This powers your Insights.
                </div>
              </div>
            </div>

            <button onClick={close} className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 pt-4">
            <div className="flex items-center justify-between text-xs text-white/40 mb-2">
              <span>Card {index + 1} of {STEPS.length}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-1.5 rounded-full bg-sky-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {err && (
            <div className="px-5 pt-4">
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-200 text-sm">
                {err}
              </div>
            </div>
          )}

          <div className="p-5">
            <div className="relative" style={{ perspective: "1200px" }}>
              <motion.div
                className="relative w-full"
                animate={{ rotateY: flip ? 180 : 0 }}
                transition={{ duration: 0.28, ease: "easeInOut" }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <div
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  style={{ backfaceVisibility: "hidden" }}
                >
                  <CardFace
                    step={current}
                    situation={situation}
                    setSituation={setSituation}
                    thought={thought}
                    setThought={setThought}
                    emotion={emotion}
                    setEmotion={setEmotion}
                    intensity={intensity}
                    setIntensity={setIntensity}
                    body={body}
                    setBody={setBody}
                    behavior={behavior}
                    setBehavior={setBehavior}
                    outcome={outcome}
                    setOutcome={setOutcome}
                  />
                </div>

                <div
                  className="absolute inset-0 rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                  style={{
                    backfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <div className="h-full flex items-center justify-center text-white/30 text-sm">
                    Flipping…
                  </div>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="p-5 border-t border-white/10 flex items-center justify-between gap-3">
            <button
              onClick={prev}
              disabled={index === 0 || saving}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-all ${
                index === 0 || saving
                  ? "border-white/10 text-white/20 bg-white/[0.02] cursor-not-allowed"
                  : "border-white/10 text-white/60 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-2">
              {index < STEPS.length - 1 ? (
                <button
                  onClick={next}
                  disabled={!isStepValid || saving}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    !isStepValid || saving
                      ? "bg-white/10 text-white/30 cursor-not-allowed"
                      : "bg-sky-500 text-white hover:bg-sky-400"
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={save}
                  disabled={!canSave || saving}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    !canSave || saving
                      ? "bg-white/10 text-white/30 cursor-not-allowed"
                      : "bg-emerald-500 text-white hover:bg-emerald-400"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {saving ? "Saving..." : "Save reflection"}
                </button>
              )}
            </div>
          </div>

          <div className="px-5 pb-5 -mt-2">
            <p className="text-white/25 text-xs">
              Tip: short answers are fine. The goal is signal, not perfection.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardFace(props: {
  step: Step;
  situation: string; setSituation: (v: string) => void;
  thought: string; setThought: (v: string) => void;
  emotion: string; setEmotion: (v: string) => void;
  intensity: number; setIntensity: (v: number) => void;
  body: string; setBody: (v: string) => void;
  behavior: string; setBehavior: (v: string) => void;
  outcome: string; setOutcome: (v: string) => void;
}) {
  const { step } = props;

  return (
    <div>
      <div className="text-white font-semibold text-base leading-tight">{step.title}</div>
      {step.helper && <div className="text-white/35 text-xs mt-1">{step.helper}</div>}

      <div className="mt-4">
        {step.id === "situation" && (
          <textarea
            value={props.situation}
            onChange={(e) => props.setSituation(e.target.value)}
            rows={4}
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-white/80 text-sm outline-none focus:border-sky-500/40 resize-none"
            placeholder={step.placeholder}
          />
        )}

        {step.id === "thought" && (
          <textarea
            value={props.thought}
            onChange={(e) => props.setThought(e.target.value)}
            rows={4}
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-white/80 text-sm outline-none focus:border-sky-500/40 resize-none"
            placeholder={step.placeholder}
          />
        )}

        {step.id === "emotion" && (
          <select
            value={props.emotion}
            onChange={(e) => props.setEmotion(e.target.value)}
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-white/80 text-sm outline-none focus:border-sky-500/40"
          >
            <option value="">Select…</option>
            {EMOTIONS.map(e => (
              <option key={e} value={e} className="bg-[#0d1424]">{e}</option>
            ))}
          </select>
        )}

        {step.id === "intensity" && (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between text-xs text-white/40 mb-2">
              <span>Low</span>
              <span className="text-white/70 font-semibold">{props.intensity}/10</span>
              <span>High</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={props.intensity}
              onChange={(e) => props.setIntensity(Number(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {step.id === "body" && (
          <input
            value={props.body}
            onChange={(e) => props.setBody(e.target.value)}
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-white/80 text-sm outline-none focus:border-sky-500/40"
            placeholder={step.placeholder}
          />
        )}

        {step.id === "behavior" && (
          <input
            value={props.behavior}
            onChange={(e) => props.setBehavior(e.target.value)}
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-white/80 text-sm outline-none focus:border-sky-500/40"
            placeholder={step.placeholder}
          />
        )}

        {step.id === "outcome" && (
          <input
            value={props.outcome}
            onChange={(e) => props.setOutcome(e.target.value)}
            className="w-full rounded-xl bg-black/20 border border-white/10 px-3 py-2 text-white/80 text-sm outline-none focus:border-sky-500/40"
            placeholder={step.placeholder}
          />
        )}
      </div>
    </div>
  );
}
