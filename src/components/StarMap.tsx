import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { DonationStar } from '../services/donationService';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface StarMapProps {
  stars: DonationStar[];
  newStarId?: string | null;
  className?: string;
}

interface BackgroundStar {
  x: number;
  y: number;
  size: number;
  twinkleDelay: number;
  twinkleDuration: number;
  baseOpacity: number;
}

const STAR_COLORS = ['#ffffff', '#e0e7ff', '#fef3c7', '#fbbf24', '#fde68a'];

export function StarMap({ stars, newStarId, className = '' }: StarMapProps) {
  const reducedMotion = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const [bgStars, setBgStars] = useState<BackgroundStar[]>([]);
  const [selectedStar, setSelectedStar] = useState<DonationStar | null>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });

  const generateBgStars = useCallback((w: number, h: number) => {
    const count = Math.floor((w * h) / 8000);
    const arr: BackgroundStar[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 1.8 + 0.4,
        twinkleDelay: Math.random() * 4,
        twinkleDuration: 2 + Math.random() * 4,
        baseOpacity: 0.15 + Math.random() * 0.35,
      });
    }
    setBgStars(arr);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      setDims({ width: rect.width, height: rect.height });
      generateBgStars(rect.width, rect.height);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [generateBgStars]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-2xl ${className}`}
      style={{
        background: 'radial-gradient(ellipse 100% 80% at 50% 30%, #0a0e1f 0%, #050714 50%, #020308 100%)',
        minHeight: 400,
      }}
    >
      {/* Nebula glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 20% 80%, rgba(56,89,175,0.08) 0%, transparent 60%), radial-gradient(ellipse 50% 30% at 80% 20%, rgba(120,60,80,0.06) 0%, transparent 60%)',
        }}
      />

      {/* Background twinkling stars */}
      <div className="absolute inset-0 pointer-events-none">
        {bgStars.map((bs, i) => (
          <div
            key={`bg-${i}`}
            className="absolute rounded-full"
            style={{
              left: `${bs.x * 100}%`,
              top: `${bs.y * 100}%`,
              width: `${bs.size}px`,
              height: `${bs.size}px`,
              background: '#ffffff',
              opacity: reducedMotion ? bs.baseOpacity : undefined,
              animation: reducedMotion ? undefined : `starTwinkle ${bs.twinkleDuration}s ease-in-out ${bs.twinkleDelay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Donation stars */}
      <div className="absolute inset-0">
        {stars.map((star) => {
          const isNew = star.id === newStarId;
          const colorIdx = Math.floor((star.star_x + star.star_y) * 99) % STAR_COLORS.length;
          const color = star.star_color || STAR_COLORS[colorIdx];
          const baseSize = 6 + star.star_size * 4;
          const glowSize = baseSize * 3.5;

          return (
            <button
              key={star.id}
              onClick={() => setSelectedStar(star)}
              className="absolute focus:outline-none group"
              style={{
                left: `${star.star_x * 100}%`,
                top: `${star.star_y * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isNew ? 30 : 10,
              }}
              aria-label={`Donation star — $${(star.amount_cents / 100).toFixed(0)}`}
            >
              {/* Glow halo */}
              <div
                className="absolute rounded-full pointer-events-none transition-opacity duration-300 group-hover:opacity-100"
                style={{
                  width: `${glowSize}px`,
                  height: `${glowSize}px`,
                  left: '50%',
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  background: `radial-gradient(circle, ${color}${Math.round(star.star_brightness * 60).toString(16).padStart(2, '0')} 0%, transparent 70%)`,
                  opacity: star.star_brightness * 0.7,
                }}
              />
              {/* Star core */}
              <motion.div
                initial={isNew ? { scale: 0, opacity: 0 } : false}
                animate={isNew ? { scale: [0, 1.6, 1], opacity: [0, 1, 1] } : { scale: 1, opacity: 1 }}
                transition={isNew ? { duration: 1.2, ease: 'easeOut' } : { duration: 0.3 }}
                className="relative rounded-full"
                style={{
                  width: `${baseSize}px`,
                  height: `${baseSize}px`,
                  background: color,
                  boxShadow: `0 0 ${glowSize * 0.4}px ${color}, 0 0 ${glowSize * 0.8}px ${color}55`,
                  opacity: star.star_brightness,
                }}
              >
                {/* Shimmer pulse */}
                {!reducedMotion && (
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      animation: `starPulse ${3 + star.star_size}s ease-in-out ${star.star_x * 2}s infinite`,
                    }}
                  />
                )}
              </motion.div>
            </button>
          );
        })}
      </div>

      {/* Empty state overlay */}
      {stars.length === 0 && dims.width > 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center px-6">
            <p className="text-white/30 text-sm font-medium mb-1">Your sky is waiting</p>
            <p className="text-white/20 text-xs">Each gift you give becomes a star here</p>
          </div>
        </div>
      )}

      {/* Star detail popover */}
      <AnimatePresence>
        {selectedStar && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute z-40 pointer-events-auto"
            style={{
              left: `${selectedStar.star_x * 100}%`,
              top: `${selectedStar.star_y * 100}%`,
              transform: 'translate(-50%, calc(-100% - 16px))',
            }}
          >
            <div
              className="rounded-xl px-4 py-3 backdrop-blur-md"
              style={{
                background: 'rgba(8,12,28,0.92)',
                border: '1px solid rgba(255,255,255,0.15)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                minWidth: 160,
              }}
            >
              <p className="text-white font-bold text-sm">
                ${(selectedStar.amount_cents / 100).toFixed(0)} gift
              </p>
              <p className="text-white/50 text-xs mt-0.5">
                {new Date(selectedStar.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
              {selectedStar.message && (
                <p className="text-white/70 text-xs italic mt-2 leading-snug">"{selectedStar.message}"</p>
              )}
              <button
                onClick={() => setSelectedStar(null)}
                className="absolute -bottom-2 right-3 w-5 h-5 rounded-full flex items-center justify-center text-white/40 hover:text-white/80"
                style={{ background: 'rgba(8,12,28,0.95)', border: '1px solid rgba(255,255,255,0.15)' }}
                aria-label="Close"
              >
                <span className="text-[10px]">x</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
