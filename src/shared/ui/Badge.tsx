import { HTMLAttributes, ReactNode } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Tint colour (hex/rgb). Defaults to neutral ink. */
  tone?: string;
  icon?: ReactNode;
  /** Solid, blurred variant for use on top of imagery (avatar portraits). */
  overlay?: boolean;
  size?: 'xs' | 'sm';
}

export function Badge({ tone, icon, overlay, size = 'sm', className = '', style, children, ...rest }: BadgeProps) {
  const toneStyle = tone ? ({ '--ds-tone': tone, ...style } as React.CSSProperties) : style;
  return (
    <span
      className={`ds-badge ${overlay ? 'ds-badge--overlay' : ''} ${size === 'xs' ? 'ds-badge--xs' : ''} ${className}`}
      style={toneStyle}
      {...rest}
    >
      {icon}
      {children}
    </span>
  );
}
