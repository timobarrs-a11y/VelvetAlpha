import { HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', interactive = false, className = '', children, ...props }, ref) => {
    const paddingMap: Record<string, string> = {
      none: '',
      sm:   'p-4',
      md:   'p-6',
      lg:   'p-8',
    };

    return (
      <div
        ref={ref}
        className={`${interactive ? 'card-interactive' : 'card-base'} ${paddingMap[padding]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
