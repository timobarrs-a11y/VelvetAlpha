import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Heart } from 'lucide-react';
import { AvatarCreatorV2 } from '../components/AvatarCreatorV2';
import { AvatarConfigV2, DEFAULT_MALE_AVATAR_V2, DEFAULT_FEMALE_AVATAR_V2 } from '../types/avatar-v2';
import { supabase } from '../shared/supabase/client';
import { trackOpenCustomizer, trackSaveAvatar, trackSkipAvatar } from '../services/avatarAnalytics';
import { AvatarSaveReveal } from '../components/AvatarSaveReveal';

export function CreateCompanionAvatarPage() {
  const navigate = useNavigate();
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfigV2>(DEFAULT_FEMALE_AVATAR_V2);
  const [saving, setSaving] = useState(false);
  const [companionName, setCompanionName] = useState('');
  const [, setCompanionGender] = useState<'male' | 'female'>('female');
  const [showReveal, setShowReveal] = useState(false);
  const pendingRoute = useRef<string | null>(null);

  useEffect(() => {
    const matchData = JSON.parse(sessionStorage.getItem('matchAnswers') || '{}');
    const selectedGender = matchData.relationshipType === 'Male' ? 'male' : 'female';
    const name = matchData.companionName || '';
    const companionId = sessionStorage.getItem('currentCompanionId');

    console.log('[CompanionAvatar] Loaded match data:', matchData);
    console.log('[CompanionAvatar] Companion ID:', companionId);
    console.log('[CompanionAvatar] Companion name:', name);

    setCompanionName(name);
    setCompanionGender(selectedGender);
    setAvatarConfig(
      selectedGender === 'male' ? DEFAULT_MALE_AVATAR_V2 : DEFAULT_FEMALE_AVATAR_V2
    );

    trackOpenCustomizer('companion');
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const companionId = sessionStorage.getItem('currentCompanionId');
      console.log('[CompanionAvatar] Saving avatar, companionId:', companionId);

      if (!companionId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: companions } = await supabase
            .from('companions')
            .select('id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

          if (companions && companions.length > 0) {
            trackSaveAvatar('companion');
            const intent = sessionStorage.getItem('onboardingIntent');
            const newId = sessionStorage.getItem('currentCompanionId') || companions[0].id;
            const isFirstCompanion = companions.length === 1;
            pendingRoute.current = intent === 'coaches'
              ? (isFirstCompanion ? '/onboarding' : `/chat?companion=${newId}`)
              : '/create-user-avatar';
            setShowReveal(true);
            return;
          }
        }
        navigate('/lobby');
        return;
      }

      const { error } = await supabase
        .from('companions')
        .update({ avatar_config: avatarConfig })
        .eq('id', companionId);

      if (error) {
        console.error('[CompanionAvatar] Error updating avatar:', error);
      }

      trackSaveAvatar('companion');
      const intent = sessionStorage.getItem('onboardingIntent');
      const { data: { user: savedUser } } = await supabase.auth.getUser();
      let isFirstCompanion = false;
      if (savedUser) {
        const { data: allCompanions } = await supabase
          .from('companions')
          .select('id')
          .eq('user_id', savedUser.id);
        isFirstCompanion = (allCompanions?.length ?? 0) <= 1;
      }
      pendingRoute.current = intent === 'coaches'
        ? (isFirstCompanion ? '/onboarding' : `/chat?companion=${companionId}`)
        : '/create-user-avatar';
      setShowReveal(true);
    } catch (error) {
      console.error('Error saving companion avatar:', error);
      navigate('/lobby');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    const companionId = sessionStorage.getItem('currentCompanionId');

    if (!companionId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: companions } = await supabase
          .from('companions')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (companions && companions.length > 0) {
          trackSkipAvatar('companion');
          const intent = sessionStorage.getItem('onboardingIntent');
          const newId = sessionStorage.getItem('currentCompanionId') || companions[0].id;
          const isFirstCompanion = companions.length === 1;
          navigate(intent === 'coaches'
            ? (isFirstCompanion ? '/onboarding' : `/chat?companion=${newId}`)
            : '/create-user-avatar');
          return;
        }
      }
      navigate('/lobby');
      return;
    }

    trackSkipAvatar('companion');
    const intent = sessionStorage.getItem('onboardingIntent');
    const { data: { user: savedUser } } = await supabase.auth.getUser();
    let isFirstCompanion = false;
    if (savedUser) {
      const { data: allCompanions } = await supabase
        .from('companions')
        .select('id')
        .eq('user_id', savedUser.id);
      isFirstCompanion = (allCompanions?.length ?? 0) <= 1;
    }
    navigate(intent === 'coaches'
      ? (isFirstCompanion ? '/onboarding' : `/chat?companion=${companionId}`)
      : '/create-user-avatar');
  };

  const handleRevealContinue = () => {
    setShowReveal(false);
    if (pendingRoute.current) {
      navigate(pendingRoute.current);
    }
  };

  const revealConfig = avatarConfig;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {showReveal && (
        <AvatarSaveReveal
          config={revealConfig}
          companionName={companionName}
          isCompanion={true}
          onContinue={handleRevealContinue}
          autoDismissMs={2500}
        />
      )}

      <div className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 mb-6">
            <Heart className="w-8 h-8" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Design {companionName || 'Your Companion'}
          </h1>

          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Now give {companionName || 'them'} a unique look. Customize their appearance to match the personality you've created.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 mb-8"
        >
          <AvatarCreatorV2
            initialConfig={avatarConfig}
            onChange={setAvatarConfig}
            draftKey="companion-avatar-draft"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <button
            onClick={handleSkip}
            disabled={saving}
            className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-all"
          >
            Use Default Look
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 rounded-lg font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Finish & Continue'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
