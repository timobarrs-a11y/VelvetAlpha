import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageCircle, UserPlus, RotateCcw, Sparkles } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../components/Avatar';
import { companionAvatarConfig } from '../components/lobby/lobbyUtils';
import { VELVET_THEME } from '../config/velvetTheme';
import { SOMEONE_NEW_ROUTE, updateSetupProgress } from '../services/setupProgressService';

interface Coach {
  id: string;
  custom_name: string | null;
  gender: string | null;
  avatar_config: unknown;
}

type Status = 'loading' | 'ready' | 'error';

export function CoachReadyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [coach, setCoach] = useState<Coach | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [busy, setBusy] = useState<'talk' | 'add' | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const goal = sessionStorage.getItem('atlasGoalText');

  useEffect(() => {
    if (!user) return;
    setStatus('loading');
    (async () => {
      const storedId = sessionStorage.getItem('atlasCoachId');
      let query = supabase
        .from('companions')
        .select('id, custom_name, gender, avatar_config')
        .eq('user_id', user.id)
        .eq('relationship_type', 'mentor')
        .eq('is_active', true);
      if (storedId) query = query.eq('id', storedId);

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        if (error) console.error('[CoachReady] load failed:', error);
        setStatus('error');
        return;
      }
      sessionStorage.setItem('atlasCoachId', data.id);
      setCoach(data);
      setStatus('ready');
    })();
  }, [user, reloadKey]);

  const coachName = coach?.custom_name || 'your coach';

  const handleTalk = async () => {
    if (!user || !coach) return;
    setBusy('talk');
    await updateSetupProgress(user.id, { step: 'complete', path: 'coach_only' });
    navigate(`/chat?companion=${coach.id}`, { replace: true });
  };

  const handleAdd = async () => {
    if (!user) return;
    setBusy('add');
    sessionStorage.removeItem('currentCompanionId');
    sessionStorage.removeItem('matchAnswers');
    await updateSetupProgress(user.id, { step: 'companion_in_progress', path: 'coach_and_companion' });
    navigate(SOMEONE_NEW_ROUTE);
  };

  const handleBack = () => {
    sessionStorage.removeItem('currentCompanionId');
    sessionStorage.setItem('envSetupNextRoute', '/coach-ready');
    sessionStorage.setItem('envSetupBackRoute', '/coach-avatar');
    navigate('/environment-setup');
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-12 overflow-hidden" style={{ background: VELVET_THEME.bg }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: VELVET_THEME.radial }} />

      <div className="relative z-10 w-full max-w-lg">
        <button
          onClick={handleBack}
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-ink-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {status === 'loading' && (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-400" />
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-16">
            <p className="text-lg font-semibold text-white mb-2">We couldn't load your coach</p>
            <p className="text-sm text-ink-secondary mb-6">Check your connection and try again. Your progress is saved.</p>
            <button
              onClick={() => setReloadKey(k => k + 1)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-transform hover:scale-[1.02]"
              style={{ background: VELVET_THEME.button.primary, boxShadow: VELVET_THEME.button.primaryGlow }}
            >
              <RotateCcw className="w-4 h-4" />
              Try again
            </button>
          </div>
        )}

        {status === 'ready' && coach && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="text-center"
          >
            <div className="relative mx-auto mb-8 w-36 h-36">
              <motion.div
                className="absolute -inset-4 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(16,185,129,0.28) 0%, transparent 70%)' }}
                animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 18 }}
                className="relative w-full h-full rounded-full overflow-hidden"
                style={{ border: '3px solid rgba(16,185,129,0.6)', boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}
              >
                <Avatar config={companionAvatarConfig(coach)} className="w-full h-full" />
              </motion.div>
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 16 }}
                className="absolute bottom-1 right-1 w-9 h-9 rounded-full flex items-center justify-center text-white"
                style={{ background: '#10b981', border: '3px solid var(--ds-bg-page)' }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.span>
            </div>

            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300 mb-3">Setup complete</p>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
              {coach.custom_name ? `${coach.custom_name} is ready` : 'Your coach is ready'}
            </h1>
            <p className="text-base text-ink-secondary leading-relaxed max-w-md mx-auto mb-10">
              {goal
                ? `${coach.custom_name || 'Your coach'} is set up to help you with ${goal.replace(/\.$/, '')}. What would you like to do next?`
                : 'What would you like to do next?'}
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={handleTalk}
                disabled={busy !== null}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60 disabled:hover:scale-100"
                style={{ background: VELVET_THEME.button.primary, boxShadow: VELVET_THEME.button.primaryGlow }}
              >
                <MessageCircle className="w-5 h-5" />
                {busy === 'talk' ? 'Opening...' : `Start talking with ${coachName}`}
              </button>

              <button
                onClick={handleAdd}
                disabled={busy !== null}
                className="group w-full text-left px-5 py-4 rounded-2xl transition-colors disabled:opacity-60 hover:border-rose-400/50"
                style={{ background: VELVET_THEME.colors.glassCard, border: `1px solid ${VELVET_THEME.colors.glassBorder}` }}
              >
                <div className="flex items-center gap-4">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 bg-rose-500/15 text-rose-300 group-hover:bg-rose-500/25 transition-colors">
                    <UserPlus className="w-5 h-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold text-white">
                      {busy === 'add' ? 'Getting things ready...' : 'Add someone new'}
                    </span>
                    <span className="block text-sm text-ink-muted">Create a friend or companion to talk to as well</span>
                  </span>
                </div>
              </button>
            </div>

            <p className="mt-6 text-xs text-ink-subtle">
              You can always add someone new later from the lobby or the quick menu.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
