import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Shuffle, Check, RotateCcw } from 'lucide-react';
import { AvatarCreatorV2, coherentRandomize } from '../components/AvatarCreatorV2';
import { AvatarConfigV2, DEFAULT_MALE_AVATAR_V2, DEFAULT_FEMALE_AVATAR_V2 } from '../types/avatar-v2';
import { supabase } from '../shared/supabase/client';
import { trackSaveAvatar, trackRandomize } from '../services/avatarAnalytics';
import { AvatarSaveReveal } from '../components/AvatarSaveReveal';
import { getRandomName } from '../data/companionNames';

async function resolveCompanionId(): Promise<string | null> {
  const stored = sessionStorage.getItem('currentCompanionId');
  if (stored) return stored;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('companions')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .neq('relationship_type', 'mentor')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data?.id) sessionStorage.setItem('currentCompanionId', data.id);
  return data?.id ?? null;
}

export function CreateCompanionAvatarPage() {
  const navigate = useNavigate();
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfigV2>(DEFAULT_FEMALE_AVATAR_V2);
  const [saving, setSaving] = useState(false);
  const [companionName, setCompanionName] = useState('');
  const [companionGender, setCompanionGender] = useState<'male' | 'female'>('female');
  const [showReveal, setShowReveal] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasRandomized = useRef(false);

  useEffect(() => {
    const matchData = JSON.parse(sessionStorage.getItem('matchAnswers') || '{}');
    const selectedGender = matchData.relationshipType === 'Male' ? 'male' : 'female';
    const name = matchData.companionName || '';

    setCompanionName(name);
    setCompanionGender(selectedGender);
    setAvatarConfig(
      selectedGender === 'male' ? DEFAULT_MALE_AVATAR_V2 : DEFAULT_FEMALE_AVATAR_V2
    );

    (async () => {
      const companionId = await resolveCompanionId();
      if (!companionId) return;
      const { data } = await supabase
        .from('companions')
        .select('custom_name, gender, avatar_config')
        .eq('id', companionId)
        .maybeSingle();
      if (!data) return;
      if (!name && data.custom_name) setCompanionName(data.custom_name);
      if (data.gender === 'male' || data.gender === 'female') setCompanionGender(data.gender);
      if (data.avatar_config && !matchData.relationshipType) {
        setAvatarConfig(data.avatar_config as AvatarConfigV2);
      }
    })();
  }, []);

  const handleRandomize = () => {
    trackRandomize();
    const randomized = coherentRandomize();
    setAvatarConfig(randomized);
    if (!companionName) {
      setCompanionName(getRandomName(randomized.gender));
    }
    hasRandomized.current = true;
  };

  const handleNameChange = (name: string) => {
    setCompanionName(name);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const companionId = await resolveCompanionId();
      if (!companionId) {
        setSaveError("We couldn't find the person you're creating. Please try again.");
        return;
      }

      const { error } = await supabase
        .from('companions')
        .update({ avatar_config: avatarConfig, custom_name: companionName || undefined })
        .eq('id', companionId);

      if (error) {
        console.error('[CompanionAvatar] Error updating avatar:', error);
        setSaveError("We couldn't save this look. Please try again.");
        return;
      }

      trackSaveAvatar('companion');
      setShowReveal(true);
    } catch (error) {
      console.error('Error saving companion avatar:', error);
      setSaveError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevealContinue = () => {
    setShowReveal(false);
    sessionStorage.setItem('envSetupNextRoute', '/who-to-talk');
    sessionStorage.setItem('envSetupBackRoute', '/create-companion-avatar');
    navigate('/environment-setup');
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
            Give {companionName || 'them'} a unique look. Customize every detail, or hit Randomize to get a complete face instantly.
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
            onRandomize={(cfg) => {
              if (!companionName) {
                setCompanionName(getRandomName(cfg.gender));
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
              value={companionName}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Companion name"
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg
                text-white placeholder-gray-500 focus:outline-none focus:border-sky-500
                transition-colors"
            />
            <button
              onClick={() => {
                setCompanionName(getRandomName(companionGender));
              }}
              title="Randomize name"
              className="px-4 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-all flex-shrink-0"
            >
              <Shuffle className="w-5 h-5" />
            </button>
          </div>

          {saveError && (
            <div
              role="alert"
              className="w-full max-w-md flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-sm"
            >
              <span>{saveError}</span>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-1.5 font-semibold text-red-100 hover:text-white transition-colors flex-shrink-0"
              >
                <RotateCcw className="w-4 h-4" />
                Try again
              </button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 justify-center w-full max-w-md">
            <button
              onClick={handleRandomize}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-sky-600/20 border border-sky-500/30 text-sky-400
                hover:bg-sky-600/30 hover:text-sky-300 rounded-lg font-semibold transition-all
                inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Shuffle className="w-5 h-5" />
              Randomize Face
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-500
                hover:from-rose-600 hover:to-pink-600 rounded-lg font-semibold transition-all
                inline-flex items-center justify-center gap-2 disabled:opacity-50"
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
