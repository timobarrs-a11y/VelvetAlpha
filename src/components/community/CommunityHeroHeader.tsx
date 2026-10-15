import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, MessageSquare, type LucideIcon,
  ChevronRight,
} from 'lucide-react';

interface BaseProps {
  back: string;
  backLabel?: string;
  actions?: React.ReactNode;
}

/* ============================================================
 * 1. COMMUNITY INDEX HEADER — panoramic hero with gradient mesh
 *    Distinct: full-width, large display title, subtle pattern
 * ============================================================ */
interface CommunityIndexHeaderProps extends BaseProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  stats?: React.ReactNode;
}

export function CommunityIndexHeader({
  title,
  subtitle,
  icon: Icon = MessageSquare,
  back,
  backLabel = 'Back',
  actions,
  stats,
}: CommunityIndexHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="relative w-full overflow-hidden border-b border-white/8">
      {/* Layered gradient mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/8 via-transparent to-emerald-500/6" />
        <div
          className="absolute -top-40 -left-20 w-[480px] h-[480px] rounded-full opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 65%)', filter: 'blur(90px)' }}
        />
        <div
          className="absolute -top-20 right-0 w-[360px] h-[360px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.10) 0%, transparent 65%)', filter: 'blur(80px)' }}
        />
      </div>
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-400 via-emerald-400 to-transparent opacity-50" />

      <div className="relative px-4 sm:px-6 pt-4 pb-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <button
            type="button"
            onClick={() => navigate(back)}
            className="flex items-center gap-1.5 text-xs font-medium text-white/40 hover:text-white/80 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </button>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-sky-500/15 to-emerald-500/10 border border-sky-400/20 shadow-lg shadow-sky-500/10">
            <Icon className="w-8 h-8 text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="font-display font-black leading-[1.05] text-white"
              style={{ fontSize: 'clamp(28px, 5vw, 44px)', letterSpacing: '-0.03em' }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-white/45 mt-1.5 leading-relaxed">{subtitle}</p>
            )}
            {stats && (
              <div className="flex items-center gap-5 mt-3">{stats}</div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
 * 2. BOARD HEADER — accent-tinted hero band
 *    Big display title, watermark icon, stat tiles, primary action.
 *    The board's accent color drives the whole composition.
 * ============================================================ */
interface BoardHeaderProps extends BaseProps {
  title: string;
  subtitle?: string;
  accent: string;
  icon?: LucideIcon;
  stats?: React.ReactNode;
  meta?: React.ReactNode;
}

/** Big-number / small-label tile for the board header stat row. */
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
        <div className="font-display font-bold text-lg text-white tabular-nums">{value}</div>
        <div className="text-[10px] uppercase tracking-[0.12em] text-white/45 mt-1">{label}</div>
      </div>
    </div>
  );
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function BoardHeader({
  title,
  subtitle,
  accent,
  icon: Icon = MessageSquare,
  back,
  backLabel = 'Back',
  actions,
  stats,
  meta,
}: BoardHeaderProps) {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  // Staggered rise-in; collapses to a static render when the user prefers reduced motion.
  const rise = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.55, delay, ease: EASE },
        };

  return (
    <header className="relative w-full overflow-hidden border-b border-white/10">
      {/* Accent wash: strongest top-left, fading across and down */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(115deg, ${accent}38 0%, ${accent}12 45%, transparent 80%)`,
        }}
      />
      {/* Glow pooled behind the icon tile */}
      <motion.div
        className="absolute -left-24 top-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accent}40 0%, transparent 65%)`, filter: 'blur(60px)' }}
        animate={reduce ? undefined : { opacity: [0.7, 1, 0.7], scale: [1, 1.08, 1] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
      />
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
      {/* Oversized watermark icon fills the right side */}
      <motion.div
        aria-hidden
        className="absolute right-8 lg:right-[8%] top-1/2 pointer-events-none hidden md:block"
        style={{ color: accent, y: '-60%' }}
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
        <Icon className="w-[220px] h-[220px]" strokeWidth={1} />
      </motion.div>
      {/* Bottom accent edge */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(to right, ${accent}, ${accent}00 75%)` }}
      />

      <div className="relative px-4 sm:px-6 pt-5 pb-7 sm:pb-8 max-w-6xl mx-auto">
        {/* Breadcrumb */}
        <motion.button
          type="button"
          onClick={() => navigate(back)}
          className="group inline-flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors"
          {...rise(0)}
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          <span>{backLabel}</span>
        </motion.button>

        <div className="mt-5">
          <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
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
              <motion.h1
                className="font-display font-black leading-[1.02] text-white"
                style={{ fontSize: 'clamp(30px, 5vw, 48px)', letterSpacing: '-0.035em', textShadow: `0 2px 24px ${accent}66` }}
                {...rise(0.15)}
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
 * 3. POST DETAIL HEADER — minimal breadcrumb-style, no big hero
 *    Distinct: compact, conversation-focused, board context pill
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

  return (
    <header className="relative w-full border-b border-white/8 bg-[var(--ds-surface-2)]/40 backdrop-blur-sm">
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(to right, ${accent}40, transparent 70%)` }} />

      <div className="relative px-4 sm:px-6 py-3 max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <button
              type="button"
              onClick={() => navigate(back)}
              className="flex items-center gap-1.5 text-white/40 hover:text-white/80 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">{backLabel}</span>
            </button>
            {boardName && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
                <button
                  onClick={() => navigate(boardId ? `/community/board/${boardId}` : '/community')}
                  className="flex items-center gap-1.5 text-white/50 hover:text-white/80 transition-colors truncate"
                >
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                    style={{ background: `${accent}18` }}
                  >
                    <MessageSquare className="w-3 h-3" style={{ color: accent }} />
                  </span>
                  <span className="truncate font-medium">{boardName}</span>
                </button>
              </>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      </div>
    </header>
  );
}

/* Backward-compatible re-export for any code still referencing the old name.
 * Maps to the board-style header since it was the most generic. */
export const CommunityHeroHeader = BoardHeader;
