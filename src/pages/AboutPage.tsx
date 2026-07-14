import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Sparkles, Heart, Compass, Shield } from 'lucide-react';
import { Footer } from '../components/Footer';

const VALUES = [
  {
    icon: Heart,
    title: 'Human Connection',
    description:
      'We believe technology should bring you closer to the people and ideas that matter — not pull you away from them.',
    accentRgb: '244,63,94',
  },
  {
    icon: Compass,
    title: 'Your World, Your Way',
    description:
      'Every feature is built around you. Your interests, your goals, your pace. No algorithm chasing clicks.',
    accentRgb: '192,132,252',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    description:
      'Your conversations are yours. We do not sell your data, and we do not use your private interactions to train foundation models.',
    accentRgb: '52,211,153',
  },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{
        background:
          'linear-gradient(160deg, #060d1f 0%, #09142e 40%, #0a1628 70%, #071020 100%)',
      }}
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

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-12 pb-8">
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors duration-200 mb-10 group"
        >
          <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-200" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Hero */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div
            className="inline-flex items-center gap-2 px-5 py-2 rounded-full mb-8"
            style={{
              background: 'rgba(192,132,252,0.08)',
              border: '1px solid rgba(192,132,252,0.28)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <Sparkles className="w-3 h-3" style={{ color: '#c084fc' }} />
            <span
              className="text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: '#c084fc' }}
            >
              About Us
            </span>
          </div>

          <h1
            className="mb-6 text-white"
            style={{
              fontSize: 'clamp(40px, 6vw, 64px)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
            }}
          >
            We are building the world
            <br />
            you actually want to live in.
          </h1>

          <p
            className="text-gray-300 max-w-2xl mx-auto font-light"
            style={{ fontSize: 'clamp(17px, 2vw, 20px)', lineHeight: 1.6 }}
          >
            Project Velvet is an AI platform built around you — the companions you
            create, the experts you rely on, the games you play, and the world you
            curate. One place. Fully yours.
          </p>
        </motion.div>

        {/* Mission section */}
        <motion.div
          className="rounded-3xl p-8 md:p-10 mb-10"
          style={{
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.09)',
            backdropFilter: 'blur(20px)',
          }}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-white font-bold text-xl md:text-2xl mb-4 tracking-tight">
            Our Mission
          </h2>
          <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-4">
            The internet promised connection and delivered feed-scrolling. It
            promised knowledge and delivered noise. Project Velvet is our attempt to
            fix that — to build a platform where the technology adapts to you, not
            the other way around.
          </p>
          <p className="text-gray-400 text-sm md:text-base leading-relaxed">
            We are a small team based in Michigan, building for people who want more
            from their technology than a slot machine in their pocket. Whether it is
            a companion who actually remembers you, an expert agent who knows their
            field, or a game you can play with friends — we want it to feel like
            yours.
          </p>
        </motion.div>

        {/* Values grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {VALUES.map((value, i) => {
            const Icon = value.icon;
            return (
              <motion.div
                key={value.title}
                className="rounded-2xl p-5"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderTop: `2px solid rgba(${value.accentRgb},0.28)`,
                  backdropFilter: 'blur(12px)',
                }}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{
                    background: `radial-gradient(circle at 35% 35%, rgba(${value.accentRgb},0.35), rgba(${value.accentRgb},0.1))`,
                    border: `1px solid rgba(${value.accentRgb},0.3)`,
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: `rgb(${value.accentRgb})` }}
                  />
                </div>
                <h3 className="text-white font-bold text-sm mb-1.5">{value.title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">
                  {value.description}
                </p>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-gray-400 text-sm mb-6">
            Want to see what we are building?
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
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </button>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
