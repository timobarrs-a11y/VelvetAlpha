import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, ArrowUp, ArrowDown, X } from 'lucide-react';
import { useTutorialDirector } from '../../context/TutorialDirectorContext';
import { onboardingService } from '../../services/onboardingService';
import { usePetStore } from '../../stores/petStore';

interface Props {
  userId: string;
  companionName: string;
}

type Placement = 'right' | 'left' | 'top' | 'bottom' | 'center';

interface TourStep {
  id: string;
  /** Matches a [data-tour-id] (or [data-tutorial-id]) attribute in the live UI. null = centered card. */
  targetId: string | null;
  placement: Placement;
  title: string;
  body: string;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_WIDTH = 312;
const SPOTLIGHT_PAD = 6;
const ARROW_ZONE = 44; // space reserved between target and card for the arrow
const EDGE_MARGIN = 12;

function buildSteps(companionName: string, petName: string, isReplay: boolean): TourStep[] {
  return [
    {
      id: 'welcome',
      targetId: null,
      placement: 'center',
      title: isReplay ? 'Welcome back 👋' : 'Welcome to your space 🎉',
      body: isReplay
        ? `Here's a quick refresher on where everything lives. Hit Next to move through.`
        : `This is where you and ${companionName} hang out. Here's a quick tour of the essentials — just read and hit Next.`,
    },
    {
      id: 'sidebar_toggle',
      targetId: 'tour-sidebar-toggle',
      placement: 'right',
      title: 'Expand & collapse your sidebar',
      body: `This little button tucks the "Your World" sidebar away when you want a full-width chat — and brings it right back. Click it any time.`,
    },
    {
      id: 'left_rail',
      targetId: 'tour-left-rail',
      placement: 'right',
      title: 'Everything, one click away',
      body: `Your World is your launchpad: Atlas (your chief of staff), Navi for local finds, Daily Feed, Your Lens videos, Co-Author, Calendar, Insights, and the Arcade.`,
    },
    {
      id: 'chat',
      targetId: 'hub.chat_surface',
      placement: 'center',
      title: 'The heart of it all',
      body: `This is your conversation with ${companionName}. When you open Atlas, Navi, or a feature, they appear as tabs along the top — so you never lose your place here.`,
    },
    {
      id: 'right_rail',
      targetId: 'tour-right-rail',
      placement: 'left',
      title: 'Your daily pulse',
      body: `Fresh news and videos picked around your interests sit right beside the chat. They update as your companions learn what you're into.`,
    },
    {
      id: 'background',
      targetId: 'tour-style-bar',
      placement: 'top',
      title: 'Set the scene',
      body: `That soft gradient behind the chat? It's the default background — and it's all yours to change. Tap Wallpaper to pick a new scene, and use the tiles next to it to restyle fonts, bubble colors, and cursor effects.`,
    },
    {
      id: 'pet',
      targetId: 'tour-pet-toggle',
      placement: 'top',
      title: `Bonus: meet ${petName} 🐾`,
      body: `One last thing — the fun one. This toggle summons ${petName}, a tiny desk pet who roams your screen, naps, and levels up while you chat. Go on, let ${petName} loose when we're done.`,
    },
  ];
}

function findTarget(targetId: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(
    `[data-tour-id="${targetId}"], [data-tutorial-id="${targetId}"]`,
  );
  for (const el of candidates) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

function readRect(targetId: string | null): Rect | null {
  if (!targetId) return null;
  const el = findTarget(targetId);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function rectsEqual(a: Rect | null, b: Rect | null): boolean {
  if (!a || !b) return a === b;
  return (
    Math.abs(a.top - b.top) < 1 &&
    Math.abs(a.left - b.left) < 1 &&
    Math.abs(a.width - b.width) < 1 &&
    Math.abs(a.height - b.height) < 1
  );
}

export function GuidedTourOverlay({ userId, companionName }: Props) {
  const { isOnboarding, completeOnboarding, tourSource } = useTutorialDirector();
  const petName = usePetStore(s => s.name);

  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [cardPos, setCardPos] = useState<{ top: number; left: number } | null>(null);

  // Callback-ref state so positioning re-runs when a new step's card mounts
  // (AnimatePresence mode="wait" mounts it after the step state has settled).
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null);
  const rectRef = useRef<Rect | null>(null);
  rectRef.current = rect;

  const step = steps?.[stepIndex] ?? null;

  // Resolve which steps have a visible target once the hub has settled.
  useEffect(() => {
    if (!isOnboarding) {
      setSteps(null);
      setStepIndex(0);
      return;
    }
    const timer = setTimeout(() => {
      const all = buildSteps(companionName, petName, tourSource === 'manual_replay');
      setSteps(all.filter(s => s.targetId === null || findTarget(s.targetId) !== null));
      setStepIndex(0);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnboarding]);

  // Track the target's rect — it can move (animations, resize, rail collapse).
  useEffect(() => {
    if (!step) return;
    const update = () => {
      const next = readRect(step.targetId);
      if (!rectsEqual(rectRef.current, next)) setRect(next);
    };
    update();
    const interval = setInterval(update, 300);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step]);

  // Position the card once its size is measurable.
  useLayoutEffect(() => {
    if (!step || !cardEl) return;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ch = cardEl.offsetHeight;
    const cw = cardEl.offsetWidth || CARD_WIDTH;

    if (step.placement === 'center' || !rect) {
      if (rect) {
        // Center within the spotlighted region (e.g. the chat surface).
        setCardPos({
          top: Math.max(EDGE_MARGIN, rect.top + rect.height / 2 - ch / 2),
          left: Math.max(EDGE_MARGIN, rect.left + rect.width / 2 - cw / 2),
        });
      } else {
        setCardPos({ top: vh / 2 - ch / 2, left: vw / 2 - cw / 2 });
      }
      return;
    }

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let top = 0;
    let left = 0;
    switch (step.placement) {
      case 'right':
        left = rect.left + rect.width + ARROW_ZONE;
        top = cy - ch / 2;
        break;
      case 'left':
        left = rect.left - ARROW_ZONE - cw;
        top = cy - ch / 2;
        break;
      case 'top':
        top = rect.top - ARROW_ZONE - ch;
        left = cx - cw / 2;
        break;
      case 'bottom':
        top = rect.top + rect.height + ARROW_ZONE;
        left = cx - cw / 2;
        break;
    }
    setCardPos({
      top: Math.min(Math.max(top, EDGE_MARGIN), vh - ch - EDGE_MARGIN),
      left: Math.min(Math.max(left, EDGE_MARGIN), vw - cw - EDGE_MARGIN),
    });
  }, [step, rect, cardEl]);

  const finish = useCallback(() => {
    onboardingService.markComplete(userId).catch(() => {});
    completeOnboarding();
  }, [userId, completeOnboarding]);

  const goNext = useCallback(() => {
    if (!steps) return;
    if (stepIndex >= steps.length - 1) finish();
    else setStepIndex(i => i + 1);
  }, [steps, stepIndex, finish]);

  const goBack = useCallback(() => {
    setStepIndex(i => Math.max(0, i - 1));
  }, []);

  // Keyboard: → / Enter advance, ← back, Esc skip.
  useEffect(() => {
    if (!isOnboarding || !steps) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); goNext(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); goBack(); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOnboarding, steps, goNext, goBack, finish]);

  if (!isOnboarding || !steps || !step) return null;

  const isLast = stepIndex === steps.length - 1;
  const showSpotlight = rect !== null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Click shield — keeps the tour focused; dims when no spotlight hole */}
      <div
        className="absolute inset-0"
        style={{ background: showSpotlight ? 'transparent' : 'rgba(15,23,42,0.55)', transition: 'background 0.25s' }}
      />

      {/* Spotlight hole — dim everything except the target */}
      {showSpotlight && rect && (
        <div
          className="absolute rounded-2xl pointer-events-none"
          style={{
            top: rect.top - SPOTLIGHT_PAD,
            left: rect.left - SPOTLIGHT_PAD,
            width: rect.width + SPOTLIGHT_PAD * 2,
            height: rect.height + SPOTLIGHT_PAD * 2,
            boxShadow: '0 0 0 200vmax rgba(15,23,42,0.55)',
            border: '2px solid rgba(244,63,94,0.85)',
            transition: 'top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease',
          }}
        />
      )}

      {/* Bouncing arrow pointing at the target */}
      {showSpotlight && rect && step.placement !== 'center' && (
        <TourArrow rect={rect} placement={step.placement} />
      )}

      {/* Step card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          ref={setCardEl}
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: cardPos ? 1 : 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.18 }}
          className="absolute rounded-2xl bg-white shadow-2xl border border-gray-200/80 p-4"
          style={{
            width: CARD_WIDTH,
            maxWidth: 'calc(100vw - 24px)',
            top: cardPos?.top ?? -9999,
            left: cardPos?.left ?? -9999,
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <h3 className="text-[15px] font-bold text-gray-900 leading-snug">{step.title}</h3>
            <button
              onClick={finish}
              title="End tour"
              className="flex items-center justify-center w-6 h-6 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0 -mt-0.5 -mr-1"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
          <p className="text-[13px] text-gray-600 leading-relaxed mb-4">{step.body}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {steps.map((s, i) => (
                <span
                  key={s.id}
                  className="rounded-full transition-all duration-200"
                  style={{
                    width: i === stepIndex ? 16 : 6,
                    height: 6,
                    background: i === stepIndex ? '#f43f5e' : i < stepIndex ? '#fda4af' : '#e5e7eb',
                  }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  onClick={goBack}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                onClick={goNext}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 shadow-sm transition-all"
              >
                {isLast ? "Let's go!" : stepIndex === 0 ? 'Start the tour' : 'Next'}
              </button>
            </div>
          </div>

          {stepIndex === 0 && (
            <button
              onClick={finish}
              className="mt-2.5 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip for now — I'll explore on my own
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function TourArrow({ rect, placement }: { rect: Rect; placement: Exclude<Placement, 'center'> }) {
  const size = 30;
  const gap = 8;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  let style: React.CSSProperties = {};
  let Icon = ArrowLeft;
  let animate: Record<string, number[]> = { x: [0, -6, 0] };

  switch (placement) {
    case 'right':
      style = { top: cy - size / 2, left: rect.left + rect.width + gap };
      Icon = ArrowLeft;
      animate = { x: [0, -6, 0] };
      break;
    case 'left':
      style = { top: cy - size / 2, left: rect.left - gap - size };
      Icon = ArrowRight;
      animate = { x: [0, 6, 0] };
      break;
    case 'top':
      style = { top: rect.top - gap - size, left: cx - size / 2 };
      Icon = ArrowDown;
      animate = { y: [0, 6, 0] };
      break;
    case 'bottom':
      style = { top: rect.top + rect.height + gap, left: cx - size / 2 };
      Icon = ArrowUp;
      animate = { y: [0, -6, 0] };
      break;
  }

  return (
    <motion.div
      className="absolute pointer-events-none flex items-center justify-center rounded-full bg-rose-500 shadow-lg"
      style={{ ...style, width: size, height: size }}
      animate={animate}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Icon className="w-4 h-4 text-white" />
    </motion.div>
  );
}
