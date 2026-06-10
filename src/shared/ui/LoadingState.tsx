interface LoadingStateProps {
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<string, string> = {
  sm: 'w-8 h-8 border-2',
  md: 'w-12 h-12 border-[3px]',
  lg: 'w-16 h-16 border-4',
};

export function LoadingState({ label, className = '', size = 'md' }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 gap-4 ${className}`}>
      <div className="relative">
        <div className={`${sizeMap[size]} rounded-full border-surface-200`} />
        <div className={`absolute inset-0 ${sizeMap[size]} rounded-full border-t-primary-500 animate-spin`} />
      </div>
      {label && <p className="text-sm text-ink-muted">{label}</p>}
    </div>
  );
}
