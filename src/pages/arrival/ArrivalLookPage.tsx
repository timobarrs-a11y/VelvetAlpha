import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AvatarCreatorV2 } from '../../components/AvatarCreatorV2';
import { DEFAULT_FEMALE_AVATAR_V2, DEFAULT_MALE_AVATAR_V2, type AvatarConfigV2 } from '../../types/avatar-v2';
import { migrateAvatarConfig } from '../../utils/avatarConfig';
import { sanitizeAvatarConfigForSave } from '../../services/avatarSaveService';
import { updateSetupProgress } from '../../services/setupProgressService';
import { colorNameToHex } from '../../utils/colorMapping';
import { supabase } from '../../shared/supabase/client';
import { AuthSpinner } from '../../components/auth/AuthSpinner';
import { ArrivalProgress } from '../../features/arrival/ArrivalProgress';
import { handPicked, seededAvatar } from '../../features/arrival/arrivalUtils';
import { ARRIVAL_ROUTES } from '../../features/arrival/arrivalRoutes';

interface Loaded {
  userId: string;
  accent: string | undefined;
  start: AvatarConfigV2;
  arrivalChoices: Record<string, unknown>;
}

/**
 * Your look: the second step of the arrival. A short "why", then the avatar
 * creator, set from Act 1 (their gender, their favorite color on the outfit).
 * It records what they chose by hand so Atlas can notice one thing that's theirs.
 */
export function ArrivalLookPage() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const current = useRef<AvatarConfigV2 | null>(null);
  // What they started from: the seeded look, or the last randomize.
  const baseline = useRef<AvatarConfigV2 | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('gender, favorite_color, avatar_config, arrival_choices')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const seeded = seededAvatar({ male: DEFAULT_MALE_AVATAR_V2, female: DEFAULT_FEMALE_AVATAR_V2 }, profile?.gender, profile?.favorite_color);
      // Read the way the editor reads it (defaults filled in), so an untouched
      // default like the outfit never counts as something they chose.
      const start = migrateAvatarConfig(profile?.avatar_config ?? seeded);
      baseline.current = start;
      current.current = start;
      setLoaded({
        userId: user.id,
        accent: profile?.favorite_color ? colorNameToHex(profile.favorite_color) : undefined,
        start,
        arrivalChoices: (profile?.arrival_choices as Record<string, unknown>) ?? {},
      });
      updateSetupProgress(user.id, { step: 'arrival_look' });
    })().catch(() => setError('Something went wrong. Please refresh.'));
    return () => { cancelled = true; };
  }, [navigate]);

  const handleDone = async () => {
    if (!loaded || !current.current) return;
    setSaving(true);
    setError('');
    try {
      const sanitized = await sanitizeAvatarConfigForSave(current.current);
      const avatarChoices = handPicked(
        (baseline.current ?? loaded.start) as unknown as Record<string, unknown>,
        sanitized as unknown as Record<string, unknown>,
      );
      const { error: saveError } = await supabase
        .from('user_profiles')
        .update({
          avatar_config: sanitized,
          arrival_choices: { ...loaded.arrivalChoices, avatar: avatarChoices },
        })
        .eq('id', loaded.userId);
      if (saveError) throw saveError;
      try { localStorage.setItem('userAvatarConfig', JSON.stringify(sanitized)); } catch { /* storage blocked */ }
      await updateSetupProgress(loaded.userId, { step: 'arrival_home' });
      navigate(ARRIVAL_ROUTES.home);
    } catch {
      setError("Couldn't save your look. Please try again.");
      setSaving(false);
    }
  };

  if (!loaded) return error ? <p className="p-8 text-center text-white">{error}</p> : <AuthSpinner />;

  const accent = loaded.accent ?? '#f43f5e';

  return (
    <div className="min-h-screen bg-[#080b14] px-4 py-6 text-white">
      <ArrivalProgress step={1} accent={loaded.accent} />

      {!creating ? (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto mt-16 max-w-md text-center"
        >
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: accent }}>Now for the fun part.</h1>
          <p className="mt-5 text-lg leading-relaxed text-white/80">
            In Velvet you're not a goal or an idea. You're a person.
          </p>
          <p className="mt-3 text-lg leading-relaxed text-white/80">
            Next you'll make the digital you, or whoever you like. Explore the options and have fun with it:
            you'll be seeing your avatar on the community boards, in your chats and on your billboard in town.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-10 rounded-full px-8 py-3.5 text-base font-bold text-white shadow-lg"
            style={{ background: `linear-gradient(to right, ${accent}, ${accent}dd)` }}
          >
            Make my avatar
          </button>
        </motion.div>
      ) : (
        <div className="mx-auto mt-6 max-w-5xl">
          <AvatarCreatorV2
            initialConfig={loaded.start}
            favoritesNamespace="user"
            onChange={config => { current.current = config; }}
            onRandomize={config => { baseline.current = config; current.current = config; }}
          />
          {error && <p role="alert" className="mt-4 text-center text-sm text-rose-400">{error}</p>}
          {/* A fade behind the button, so it never sits on top of an option. */}
          <div
            className="sticky bottom-0 mt-6 flex justify-center pb-4 pt-8"
            style={{ background: 'linear-gradient(to top, rgba(7,10,19,0.96) 55%, rgba(7,10,19,0))' }}
          >
            <button
              type="button"
              onClick={handleDone}
              disabled={saving}
              className="rounded-full px-10 py-3.5 text-base font-bold text-white shadow-xl disabled:opacity-60"
              style={{ background: `linear-gradient(to right, ${accent}, ${accent}dd)` }}
            >
              {saving ? 'Saving…' : "That's me"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
