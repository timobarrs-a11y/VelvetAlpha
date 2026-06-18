import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, User } from 'lucide-react';
import { AvatarCreatorV2 } from '../components/AvatarCreatorV2';
import { AvatarConfigV2, DEFAULT_FEMALE_AVATAR_V2 } from '../types/avatar-v2';
import { supabase } from '../shared/supabase/client';
import { getCompanions } from '../services/companionService';
import { resolveHomeRoute } from '../utils/homeRoute';
import { trackOpenCustomizer, trackSaveAvatar, trackSkipAvatar } from '../services/avatarAnalytics';
import { AvatarSaveReveal } from '../components/AvatarSaveReveal';

export function CreateUserAvatarPage() {
  const navigate = useNavigate();
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfigV2>(DEFAULT_FEMALE_AVATAR_V2);
  const [saving, setSaving] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const pendingRoute = useRef<string | null>(null);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error('[CreateUserAvatar] No authenticated user found');
        setAuthError('Authentication required. Please sign in.');
        setIsAuthenticating(false);
        navigate('/login', { replace: true });
        return;
      }

      const companions = await getCompanions(user.id);
      console.log('[CreateUserAvatar] User has', companions.length, 'companions');

      if (companions.length > 0) {
        console.log('[CreateUserAvatar] User already has companions, sending to companion chat');
        localStorage.removeItem('currentCompanionId');
        localStorage.removeItem('matchAnswers');
        navigate(await resolveHomeRoute(user.id), { replace: true });
        return;
      }

      const currentCompanionId = sessionStorage.getItem('currentCompanionId');
      const matchAnswers = sessionStorage.getItem('matchAnswers');
      if (currentCompanionId && matchAnswers) {
        console.log('[CreateUserAvatar] User is mid-onboarding, proceeding to companion avatar');
        navigate('/create-companion-avatar', { replace: true });
        return;
      }

      trackOpenCustomizer('user');
      setIsAuthenticating(false);
    } catch (error) {
      console.error('[CreateUserAvatar] Error in initializeAuth:', error);
      setAuthError('Failed to initialize. Please refresh the page.');
      setIsAuthenticating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        console.error('[CreateUserAvatar] No user found when saving');
        setAuthError('Authentication failed. Please refresh the page.');
        setSaving(false);
        return;
      }

      console.log('[CreateUserAvatar] Saving avatar for user:', user.id);

      const { error: updateError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          name: 'there',
          avatar_config: avatarConfig
        }, {
          onConflict: 'id'
        });

      if (updateError) {
        console.error('[CreateUserAvatar] Error updating profile:', updateError);
        throw updateError;
      }

      localStorage.setItem('userAvatarConfig', JSON.stringify(avatarConfig));
      trackSaveAvatar('user');
      const isFirstCompanion = !!sessionStorage.getItem('currentCompanionId');
      pendingRoute.current = isFirstCompanion ? '/onboarding' : await resolveHomeRoute(user.id);
      setShowReveal(true);
    } catch (error) {
      console.error('Error saving avatar:', error);
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[CreateUserAvatar] No user found when skipping');
      setAuthError('Authentication failed. Please refresh the page.');
      return;
    }
    trackSkipAvatar('user');
    const isFirstCompanion = !!sessionStorage.getItem('currentCompanionId');
    navigate(isFirstCompanion ? '/onboarding' : await resolveHomeRoute(user.id));
  };

  const handleRevealContinue = () => {
    setShowReveal(false);
    if (pendingRoute.current) {
      navigate(pendingRoute.current);
    }
  };

  if (isAuthenticating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-gray-300 font-medium">Setting things up...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {showReveal && (
        <AvatarSaveReveal
          config={avatarConfig}
          isCompanion={false}
          onContinue={handleRevealContinue}
          autoDismissMs={2500}
        />
      )}

      <div className="max-w-7xl mx-auto px-6 py-12">
        {authError && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-center">
            <p className="text-red-300">{authError}</p>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-sky-500 to-cyan-500 mb-6">
            <User className="w-8 h-8" />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Create Your Avatar
          </h1>

          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Let's start by creating your digital look. This helps your companion recognize you in conversations.
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
            draftKey="user-avatar-draft"
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
            disabled={saving || isAuthenticating}
            className="px-8 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-all disabled:opacity-50"
          >
            Skip For Now
          </button>

          <button
            onClick={handleSave}
            disabled={saving || isAuthenticating}
            className="px-8 py-3 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-600 hover:to-cyan-600 rounded-lg font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Continue'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
