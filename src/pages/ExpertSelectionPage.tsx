import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Briefcase, Palette, GraduationCap, Compass, Crown, Plus, ChevronRight, Sparkles, ArrowLeft } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useSubscription } from '../hooks/useSubscription';
import {
  ExpertConfig,
  EXPERT_CATEGORIES,
  getCuratedExperts,
  getFreeExperts,
  canUseExpert,
} from '../config/signatureExperts';
import { getUserExperts, userExpertToConfig } from '../services/expertService';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Heart,
  Briefcase,
  Palette,
  GraduationCap,
  Compass,
};

export default function ExpertSelectionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { tier, loading: subscriptionLoading } = useSubscription();
  const isPremium = tier !== 'free';

  const [selectedExpertId, setSelectedExpertId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<ExpertConfig['category'] | 'all'>('all');
  const [curatedExperts, setCuratedExperts] = useState<ExpertConfig[]>([]);
  const [userExperts, setUserExperts] = useState<ExpertConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadExperts();
  }, []);

  const loadExperts = async () => {
    setLoading(true);
    try {
      // Load curated experts
      const curated = getCuratedExperts();
      setCuratedExperts(curated);

      // Load user experts if logged in
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        try {
          const userExpertsData = await getUserExperts(user.id);
          const converted = userExpertsData.map(userExpertToConfig);
          setUserExperts(converted);
        } catch (error) {
          console.error('Error loading user experts:', error);
        }
      }
    } catch (error) {
      console.error('Error loading experts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredExperts = () => {
    const allExperts = [...curatedExperts, ...userExperts];

    if (selectedCategory === 'all') {
      return allExperts;
    }

    return allExperts.filter(e => e.category === selectedCategory);
  };

  const filteredExperts = getFilteredExperts();

  const handleExpertSelect = (expertId: string) => {
    setSelectedExpertId(expertId);
  };

  const handleContinue = async () => {
    if (!selectedExpertId) return;

    // Find selected expert to determine source
    const expert = curatedExperts.find(e => e.id === selectedExpertId)
      || userExperts.find(e => e.id === selectedExpertId);

    if (!expert) return;

    // Store selection in sessionStorage
    sessionStorage.setItem('selectedExpertId', selectedExpertId);
    sessionStorage.setItem('selectedExpertSource', expert.source);

    // Read onboarding intent and navigate
    const onboardingIntent = sessionStorage.getItem('onboardingIntent');

    if (onboardingIntent === 'coaches') {
      navigate('/expert-questionnaire', { replace: true });
    } else {
      navigate('/create-companion-avatar', { replace: true });
    }
  };

  const handleSkip = () => {
    sessionStorage.removeItem('selectedExpertId');
    sessionStorage.removeItem('selectedExpertSource');
    navigate('/create-companion-avatar', { replace: true });
  };

  const handleCreateOwn = () => {
    navigate('/expert-builder', { replace: true });
  };

  const showSkip = sessionStorage.getItem('onboardingIntent') !== 'coaches';

  if (loading || subscriptionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="inline-block"
          >
            <Sparkles className="w-12 h-12 text-blue-400 mb-4" />
          </motion.div>
          <p className="text-gray-300">Loading experts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white overflow-y-auto pb-24">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate('/intent-select')}
          className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Choose Your Expert
          </h1>
          <p className="text-xl text-gray-300">
            Select an expert to guide your growth — or create your own
          </p>
        </motion.div>

        {/* Category Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex flex-wrap gap-3 mb-12 justify-center"
        >
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-6 py-2 rounded-full font-medium transition-all ${
              selectedCategory === 'all'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            All
          </button>

          {EXPERT_CATEGORIES.map(category => {
            const IconComponent = CATEGORY_ICONS[category.icon] as React.ComponentType<{ className?: string }>;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-6 py-2 rounded-full font-medium transition-all flex items-center gap-2 ${
                  selectedCategory === category.id
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                    : 'bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                {category.label}
              </button>
            );
          })}
        </motion.div>

        {/* Expert Cards Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
        >
          <AnimatePresence mode="popLayout">
            {filteredExperts.map((expert, index) => (
              <motion.div
                key={expert.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                onClick={() => handleExpertSelect(expert.id)}
                className={`p-6 rounded-xl cursor-pointer transition-all ${
                  selectedExpertId === expert.id
                    ? 'bg-gray-800/80 border-2 border-blue-500 ring-1 ring-blue-500/30'
                    : 'bg-gray-800/50 border-2 border-gray-700 hover:border-blue-500/50'
                }`}
              >
                {/* Premium Badge */}
                {expert.premium && (
                  <div className="flex items-center gap-1 mb-3 text-xs font-semibold text-yellow-400">
                    <Crown className="w-4 h-4" />
                    Premium
                  </div>
                )}

                {/* Custom Badge */}
                {expert.source === 'user' && (
                  <div className="flex items-center gap-1 mb-3 text-xs font-semibold text-purple-400">
                    Custom
                  </div>
                )}

                {/* Name and Domain */}
                <h3 className="text-xl font-bold mb-2">{expert.name}</h3>
                <p className="text-sm text-blue-400 mb-3">{expert.domain}</p>

                {/* Description */}
                <p className="text-sm text-gray-300 mb-4">{expert.description}</p>

                {/* Sample Interaction */}
                <p className="text-sm text-gray-400 italic mb-4 p-3 bg-gray-900/50 rounded border border-gray-700">
                  "{expert.sampleInteraction}"
                </p>

                {/* Selection Indicator */}
                {selectedExpertId === expert.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2 text-blue-400 font-medium"
                  >
                    <ChevronRight className="w-5 h-5" />
                    Selected
                  </motion.div>
                )}
              </motion.div>
            ))}

            {/* Create Your Own Card */}
            <motion.div
              key="create-own"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, delay: filteredExperts.length * 0.05 }}
              onClick={handleCreateOwn}
              className="p-6 rounded-xl cursor-pointer transition-all border-2 border-dashed border-gray-600 hover:border-blue-500/50 bg-gray-900/30 hover:bg-gray-800/30 group"
            >
              <div className="flex flex-col items-center justify-center h-full min-h-64 gap-4">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  className="p-4 bg-blue-500/20 rounded-full group-hover:bg-blue-500/30 transition-colors"
                >
                  <Plus className="w-8 h-8 text-blue-400" />
                </motion.div>
                <div className="text-center">
                  <h3 className="text-xl font-bold mb-1">Create Your Own</h3>
                  <p className="text-sm text-gray-400">Design a custom expert with your own style</p>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* No Experts Found */}
        {filteredExperts.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-gray-400 text-lg">No experts found in this category.</p>
          </motion.div>
        )}

        {/* Bottom Action Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-900 to-transparent pt-6 pb-8 px-6"
        >
          <div className="max-w-6xl mx-auto flex gap-4 justify-center items-center">
            {showSkip && (
              <button
                onClick={handleSkip}
                className="px-8 py-3 rounded-lg font-semibold text-gray-300 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 transition-all"
              >
                Skip
              </button>
            )}

            <button
              onClick={handleContinue}
              disabled={!selectedExpertId}
              className={`px-12 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all ${
                selectedExpertId
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-lg hover:shadow-blue-500/50 text-white'
                  : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50'
              }`}
            >
              Continue
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
