import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, type LucideIcon } from 'lucide-react';

interface CommunityHeroHeaderProps {
  title: string;
  subtitle?: string;
  accent: string;
  icon?: LucideIcon;
  back: string;
  backLabel?: string;
  actions?: React.ReactNode;
  stats?: React.ReactNode;
  meta?: React.ReactNode;
}

export function CommunityHeroHeader({
  title,
  subtitle,
  accent,
  icon: Icon = MessageSquare,
  back,
  backLabel = 'Back',
  actions,
  stats,
  meta,
}: CommunityHeroHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="relative w-full overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          background: `linear-gradient(135deg, ${accent}18 0%, transparent 50%, ${accent}08 100%)`,
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: -60,
          right: '15%',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}12 0%, transparent 65%)`,
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: `linear-gradient(to right, ${accent}, transparent 70%)` }}
      />

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
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `${accent}18`,
              border: `1px solid ${accent}40`,
              boxShadow: `0 4px 24px ${accent}20`,
            }}
          >
            <Icon className="w-7 h-7" style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className="font-display font-black leading-tight text-white"
              style={{ fontSize: 'clamp(26px, 4vw, 38px)', letterSpacing: '-0.02em' }}
            >
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-white/50 mt-1 leading-relaxed">{subtitle}</p>
            )}
            {stats && (
              <div className="flex items-center gap-4 mt-3">
                {stats}
              </div>
            )}
          </div>
        </div>

        {meta && <div className="mt-3">{meta}</div>}
      </div>
    </header>
  );
}
