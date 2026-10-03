import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, Heart, Users, RotateCcw, MessageCircle } from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { useAuth } from '../auth/AuthProvider';
import { Avatar } from '../components/Avatar';
import { companionAvatarConfig } from '../components/lobby/lobbyUtils';
import { VELVET_THEME } from '../config/velvetTheme';
import { advanceSetupStepIf } from '../services/setupProgressService';

interface Person {
  id: string;
  custom_name: string | null;
  gender: string | null;
  avatar_config: unknown;
  relationship_type: string | null;
}

type Status = 'loading' | 'ready' | 'error';

const ROLE_META: Record<string, { label: string; color: string; icon: typeof Brain }> = {
  mentor: { label: 'Your coach', color: '#10b981', icon: Brain },
  romantic: { label: 'Your companion', color: '#f472b6', icon: Heart },
  friend: { label: 'Your friend', color: '#38bdf8', icon: Users },
};

function roleMeta(rel: string | null) {
  return ROLE_META[rel ?? ''] ?? ROLE_META.friend;
}

export function WhoToTalkPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [opening, setOpening] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!user) return;
    setStatus('loading');
    (async () => {
      const { data, error } = await supabase
        .from('companions')
        .select('id, custom_name, gender, avatar_config, relationship_type')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error || !data) {
        if (error) console.error('[WhoToTalk] load failed:', error);
        setStatus('error');
        return;
      }

      const newestId = sessionStorage.getItem('currentCompanionId');
      const coach = data.find(c => c.relationship_type === 'mentor');
      const others = data.filter(c => c.relationship_type !== 'mentor');
      const newest = others.find(c => c.id === newestId) ?? others[0];
      const picks = [coach, newest].filter((p): p is Person => !!p);

      if (picks.length === 0) {
        setStatus('error');
        return;
      }
      setPeople(picks);
      setStatus('ready');
    })();
  }, [user, reloadKey]);

  const handlePick = async (person: Person) => {
    if (!user) return;
    setOpening(person.id);
    await advanceSetupStepIf(user.id, ['companion_in_progress', 'choose_conversation'], 'complete');
    sessionStorage.removeItem('currentCompanionId');
    sessionStorage.removeItem('matchAnswers');
    navigate(`/chat?companion=${person.id}`, { replace: true });
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-6 py-12 overflow-hidden" style={{ background: VELVET_THEME.bg }}>
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: VELVET_THEME.radial }} />

      <div className="relative z-10 w-full max-w-2xl">
        {status === 'loading' && (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-rose-400" />
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-16">
            <p className="text-lg font-semibold text-white mb-2">We couldn't load your conversations</p>
            <p className="text-sm text-ink-secondary mb-6">Check your connection and try again. Everything you created is saved.</p>
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

        {status === 'ready' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="text-center mb-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-300 mb-3">All set</p>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
                Who do you want to talk to?
              </h1>
              <p className="text-base text-ink-secondary leading-relaxed">
                You can switch between them anytime from the lobby.
              </p>
            </div>

            <div className={`grid gap-4 ${people.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-xs mx-auto'}`}>
              {people.map((person, i) => {
                const meta = roleMeta(person.relationship_type);
                const Icon = meta.icon;
                return (
                  <motion.button
                    key={person.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.1, duration: 0.4 }}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePick(person)}
                    disabled={opening !== null}
                    className="group relative rounded-3xl p-6 text-center transition-shadow disabled:opacity-60"
                    style={{
                      background: VELVET_THEME.colors.glassCard,
                      border: `1px solid ${VELVET_THEME.colors.glassBorder}`,
                    }}
                  >
                    <div
                      className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      style={{ boxShadow: `0 0 0 1px ${meta.color}66, 0 16px 48px ${meta.color}26` }}
                    />
                    <div className="relative mx-auto mb-5 w-28 h-28">
                      <div
                        className="w-full h-full rounded-full overflow-hidden"
                        style={{ border: `3px solid ${meta.color}99` }}
                      >
                        <Avatar config={companionAvatarConfig(person)} className="w-full h-full" />
                      </div>
                      <span
                        className="absolute bottom-0 right-0 w-8 h-8 rounded-full flex items-center justify-center text-white"
                        style={{ background: meta.color, border: '3px solid var(--ds-surface-3)' }}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: meta.color }}>
                      {meta.label}
                    </p>
                    <p className="text-xl font-bold text-white mb-4 truncate">{person.custom_name || 'Unnamed'}</p>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink-secondary group-hover:text-white transition-colors">
                      <MessageCircle className="w-4 h-4" />
                      {opening === person.id ? 'Opening...' : 'Start talking'}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
