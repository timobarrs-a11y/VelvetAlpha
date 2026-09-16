import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Users, Heart, Brain, ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase/client';
import { VELVET_THEME } from '../config/velvetTheme';

interface IntentOption {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  description: string;
  intent: string;
  relationshipType: string;
  nextPath: string;
}

const AMBIENT_ORBS = [
  { x: '-8%', y: '10%', w: 520, h: 520, color: 'rgba(244,114,182,0.07)', blur: 120, dur: 30 },
  { x: '65%', y: '60%', w: 440, h: 440, color: 'rgba(192,132,252,0.06)', blur: 110, dur: 36 },
  { x: '30%', y: '-10%', w: 380, h: 380, color: 'rgba(244,63,94,0.05)', blur: 100, dur: 42 },
];

export function IntentSelectPage() {
  const navigate = useNavigate();
  const [transitioning, setTransitioning] = useState<string | null>(null);
  const [hasActiveMentor, setHasActiveMentor] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: existingMentor } = await supabase
          .from('companions')
          .select('id')
          .eq('user_id', user.id)
          .eq('relationship_type', 'mentor')
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (existingMentor) setHasActiveMentor(true);
      } catch { /* non-fatal */ }
    })();
  }, []);

  const options: IntentOption[] = [
    {
      id: 'friends',
      title: 'Friends',
      subtitle: 'Platonic companions',
      icon: <Users className="w-8 h-8" />,
      description: 'Friends who know you, remember your stories, and are always there for great conversation — no labels, just real connection.',
      intent: 'connection',
      relationshipType: 'friend',
      nextPath: '/companion-path',
    },
    {
      id: 'companions',
      title: 'Companions',
      subtitle: 'Romantic + close bonds',
      icon: <Heart className="w-8 h-8" />,
      description: 'Deeper emotional connection with someone who remembers everything — your moods, your dreams, your sense of humor. Built to feel real.',
      intent: 'connection',
      relationshipType: 'romantic',
      nextPath: '/companion-path',
    },
    {
      id: 'coaches',
      title: 'Coaches',
      subtitle: hasActiveMentor ? 'Your coach is ready' : 'Expert agents',
      icon: <Brain className="w-8 h-8" />,
      description: "AI experts built around your goals — fitness coaches, career mentors, creative partners, life coaches. Sharp, focused, and built to keep you moving forward.",
      intent: 'coaches',
      relationshipType: 'mentor',
      nextPath: hasActiveMentor ? '/lobby' : '/expert-selection',
    },
  ];

  const handleSelectIntent = (option: IntentOption) => {
    sessionStorage.setItem('onboardingIntent', option.intent);
    sessionStorage.setItem('onboardingRelationshipType', option.relationshipType);
    setTransitioning(option.id);
    setTimeout(() => navigate(option.nextPath), 700);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };

  const headerVariants: Variants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: 'easeOut' },
    },
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: VELVET_THEME.bg }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: VELVET_THEME.radial }} />

      {/* Grain texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-[1] opacity-[0.024]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '160px',
        }}
      />

      {/* Ambient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {AMBIENT_ORBS.map((orb, i) => (
          <motion.div
            key={i}
            className="absolute"
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
              y: ['0%', i % 2 === 0 ? '2%' : '-1.5%', '0%'],
            }}
            transition={{ duration: orb.dur, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-5xl">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-ink-muted hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back</span>
        </button>

        <AnimatePresence mode="wait">
          {transitioning ? (
            <motion.div
              key="transitioning"
              className="flex flex-col items-center justify-center py-32"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              >
                <Sparkles className="w-12 h-12 text-rose-300" />
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="main"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
        <motion.div
          variants={headerVariants}
          initial="hidden"
          animate="visible"
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold text-white mb-4">
            What are you looking for?
          </h1>
          <p className="text-lg text-ink-muted">
            Every path is powered by the Velvet Engine — the only AI memory system that gets sharper the more you talk
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {options.map((option) => (
            <motion.button
              key={option.id}
              variants={cardVariants}
              onClick={() => handleSelectIntent(option)}
              className="relative group text-left"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500/0 via-rose-500/0 to-rose-500/0 group-hover:from-rose-500/20 group-hover:via-rose-500/30 group-hover:to-rose-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />

              <div
                className="relative h-full rounded-2xl p-8 group-hover:border-rose-500/50 transition duration-300"
                style={{
                  background: VELVET_THEME.colors.glassCard,
                  border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
                }}
              >
                <div className="mb-6 text-rose-300 group-hover:text-rose-200 transition duration-300">
                  {option.icon}
                </div>

                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-rose-100 transition duration-300">
                  {option.title}
                </h3>
                <p className="text-xs text-ink-subtle mb-4 font-medium uppercase tracking-wide">
                  {option.subtitle}
                </p>

                <p className="text-sm text-ink-secondary leading-relaxed">
                  {option.description}
                </p>

                <div className="mt-6 h-1 w-0 bg-gradient-to-r from-rose-500 to-pink-400 group-hover:w-full transition-all duration-300" />
              </div>
            </motion.button>
          ))}
        </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
