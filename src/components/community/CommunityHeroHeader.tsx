import { useRef, useState, useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  motion,
  animate,
  useMotionValue,
  useMotionTemplate,
  useTransform,
  useSpring,
  useReducedMotion,
  type MotionStyle,
} from 'framer-motion';
import {
  ArrowLeft, MessageSquare, ChevronRight,
  type LucideIcon,
} from 'lucide-react';

/* ============================================================
 * SHARED INTERNAL — HeroHeader
 * ============================================================ */
interface HeroHeaderProps {
  title: string;
  subtitle?: string;
  accent: string;
  accent2?: string;
  icon?: LucideIcon;
  back: string;
  backLabel?: string;
  actions?: ReactNode;
  stats?: ReactNode;
  meta?: ReactNode;
  variant: 'board' | 'index';
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

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
  variant,
}: HeroHeaderProps) {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const headerRef = useRef<HTMLElement>(null);

  const isIndex = variant === 'index';
  const a2 = accent2 ?? accent;

  // pointer spotlight
  const px = useMotionValue(280);
  const py = useMotionValue(90);
  const spotlight = useMotionTemplate`radial-gradient(340px circle at ${px}px ${py}px, ${accent}30, transparent 70%)`;

  // watermark parallax (opposite to cursor)
  const wmXRaw = useTransform(px, (v: number) => -v * 0.04);
  const wmYRaw = useTransform(py, (v: number) => -v * 0.025);
  const wmX = useSpring(wmXRaw, { stiffness: 80, damping: 18 });
  const wmY = useSpring(wmYRaw, { stiffness: 80, damping: 18 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (reduced) return;
    const rect = headerRef.current?.getBoundingClientRect();
    if (!rect) return;
    px.set(e.clientX - rect.left);
    py.set(e.clientY - rect.top);
  };

  const titleFontSize = isIndex ? 'clamp(34px, 6vw, 60px)' : 'clamp(30px, 5vw, 48px)';
  const padY = isIndex ? 'pt-6 pb-9 sm:pb-11' : 'pt-5 pb-7 sm:pb-8';
  const wmSize = isIndex ? 260 : 220;
  const titleBg = `linear-gradient(100deg, #fff 42%, color-mix(in srgb, ${accent} 45%, #fff) 50%, #fff 58%)`;

  const fadeUp = reduced ? false : { opacity: 0, y: 14 };
  const fadeAnim = { opacity: 1, y: 0 };

  return (
    <header
      ref={headerRef}
      onMouseMove={handleMouseMove}
      className="relative w-full overflow-hidden border-b border-white/10"
    >
      {/* 1. Accent wash */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: isIndex
          ? `linear-gradient(115deg, ${accent}38 0%, ${a2}22 55%, transparent 90%)`
          : `linear-gradient(115deg, ${accent}38 0%, ${accent}12 45%, transparent 80%)`,
      }} />

      {/* 2. Glow behind icon tile */}
      {!reduced && (
        <motion.div
          className="absolute pointer-events-none rounded-full"
          style={{
            left: -96, top: '50%', width: 420, height: 420,
            background: `radial-gradient(circle, ${accent}40 0%, transparent 65%)`,
            filter: 'blur(60px)',
            x: '-50%', y: '-50%',
          }}
          animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.08, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* 3. Index-only second glow */}
      {isIndex && !reduced && (
        <motion.div
          className="absolute pointer-events-none rounded-full"
          style={{
            top: -40, right: -60, width: 380, height: 380,
            background: `radial-gradient(circle, ${a2}33 0%, transparent 65%)`,
            filter: 'blur(60px)',
          }}
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* 4. Dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1px)',
        backgroundSize: '22px 22px',
        opacity: 0.35,
        WebkitMaskImage: 'linear-gradient(100deg, black 0%, transparent 65%)',
        maskImage: 'linear-gradient(100deg, black 0%, transparent 65%)',
      }} />

      {/* 5. Cursor spotlight */}
      {!reduced && (
        <motion.div className="absolute inset-0 pointer-events-none" style={{ background: spotlight }} />
      )}

      {/* 6. Watermark icon */}
      {!reduced && (
        <motion.div
          className="absolute pointer-events-none hidden md:block"
          style={{ right: 32, top: '50%', marginTop: -wmSize * 0.6, x: wmX, y: wmY }}
          initial={{ opacity: 0, rotate: -20, scale: 0.85 }}
          animate={{ opacity: 0.16, rotate: [-8, -5], scale: 1 }}
          transition={{
            opacity: { duration: 1.2, delay: 0.2 },
            scale: { duration: 1.2, delay: 0.2 },
            rotate: { duration: 14, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' },
          }}
        >
          <Icon strokeWidth={1} style={{ width: wmSize, height: wmSize, color: accent }} />
        </motion.div>
      )}

      {/* 7. Bottom edge line + travelling highlight */}
      <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none" style={{
        background: `linear-gradient(to right, ${accent}, ${a2}00 75%)`,
      }} />
      {!reduced && (
        <motion.div
          className="absolute bottom-0 h-px pointer-events-none"
          style={{ width: 160, background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.6), transparent)' }}
          initial={{ left: '-160px' }}
          animate={{ left: '100%' }}
          transition={{ duration: 3.2, delay: 1, repeat: Infinity, repeatDelay: 5, ease: 'easeInOut' }}
        />
      )}

      {/* Content */}
      <div className={`relative px-4 sm:px-6 max-w-6xl mx-auto ${padY}`}>
        {/* Breadcrumb */}
        <motion.div initial={fadeUp} animate={fadeAnim} transition={{ duration: 0.55, ease: EASE }}>
          <button
            type="button"
            onClick={() => navigate(back)}
            className="group flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>{backLabel}</span>
          </button>
        </motion.div>

        {/* Icon + Title row */}
        <div className="mt-5 flex items-start gap-4">
          <motion.div
            initial={reduced ? false : { scale: 0.7, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18, delay: 0.1 }}
            className="flex-shrink-0 w-14 h-14 sm:w-[72px] sm:h-[72px] rounded-2xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, ${accent}55, ${accent}1f)`,
              border: `1px solid ${accent}66`,
              boxShadow: `0 8px 32px ${accent}44, inset 0 1px 0 rgba(255,255,255,0.18)`,
            }}
          >
            <Icon className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
          </motion.div>

          <div className="flex-1 min-w-0">
            <motion.h1
              initial={fadeUp}
              animate={fadeAnim}
              transition={{ duration: 0.55, delay: 0.15, ease: EASE }}
              className="font-display font-black leading-[1.02]"
              style={{
                fontSize: titleFontSize,
                letterSpacing: '-0.035em',
                ...(reduced
                  ? { color: '#fff' }
                  : {
                      backgroundImage: titleBg,
                      backgroundSize: '260%',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      filter: `drop-shadow(0 2px 20px ${accent}66)`,
                    } as MotionStyle),
              }}
            >
              {!reduced ? (
                <motion.span
                  className="inline-block"
                  initial={{ backgroundPosition: '100% 0' }}
                  animate={{ backgroundPosition: '0% 0' }}
                  transition={{ duration: 1.4, delay: 0.7, ease: 'easeInOut' }}
                  style={{
                    backgroundImage: titleBg,
                    backgroundSize: '260%',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {title}
                </motion.span>
              ) : title}
            </motion.h1>

            {subtitle && (
              <motion.p
                initial={fadeUp}
                animate={fadeAnim}
                transition={{ duration: 0.55, delay: 0.25, ease: EASE }}
                className="text-sm sm:text-[15px] text-white/65 mt-2 max-w-xl"
              >
                {subtitle}
              </motion.p>
            )}

            {meta && (
              <motion.div
                initial={fadeUp}
                animate={fadeAnim}
                transition={{ duration: 0.55, delay: 0.25, ease: EASE }}
                className="mt-2.5"
              >
                {meta}
              </motion.div>
            )}
          </div>
        </div>

        {/* Stats + Actions row */}
        {(stats || actions) && (
          <motion.div
            initial={fadeUp}
            animate={fadeAnim}
            transition={{ duration: 0.55, delay: 0.35, ease: EASE }}
            className="mt-6 flex flex-wrap gap-x-2.5 gap-y-3 items-center"
          >
            {stats}
            {actions && <div className="sm:ml-auto relative z-10">{actions}</div>}
          </motion.div>
        )}
      </div>
    </header>
  );
}

/* ============================================================
 * HeaderStat — stat tile with count-up
 * ============================================================ */
interface HeaderStatProps {
  value: ReactNode;
  label: string;
  icon?: LucideIcon;
  accent?: string;
}

export function HeaderStat({ value, label, icon: Icon, accent = '#fff' }: HeaderStatProps) {
  const reduced = useReducedMotion();
  const isNumeric = typeof value === 'number';

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-black/20 backdrop-blur-sm px-3.5 py-2">
      {Icon && <Icon className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />}
      <div className="flex flex-col">
        {isNumeric && !reduced ? (
          <CountUp target={value as number} duration={1.1} delay={0.45} />
        ) : (
          <span className="font-display font-bold text-lg text-white tabular-nums leading-none">{value}</span>
        )}
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/45 mt-0.5">{label}</span>
      </div>
    </div>
  );
}

function CountUp({ target, duration, delay }: { target: number; duration: number; delay: number }) {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(reduced ? target : 0);
  const mv = useMotionValue(0);

  useEffect(() => {
    if (reduced) {
      setVal(target);
      return;
    }
    mv.set(0);
    const controls = animate(mv, target, {
      duration,
      delay,
      ease: EASE,
      onUpdate: (v: number) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, reduced, mv, duration, delay]);

  return <span className="font-display font-bold text-lg text-white tabular-nums leading-none">{val}</span>;
}

/* ============================================================
 * LivePill — pill with pinging dot
 * ============================================================ */
interface LivePillProps {
  accent: string;
  children: ReactNode;
}

export function LivePill({ accent, children }: LivePillProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white/85"
      style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
    >
      <span className="relative flex w-2 h-2">
        <span className="absolute inline-flex h-full w-full rounded-full animate-ping" style={{ background: accent }} />
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: accent }} />
      </span>
      {children}
    </span>
  );
}

/* ============================================================
 * CommunityIndexHeader
 * ============================================================ */
interface CommunityIndexHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: string;
  accent2?: string;
  back: string;
  backLabel?: string;
  actions?: ReactNode;
  stats?: ReactNode;
  meta?: ReactNode;
}

export function CommunityIndexHeader({
  title, subtitle, icon, accent = '#a78bfa', accent2 = '#38bdf8',
  back, backLabel, actions, stats, meta,
}: CommunityIndexHeaderProps) {
  return (
    <HeroHeader
      title={title} subtitle={subtitle} accent={accent} accent2={accent2}
      icon={icon} back={back} backLabel={backLabel}
      actions={actions} stats={stats} meta={meta} variant="index"
    />
  );
}

/* ============================================================
 * BoardHeader
 * ============================================================ */
interface BoardHeaderProps {
  title: string;
  subtitle?: string;
  accent: string;
  icon?: LucideIcon;
  back: string;
  backLabel?: string;
  actions?: ReactNode;
  stats?: ReactNode;
  meta?: ReactNode;
}

export function BoardHeader({
  title, subtitle, accent, icon, back, backLabel, actions, stats, meta,
}: BoardHeaderProps) {
  return (
    <HeroHeader
      title={title} subtitle={subtitle} accent={accent}
      icon={icon} back={back} backLabel={backLabel}
      actions={actions} stats={stats} meta={meta} variant="board"
    />
  );
}

/* ============================================================
 * PostDetailHeader — slim breadcrumb style
 * ============================================================ */
interface PostDetailHeaderProps {
  boardName?: string;
  boardId?: string | null;
  accent?: string;
  back: string;
  backLabel?: string;
  actions?: ReactNode;
}

export function PostDetailHeader({
  boardName, boardId, accent = '#3b82f6', back, backLabel = 'Back', actions,
}: PostDetailHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="relative w-full overflow-hidden border-b border-white/10">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `linear-gradient(100deg, ${accent}26 0%, ${accent}0c 40%, transparent 75%)`,
      }} />
      <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none" style={{
        background: `linear-gradient(to right, ${accent}, ${accent}00 70%)`,
      }} />

      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative px-4 sm:px-6 py-3.5 max-w-4xl mx-auto"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm min-w-0">
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
                  onClick={() => navigate(boardId ? `/spaces/${boardId}?tab=posts` : '/spaces')}
                  className="flex items-center gap-1.5 text-white/70 hover:text-white transition-colors truncate"
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

/* Backward-compatible alias */
export const CommunityHeroHeader = BoardHeader;
