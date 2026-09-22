import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useTypingEffect } from '../hooks/useTypingEffect';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useShell } from '../shells/ShellProvider';

interface AtlasTransitionOverlayProps {
  message: string;
  subMessage?: string;
  destination: string;
  visible: boolean;
  autoAdvanceMs?: number;
  onAdvance?: () => void;
}

export function AtlasTransitionOverlay({
  message,
  subMessage,
  destination,
  visible,
  autoAdvanceMs = 3500,
  onAdvance,
}: AtlasTransitionOverlayProps) {
  const navigate = useNavigate();
  const { manifest } = useShell();
  const reduced = usePrefersReducedMotion();
  const [showButton, setShowButton] = useState(false);
  const [showSub, setShowSub] = useState(false);

  const { displayedText: typedMessage, showCursor } = useTypingEffect(
    message,
    visible,
    { speed: 55 },
  );

  useEffect(() => {
    if (!visible) {
      setShowButton(false);
      setShowSub(false);
      return;
    }
    const subTimer = setTimeout(() => setShowSub(true), 800);
    const btnTimer = setTimeout(() => setShowButton(true), autoAdvanceMs);
    return () => {
      clearTimeout(subTimer);
      clearTimeout(btnTimer);
    };
  }, [visible, autoAdvanceMs]);

  const handleAdvance = () => {
    if (onAdvance) onAdvance();
    navigate(destination, { replace: true });
  };

  const ease = manifest.motion.ease;
  const durSlow = manifest.motion.durationSlow / 1000;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'rgba(7,9,15,0.92)',
              backdropFilter: 'blur(16px)',
            }}
          />

          {/* Grain texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.02]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
              backgroundSize: '160px',
            }}
          />

          {/* Ambient glow behind content */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 420,
              height: 300,
              borderRadius: '50%',
              background: `radial-gradient(ellipse, var(--shell-accent-soft) 0%, transparent 70%)`,
            }}
            animate={reduced ? undefined : { opacity: [0.4, 0.8, 0.4], scale: [0.95, 1.08, 0.95] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            className="relative text-center max-w-md"
            initial={{ scale: 0.88, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={
              reduced
                ? { duration: 0.3 }
                : { type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }
            }
          >
            {/* Atlas crest -- staggered entrance */}
            <motion.div
              className="flex justify-center mb-8"
              initial={{ scale: 0.3, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={
                reduced
                  ? { duration: 0.3 }
                  : { delay: 0.15, type: 'spring', stiffness: 200, damping: 14 }
              }
            >
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center relative"
                style={{
                  background: 'var(--shell-surface)',
                  border: '1px solid var(--shell-border-strong)',
                  backdropFilter: 'blur(12px)',
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-3xl"
                  style={{
                    background: 'radial-gradient(circle, var(--shell-accent-soft) 0%, transparent 70%)',
                  }}
                  animate={reduced ? undefined : { opacity: [0.3, 0.7, 0.3], scale: [0.85, 1.15, 0.85] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                <img
                  src={`data:image/svg+xml,${encodeURIComponent(manifest.crestSvg ?? '')}`}
                  alt="Atlas crest"
                  className="w-9 h-9 relative z-10"
                />
              </div>
            </motion.div>

            {/* Headline -- typed out */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: durSlow, ease }}
            >
              <p
                className="text-[10px] font-bold tracking-[0.24em] uppercase mb-4"
                style={{
                  color: 'var(--shell-accent-text)',
                  fontFamily: 'var(--shell-display-font)',
                }}
              >
                {manifest.copy.agentName}
              </p>
              <h2
                className="text-2xl font-bold mb-4 leading-tight"
                style={{
                  fontFamily: 'var(--shell-display-font)',
                  color: 'var(--shell-text-primary)',
                }}
              >
                {typedMessage}
                {showCursor && (
                  <motion.span
                    className="inline-block w-[2px] h-[0.9em] ml-0.5 align-text-bottom rounded-full"
                    style={{ background: 'var(--shell-accent)' }}
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                  />
                )}
              </h2>

              {/* Sub-message -- staggered fade */}
              <AnimatePresence>
                {showSub && subMessage && (
                  <motion.p
                    className="text-base leading-relaxed mb-8"
                    style={{ color: 'var(--shell-text-secondary)' }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: durSlow, ease }}
                  >
                    {subMessage}
                  </motion.p>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Button -- last to appear */}
            <AnimatePresence>
              {showButton && (
                <motion.button
                  initial={{ opacity: 0, y: 16, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={
                    reduced
                      ? { duration: 0.3 }
                      : { type: 'spring', stiffness: 200, damping: 16 }
                  }
                  onClick={handleAdvance}
                  whileHover={reduced ? undefined : { scale: 1.02 }}
                  whileTap={reduced ? undefined : { scale: 0.97 }}
                  className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-base transition-all"
                  style={{
                    background: 'var(--shell-accent)',
                    color: 'var(--shell-bg)',
                  }}
                >
                  Continue
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              )}
            </AnimatePresence>

            {/* Waiting indicator before button appears */}
            {!showButton && (
              <motion.div
                className="flex justify-center gap-1.5 mt-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'var(--shell-accent)' }}
                    animate={reduced ? undefined : { opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.25, ease: 'easeInOut' }}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
