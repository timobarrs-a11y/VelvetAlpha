interface LoadingStateProps {
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<string, string> = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};



export function LoadingState({ label, className = '', size = 'md' }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 gap-4 ${className}`}>
      <div className="relative">
        <div
          className={`${sizeMap[size]} rounded-full absolute inset-0`}
          style={{
            border: '2px solid rgba(255,255,255,0.06)',
            animation: 'spin 2s linear infinite reverse',
          }}
        />
        <div
          className={`${sizeMap[size]} rounded-full absolute inset-0`}
          style={{
            border: '2px solid transparent',
            borderTopColor: 'rgba(192,132,252,0.6)',
            animation: 'spin 1.2s linear infinite',
          }}
        />
        <div className={sizeMap[size]} />
      </div>
      {label && (
        <p className="text-sm text-white/50 font-medium">
          {label}
        </p>
      )}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
