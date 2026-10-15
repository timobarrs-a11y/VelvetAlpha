import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  motion, animate, useReducedMotion, useMotionValue, useMotionTemplate,
  useSpring, useTransform,
} from 'framer-motion';
import {
  ArrowLeft, MessageSquare, type LucideIcon,
  ChevronRight,
} from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1] as const;

interface BaseProps {
  back: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

/* ============================================================
 * Shared pieces
 * ============================================================ */

/** Big-number / small-label tile. Numeric values count up on mount. */
export function HeaderStat({
  value,
  label,
  icon: Icon,
  accent,
}: {
  value: React.ReactNode;
  label: string;
  icon?: LucideIcon;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm px-3.5 py-2">
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" style={{ color: accent ?? 'rgba(255,255,255,0.5)' }} />}
      <div className="leading-none">
        <div className="font-display font-bold text-lg text-white tabular-nums">
          {typeof value === 'number' ? <CountUp value={value} /> : value}
        </div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-white/45 mt-1">{label}</div>
      </div>
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(0, value, {
      duration: 1.1,
      delay: 0.45,
      ease: EASE,
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduce]);
  return <>{shown}</>;
}

/** Pulsing "live" pill for boards with recent activity. */
export function LivePill({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white/85"
      style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
    >
      <span className="relative flex w-2 h-2">
        <span className="absolute inset-0 rounded-full animate-ping" style={{ background: accent, opacity: 0.6 }} />
        <span className="relative w-2 h-2 rounded-full" style={{ background: accent }} />
      </span>
      {children}
    </span>
  );
}

/** Tracks the pointer over the header: a spotlight position plus a -1..1 parallax offset. */
function useHeroPointer(reduce: boolean | null) {
  const x = useMotionValue(280);
  const y = useMotionValue(90);
  const px = useSpring(0, { stiffness: 80, damping: 18 });
  const py = useSpring(0, { stiffness: 80, damping: 18 });
  const ref = useRef<HTMLElement>(null);

  const handlers = reduce
    ? {}
    : {
        onPointerMove: (e: React.PointerEvent) => {
          const r = ref.current?.getBoundingClientRect();
          if (!r) return;
          x.set(e.clientX - r.left);
          y.set(e.clientY - r.top);
          px.set((e.clientX - r.left) / r.width * 2 - 1);
          py.set((e.clientY - r.top) / r.height * 2 - 1);
        },
        onPointerLeave: () => {
          px.set(0);
          py.set(0);
        },
      };
  return { ref, x, y, px, py, handlers };
}

interface HeroProps extends BaseProps {
  title: string;
  subtitle?: string;
  accent: string;
  /** Second color blended into the wash (index variant). */
  accent2?: string;
  icon?: LucideIcon;
  stats?: React.ReactNode;
  meta?: React.ReactNode;
  /** `index` is taller with a larger title and a two-color wash. */
  variant?: 'board' | 'index';
}

function HeroHeader({
  title,
  subtitle,
  accent,
  accent2,
  icon: Icon = MessageSquare,
  back,
  backLabel = 'Back',
  actions,
  stats,
  meta,
  variant = 'board',
}: HeroProps) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { ref, x, y, px, py, handlers } = useHeroPointer(reduce);
  const isIndex = variant === 'index';

  // Staggered rise-in; collapses to a static render when the user prefers reduced motion.
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: EASE },
        };

  const spotlight = useMotionTemplate`radial-gradient(340px circle at ${x}px ${y}px, ${accent}30, transparent 70%)`;
  const markX = useTransform(px, [-1, 1], [-18, 18]);
  const markY = useTransform(py, [-1, 1], [-10, 10]);
  const wash2 = accent2 ?? accent;

  return (
    <header
      ref={ref}
      {...handlers}
      className="relative w-full overflow-hidden border-b border-white/10"
    >
      {/* Accent wash */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: isIndex
            ? `linear-gradient(115deg, ${accent}38 0%, ${wash2}22 55%, transparent 90%)`
            : `linear-gradient(115deg, ${accent}38 0%, ${accent}12 45%, transparent 80%)`,
        }}
      />
      {/* Glow pooled behind the icon tile */}
      <motion.div
        className="absolute -left-24 top-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent}40 0%, transparent 65%)`, filter: 'blur(60px)' }}
        animate={reduce ? undefined : { opacity: [0.7, 1, 0.7], scale: [1, 1.08, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
      {isIndex && (
        <div
          className="absolute -right-20 -top-24 w-[380px] h-[380px] rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${wash2}33 0%, transparent 65%)`, filter: 'blur(70px)' }}
        />
      )}
      {/* Dot grid, masked so it fades toward the right */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          WebkitMaskImage: 'linear-gradient(100deg, black 0%, transparent 65%)',
          maskImage: 'linear-gradient(100deg, black 0%, transparent 65%)',
        }}
      />
      {/* Cursor spotlight */}
      {!reduce && <motion.div className="absolute inset-0 pointer-events-none" style={{ background: spotlight }} />}
      {/* Oversized watermark icon: parallax follows the cursor */}
      <div className="absolute right-8 lg:right-[8%] top-1/2 -translate-y-[60%] pointer-events-none hidden md:block" aria-hidden>
        <motion.div style={{ x: reduce ? 0 : markX, y: reduce ? 0 : markY, color: accent }}>
          <motion.div
            initial={reduce ? false : { opacity: 0, rotate: -20, scale: 0.85 }}
            animate={reduce ? { opacity: 0.16, rotate: -8 } : { opacity: 0.16, rotate: [-8, -5, -8], scale: 1 }}
            transition={
              reduce
                ? undefined
                : {
                    opacity: { duration: 1.2, delay: 0.2 },
                    scale: { duration: 1.2, delay: 0.2, ease: EASE },
                    rotate: { duration: 14, repeat: Infinity, ease: 'easeInOut' },
                  }
            }
          >
            <Icon className={isIndex ? 'w-[260px] h-[260px]' : 'w-[220px] h-[220px]'} strokeWidth={1} />
          </motion.div>
        </motion.div>
      </div>
      {/* Bottom accent edge with a light that travels along it */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(to right, ${accent}, ${wash2}00 75%)` }}
      />
      {!reduce && (
        <motion.div
          className="absolute bottom-0 h-px w-40 pointer-events-none"
          style={{ background: `linear-gradient(to right, transparent, #fff, transparent)` }}
          initial={{ left: '-10%' }}
          animate={{ left: '110%' }}
          transition={{ duration: 3.2, delay: 1, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
        />
      )}

      <div className={`relative px-4 sm:px-6 max-w-6xl mx-auto ${isIndex ? 'pt-6 pb-9 sm:pb-11' : 'pt-5 pb-7 sm:pb-8'}`}>
        <motion.button
          type="button"
          onClick={() => navigate(back)}
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors"
          {...rise(0)}
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>{backLabel}</span>
        </motion.button>

        <div className="mt-5 flex items-start gap-4 sm:gap-5 min-w-0">
          <motion.div
            className="w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-2xl flex items-center justify-center flex-shrink-0"
            initial={reduce ? false : { opacity: 0, scale: 0.7, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
            style={{
              background: `linear-gradient(135deg, ${accent}55, ${accent}1f)`,
              border: `1px solid ${accent}66`,
              boxShadow: `0 8px 32px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.18)`,
            }}
          >
            <Icon className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
          </motion.div>
          <div className="min-w-0">
            {/* Title: a single light sweep passes across the letters after the rise-in */}
            <motion.h1
              className="font-display font-black leading-[1.02]"
              style={{
                fontSize: isIndex ? 'clamp(34px, 6vw, 60px)' : 'clamp(30px, 5vw, 48px)',
                letterSpacing: '-0.035em',
                color: reduce ? '#fff' : 'transparent',
                backgroundImage: `linear-gradient(100deg, #fff 42%, color-mix(in srgb, ${accent} 45%, #fff) 50%, #fff 58%)`,
                backgroundSize: '260% 100%',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                filter: `drop-shadow(0 2px 20px ${accent}66)`,
              }}
              {...rise(0.15)}
              {...(reduce
                ? {}
                : {
                    animate: { opacity: 1, y: 0, backgroundPosition: ['100% 0', '0% 0'] },
                    transition: {
                      opacity: { duration: 0.55, delay: 0.15 },
                      y: { duration: 0.55, delay: 0.15, ease: EASE },
                      backgroundPosition: { duration: 1.4, delay: 0.7, ease: 'easeInOut' },
                    },
                  })}
            >
              {title}
            </motion.h1>
            {subtitle && (
              <motion.p className="text-sm sm:text-[15px] text-white/65 mt-2 leading-relaxed max-w-xl" {...rise(0.25)}>
                {subtitle}
              </motion.p>
            )}
            {meta && <div className="mt-2.5">{meta}</div>}
          </div>
        </div>

        {(stats || actions) && (
          <motion.div className="mt-6 flex flex-wrap items-center gap-x-2.5 gap-y-3" {...rise(0.35)}>
            {stats}
            {actions && <div className="flex items-center gap-2 sm:ml-auto relative z-10">{actions}</div>}
          </motion.div>
        )}
      </div>
    </header>
  );
}

/* ============================================================
 * 1. COMMUNITY INDEX HEADER — taller hero, two-color wash
 * ============================================================ */
interface CommunityIndexHeaderProps extends BaseProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  stats?: React.ReactNode;
  accent?: string;
  accent2?: string;
}

export function CommunityIndexHeader({
  accent = '#a78bfa',
  accent2 = '#38bdf8',
  ...props
}: CommunityIndexHeaderProps) {
  return <HeroHeader {...props} accent={accent} accent2={accent2} variant="index" />;
}

/* ============================================================
 * 2. BOARD HEADER — accent-tinted hero band driven by the board color
 * ============================================================ */
interface BoardHeaderProps extends BaseProps {
  title: string;
  subtitle?: string;
  accent: string;
  icon?: LucideIcon;
  stats?: React.ReactNode;
  meta?: React.ReactNode;
}

export function BoardHeader(props: BoardHeaderProps) {
  return <HeroHeader {...props} variant="board" />;
}

/* ============================================================
 * 3. POST DETAIL HEADER — compact breadcrumb strip for reading
 *    Same accent language, but kept slim so the post stays the focus.
 * ============================================================ */
interface PostDetailHeaderProps extends BaseProps {
  boardName?: string;
  boardId?: string | null;
  accent?: string;
}

export function PostDetailHeader({
  boardName,
  boardId,
  accent = '#3b82f6',
  back,
  backLabel = 'Back',
  actions,
}: PostDetailHeaderProps) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (
    <header className="relative w-full overflow-hidden border-b border-white/10">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(100deg, ${accent}26 0%, ${accent}0c 40%, transparent 75%)` }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(to right, ${accent}, ${accent}00 70%)` }}
      />

      <motion.div
        className="relative px-4 sm:px-6 py-3.5 max-w-4xl mx-auto"
        initial={reduce ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <button
              type="button"
              onClick={() => navigate(back)}
              className="group flex items-center gap-1.5 text-white/50 hover:text-white transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">{backLabel}</span>
            </button>
            {boardName && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                <button
                  onClick={() => navigate(boardId ? `/community/board/${boardId}` : '/community')}
                  className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-white/85 hover:text-white transition-colors truncate"
                  style={{ background: `${accent}1f`, border: `1px solid ${accent}40` }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accent}40` }}
                  >
                    <MessageSquare className="w-3 h-3 text-white" />
                  </span>
                  <span className="truncate font-semibold text-[13px]">{boardName}</span>
                </button>
              </>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      </motion.div>
    </header>
  );
}

/* Backward-compatible re-export for any code still referencing the old name. */
export const CommunityHeroHeader = BoardHeader;
