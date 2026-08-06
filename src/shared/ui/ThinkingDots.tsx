interface ThinkingDotsProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const dotSize: Record<string, string> = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export function ThinkingDots({ size = 'md', className = '' }: ThinkingDotsProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`${dotSize[size]} rounded-full`}
          style={{
            background: 'rgba(192,132,252,0.5)',
            animation: `thinkBounce 1.4s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes thinkBounce {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

interface CompanionThinkingProps {
  name?: string;
  className?: string;
}

export function CompanionThinking({ name = 'Companion', className = '' }: CompanionThinkingProps) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl rounded-bl-md ${className}`}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, rgba(192,132,252,0.3), rgba(244,114,182,0.25))',
          border: '1px solid rgba(192,132,252,0.3)',
        }}
      >
        <div
          className="w-3 h-3 rounded-full"
          style={{
            background: 'rgba(255,255,255,0.8)',
            animation: 'breathe 2s ease-in-out infinite',
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-white/40 text-[10px] font-medium">{name} is thinking</span>
        <ThinkingDots size="sm" />
      </div>
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
