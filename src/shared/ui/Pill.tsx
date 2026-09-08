import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  /** Highlighted state (selected tab / toggled on). */
  active?: boolean;
  /** Tint with a feature colour (hex/rgb). */
  tone?: string;
  /** Visual style. `solid` = high-contrast (ink on ink), `quiet` = no chrome until hover. */
  variant?: 'default' | 'quiet' | 'solid';
  size?: 'sm' | 'md';
  /** Hide the label below the `sm` breakpoint (icon stays). */
  hideLabelOnMobile?: boolean;
}

/**
 * Secondary / toolbar button. Use <Button> for primary CTAs, <Pill> for
 * everything in headers, filters, and tab strips.
 */
export const Pill = forwardRef<HTMLButtonElement, PillProps>(
  ({ icon, active, tone, variant = 'default', size = 'md', hideLabelOnMobile, className = '', children, style, type = 'button', ...rest }, ref) => {
    const classes = [
      'ds-pill',
      size === 'sm' ? 'ds-pill--sm' : '',
      variant === 'quiet' ? 'ds-pill--quiet' : '',
      variant === 'solid' ? 'ds-pill--solid' : '',
      active ? 'ds-pill--active' : '',
      tone && !active ? 'ds-pill--tone' : '',
      !children ? 'ds-pill--icon' : '',
      className,
    ].filter(Boolean).join(' ');

    const toneStyle = tone ? ({ '--ds-tone': tone, ...style } as React.CSSProperties) : style;

    return (
      <button ref={ref} type={type} className={classes} style={toneStyle} {...rest}>
        {icon && <span className="flex-shrink-0 inline-flex">{icon}</span>}
        {children && (
          <span className={hideLabelOnMobile ? 'hidden sm:inline' : undefined}>{children}</span>
        )}
      </button>
    );
  }
);
Pill.displayName = 'Pill';

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  size?: 'sm' | 'md';
  className?: string;
}

/** A row of mutually-exclusive pills (period switcher, view toggle, tabs). */
export function Segmented<T extends string>({ value, onChange, options, size = 'sm', className = '' }: SegmentedProps<T>) {
  return (
    <div className={`ds-segment ${className}`} role="tablist">
      {options.map(o => (
        <Pill
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          size={size}
          active={value === o.value}
          icon={o.icon}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Pill>
      ))}
    </div>
  );
}
