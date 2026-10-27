import { useEffect, useState } from 'react';
import { publicName } from '../../shared/profile/names';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MoveInPanel } from '../../features/velvet-world/MoveInSheet';
import type { HouseConfig } from '../../features/velvet-world/art/streetArt';
import { getMyPlot } from '../../services/worldService';
import { upsertMyMemberProfile } from '../../services/memberProfileService';
import { updateSetupProgress } from '../../services/setupProgressService';
import { colorNameToHex } from '../../utils/colorMapping';
import { supabase } from '../../shared/supabase/client';
import { AuthSpinner } from '../../components/auth/AuthSpinner';
import { ArrivalProgress } from '../../features/arrival/ArrivalProgress';
import { ARRIVAL_ROUTES } from '../../features/arrival/arrivalRoutes';

/** Tap-to-use headlines for anyone stuck on what to write. */
const HEADLINE_STARTERS = [
  'Learning to cook, one disaster at a time',
  'Always planning the next trip',
  'Here to finally finish what I start',
  'Coffee first, then world domination',
  'Making the most of the weekends',
];

interface Loaded {
  userId: string;
  name: string;
  accent: string | undefined;
  existingHouse: HouseConfig | null;
  arrivalChoices: Record<string, unknown>;
}

/**
 * Your home: the third step of the arrival. Pick a house on the street, then
 * the billboard out front. Their goal goes on the billboard later, if they want
 * it there (Atlas asks at the end of the walkthrough).
 */
export function ArrivalHomePage() {
  const navigate = useNavigate();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [step, setStep] = useState<'house' | 'billboard'>('house');
  const [headline, setHeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login', { replace: true });
        return;
      }
      const [{ data: profile }, plot] = await Promise.all([
        supabase.from('user_profiles').select('nickname, favorite_color, arrival_choices').eq('id', user.id).maybeSingle(),
        getMyPlot().catch(() => null),
      ]);
      if (cancelled) return;
      setLoaded({
        userId: user.id,
        // Their billboard is public, so it carries the nickname, never a real name.
        name: publicName(profile) ?? '',
        accent: profile?.favorite_color ? colorNameToHex(profile.favorite_color) : undefined,
        existingHouse: plot?.house ?? null,
        arrivalChoices: (profile?.arrival_choices as Record<string, unknown>) ?? {},
      });
      updateSetupProgress(user.id, { step: 'arrival_home' });
    })().catch(() => setError('Something went wrong. Please refresh.'));
    return () => { cancelled = true; };
  }, [navigate]);

  const handleMoved = async (house: HouseConfig, chosen: boolean) => {
    if (!loaded) return;
    const arrivalChoices = { ...loaded.arrivalChoices, house: { style: house.style, color: house.body, chosen } };
    await supabase.from('user_profiles').update({ arrival_choices: arrivalChoices }).eq('id', loaded.userId);
    setLoaded({ ...loaded, arrivalChoices, existingHouse: house });
    setStep('billboard');
  };

  const finish = async (withHeadline: boolean) => {
    if (!loaded) return;
    setSaving(true);
    setError('');
    try {
      await upsertMyMemberProfile({
        display_name: loaded.name || 'Member',
        ...(withHeadline ? { headline: headline.trim() || null } : {}),
      });
      await updateSetupProgress(loaded.userId, { step: 'arrival_atlas' });
      navigate(ARRIVAL_ROUTES.atlas);
    } catch {
      setError("Couldn't save your billboard. Please try again.");
      setSaving(false);
    }
  };

  if (!loaded) return error ? <p className="p-8 text-center text-white">{error}</p> : <AuthSpinner />;

  const accent = loaded.accent ?? '#f43f5e';

  return (
    <div className="min-h-screen bg-[#080b14] px-4 py-6 text-white">
      <ArrivalProgress step={2} accent={loaded.accent} />

      <div className="mx-auto mt-8 max-w-xl">
        {step === 'house' ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5">
            <div className="text-center">
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: accent }}>Every member has a home on the street.</h1>
              <p className="mt-3 text-base leading-relaxed text-white/75">
                Your house is how the town sees you. Your billboard out front tells people who you are.
              </p>
            </div>
            <MoveInPanel
              initial={loaded.existingHouse}
              onMoved={handleMoved}
              submitLabel={loaded.existingHouse ? 'Keep this house' : 'Move in'}
            />
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5">
            <div className="text-center">
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: accent }}>Your billboard</h1>
              <p className="mt-3 text-base leading-relaxed text-white/75">
                Out front, for the neighbors: your name, a line about you, and the spaces you're part of.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Name</p>
              <p className="mt-1 text-lg font-bold">{loaded.name || 'You'}</p>

              <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-white/45" htmlFor="headline">
                Your headline
              </label>
              <input
                id="headline"
                value={headline}
                onChange={e => setHeadline(e.target.value)}
                maxLength={80}
                placeholder="One line about you"
                className="mt-1.5 w-full rounded-xl border-2 border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder-white/30 focus:outline-none"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                {HEADLINE_STARTERS.map(starter => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => setHeadline(starter)}
                    className="rounded-full border border-white/12 px-3 py-1.5 text-xs text-white/75 hover:text-white"
                  >
                    {starter}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-xs text-white/45">Your spaces show up here once you've joined them. Your goal can go up later, if you'd like.</p>
            </div>

            {error && <p role="alert" className="text-center text-sm text-rose-400">{error}</p>}

            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => finish(true)}
                disabled={saving}
                className="w-full max-w-xs rounded-full py-3.5 text-base font-bold text-white shadow-lg disabled:opacity-60"
                style={{ background: `linear-gradient(to right, ${accent}, ${accent}dd)` }}
              >
                {saving ? 'Saving…' : 'Put it up'}
              </button>
              <button type="button" onClick={() => finish(false)} disabled={saving} className="text-sm text-white/55 hover:text-white">
                Skip the headline
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
