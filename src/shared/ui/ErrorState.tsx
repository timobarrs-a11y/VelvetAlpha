import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'An unexpected error occurred. Please try again.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      <div className="mb-5 w-16 h-16 rounded-2xl bg-danger-50 flex items-center justify-center">
        <AlertCircle className="w-7 h-7 text-danger-500" />
      </div>
      <h3 className="text-lg font-semibold text-ink mb-2 font-display">{title}</h3>
      <p className="text-sm text-ink-muted max-w-xs leading-relaxed mb-6">{description}</p>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          leftIcon={<RefreshCw className="w-4 h-4" />}
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  );
}
