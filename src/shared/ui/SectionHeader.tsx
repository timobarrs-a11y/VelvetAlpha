import { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface SectionHeaderProps {
  title: ReactNode;
  icon?: LucideIcon;
  /** Accent colour for the icon (hex/rgb). */
  tone?: string;
  /** Small badge/tag rendered after the title. */
  badge?: ReactNode;
  /** Right-aligned action (usually a <Pill>). */
  action?: ReactNode;
  description?: ReactNode;
  className?: string;
}

/** Consistent section heading used inside pages (Lobby sections, Settings groups…). */
export function SectionHeader({ title, icon: Icon, tone, badge, action, description, className = '' }: SectionHeaderProps) {
  const toneStyle = tone ? ({ '--ds-tone': tone } as React.CSSProperties) : undefined;
  return (
    <div className={`flex items-start justify-between gap-4 mb-5 ${className}`}>
      <div className="min-w-0">
        <h2 className="ds-section-title" style={toneStyle}>
          {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
          <span className="truncate">{title}</span>
          {badge}
        </h2>
        {description && <p className="text-sm ds-muted mt-1">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
