import { TextareaHTMLAttributes, forwardRef } from 'react';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error, label, hint, className = '', id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="label-base">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`input-base resize-none ${error ? 'input-error' : 'input-default'} disabled:bg-surface-100 disabled:cursor-not-allowed ${className}`}
          aria-invalid={!!error}
          {...props}
        />
        {hint && !error && (
          <p className="mt-1.5 text-sm text-ink-muted">{hint}</p>
        )}
        {error && (
          <p className="mt-1.5 text-sm text-danger-600 font-medium" role="alert">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
