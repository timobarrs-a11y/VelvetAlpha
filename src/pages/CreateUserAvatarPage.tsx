import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, User } from 'lucide-react';
import { AvatarCreatorV2 } from '../components/AvatarCreatorV2';
import { AvatarConfigV2, DEFAULT_FEMALE_AVATAR_V2 } from '../types/avatar-v2';
import { supabase } from '../shared/supabase/client';
import { getCompanions } from '../services/companionService';
import { trackOpenCustomizer, trackSaveAvatar, trackSkipAvatar } from '../services/avatarAnalytics';
import { AvatarSaveReveal } from '../components/AvatarSaveReveal';
import { resolveHomeRoute } from '../utils/homeRoute';
import { VELVET_THEME } from '../config/velvetTheme';

const AMBIENT_ORBS = [
  { x: '-8%', y: '10%', w: 520, h: 520, color: 'rgba(244,114,182,0.07)', blur: 120, dur: 30 },
  { x: '65%', y: '60%', w: 440, h: 440, color: 'rgba(192,132,252,0.06)', blur: 110, dur: 36 },
  { x: '30%', y: '-10%', w: 380, h: 380, color: 'rgba(244,63,94,0.05)', blur: 100, dur: 42 },
];

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
        setAuthError('Authentication required. Please sign in.');
        setIsAuthenticating(false);
        navigate('/login', { replace: true });
        return;
      }

      const companions = await getCompanions(user.id);

      if (companions.length > 0) {
        pendingRoute.current = await resolveHomeRoute(user.id);
      } else {
        pendingRoute.current = '/atlas-onboarding';
      }

      trackOpenCustomizer('user');
      setIsAuthenticating(false);
    } catch {
      setAuthError('Failed to initialize. Please refresh the page.');
      setIsAuthenticating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAuthError('Authentication failed. Please refresh the page.');
        setSaving(false);
        return;
      }

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
        throw updateError;
      }

      localStorage.setItem('userAvatarConfig', JSON.stringify(avatarConfig));
      trackSaveAvatar('user');
      setShowReveal(true);
    } catch {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAuthError('Authentication failed. Please refresh the page.');
      return;
    }
    trackSkipAvatar('user');
    navigate(pendingRoute.current || '/atlas-onboarding');
  };

  const handleRevealContinue = () => {
    setShowReveal(false);
    if (pendingRoute.current) {
      navigate(pendingRoute.current);
    }
  };

  if (isAuthenticating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: VELVET_THEME.bg }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-400 mx-auto mb-4"></div>
          <p className="text-ink-secondary font-medium">Setting things up...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: VELVET_THEME.bg }}>
      {showReveal && (
        <AvatarSaveReveal
          config={avatarConfig}
          isCompanion={false}
          onContinue={handleRevealContinue}
          autoDismissMs={2500}
        />
      )}

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

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-12 flex-1 flex flex-col">
        {authError && (
          <div className="mb-6 p-4 rounded-xl border text-center" style={{ background: 'rgba(244,63,107,0.12)', borderColor: 'rgba(244,63,107,0.3)' }}>
            <p className="text-rose-300">{authError}</p>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex justify-center mb-6">
            <div
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl"
              style={{
                background: VELVET_THEME.colors.glassCard,
                border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
              }}
            >
              <User className="w-8 h-8 text-rose-300" />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Create Your Avatar
          </h1>

          <p className="text-xl text-ink-secondary max-w-2xl mx-auto">
            Let's start by creating your digital look. This helps your companion recognize you in conversations.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl p-8 mb-8"
          style={{
            background: VELVET_THEME.colors.glassCard,
            border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
          }}
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
            className="px-8 py-3 rounded-xl font-semibold transition-all disabled:opacity-50 hover:scale-[1.02]"
            style={{
              background: VELVET_THEME.colors.glassCard,
              border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
              color: 'text-ink-secondary',
            }}
          >
            Skip For Now
          </button>

          <button
            onClick={handleSave}
            disabled={saving || isAuthenticating}
            className="px-8 py-3 rounded-xl font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02]"
            style={{
              background: VELVET_THEME.button.primary,
              boxShadow: VELVET_THEME.button.primaryGlow,
              color: '#fff',
            }}
          >
            {saving ? 'Saving...' : 'Continue'}
            <ArrowRight className="w-5 h-5" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
