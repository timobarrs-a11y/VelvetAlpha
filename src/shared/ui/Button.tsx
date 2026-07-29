import { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    isLoading = false,
    fullWidth = false,
    disabled,
    children,
    className = '',
    leftIcon,
    rightIcon,
    ...props
  }, ref) => {
    const base = 'btn-base focus-visible:ring-primary-500';

    const variants: Record<string, string> = {
      primary:
        'bg-gradient-to-br from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-card hover:shadow-glow focus-visible:ring-primary-500 disabled:from-ink-disabled disabled:to-ink-disabled disabled:shadow-none',
      secondary:
        'bg-surface-100 border-2 border-surface-200 hover:border-surface-300 text-ink-secondary hover:text-ink shadow-card hover:shadow-card-hover focus-visible:ring-surface-300 disabled:bg-surface-50 disabled:text-ink-disabled disabled:border-surface-200',
      ghost:
        'bg-transparent hover:bg-surface-100 text-ink-secondary hover:text-ink focus-visible:ring-surface-300 disabled:text-ink-disabled disabled:hover:bg-transparent',
      danger:
        'bg-gradient-to-br from-danger-500 to-danger-600 hover:from-danger-600 hover:to-danger-700 text-white shadow-card focus-visible:ring-danger-500 disabled:from-ink-disabled disabled:to-ink-disabled disabled:shadow-none',
      success:
        'bg-gradient-to-br from-success-500 to-success-600 hover:from-success-600 hover:to-success-700 text-white shadow-card focus-visible:ring-success-500 disabled:from-ink-disabled disabled:to-ink-disabled disabled:shadow-none',
    };

    const sizes: Record<string, string> = {
      xs: 'px-2.5 py-1 text-xs rounded-xl gap-1',
      sm: 'px-3.5 py-1.5 text-sm',
      md: 'px-5 py-2.5 text-[15px]',
      lg: 'px-6 py-3 text-base',
    };

    return (
      <motion.button
        ref={ref}
        whileHover={disabled || isLoading ? {} : { scale: 1.015 }}
        whileTap={disabled || isLoading ? {} : { scale: 0.975 }}
        transition={{ duration: 0.15 }}
        className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
        disabled={disabled || isLoading}
        {...(props as any)}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
        ) : leftIcon ? (
          <span className="flex-shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {!isLoading && rightIcon && (
          <span className="flex-shrink-0">{rightIcon}</span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
