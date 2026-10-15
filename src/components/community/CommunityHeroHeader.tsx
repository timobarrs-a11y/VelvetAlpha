import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, type LucideIcon,
  Lock, Clock, MessageCircle, Users, Pin, ChevronRight,
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
 * 2. BOARD HEADER — banner-style with accent color, description
 *    Distinct: left accent bar, colored glow matching board color
 * ============================================================ */
interface BoardHeaderProps extends BaseProps {
  title: string;
  subtitle?: string;
  accent: string;
  icon?: LucideIcon;
  stats?: React.ReactNode;
  meta?: React.ReactNode;
}

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

  return (
    <header className="relative w-full overflow-hidden border-b border-white/8">
      {/* Accent-colored glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-32 left-1/4 w-[400px] h-[400px] rounded-full opacity-40"
          style={{ background: `radial-gradient(circle, ${accent}14 0%, transparent 65%)`, filter: 'blur(80px)' }}
        />
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${accent}08 0%, transparent 60%)` }} />
      </div>
      {/* Left accent bar */}
      <div className="absolute top-0 bottom-0 left-0 w-[3px]" style={{ background: `linear-gradient(to bottom, ${accent}, transparent 80%)` }} />

      <div className="relative px-4 sm:px-6 pt-4 pb-5 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-4">
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

        <div className="flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${accent}18`, border: `1px solid ${accent}40` }}
          >
            <Icon className="w-6 h-6" style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="font-display font-bold leading-tight text-white"
              style={{ fontSize: 'clamp(22px, 3.5vw, 30px)', letterSpacing: '-0.02em' }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-white/45 mt-1 leading-relaxed max-w-2xl">{subtitle}</p>
            )}
            {stats && (
              <div className="flex items-center gap-4 mt-2.5">{stats}</div>
            )}
          </div>
        </div>

        {meta && <div className="mt-3">{meta}</div>}
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
