import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, ChevronRight } from 'lucide-react';
import { VELVET_THEME } from '../config/velvetTheme';
import { useTypingEffect } from '../hooks/useTypingEffect';

interface AtlasTransitionOverlayProps {
  message: string;
  subMessage?: string;
  destination: string;
  visible: boolean;
  autoAdvanceMs?: number;
  onAdvance?: () => void;
}

const OVERLAY_ORBS = [
  { x: '-10%', y: '20%', w: 400, h: 400, color: 'rgba(244,114,182,0.08)', blur: 110, dur: 28 },
  { x: '60%', y: '50%', w: 360, h: 360, color: 'rgba(192,132,252,0.06)', blur: 100, dur: 34 },
];

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

          {/* Ambient orbs */}
          {OVERLAY_ORBS.map((orb, i) => (
            <motion.div
              key={i}
              className="absolute pointer-events-none"
              style={{
                left: orb.x,
                top: orb.y,
                width: orb.w,
                height: orb.h,
                borderRadius: '50%',
                background: orb.color,
                filter: `blur(${orb.blur}px)`,
              }}
              animate={{
                x: ['0%', i % 2 === 0 ? '3%' : '-2%', '0%'],
                y: ['0%', '1.5%', '0%'],
              }}
              transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut' }}
            />
          ))}

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
              background: 'radial-gradient(ellipse, rgba(244,114,182,0.10) 0%, transparent 70%)',
            }}
            animate={{ opacity: [0.4, 0.8, 0.4], scale: [0.95, 1.08, 0.95] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          <motion.div
            className="relative text-center max-w-md"
            initial={{ scale: 0.88, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
          >
            {/* Atlas compass icon -- staggered entrance */}
            <motion.div
              className="flex justify-center mb-8"
              initial={{ scale: 0.3, opacity: 0, rotate: -90 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 14 }}
            >
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center relative"
                style={{
                  background: VELVET_THEME.colors.glassCard,
                  border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
                  backdropFilter: 'blur(12px)',
                }}
              >
                <motion.div
                  className="absolute inset-0 rounded-3xl"
                  style={{
                    background: 'radial-gradient(circle, rgba(244,114,182,0.18) 0%, transparent 70%)',
                  }}
                  animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.85, 1.15, 0.85] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                <Compass className="w-8 h-8 text-rose-300 relative z-10" />
              </div>
            </motion.div>

            {/* Headline -- typed out */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
            >
              <p
                className="text-[10px] font-bold tracking-[0.24em] uppercase mb-4"
                style={{ color: 'rgba(244,114,182,0.7)' }}
              >
                Atlas
              </p>
              <h2 className="text-2xl font-bold text-white mb-4 leading-tight">
                {typedMessage}
                {showCursor && (
                  <motion.span
                    className="inline-block w-[2px] h-[0.9em] ml-0.5 align-text-bottom rounded-full"
                    style={{ background: 'rgba(244,114,182,0.6)' }}
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                )}
              </h2>

              {/* Sub-message -- staggered fade */}
              <AnimatePresence>
                {showSub && subMessage && (
                  <motion.p
                    className="text-ink-muted text-base leading-relaxed mb-8"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
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
                  transition={{ type: 'spring', stiffness: 200, damping: 16 }}
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

            {/* Waiting dots before button appears */}
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
                    style={{ background: 'rgba(244,114,182,0.5)' }}
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
