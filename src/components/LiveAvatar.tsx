import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AvatarConfig } from '../types/avatar';
import { AvatarConfigV2 } from '../types/avatar-v2';
import { AvatarV2 } from './AvatarV2';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

// A living portrait: the avatar blinks now and then, breathes with a slow
// sway, and every so often breaks into a smile. Each one keeps its own
// timing, so a row of them never moves in step. Still for anyone who asks
// for reduced motion, and quiet while the tab is hidden.

interface LiveAvatarProps {
  config: AvatarConfig | Partial<AvatarConfigV2>;
  className?: string;
  // Frame the portrait on head and shoulders, for small round frames.
  portrait?: boolean;
}

const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);

export function LiveAvatar({ config, className = '', portrait = false }: LiveAvatarProps) {
  const reduced = usePrefersReducedMotion();
  const [blinking, setBlinking] = useState(false);
  const [smiling, setSmiling] = useState(false);
  // Each portrait breathes at its own pace.
  const sway = useMemo(() => ({ duration: between(5.5, 8), delay: between(0, 3), tilt: between(0.8, 1.6) }), []);

  useEffect(() => {
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    const blink = () => {
      timer = setTimeout(() => {
        if (!document.hidden) {
          setBlinking(true);
          // Sometimes a quick double blink.
          const twice = Math.random() < 0.2;
          setTimeout(() => {
            setBlinking(false);
            if (twice) setTimeout(() => { setBlinking(true); setTimeout(() => setBlinking(false), 120); }, 160);
          }, 130);
        }
        blink();
      }, between(2600, 6500));
    };
    blink();
    return () => clearTimeout(timer);
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    let timer: ReturnType<typeof setTimeout>;
    const smile = () => {
      timer = setTimeout(() => {
        if (!document.hidden) {
          setSmiling(true);
          setTimeout(() => setSmiling(false), between(1600, 2800));
        }
        smile();
      }, between(9000, 22000));
    };
    smile();
    return () => clearTimeout(timer);
  }, [reduced]);

  const drawn = (
    <AvatarV2
      config={config as Partial<AvatarConfigV2>}
      className="h-full w-full"
      eyesClosed={blinking}
      mood={smiling ? 'smile' : 'neutral'}
    />
  );
  const face = portrait
    ? <div className="h-full w-full" style={{ transform: 'scale(1.5)', transformOrigin: '50% 34%' }}>{drawn}</div>
    : drawn;

  if (reduced) return <div className={className}>{face}</div>;
  return (
    <motion.div
      className={className}
      style={{ transformOrigin: '50% 90%' }}
      animate={{ y: [0, -0.8, 0, 0.4, 0], rotate: [0, sway.tilt, 0, -sway.tilt, 0] }}
      transition={{ duration: sway.duration, delay: sway.delay, repeat: Infinity, ease: 'easeInOut' }}
    >
      {face}
    </motion.div>
  );
}
