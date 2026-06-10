import { ReactNode } from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
  };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      {icon && (
        <div className="mb-5 w-16 h-16 rounded-2xl bg-surface-100 flex items-center justify-center text-ink-muted">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-ink mb-2 font-display">{title}</h3>
      {description && (
        <p className="text-sm text-ink-muted max-w-xs leading-relaxed mb-6">{description}</p>
      )}
      {!description && action && <div className="mb-6" />}
      {action && (
        <Button variant={action.variant ?? 'primary'} size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
