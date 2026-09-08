import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

type Width = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

const WIDTH: Record<Width, string> = {
  sm:   'max-w-md',
  md:   'max-w-2xl',
  lg:   'max-w-4xl',
  xl:   'max-w-6xl',
  '2xl':'max-w-7xl',
  full: 'max-w-full',
};

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: LucideIcon;
  /** Feature accent colour (hex/rgb). Drives the icon chip tint only. */
  accent?: string;
  /** Custom leading element (e.g. a monogram) rendered instead of the icon chip. */
  leading?: ReactNode;
  /** Back behaviour: a path (string), a handler, or `false` to hide. Defaults to `/lobby`. */
  back?: string | (() => void) | false;
  backLabel?: string;
  /** Right-aligned toolbar content. */
  actions?: ReactNode;
  /** Second row (tabs / filters) rendered under the title row. */
  children?: ReactNode;
  width?: Width;
  sticky?: boolean;
  /** Optional slim progress bar under the header (e.g. while refreshing). */
  progress?: boolean;
  className?: string;
}

/**
 * The one header used by every non-companion screen.
 * Sticky glass bar · back control · icon chip · title · optional subtitle · actions · optional second row.
 */
export function PageHeader({
  title,
  subtitle,
  icon: Icon,
  accent,
  leading,
  back = '/lobby',
  backLabel = 'Back',
  actions,
  children,
  width = 'xl',
  sticky = true,
  progress = false,
  className = '',
}: PageHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (back === false) return;
    if (typeof back === 'function') back();
    else navigate(back);
  };

  const toneStyle = accent ? ({ '--ds-tone': accent } as React.CSSProperties) : undefined;

  return (
    <header className={`ds-header ${sticky ? '' : '!static'} ${className}`}>
      <div className={`w-full ${WIDTH[width]} mx-auto px-4 sm:px-6`}>
        <div className="ds-header-row py-2">
          {back !== false && (
            <button
              type="button"
              onClick={handleBack}
              className="ds-pill ds-pill--icon ds-pill--quiet -ml-2"
              aria-label={backLabel}
              title={backLabel}
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          {leading ?? (Icon && (
            <span className="ds-chip w-9 h-9" style={toneStyle}>
              <Icon className="w-[18px] h-[18px]" />
            </span>
          ))}

          <div className="min-w-0 flex-1">
            <h1 className="font-display font-bold text-lg sm:text-xl leading-tight text-ink truncate">{title}</h1>
            {subtitle && <p className="text-xs sm:text-sm ds-muted truncate leading-snug">{subtitle}</p>}
          </div>

          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>

        {children && <div className="pb-3 -mt-1">{children}</div>}
      </div>

      {progress && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
          <div className="h-full w-2/5 animate-shimmer" style={{ background: 'var(--ds-accent)', opacity: 0.7 }} />
        </div>
      )}
    </header>
  );
}
