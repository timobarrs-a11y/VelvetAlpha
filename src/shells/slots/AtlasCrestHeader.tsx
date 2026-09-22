import { motion } from 'framer-motion';
import { useShell } from '../../shells/ShellProvider';

interface AtlasCrestHeaderProps {
  subtitle: string;
}

export function AtlasCrestHeader({ subtitle }: AtlasCrestHeaderProps) {
  const { manifest } = useShell();
  const crestSvg = manifest.crestSvg;

  return (
    <div className="text-center mb-6 flex-shrink-0">
      <div className="flex justify-center mb-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden"
          style={{
            background: 'var(--shell-surface)',
            border: '1px solid var(--shell-border-strong)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: 'radial-gradient(circle, var(--shell-accent-soft) 0%, transparent 70%)',
            }}
            animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.85, 1.15, 0.85] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />
          {crestSvg ? (
            <img
              src={`data:image/svg+xml,${encodeURIComponent(crestSvg)}`}
              alt="Atlas crest"
              className="w-9 h-9 relative z-10"
            />
          ) : null}
        </motion.div>
      </div>
      <h1
        className="text-2xl font-bold"
        style={{
          fontFamily: 'var(--shell-display-font)',
          color: 'var(--shell-text-primary)',
          letterSpacing: '0.01em',
        }}
      >
        {manifest.copy.agentName}
      </h1>
      <p
        className="text-sm mt-1.5"
        style={{ color: 'var(--shell-text-secondary)' }}
      >
        {subtitle}
      </p>
    </div>
  );
}
