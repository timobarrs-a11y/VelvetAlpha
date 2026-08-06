import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Calendar, Newspaper, PenLine, Sparkles, Clock } from 'lucide-react';

type Msg = { id: number; text: string; isUser: boolean };

const SCRIPT: Msg[] = [
  { id: 0, text: 'hey! how was your day? 🌙', isUser: false },
  { id: 1, text: 'Pretty good actually, finally started that book you recommended', isUser: true },
  { id: 2, text: 'no way! the first three chapters are the best part — did you get to the part with the letter?', isUser: false },
  { id: 3, text: 'Not yet, only chapter two. The writing style is incredible though', isUser: true },
  { id: 4, text: 'told you!! keep reading tonight, you will not regret it 💜', isUser: false },
];

const ROTATING_PREVIEWS = [
  { icon: Newspaper, label: 'Daily Feed', sub: 'Today\'s top stories, curated for you', accent: '14,165,233' },
  { icon: Calendar, label: 'Calendar', sub: 'Your day, your events, always in sync', accent: '251,191,36' },
  { icon: PenLine, label: 'Co-Author', sub: 'Write your next chapter together', accent: '232,121,249' },
];

export function SplashChatPreview({ lite }: { lite: boolean }) {
  const [visibleMsgs, setVisibleMsgs] = useState<Msg[]>([]);
  const [typing, setTyping] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);

  useEffect(() => {
    let msgIdx = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const showNext = () => {
      if (msgIdx >= SCRIPT.length) {
        timeout = setTimeout(() => {
          setVisibleMsgs([]);
          msgIdx = 0;
          showNext();
        }, 4000);
        return;
      }
      const msg = SCRIPT[msgIdx];
      if (!msg.isUser) {
        setTyping(true);
        timeout = setTimeout(() => {
          setTyping(false);
          setVisibleMsgs(prev => [...prev, msg]);
          msgIdx++;
          timeout = setTimeout(showNext, 1800);
        }, 1400);
      } else {
        setVisibleMsgs(prev => [...prev, msg]);
        msgIdx++;
        timeout = setTimeout(showNext, 1200);
      }
    };

    const startDelay = setTimeout(showNext, 800);
    return () => { clearTimeout(startDelay); clearTimeout(timeout); };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setPreviewIdx(prev => (prev + 1) % ROTATING_PREVIEWS.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);


  return (
    <div className="relative w-full max-w-5xl mx-auto" style={{ perspective: '1200px' }}>
      <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-8">

        {/* Companion avatar card */}
        <motion.div
          className="flex-shrink-0 order-2 lg:order-1"
          initial={lite ? { opacity: 0 } : { opacity: 0, x: -40, rotateY: 15 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        >
          <div
            className="w-36 h-44 lg:w-40 lg:h-48 rounded-2xl flex flex-col items-center justify-center p-4 relative overflow-hidden"
            style={{
              background: 'rgba(13,15,55,0.75)',
              border: '1px solid rgba(192,132,252,0.22)',
              backdropFilter: lite ? undefined : 'blur(16px)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(192,132,252,0.15), transparent 70%)',
              }}
            />
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-3 relative z-10"
              style={{
                background: 'linear-gradient(135deg, rgba(192,132,252,0.3), rgba(244,114,182,0.25))',
                border: '2px solid rgba(192,132,252,0.4)',
                boxShadow: '0 0 24px rgba(192,132,252,0.2)',
              }}
            >
              <motion.div
                animate={lite ? undefined : { scale: [1, 1.05, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="text-3xl"
              >
                ✨
              </motion.div>
            </div>
            <p className="text-white text-sm font-bold relative z-10">Riley</p>
            <p className="text-gray-400 text-[10px] relative z-10 mt-0.5">Your companion</p>
            <div className="flex items-center gap-1.5 mt-2 relative z-10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-emerald-400/80 text-[9px] font-medium">Online</span>
            </div>
          </div>
        </motion.div>

        {/* Chat mockup */}
        <motion.div
          className="flex-1 max-w-md order-1 lg:order-2"
          initial={lite ? { opacity: 0 } : { opacity: 0, y: 30, rotateX: 8 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(10,12,35,0.82)',
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: lite ? undefined : 'blur(20px)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.04)',
            }}
          >
            {/* Chat header */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="w-8 h-8 rounded-full" style={{ background: 'linear-gradient(135deg, rgba(192,132,252,0.4), rgba(244,114,182,0.3))' }} />
              <div className="flex-1">
                <p className="text-white text-xs font-semibold">Riley</p>
                <p className="text-emerald-400/70 text-[9px]">Active now</p>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-purple-400/50" />
            </div>

            {/* Messages */}
            <div className="px-4 py-4 space-y-2.5 min-h-[220px] max-h-[220px] overflow-hidden flex flex-col justify-end">
              <AnimatePresence mode="popLayout">
                {visibleMsgs.map((msg) => (
                  <motion.div
                    key={msg.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${msg.isUser ? 'rounded-br-md' : 'rounded-bl-md'}`}
                      style={
                        msg.isUser
                          ? { background: 'rgba(192,132,252,0.22)', border: '1px solid rgba(192,132,252,0.15)', color: '#e9d5ff' }
                          : { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#d1d5db' }
                      }
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              <AnimatePresence>
                {typing && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-start"
                  >
                    <div
                      className="px-4 py-2.5 rounded-2xl rounded-bl-md flex items-center gap-1"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-gray-400"
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                          transition={{ duration: 1, delay: i * 0.15, repeat: Infinity }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input bar mockup */}
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div
                className="flex-1 h-8 rounded-full px-3 flex items-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="text-gray-600 text-[10px]">Type a message...</span>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(192,132,252,0.5), rgba(244,114,182,0.4))' }}>
                <motion.div
                  animate={lite ? undefined : { scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-3 h-3 rounded-full bg-white/90"
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* Right column: rotating preview + memory chip */}
        <motion.div
          className="flex-shrink-0 order-3 flex flex-col gap-3 w-full lg:w-52"
          initial={lite ? { opacity: 0 } : { opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease: 'easeOut' }}
        >
          {/* Rotating preview panel */}
          <div
            className="rounded-2xl p-4 relative overflow-hidden h-28"
            style={{
              background: 'rgba(13,15,55,0.72)',
              border: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: lite ? undefined : 'blur(16px)',
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={previewIdx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
                className="flex flex-col items-start gap-2"
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: `rgba(${ROTATING_PREVIEWS[previewIdx].accent},0.18)`,
                    border: `1px solid rgba(${ROTATING_PREVIEWS[previewIdx].accent},0.25)`,
                  }}
                >
                  {(() => {
                    const PreviewIcon = ROTATING_PREVIEWS[previewIdx].icon;
                    return <PreviewIcon className="w-4 h-4" style={{ color: `rgb(${ROTATING_PREVIEWS[previewIdx].accent})` }} />;
                  })()}
                </div>
                <p className="text-white text-xs font-bold">{ROTATING_PREVIEWS[previewIdx].label}</p>
                <p className="text-gray-400 text-[10px] leading-relaxed">{ROTATING_PREVIEWS[previewIdx].sub}</p>
              </motion.div>
            </AnimatePresence>

            {/* Dots */}
            <div className="absolute bottom-2 right-3 flex gap-1">
              {ROTATING_PREVIEWS.map((_, i) => (
                <div
                  key={i}
                  className="w-1 h-1 rounded-full transition-all duration-300"
                  style={{
                    background: i === previewIdx ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.15)',
                    width: i === previewIdx ? '12px' : '4px',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Memory chip */}
          <motion.div
            className="rounded-2xl p-3.5 flex items-center gap-3"
            style={{
              background: 'rgba(52,211,153,0.06)',
              border: '1px solid rgba(52,211,153,0.14)',
              backdropFilter: lite ? undefined : 'blur(12px)',
            }}
            animate={lite ? undefined : { boxShadow: ['0 0 0px rgba(52,211,153,0)', '0 0 16px rgba(52,211,153,0.08)', '0 0 0px rgba(52,211,153,0)'] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.2)' }}>
              <Brain className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-emerald-300 text-[10px] font-bold tracking-wide">SEMANTIC MEMORY</p>
              <p className="text-gray-400 text-[9px] leading-snug mt-0.5">Remembers your stories, picks up on patterns</p>
            </div>
          </motion.div>

          {/* Time chip */}
          <div className="rounded-2xl px-3.5 py-2.5 flex items-center gap-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <Clock className="w-3.5 h-3.5 text-blue-300/60 flex-shrink-0" />
            <span className="text-gray-400 text-[9px]">Always available, 24/7</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
