import { motion } from 'framer-motion';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { useShell } from '../ShellProvider';

const ATLAS_ORBS = [
  { x: '-8%', y: '10%', w: 520, h: 520, opacity: 0.07, blur: 120, dur: 30 },
  { x: '65%', y: '55%', w: 440, h: 440, opacity: 0.05, blur: 110, dur: 36 },
  { x: '30%', y: '-10%', w: 380, h: 380, opacity: 0.04, blur: 100, dur: 42 },
];

export function AtlasBackgroundScene() {
  const { tokens } = useShell();
  const reduced = usePrefersReducedMotion();

  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 20% -10%, ${tokens.accentSoft} 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 110%, ${tokens.accentSoft} 0%, transparent 60%)`,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '160px',
        }}
      />
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {ATLAS_ORBS.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: orb.x,
              top: orb.y,
              width: orb.w,
              height: orb.h,
              borderRadius: '50%',
              background: tokens.accent,
              opacity: orb.opacity,
              filter: `blur(${orb.blur}px)`,
            }}
            animate={
              reduced
                ? undefined
                : {
                    x: ['0%', i % 2 === 0 ? '3%' : '-2%', '0%'],
                    y: ['0%', i % 2 === 0 ? '2%' : '-1.5%', '0%'],
                  }
            }
            transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>
    </>
  );
}
