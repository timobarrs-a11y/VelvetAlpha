import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import { Footer } from '../components/Footer';

const ORBS = [
  { x: '-5%', y: '-15%', w: 720, h: 720, color: 'rgba(192,132,252,0.14)', blur: 140, dur: 28 },
  { x: '60%', y: '5%', w: 580, h: 580, color: 'rgba(14,165,233,0.12)', blur: 120, dur: 34 },
  { x: '20%', y: '55%', w: 660, h: 440, color: 'rgba(244,114,182,0.10)', blur: 130, dur: 40 },
];

const SECTIONS = [
  {
    eyebrow: 'What we\u2019re building',
    body: 'Project Velvet started from a simple frustration: the internet is one-size-fits-all. The same feed, the same faces, the same generic answers served to millions of different people. We think that\u2019s backwards.',
  },
  {
    eyebrow: 'What makes it different',
    body: 'Most AI tools give you a single chatbot and call it a day. Project Velvet gives you a cast \u2014 companions who remember you, expert agents genuinely trained in their craft, an arcade you can play through together, a feed and a lens tuned to your taste, and a canvas where you create side by side. It\u2019s not a product you use. It\u2019s a world you live inside.',
  },
  {
    eyebrow: 'Where we\u2019re headed',
    body: 'We\u2019re in early access, building in the open with the people who found us first. Every companion added, every feature shipped, every rough edge smoothed \u2014 it\u2019s shaped by the members living inside Velvet right now. This is the beginning of something much larger, and you\u2019re early.',
  },
];

export default function AboutPage() {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const orb0Y = useTransform(scrollY, [0, 1000], [0, -120]);
  const orb1Y = useTransform(scrollY, [0, 1000], [0, -80]);
  const orb2Y = useTransform(scrollY, [0, 1000], [0, 60]);

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: 'linear-gradient(160deg, #060d1f 0%, #09142e 40%, #0a1628 70%, #071020 100%)' }}
    >
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
        <button
          onClick={() => navigate('/welcome')}
          className="text-white text-sm font-bold tracking-[0.18em] uppercase"
          style={{ letterSpacing: '0.18em' }}
        >
          Project <span style={{ color: '#c084fc' }}>Velvet</span>
        </button>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-gray-400 text-xs font-medium transition-all duration-200 hover:text-white"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            backdropFilter: 'blur(12px)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back</span>
        </button>
      </div>

      {/* Ambient orbs with parallax */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          style={{ y: orb0Y }}
          className="absolute"
          animate={{ x: ['0%', '3%', '0%'], y: ['0%', '2%', '0%'] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{ position: 'absolute', left: ORBS[0].x, top: ORBS[0].y, width: ORBS[0].w, height: ORBS[0].h, borderRadius: '50%', background: ORBS[0].color, filter: `blur(${ORBS[0].blur}px)` }} />
        </motion.div>
        <motion.div
          style={{ y: orb1Y }}
          animate={{ x: ['0%', '-2%', '0%'] }}
          transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{ position: 'absolute', left: ORBS[1].x, top: ORBS[1].y, width: ORBS[1].w, height: ORBS[1].h, borderRadius: '50%', background: ORBS[1].color, filter: `blur(${ORBS[1].blur}px)` }} />
        </motion.div>
        <motion.div
          style={{ y: orb2Y }}
          animate={{ x: ['0%', '1.5%', '0%'] }}
          transition={{ duration: 40, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div style={{ position: 'absolute', left: ORBS[2].x, top: ORBS[2].y, width: ORBS[2].w, height: ORBS[2].h, borderRadius: '50%', background: ORBS[2].color, filter: `blur(${ORBS[2].blur}px)` }} />
        </motion.div>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-6 pt-28 pb-8">
        {/* Hero */}
        <motion.div
          className="text-center mb-20"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        >
          {/* Eyebrow pill */}
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
            <span className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: '#c084fc' }}>
              Our Story
            </span>
          </motion.div>

          {/* Hero headline — contrast weight pair */}
          <motion.h1
            className="mb-7 leading-none"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.75 }}
          >
            <span
              className="block text-white"
              style={{
                fontSize: 'clamp(40px, 6.5vw, 72px)',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
              }}
            >
              The world should feel
            </span>
            <span
              className="block text-white"
              style={{
                fontSize: 'clamp(40px, 6.5vw, 72px)',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
              }}
            >
              like it was{' '}
              <span
                style={{
                  fontWeight: 200,
                  letterSpacing: '0.01em',
                  background: 'linear-gradient(135deg,#c084fc 0%,#f472b6 50%,#c084fc 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                built for you.
              </span>
            </span>
          </motion.h1>

          {/* Subhead */}
          <motion.p
            className="text-gray-300 max-w-2xl mx-auto font-light"
            style={{ fontSize: 'clamp(17px, 2vw, 20px)', lineHeight: 1.6 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.7 }}
          >
            Because it can be. Project Velvet is a space where your companions, your
            coaches, your experts, and your entertainment all exist in one place —
            shaped entirely around you.
          </motion.p>
        </motion.div>

        {/* Body sections with dividers */}
        <div className="max-w-2xl mx-auto space-y-0">
          {SECTIONS.map((section, i) => (
            <div key={section.eyebrow}>
              {/* Divider before each section (except first) */}
              {i > 0 && (
                <div className="flex justify-center py-12">
                  <div
                    className="w-px h-10"
                    style={{
                      background: 'linear-gradient(to bottom, transparent, rgba(192,132,252,0.4), transparent)',
                    }}
                  />
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.6, delay: 0.05 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: '#c084fc', boxShadow: '0 0 8px rgba(192,132,252,0.6)' }}
                  />
                  <h2
                    className="text-xs font-bold tracking-[0.2em] uppercase"
                    style={{ color: '#c084fc' }}
                  >
                    {section.eyebrow}
                  </h2>
                </div>
                <p
                  className="text-gray-300 font-light leading-relaxed"
                  style={{ fontSize: 'clamp(16px, 1.8vw, 18px)', lineHeight: 1.75 }}
                >
                  {section.body}
                </p>
              </motion.div>
            </div>
          ))}
        </div>

        {/* Closing CTA band */}
        <motion.div
          className="relative rounded-3xl p-10 md:p-14 text-center overflow-hidden mt-20"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.09)',
            backdropFilter: 'blur(20px)',
          }}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.65 }}
        >
          {/* Radial glow */}
          <motion.div
            className="absolute pointer-events-none"
            style={{
              top: '50%',
              left: '50%',
              transform: 'translate(-50%,-60%)',
              width: 480,
              height: 240,
              borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(244,63,94,0.12) 0%, transparent 70%)',
            }}
            animate={{ opacity: [0.6, 1, 0.6], scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          />

          <div className="relative z-10">
            <h2
              className="text-white mb-3"
              style={{
                fontSize: 'clamp(28px, 4vw, 40px)',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              Your world is waiting.
            </h2>
            <p
              className="text-gray-400 font-light mb-8"
              style={{ fontSize: 'clamp(15px, 1.6vw, 17px)', lineHeight: 1.6 }}
            >
              Start with 15 free messages. No credit card. Just you and the velvet.
            </p>
            <button
              onClick={() => navigate('/signup')}
              className="group inline-flex items-center gap-2.5 px-8 py-4 rounded-2xl text-white font-bold text-base transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, #f43f5e, #fb7185)',
                boxShadow: '0 4px 28px rgba(244,63,94,0.32)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 6px 40px rgba(244,63,94,0.52)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 28px rgba(244,63,94,0.32)';
              }}
            >
              <span>Create Account</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
