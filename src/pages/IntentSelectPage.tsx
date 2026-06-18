import React from 'react';
import { motion } from 'framer-motion';
import { Heart, Sparkles, TrendingUp, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface IntentOption {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  storageValue: string;
  nextPath: string;
  recommended?: boolean;
}

export function IntentSelectPage() {
  const navigate = useNavigate();

  const options: IntentOption[] = [
    {
      id: 'connection',
      title: 'I want connection',
      icon: <Heart className="w-8 h-8" />,
      description: 'A companion with real personality who actually remembers you — your stories, your moods, your history. No goals, no coaching. Just someone who genuinely gets you.',
      storageValue: 'connection',
      nextPath: '/companion-path',
    },
    {
      id: 'connection_growth',
      title: 'Connection + growth',
      icon: <Sparkles className="w-8 h-8" />,
      description: 'Personality depth plus domain expertise, all powered by memory that never forgets. Your companion grows with you while helping you grow — the full experience.',
      storageValue: 'connection_growth',
      nextPath: '/expert-selection',
      recommended: true,
    },
    {
      id: 'expert_only',
      title: 'I want to level up',
      icon: <TrendingUp className="w-8 h-8" />,
      description: 'A sharp expert who remembers every session, tracks your patterns over time, and never lets you repeat the same mistake twice. No fluff — maximum accountability.',
      storageValue: 'expert_only',
      nextPath: '/expert-selection',
    },
    {
      id: 'conversation_only',
      title: 'Just great conversation',
      icon: <MessageCircle className="w-8 h-8" />,
      description: "No labels, no setup. Just witty, intelligent conversation from someone with real personality — who learns how you think and remembers what makes you tick.",
      storageValue: 'conversation_only',
      nextPath: '/companion-path',
    },
  ];

  const handleSelectIntent = (option: IntentOption) => {
    sessionStorage.setItem('onboardingIntent', option.storageValue);
    navigate(option.nextPath);
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

  const cardVariants = {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  const headerVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: 'easeOut',
      },
    },
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
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
            Every path is powered by memory that learns and never forgets
          </p>
        </motion.div>

        {/* Cards Grid — 2×2 */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {options.map((option) => (
            <motion.button
              key={option.id}
              variants={cardVariants}
              onClick={() => handleSelectIntent(option)}
              className="relative group text-left"
            >
              {/* Glow effect */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500/0 via-purple-500/0 to-purple-500/0 group-hover:from-purple-500/20 group-hover:via-purple-500/30 group-hover:to-purple-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-500" />

              {/* Card content */}
              <div className="relative h-full bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 group-hover:border-purple-500/50 transition duration-300">
                {/* Recommended Badge */}
                {option.recommended && (
                  <div className="absolute -top-3 right-6">
                    <span className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Recommended
                    </span>
                  </div>
                )}

                {/* Icon */}
                <div className="mb-6 text-purple-400 group-hover:text-purple-300 transition duration-300">
                  {option.icon}
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white mb-3 group-hover:text-purple-200 transition duration-300">
                  {option.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-300 leading-relaxed">
                  {option.description}
                </p>

                {/* Bottom accent */}
                <div className="mt-6 h-1 w-0 bg-gradient-to-r from-purple-500 to-pink-500 group-hover:w-full transition-all duration-300" />
              </div>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
