import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shuffle, Check, Briefcase } from 'lucide-react';
import { AvatarCreatorV2, coherentRandomize } from '../components/AvatarCreatorV2';
import { AvatarConfigV2, DEFAULT_MALE_AVATAR_V2, DEFAULT_FEMALE_AVATAR_V2 } from '../types/avatar-v2';
import { supabase } from '../shared/supabase/client';
import { trackSaveAvatar, trackRandomize } from '../services/avatarAnalytics';
import { AvatarSaveReveal } from '../components/AvatarSaveReveal';
import { getRandomName } from '../data/companionNames';
import { VELVET_THEME } from '../config/velvetTheme';

export function CoachAvatarPage() {
  const navigate = useNavigate();
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfigV2>(DEFAULT_FEMALE_AVATAR_V2);
  const [saving, setSaving] = useState(false);
  const [coachName, setCoachName] = useState('');
  const [coachGender, setCoachGender] = useState<'male' | 'female'>('female');
  const [showReveal, setShowReveal] = useState(false);
  const pendingRoute = useRef<string>('/intent-select');
  const hasRandomized = useRef(false);

  useEffect(() => {
    const coachId = sessionStorage.getItem('atlasCoachId');
    const storedGender = sessionStorage.getItem('atlasCoachGender') as 'male' | 'female' | null;
    const storedName = sessionStorage.getItem('atlasCoachName') || '';
    const nextDestination = sessionStorage.getItem('atlasNextDestination') || '/intent-select';

    pendingRoute.current = nextDestination;

    const gender: 'male' | 'female' = storedGender === 'male' ? 'male' : 'female';
    setCoachGender(gender);
    setCoachName(storedName);
    setAvatarConfig(gender === 'male' ? DEFAULT_MALE_AVATAR_V2 : DEFAULT_FEMALE_AVATAR_V2);

    if (coachId) {
      (async () => {
        const { data } = await supabase
          .from('companions')
          .select('avatar_config, custom_name')
          .eq('id', coachId)
          .maybeSingle();

        if (data?.avatar_config) {
          setAvatarConfig(data.avatar_config as AvatarConfigV2);
        }
        if (data?.custom_name && !storedName) {
          setCoachName(data.custom_name);
        }
      })();
    }
  }, []);

  const handleRandomize = () => {
    trackRandomize();
    const randomized = coherentRandomize();
    setAvatarConfig(randomized);
    setCoachGender(randomized.gender);
    if (!coachName) {
      setCoachName(getRandomName(randomized.gender));
    }
    hasRandomized.current = true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const coachId = sessionStorage.getItem('atlasCoachId');
      if (!coachId) {
        navigate(pendingRoute.current);
        return;
      }

      const { error } = await supabase
        .from('companions')
        .update({
          avatar_config: avatarConfig,
          custom_name: coachName || undefined,
          gender: coachGender,
        })
        .eq('id', coachId);

      if (error) {
        console.error('[CoachAvatar] Error updating coach avatar:', error);
      }

      trackSaveAvatar('companion');
      setShowReveal(true);
    } catch (error) {
      console.error('Error saving coach avatar:', error);
      navigate(pendingRoute.current);
    } finally {
      setSaving(false);
    }
  };

  const handleRevealContinue = () => {
    setShowReveal(false);
    sessionStorage.setItem('envSetupNextRoute', pendingRoute.current);
    navigate('/environment-setup');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: VELVET_THEME.bg }}>
      {showReveal && (
        <AvatarSaveReveal
          config={avatarConfig}
          companionName={coachName}
          isCompanion={true}
          onContinue={handleRevealContinue}
          autoDismissMs={2500}
        />
      )}

      <div className="max-w-7xl mx-auto px-6 py-12 flex-1 flex flex-col">
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
              <Briefcase className="w-8 h-8 text-rose-300" />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Design {coachName || 'Your Coach'}
          </h1>

          <p className="text-xl text-ink-secondary max-w-2xl mx-auto">
            Give {coachName || 'them'} a face and a name. Customize every detail, or hit Randomize to get a complete look instantly.
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
            draftKey="coach-avatar-draft"
            onRandomize={(cfg) => {
              setCoachGender(cfg.gender);
              if (!coachName) {
                setCoachName(getRandomName(cfg.gender));
              }
            }}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col gap-4 justify-center items-center"
        >
          <div className="flex items-center gap-3 w-full max-w-md">
            <input
              type="text"
              value={coachName}
              onChange={(e) => setCoachName(e.target.value)}
              placeholder="Coach name"
              className="flex-1 px-4 py-3 rounded-xl text-white placeholder:text-ink-subtle focus:outline-none transition-colors"
              style={{
                background: VELVET_THEME.colors.glassCard,
                border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
              }}
            />
            <button
              onClick={() => {
                setCoachName(getRandomName(coachGender));
              }}
              title="Randomize name"
              className="px-4 py-3 rounded-xl transition-all flex-shrink-0 hover:scale-105"
              style={{
                background: VELVET_THEME.colors.glassCard,
                border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
              }}
            >
              <Shuffle className="w-5 h-5 text-ink-secondary" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md">
            <button
              onClick={handleRandomize}
              disabled={saving}
              className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02]"
              style={{
                background: 'rgba(244,114,182,0.12)',
                border: '1px solid rgba(244,114,182,0.3)',
                color: 'rgba(244,114,182,0.9)',
              }}
            >
              <Shuffle className="w-5 h-5" />
              Randomize Face
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 rounded-xl font-semibold transition-all inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.02]"
              style={{
                background: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
                boxShadow: '0 2px 12px rgba(244,63,94,0.25)',
                color: '#fff',
              }}
            >
              {saving ? 'Saving...' : 'Accept & Continue'}
              <Check className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
