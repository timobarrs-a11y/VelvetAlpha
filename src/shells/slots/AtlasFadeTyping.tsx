import { motion } from 'framer-motion';
import { useShell } from '../../shells/ShellProvider';

interface AtlasFadeTypingProps {
  label: string;
}

export function AtlasFadeTyping({ label }: AtlasFadeTypingProps) {
  const { manifest } = useShell();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: manifest.motion.durationBase / 1000, ease: manifest.motion.ease }}
      className="flex justify-start"
    >
      <div className="flex flex-col gap-2">
        <div
          className="px-5 py-4 rounded-2xl rounded-bl-md"
          style={{
            background: 'var(--shell-agent-bubble)',
            border: '1px solid var(--shell-border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-[5px] h-[5px] rounded-full"
                  style={{ background: 'var(--shell-accent)' }}
                  animate={{ opacity: [0.2, 0.8, 0.2] }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.35,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <motion.p
          className="text-[11px] ml-1"
          style={{
            color: 'var(--shell-text-muted)',
            fontFamily: 'var(--shell-display-font)',
            fontStyle: 'italic',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
        >
          {label}
        </motion.p>
      </div>
    </motion.div>
  );
}
