import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { Brain, Layers, Sliders, ArrowRight, Sparkles, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../shared/supabase/client';
import { getCompanions } from '../services/companionService';

const ORBS = [
  { x: '-5%', y: '-15%', w: 720, h: 720, color: 'rgba(244,63,94,0.18)', blur: 140, dur: 28 },
  { x: '60%', y: '5%', w: 580, h: 580, color: 'rgba(14,165,233,0.16)', blur: 120, dur: 34 },
  { x: '20%', y: '55%', w: 660, h: 440, color: 'rgba(251,191,36,0.12)', blur: 130, dur: 40 },
  { x: '-15%', y: '65%', w: 480, h: 480, color: 'rgba(52,211,153,0.12)', blur: 110, dur: 32 },
  { x: '75%', y: '70%', w: 520, h: 520, color: 'rgba(232,121,249,0.12)', blur: 120, dur: 38 },
];

const PARTICLES = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 1.8 + 0.4,
  duration: Math.random() * 10 + 6,
  delay: Math.random() * 8,
  opacity: Math.random() * 0.4 + 0.08,
  isShooting: i < 5,
}));

const features = [
  {
    icon: Sliders,
    accentRgb: '52,211,153',
    iconGlow: 'rgba(52,211,153,0.22)',
    borderColor: 'rgba(52,211,153,0.3)',
    tag: 'Built for you',
    title: 'Built By You',
    desc: 'Has there ever been a personality type you feel you\'d truly connect with? The mysterious type. The cheerleader energy. A disciplined, no-nonsense presence. Someone warm and a little chaotic. In Project Velvet, you can bring any of them to life — and create as many unique companions as you want. Pair any personality with a Signature Voice™ and a bespoke hand-crafted avatar, and what you get is someone that could only ever exist for you.',
  },
  {
    icon: Brain,
    accentRgb: '14,165,233',
    iconGlow: 'rgba(14,165,233,0.22)',
    borderColor: 'rgba(14,165,233,0.3)',
    tag: 'Memory engine',
    title: 'Semantic Memory Engine',
    desc: 'Data is just storage. Memory is understanding. Our Semantic Memory Engine retains the things that matter: small details you may miss, the big moments that shaped your week, the context that makes you you. And thanks to a breakthrough from our engineers, it\'s now Cross-Play enabled across every main feature of the suite — less repetition, faster connection, everywhere you go inside Project Velvet.',
  },
  {
    icon: Layers,
    accentRgb: '244,114,182',
    iconGlow: 'rgba(244,114,182,0.22)',
    borderColor: 'rgba(244,114,182,0.3)',
    tag: 'Living world',
    title: 'A Curated Metaverse',
    desc: 'Project Velvet isn\'t a chatbot. It\'s your living world, projected. Real-time news and videos delivered based on your interests. Stories, poems, and theses that co-author alongside you. Games — solo or with a companion. A calendar that thinks ahead. Every piece connected, every feature intentional — not because the technology demands it, but because you deserve it.',
  },
];

export function SplashPage() {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [visible, setVisible] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const [visibleFeatures, setVisibleFeatures] = useState<number[]>([]);

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000));
        const result = await Promise.race([
          supabase.auth.getUser().then(r => r.data.user),
          timeout,
        ]);
        const user = result;
        if (user) {
          const companions = await getCompanions(user.id);
          if (companions.length > 0) { navigate('/lobby', { replace: true }); return; }
          const companionId = sessionStorage.getItem('currentCompanionId');
          const matchAnswers = sessionStorage.getItem('matchAnswers');
          if (companionId && matchAnswers) { navigate('/voice-selection', { replace: true }); return; }
          navigate('/welcome', { replace: true });
          return;
        }
        setIsChecking(false);
        setTimeout(() => setVisible(true), 60);
      } catch {
        setIsChecking(false);
        setTimeout(() => setVisible(true), 60);
      }
    };
    checkUserStatus();
  }, [navigate]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0');
            setVisibleFeatures(prev => [...new Set([...prev, index])]);
          }
        });
      },
      { threshold: 0.08 }
    );
    const cards = featuresRef.current?.querySelectorAll('[data-index]');
    cards?.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [visible]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07090f]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden" style={{ background: 'linear-gradient(160deg, #060d1f 0%, #09142e 40%, #0a1628 70%, #071020 100%)' }}>

      {/* Grain texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.028]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '160px',
        }}
      />

      {/* Sticky top bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50 h-12 flex items-center justify-between px-6"
        style={{
          background: 'rgba(7,9,15,0.72)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.055)',
        }}
      >
        <span className="text-white text-sm font-bold tracking-[0.18em] uppercase">
          Project <span style={{ color: '#c084fc' }}>Velvet</span>
        </span>
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-gray-400 text-xs font-medium transition-all duration-200 hover:text-white"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          Sign In
        </button>
      </div>

      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute"
          animate={{ x: ['0%', '3%', '0%'], y: ['0%', '2%', '0%'] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{ position: 'absolute', left: ORBS[0].x, top: ORBS[0].y, width: ORBS[0].w, height: ORBS[0].h, borderRadius: '50%', background: ORBS[0].color, filter: `blur(${ORBS[0].blur}px)` }} />
        </motion.div>
        <motion.div
          className="absolute"
          animate={{ x: ['0%', '-2%', '0%'] }}
          transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{ position: 'absolute', left: ORBS[1].x, top: ORBS[1].y, width: ORBS[1].w, height: ORBS[1].h, borderRadius: '50%', background: ORBS[1].color, filter: `blur(${ORBS[1].blur}px)` }} />
        </motion.div>
        <motion.div
          className="absolute"
          animate={{ x: ['0%', '1.5%', '0%'] }}
          transition={{ duration: 40, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{ position: 'absolute', left: ORBS[2].x, top: ORBS[2].y, width: ORBS[2].w, height: ORBS[2].h, borderRadius: '50%', background: ORBS[2].color, filter: `blur(${ORBS[2].blur}px)` }} />
        </motion.div>
        <div style={{ position: 'absolute', left: ORBS[3].x, top: ORBS[3].y, width: ORBS[3].w, height: ORBS[3].h, borderRadius: '50%', background: ORBS[3].color, filter: `blur(${ORBS[3].blur}px)` }} />
        <div style={{ position: 'absolute', left: ORBS[4].x, top: ORBS[4].y, width: ORBS[4].w, height: ORBS[4].h, borderRadius: '50%', background: ORBS[4].color, filter: `blur(${ORBS[4].blur}px)` }} />
      </div>

      {/* Particles + shooting stars */}
      {PARTICLES.map(p =>
        p.isShooting ? (
          <motion.div
            key={p.id}
            className="absolute pointer-events-none"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: '80px',
              height: '1px',
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.55), transparent)',
              rotate: '30deg',
              opacity: 0,
            }}
            animate={{ opacity: [0, 0.7, 0], x: [0, 120], y: [0, 70] }}
            transition={{ duration: 1.2, delay: p.delay * 4, repeat: Infinity, repeatDelay: Math.random() * 18 + 10, ease: 'easeOut' }}
          />
        ) : (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-white pointer-events-none"
            style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.size}px`, height: `${p.size}px`, opacity: p.opacity }}
            animate={{ opacity: [p.opacity, p.opacity * 2.8, p.opacity], scale: [1, 1.6, 1] }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        )
      )}

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-28 pb-8">

        {/* Hero */}
        <AnimatePresence>
          {visible && (
            <motion.div
              className="text-center mb-24"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            >
              {/* Early access pill with shimmer */}
              <motion.div
                className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-10 overflow-hidden relative cursor-default select-none"
                style={{
                  background: 'rgba(192,132,252,0.08)',
                  border: '1px solid rgba(192,132,252,0.28)',
                  backdropFilter: 'blur(16px)',
                }}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.15, duration: 0.5 }}
              >
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.14) 50%, transparent 70%)',
                  }}
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2.4, delay: 1.2, repeat: Infinity, repeatDelay: 4 }}
                />
                <Sparkles className="w-3 h-3" style={{ color: '#c084fc' }} />
                <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: '#c084fc' }}>Now in Early Access</span>
              </motion.div>

              {/* Hero headline */}
              <motion.h1
                className="mb-7 leading-none"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28, duration: 0.75 }}
              >
                <span
                  className="block text-white"
                  style={{
                    fontSize: 'clamp(64px, 10vw, 108px)',
                    fontWeight: 900,
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                  }}
                >
                  Project
                </span>
                <span
                  className="block relative"
                  style={{
                    fontSize: 'clamp(64px, 10vw, 108px)',
                    fontWeight: 200,
                    letterSpacing: '0.12em',
                    lineHeight: 1.05,
                  }}
                >
                  <span
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ filter: 'blur(60px)', opacity: 0.45 }}
                    aria-hidden
                  >
                    <span
                      style={{
                        fontSize: 'clamp(64px, 10vw, 108px)',
                        fontWeight: 200,
                        letterSpacing: '0.12em',
                        background: 'linear-gradient(135deg,#c084fc,#f472b6,#c084fc)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      Velvet
                    </span>
                  </span>
                  <motion.span
                    style={{
                      background: 'linear-gradient(135deg,#c084fc 0%,#f472b6 50%,#c084fc 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                    }}
                    animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    Velvet
                  </motion.span>
                </span>
              </motion.h1>

              <motion.p
                className="text-gray-300 max-w-2xl mx-auto font-light mb-10"
                style={{ fontSize: 'clamp(18px,2.2vw,22px)', lineHeight: 1.6 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.7 }}
              >
                Your World, Projected.
              </motion.p>

              {/* CTA buttons — center of hero */}
              <motion.div
                className="flex flex-row gap-4 justify-center max-w-lg mx-auto w-full"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65, duration: 0.6 }}
              >
                <motion.button
                  onClick={() => navigate('/signup')}
                  whileTap={{ scale: 0.97 }}
                  className="group relative flex-1 inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl text-white font-bold text-base overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg,#a855f7,#ec4899)',
                    boxShadow: '0 4px 28px rgba(168,85,247,0.32)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 40px rgba(168,85,247,0.52)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 28px rgba(168,85,247,0.32)'; }}
                >
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)' }}
                    initial={{ x: '-100%' }}
                    whileHover={{ x: '200%' }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                  <span className="relative z-10">Create Account</span>
                  <ArrowRight className="w-4 h-4 relative z-10 transition-transform group-hover:translate-x-1" />
                </motion.button>
                <motion.button
                  onClick={() => navigate('/login')}
                  whileTap={{ scale: 0.97 }}
                  className="flex-1 px-8 py-4 rounded-2xl text-white font-semibold text-base transition-all duration-200"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1.5px solid rgba(255,255,255,0.15)',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; }}
                >
                  Enter Project Velvet
                </motion.button>
              </motion.div>

              <motion.p
                className="text-gray-600 text-xs mt-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.85 }}
              >
                Start with 15 free messages — no credit card required.
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section divider */}
        {visible && (
          <motion.div
            className="mb-10 flex items-center gap-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
          >
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to right, transparent, rgba(244,63,94,0.3), transparent)' }} />
            <div className="flex items-center gap-2">
              <div className="w-px h-3 rounded-full bg-rose-500/60" />
              <span className="text-[10px] text-gray-500 tracking-[0.28em] uppercase font-semibold">What Awaits</span>
              <div className="w-px h-3 rounded-full bg-rose-500/60" />
            </div>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(to left, transparent, rgba(244,63,94,0.3), transparent)' }} />
          </motion.div>
        )}

        {/* Feature cards */}
        {visible && (
          <div ref={featuresRef} className="grid md:grid-cols-3 gap-5 mb-16">
            {features.map(({ icon: Icon, accentRgb, borderColor, tag, title, desc }, i) => {
              const isVisible = visibleFeatures.includes(i);
              const isHovered = hoveredCard === i;
              return (
                <motion.div
                  key={title}
                  data-index={i}
                  onMouseEnter={() => setHoveredCard(i)}
                  onMouseLeave={() => setHoveredCard(null)}
                  className="rounded-2xl p-5 flex flex-col gap-3 cursor-default relative overflow-hidden"
                  initial={{ opacity: 0, y: 28 }}
                  animate={isVisible ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
                  transition={{ duration: 0.55, delay: i * 0.1 }}
                  style={{
                    background: isHovered ? `rgba(${accentRgb},0.07)` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${isHovered ? borderColor : 'rgba(255,255,255,0.08)'}`,
                    borderTop: `2px solid rgba(${accentRgb},${isHovered ? 0.65 : 0.28})`,
                    boxShadow: isHovered ? `0 8px 40px rgba(${accentRgb},0.14), 0 0 0 1px rgba(${accentRgb},0.12)` : 'none',
                    transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
                    transition: 'all 0.3s ease',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none opacity-[0.018]"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 128 128' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                      backgroundSize: '120px',
                    }}
                  />
                  <div className="flex items-start justify-between gap-2 relative z-10">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `radial-gradient(circle at 35% 35%, rgba(${accentRgb},0.35), rgba(${accentRgb},0.1))`,
                        border: `1px solid rgba(${accentRgb},0.3)`,
                        boxShadow: isHovered ? `0 0 20px rgba(${accentRgb},0.25)` : 'none',
                        transition: 'box-shadow 0.3s ease',
                      }}
                    >
                      <Icon className="w-5 h-5" style={{ color: `rgb(${accentRgb})` }} />
                    </div>
                    <span
                      className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full whitespace-nowrap"
                      style={{
                        color: `rgb(${accentRgb})`,
                        background: `rgba(${accentRgb},0.1)`,
                        border: `1px solid rgba(${accentRgb},0.2)`,
                      }}
                    >
                      {tag}
                    </span>
                  </div>
                  <div className="relative z-10">
                    <h3 className="text-white font-bold text-base mb-1.5 tracking-tight">{title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        <motion.p
          className="text-center text-gray-700 text-xs mb-6"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          By continuing you agree to our{' '}
          <button onClick={() => navigate('/terms')} className="underline hover:text-gray-500 transition-colors">Terms of Service</button>
          {' '}and{' '}
          <button onClick={() => navigate('/privacy')} className="underline hover:text-gray-500 transition-colors">Privacy Policy</button>.
        </motion.p>

        <footer className="text-center pb-6">
          <div className="flex items-center justify-center gap-2">
            <Heart className="w-3.5 h-3.5 text-rose-500/50" fill="currentColor" />
            <p className="text-gray-700 text-sm">© 2025 Project Velvet. All rights reserved.</p>
          </div>
        </footer>

      </div>
    </div>
  );
}
