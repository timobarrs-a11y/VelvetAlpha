import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BridgeLine {
  text: string;
}

interface HonestBridgeProps {
  lines: BridgeLine[];
  onComplete: () => void;
  durationMs?: number;
}

export function HonestBridge({ lines, onComplete, durationMs = 3500 }: HonestBridgeProps) {
  const [currentLine, setCurrentLine] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const perLine = durationMs / lines.length;
    const timers: ReturnType<typeof setTimeout>[] = [];

    lines.forEach((_, i) => {
      timers.push(setTimeout(() => setCurrentLine(i), i * perLine));
    });

    timers.push(setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 400);
    }, durationMs));

    return () => timers.forEach(clearTimeout);
  }, [lines, durationMs, onComplete]);

  return (
    <motion.div
      className="min-h-screen bg-[#080b14] flex items-center justify-center p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-md w-full text-center">
        <motion.div
          className="mb-8 mx-auto"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="relative w-16 h-16 mx-auto">
            <motion.div
              className="absolute inset-0 rounded-full bg-rose-500/20 blur-xl"
              animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-rose-500/30"
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-3 rounded-full bg-gradient-to-br from-rose-500/30 to-pink-500/20"
              animate={{ scale: [1, 0.95, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>

        <AnimatePresence mode="wait">
          {lines.slice(0, currentLine + 1).map((line, i) => (
            <motion.p
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: i === currentLine ? 1 : 0.3, y: 0 }}
              transition={{ duration: 0.4 }}
              className={`text-lg font-medium mb-3 ${i === currentLine ? 'text-white' : 'text-gray-600'}`}
            >
              {line.text}
            </motion.p>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
