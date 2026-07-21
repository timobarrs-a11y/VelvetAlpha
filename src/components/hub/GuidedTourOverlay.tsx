import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, X, ArrowRight, ArrowLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { useTutorialDirector } from '../../context/TutorialDirectorContext';
import { usePetStore } from '../../stores/petStore';
import { onboardingService } from '../../services/onboardingService';

type Placement = 'center' | 'right' | 'left' | 'top' | 'bottom';

interface TourStepDef {
  id: string;
  selector: string;
  placement: Placement;
  title: string;
  body: string;
  showArrow: boolean;
}

interface Props {
  userId: string;
  companionName: string;
}

export function GuidedTourOverlay({ userId, companionName }: Props) {
  const { isOnboarding, completeOnboarding, tourSource } = useTutorialDirector();
  const petName = usePetStore(s => s.name);
  const isReplay = tourSource === 'manual_replay';

  const [activeIndex, setActiveIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [cardEl, setCardEl] = useState<HTMLDivElement | null>(null);
  const indexRef = useRef(0);

  const buildSteps = useCallback((): TourStepDef[] => {
    const pn = petName || 'your pet';
    return [
      {
        id: 'welcome',
        selector: '',
        placement: 'center',
        showArrow: false,
        title: isReplay ? 'Welcome back 👋' : 'Welcome to your space 🎉',
        body: isReplay
          ? `Here's a quick refresher on where everything lives. Hit Next to move through.`
          : `This is where you and ${companionName} hang out. Here's a quick tour of the essentials — just read and hit Next.`,
      },
      {
        id: 'sidebar_toggle',
        selector: '[data-tour-id="tour-sidebar-toggle"]',
        placement: 'right',
        showArrow: true,
        title: 'Expand & collapse your sidebar',
        body: `This little button tucks the "Your World" sidebar away when you want a full-width chat — and brings it right back. Click it any time.`,
      },
      {
        id: 'left_rail',
        selector: '[data-tour-id="tour-left-rail"]',
        placement: 'right',
        showArrow: true,
        title: 'Everything, one click away',
        body: `Your World is your launchpad: Atlas (your chief of staff), Navi for local finds, Daily Feed, Your Lens videos, Co-Author, Calendar, Insights, and the Arcade.`,
      },
      {
        id: 'velvet_lobby',
        selector: '[data-tutorial-id="hub.shortcut.lobby"]',
        placement: 'right',
        showArrow: true,
        title: 'The Velvet Lobby',
        body: `Your classic home base. The Lobby holds all your companions and coaches, group chats, Loyalty Rewards, and the full games collection — this shortcut takes you there any time.`,
      },
      {
        id: 'chat',
        selector: '[data-tutorial-id="hub.chat_surface"]',
        placement: 'center',
        showArrow: false,
        title: 'The heart of it all',
        body: `This is your conversation with ${companionName}. When you open Atlas, Navi, or a feature, they appear as tabs along the top — so you never lose your place here.`,
      },
      {
        id: 'right_rail',
        selector: '[data-tour-id="tour-right-rail"]',
        placement: 'left',
        showArrow: true,
        title: 'Your daily pulse',
        body: `Fresh news and videos picked around your interests sit right beside the chat. They update as your companions learn what you're into.`,
      },
      {
        id: 'background',
        selector: '[data-tour-id="tour-style-bar"]',
        placement: 'top',
        showArrow: true,
        title: 'Set the scene',
        body: `That soft gradient behind the chat? It's the default background — and it's all yours to change. Tap Wallpaper to pick a new scene, and use the tiles next to it to restyle fonts, bubble colors, and cursor effects.`,
      },
      {
        id: 'pet',
        selector: '[data-tour-id="tour-pet-toggle"]',
        placement: 'top',
        showArrow: true,
        title: `Bonus: meet ${pn} 🐾`,
        body: `One last thing — the fun one. This toggle summons ${pn}, a tiny desk pet who roams your screen, naps, and levels up while you chat. Go on, let ${pn} loose when we're done.`,
      },
    ];
  }, [companionName, isReplay, petName]);

  const lookupTarget = useCallback((selector: string): HTMLElement | null => {
    if (!selector) return null;
    const nodes = document.querySelectorAll(selector);
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i] as HTMLElement;
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return el;
    }
    return null;
  }, []);

  const [steps, setSteps] = useState<TourStepDef[]>([]);

  useEffect(() => {
    if (!isOnboarding) return;
    const timer = setTimeout(() => {
      const all = buildSteps();
      const resolved = all.filter(s => {
        if (!s.selector) return true;
        return lookupTarget(s.selector) != null;
      });
      setSteps(resolved);
      setActiveIndex(0);
      indexRef.current = 0;
    }, 400);
    return () => clearTimeout(timer);
  }, [isOnboarding, buildSteps, lookupTarget]);

  useEffect(() => {
    indexRef.current = activeIndex;
  }, [activeIndex]);

  const currentStep = steps[activeIndex];

  const updateRect = useCallback(() => {
    if (!currentStep || !currentStep.selector) {
      setRect(null);
      return;
    }
    const el = lookupTarget(currentStep.selector);
    if (el) setRect(el.getBoundingClientRect());
    else setRect(null);
  }, [currentStep, lookupTarget]);

  useEffect(() => {
    updateRect();
    if (!currentStep || !currentStep.selector) return;
    const id = setInterval(updateRect, 300);
    const onResize = () => updateRect();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [currentStep, updateRect]);

  const finishTour = useCallback(() => {
    onboardingService.markComplete(userId).catch(() => {});
    completeOnboarding();
  }, [userId, completeOnboarding]);

  const goNext = useCallback(() => {
    const idx = indexRef.current;
    if (idx >= steps.length - 1) {
      finishTour();
    } else {
      setActiveIndex(idx + 1);
    }
  }, [steps.length, finishTour]);

  const goBack = useCallback(() => {
    const idx = indexRef.current;
    if (idx > 0) setActiveIndex(idx - 1);
  }, []);

  useEffect(() => {
    if (!isOnboarding) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishTour();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOnboarding, goNext, goBack, finishTour]);

  const arrowIcon = useMemo(() => {
    if (!currentStep || !currentStep.showArrow || !rect) return null;
    switch (currentStep.placement) {
      case 'left': return <ArrowRight className="w-4 h-4 text-white" />;
      case 'right': return <ArrowLeft className="w-4 h-4 text-white" />;
      case 'top': return <ArrowDown className="w-4 h-4 text-white" />;
      case 'bottom': return <ArrowUp className="w-4 h-4 text-white" />;
      default: return null;
    }
  }, [currentStep, rect]);

  const arrowPos = useMemo(() => {
    if (!currentStep || !currentStep.showArrow || !rect) return null;
    const pad = 8;
    const size = 30;
    switch (currentStep.placement) {
      case 'left':
        return { left: rect.left - size - pad, top: rect.top + rect.height / 2 - size / 2 };
      case 'right':
        return { left: rect.right + pad, top: rect.top + rect.height / 2 - size / 2 };
      case 'top':
        return { left: rect.left + rect.width / 2 - size / 2, top: rect.top - size - pad };
      case 'bottom':
        return { left: rect.left + rect.width / 2 - size / 2, top: rect.bottom + pad };
      default:
        return null;
    }
  }, [currentStep, rect]);

  const cardPos = useMemo(() => {
    if (!currentStep) return { left: 0, top: 0 };
    const offset = 44;
    const cardW = 312;
    const cardH = cardEl?.offsetHeight ?? 200;
    const pad = 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (currentStep.placement === 'center') {
      if (!rect) {
        return { left: vw / 2 - cardW / 2, top: vh / 2 - cardH / 2 };
      }
      return { left: rect.left + rect.width / 2 - cardW / 2, top: rect.top + rect.height / 2 - cardH / 2 };
    }

    if (!rect) return { left: vw / 2 - cardW / 2, top: vh / 2 - cardH / 2 };

    let left: number;
    let top: number;
    switch (currentStep.placement) {
      case 'right':
        left = rect.right + offset;
        top = rect.top + rect.height / 2 - cardH / 2;
        break;
      case 'left':
        left = rect.left - cardW - offset;
        top = rect.top + rect.height / 2 - cardH / 2;
        break;
      case 'top':
        left = rect.left + rect.width / 2 - cardW / 2;
        top = rect.top - cardH - offset;
        break;
      case 'bottom':
        left = rect.left + rect.width / 2 - cardW / 2;
        top = rect.bottom + offset;
        break;
      default:
        left = vw / 2 - cardW / 2;
        top = vh / 2 - cardH / 2;
    }
    left = Math.max(pad, Math.min(left, vw - cardW - pad));
    top = Math.max(pad, Math.min(top, vh - cardH - pad));
    return { left, top };
  }, [currentStep, rect, cardEl]);

  const isFirst = activeIndex === 0;
  const isLast = activeIndex === steps.length - 1;

  if (!isOnboarding || steps.length === 0 || !currentStep) return null;

  const spotStyle = rect
    ? {
        left: rect.left - 6,
        top: rect.top - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      }
    : undefined;

  return (
    <div className="fixed inset-0 z-[100]" style={{ pointerEvents: 'auto' }}>
      <div className="absolute inset-0" style={{ background: 'transparent' }} />

      {rect && (
        <motion.div
          initial={false}
          animate={spotStyle ? { left: spotStyle.left, top: spotStyle.top, width: spotStyle.width, height: spotStyle.height } : {}}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="absolute rounded-xl pointer-events-none"
          style={{
            ...(spotStyle ?? {}),
            boxShadow: '0 0 0 200vmax rgba(15,23,42,0.55)',
            border: '2px solid rgba(244,63,94,0.85)',
          }}
        />
      )}

      {!rect && (
        <div className="absolute inset-0" style={{ background: 'rgba(15,23,42,0.55)' }} />
      )}

      {arrowPos && currentStep.showArrow && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="absolute pointer-events-none z-[101]"
          style={{ left: arrowPos.left, top: arrowPos.top, width: 30, height: 30 }}
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
            className="w-full h-full rounded-full flex items-center justify-center"
            style={{ background: '#f43f5e', boxShadow: '0 4px 14px rgba(244,63,94,0.45)' }}
          >
            {arrowIcon}
          </motion.div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep.id}
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.97 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          ref={setCardEl}
          className="absolute rounded-2xl bg-white shadow-2xl flex flex-col"
          style={{
            left: cardPos.left,
            top: cardPos.top,
            width: 312,
            padding: '20px 22px 18px',
            border: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <h3 className="text-[17px] font-bold text-slate-900 leading-snug">
              {currentStep.title}
            </h3>
            <button
              onClick={finishTour}
              className="flex items-center justify-center w-6 h-6 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors flex-shrink-0 -mt-0.5 -mr-1"
              title="End tour"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-[13px] text-slate-600 leading-relaxed mb-4">
            {currentStep.body}
          </p>

          <div className="flex items-center gap-1.5 mb-4">
            {steps.map((s, i) => (
              <span
                key={s.id}
                className="rounded-full transition-all duration-200"
                style={{
                  height: 5,
                  width: i === activeIndex ? 16 : 5,
                  background: i === activeIndex ? '#f43f5e' : i < activeIndex ? '#fda4af' : '#e2e8f0',
                }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            {!isFirst ? (
              <button
                onClick={goBack}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-[13px] font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-3">
              {isFirst && (
                <button
                  onClick={finishTour}
                  className="text-[12px] font-medium text-slate-400 hover:text-slate-700 transition-colors"
                >
                  Skip for now — I'll explore on my own
                </button>
              )}
              <button
                onClick={goNext}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-[13px] font-bold text-white transition-all hover:brightness-110 active:scale-95"
                style={{
                  background: 'linear-gradient(135deg, #f43f5e 0%, #ec4899 100%)',
                  boxShadow: '0 3px 10px rgba(244,63,94,0.30)',
                }}
              >
                {isFirst ? 'Start the tour' : isLast ? "Let's go!" : 'Next'}
                {!isFirst && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div
        className="absolute inset-0"
        style={{ pointerEvents: 'all', cursor: 'default' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            // don't close on backdrop click — require explicit Next/Skip
          }
        }}
      />
    </div>
  );
}
