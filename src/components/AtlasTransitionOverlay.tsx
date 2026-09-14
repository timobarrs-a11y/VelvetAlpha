import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, ChevronRight } from 'lucide-react';
import { VELVET_THEME } from '../config/velvetTheme';

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
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setShowButton(true), autoAdvanceMs);
    return () => clearTimeout(timer);
  }, [visible, autoAdvanceMs]);

  const handleAdvance = () => {
    if (onAdvance) onAdvance();
    navigate(destination, { replace: true });
  };

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

          {/* Ambient glow */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 420,
              height: 300,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(192,132,252,0.12) 0%, transparent 70%)',
            }}
            animate={{ opacity: [0.5, 0.9, 0.5], scale: [0.95, 1.08, 0.95] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            className="relative text-center max-w-md"
            initial={{ scale: 0.88, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
          >
            {/* Atlas avatar mark */}
            <motion.div
              className="flex justify-center mb-8"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 14 }}
            >
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{
                  background: VELVET_THEME.colors.glassCard,
                  border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
                  backdropFilter: 'blur(12px)',
                }}
              >
                <Compass className="w-8 h-8 text-ink-secondary" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
            >
              <p
                className="text-[10px] font-bold tracking-[0.24em] uppercase mb-4"
                style={{ color: '#c084fc' }}
              >
                Atlas
              </p>
              <h2 className="text-2xl font-bold text-white mb-4 leading-tight">
                {message}
              </h2>
              {subMessage && (
                <p className="text-ink-muted text-base leading-relaxed mb-8">
                  {subMessage}
                </p>
              )}
            </motion.div>

            <AnimatePresence>
              {showButton && (
                <motion.button
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  onClick={handleAdvance}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl text-white font-bold text-base transition-all"
                  style={{
                    background: VELVET_THEME.button.primary,
                    boxShadow: VELVET_THEME.button.primaryGlow,
                  }}
                >
                  Continue
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              )}
            </AnimatePresence>

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
                    style={{ background: 'rgba(192,132,252,0.5)' }}
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
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
