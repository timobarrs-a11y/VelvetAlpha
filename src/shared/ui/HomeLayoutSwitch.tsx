import { LayoutGrid, Newspaper } from 'lucide-react';
import { useHomeLayout, type HomeLayout, setHomeLayout as _set } from '../../hooks/useHomeLayout';
import { analyticsService } from '../../services/analyticsService';

const OPTIONS: { id: HomeLayout; label: string; shortLabel: string; description: string; icon: typeof LayoutGrid }[] = [
  { id: 'classic', label: 'Classic Lobby', shortLabel: 'Classic', description: 'The companion lobby with tiles, games, and group chats.', icon: LayoutGrid },
  { id: 'new',     label: 'New Home',      shortLabel: 'New',     description: 'A daily-feed centered home with news, rituals, and quick-start cards.', icon: Newspaper },
];

function track(to: HomeLayout) {
  analyticsService.trackEvent({
    action_type: 'feature_used',
    action_target: 'home_layout_toggle',
    page_path: window.location.pathname,
    metadata: { to },
  });
}

interface Props {
  mode?: 'compact' | 'full';
  className?: string;
}

export function HomeLayoutSwitch({ mode = 'compact', className = '' }: Props) {
  const [layout, setLayout] = useHomeLayout();

  const handleChange = (id: HomeLayout) => {
    if (id === layout) return;
    setLayout(id);
    track(id);
  };

  if (mode === 'compact') {
    return (
      <div className={`ds-segment ${className}`} role="radiogroup" aria-label="Home layout">
        {OPTIONS.map(o => {
          const Icon = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={layout === o.id}
              onClick={() => handleChange(o.id)}
              className={`ds-pill ds-pill--sm ${layout === o.id ? 'ds-pill--active' : ''}`}
              style={{ padding: '0.25rem 0.5rem' }}
              title={o.label}
            >
              <Icon className="w-3.5 h-3.5 mr-1 inline-block align-[-2px]" />
              {o.shortLabel}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`} role="radiogroup" aria-label="Home layout">
      {OPTIONS.map(o => {
        const active = layout === o.id;
        const Icon = o.icon;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => handleChange(o.id)}
            className="ds-card ds-card--interactive text-left p-4 ds-focus"
            style={active ? { borderColor: 'var(--ds-accent-line)', boxShadow: 'var(--ds-shadow-glow)' } : undefined}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-display font-bold text-ink flex items-center gap-2">
                <Icon className="w-4 h-4" />
                {o.label}
              </span>
              {active && <span className="ds-badge" style={{ '--ds-tone': 'var(--ds-accent-fg)' } as React.CSSProperties}>Active</span>}
            </div>
            <p className="text-xs ds-muted leading-relaxed">{o.description}</p>
          </button>
        );
      })}
    </div>
  );
}
