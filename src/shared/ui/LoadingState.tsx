import { useEffect, useState } from 'react';

interface LoadingStateProps {
  label?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  contextual?: boolean;
}

const sizeMap: Record<string, string> = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

const CONTEXT_PHRASES = [
  'Warming up your world...',
  'Loading your companions...',
  'Finding today\'s thread...',
  'Gathering your memories...',
];

export function LoadingState({ label, className = '', size = 'md', contextual = false }: LoadingStateProps) {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    if (!contextual) return;
    const interval = setInterval(() => {
      setPhraseIdx(prev => (prev + 1) % CONTEXT_PHRASES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [contextual]);

  const displayLabel = contextual ? CONTEXT_PHRASES[phraseIdx] : label;

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
      {displayLabel && (
        <p
          className="text-sm text-white/50 font-medium transition-opacity duration-500"
          style={contextual ? { animation: 'fadeInOut 2.2s ease-in-out infinite' } : undefined}
          key={contextual ? phraseIdx : undefined}
        >
          {displayLabel}
        </p>
      )}
      <style>{`
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
