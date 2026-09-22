import { motion } from 'framer-motion';
import { Check, RotateCcw, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { useShell } from '../ShellProvider';

interface AtlasBriefCardProps {
  children: ReactNode;
  onAccept?: () => void;
  onRefine?: () => void;
  acceptLabel?: string;
  refineLabel?: string;
  disabled?: boolean;
  showActions?: boolean;
}

export function AtlasBriefCard({
  children,
  onAccept,
  onRefine,
  acceptLabel = 'Yes, set me up',
  refineLabel = 'Not quite, let me refine',
  disabled = false,
  showActions = true,
}: AtlasBriefCardProps) {
  const { manifest } = useShell();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: manifest.motion.durationSlow / 1000, ease: manifest.motion.ease }}
      className="max-w-[88%] w-full"
    >
      <div
        className="rounded-2xl rounded-bl-md overflow-hidden"
        style={{
          background: 'var(--shell-surface)',
          border: '1px solid var(--shell-border-strong)',
          backdropFilter: 'blur(16px)',
          boxShadow: 'var(--shell-shadow)',
        }}
      >
        <div
          className="px-5 py-3 flex items-center gap-2"
          style={{
            borderBottom: '1px solid var(--shell-border)',
            background: 'var(--shell-accent-soft)',
          }}
        >
          <Sparkles className="w-4 h-4" style={{ color: 'var(--shell-accent)' }} />
          <span
            className="text-[11px] font-bold tracking-[0.18em] uppercase"
            style={{
              color: 'var(--shell-accent-text)',
              fontFamily: 'var(--shell-display-font)',
            }}
          >
            Your Brief
          </span>
        </div>

        <div
          className="px-5 py-4 text-[15px] leading-relaxed"
          style={{ color: 'var(--shell-agent-bubble-text)' }}
        >
          {children}
        </div>

        {showActions && onAccept && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="flex gap-3 px-5 pb-5"
          >
            <button
              onClick={onAccept}
              disabled={disabled}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'var(--shell-accent)',
                color: 'var(--shell-bg)',
              }}
            >
              <Check className="w-4 h-4" />
              {acceptLabel}
            </button>
            <button
              onClick={onRefine}
              disabled={disabled}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'transparent',
                border: '1px solid var(--shell-border-strong)',
                color: 'var(--shell-text-secondary)',
              }}
            >
              <RotateCcw className="w-4 h-4" />
              {refineLabel}
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
