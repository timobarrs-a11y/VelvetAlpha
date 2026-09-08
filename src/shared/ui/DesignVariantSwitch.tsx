import { DESIGN_VARIANTS, useDesignVariant } from '../../design/designSystem';

interface DesignVariantSwitchProps {
  /** `compact` = a small A/B toggle for toolbars; `full` = labelled cards for Settings. */
  mode?: 'compact' | 'full';
  className?: string;
}

/** A/B design-system switch. Persisted in localStorage; also settable via `?design=a|b`. */
export function DesignVariantSwitch({ mode = 'compact', className = '' }: DesignVariantSwitchProps) {
  const [variant, setVariant] = useDesignVariant();

  if (mode === 'compact') {
    return (
      <div className={`ds-segment ${className}`} role="radiogroup" aria-label="Design variant" title="Design system A/B">
        {DESIGN_VARIANTS.map(v => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={variant === v.id}
            onClick={() => setVariant(v.id)}
            className={`ds-pill ds-pill--sm ${variant === v.id ? 'ds-pill--active' : ''}`}
            style={{ minWidth: '2rem', padding: '0.25rem 0.5rem' }}
            title={v.label}
          >
            {v.id.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${className}`} role="radiogroup" aria-label="Design variant">
      {DESIGN_VARIANTS.map(v => {
        const active = variant === v.id;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setVariant(v.id)}
            className="ds-card ds-card--interactive text-left p-4 ds-focus"
            style={active ? { borderColor: 'var(--ds-accent-line)', boxShadow: 'var(--ds-shadow-glow)' } : undefined}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-display font-bold text-ink">{v.label}</span>
              {active && <span className="ds-badge" style={{ '--ds-tone': 'var(--ds-accent-fg)' } as React.CSSProperties}>Active</span>}
            </div>
            <p className="text-xs ds-muted leading-relaxed">{v.description}</p>
          </button>
        );
      })}
    </div>
  );
}
