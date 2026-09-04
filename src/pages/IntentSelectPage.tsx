import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Users, Heart, Brain, ArrowLeft, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../shared/supabase/client';

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
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-5xl">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
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
                <Sparkles className="w-12 h-12 text-blue-400" />
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
          <p className="text-lg text-gray-400">
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
              <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/20 group-hover:via-blue-500/30 group-hover:to-blue-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />

              <div className="relative h-full bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 group-hover:border-blue-500/50 transition duration-300">
                <div className="mb-6 text-blue-400 group-hover:text-blue-300 transition duration-300">
                  {option.icon}
                </div>

                <h3 className="text-xl font-bold text-white mb-1 group-hover:text-blue-200 transition duration-300">
                  {option.title}
                </h3>
                <p className="text-xs text-gray-500 mb-4 font-medium uppercase tracking-wide">
                  {option.subtitle}
                </p>

                <p className="text-sm text-gray-300 leading-relaxed">
                  {option.description}
                </p>

                <div className="mt-6 h-1 w-0 bg-gradient-to-r from-blue-500 to-cyan-400 group-hover:w-full transition-all duration-300" />
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
