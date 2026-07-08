import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getCompanions, CompanionWithLastMessage } from '../services/companionService';
import { AuthSpinner } from '../components/auth/AuthSpinner';
import { supabase } from '../shared/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ChevronRight } from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { AvatarConfig, DEFAULT_MALE_AVATAR, DEFAULT_FEMALE_AVATAR } from '../types/avatar';

function CompanionPickerModal({
  companions,
  onSelect,
}: {
  companions: CompanionWithLastMessage[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative w-full max-w-sm rounded-3xl p-6"
        style={{
          background: 'rgba(13,15,55,0.96)',
          border: '1px solid rgba(100,120,255,0.30)',
          backdropFilter: 'blur(24px)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.60)',
        }}
      >
        <div className="flex items-center justify-center mb-2">
          <Heart className="w-6 h-6 text-pink-400" fill="currentColor" />
        </div>
        <h2 className="text-xl font-bold text-white text-center mb-1">Who would you like to chat with?</h2>
        <p className="text-blue-200/60 text-sm text-center mb-6">Choose a companion to open their chat.</p>

        <div className="space-y-2">
          {companions.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all group"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,107,0.14)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,107,0.35)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)';
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/10">
                  <Avatar
                    config={(c.avatar_config as AvatarConfig) ?? (c.gender === 'male' ? DEFAULT_MALE_AVATAR : DEFAULT_FEMALE_AVATAR)}
                    className="w-full h-full"
                  />
                </div>
                <span className="text-white font-semibold">{c.name}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-200/50 group-hover:text-pink-400 transition-colors" />
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export function RootRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [destination, setDestination] = useState<string | null>(null);
  const [pickerCompanions, setPickerCompanions] = useState<CompanionWithLastMessage[]>([]);

  useEffect(() => {
    if (loading) return;

    async function determineRoute() {
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.substring(1));
      const isRecovery = hashParams.get('type') === 'recovery' || hashParams.has('access_token');

      if (isRecovery) {
        setDestination(`/reset-password${hash}`);
        return;
      }

      if (!user) {
        setDestination('/welcome');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('welcome_seen')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError || profile === null) {
        await supabase.auth.signOut();
        setDestination('/welcome');
        return;
      }

      const companions = await getCompanions(user.id);

      if (companions.length === 0) {
        const currentCompanionId = sessionStorage.getItem('currentCompanionId');
        const matchAnswers = sessionStorage.getItem('matchAnswers');
        const expertMatchAnswers = sessionStorage.getItem('expertMatchAnswers');
        const onboardingIntent = sessionStorage.getItem('onboardingIntent');

        if (currentCompanionId && matchAnswers) {
          setDestination('/voice-selection');
          return;
        }

        if (onboardingIntent === 'coaches' && expertMatchAnswers) {
          setDestination('/voice-selection');
          return;
        }

        if (!profile?.welcome_seen) {
          setDestination('/welcome');
        } else {
          setDestination('/user-questionnaire');
        }
      } else if (companions.length === 1) {
        localStorage.removeItem('currentCompanionId');
        localStorage.removeItem('matchAnswers');
        setDestination(`/chat?companion=${companions[0].id}`);
      } else {
        localStorage.removeItem('currentCompanionId');
        localStorage.removeItem('matchAnswers');
        const lastId = localStorage.getItem('velvet_last_companion');
        const lastCompanion = lastId ? companions.find(c => c.id === lastId) : null;
        if (lastCompanion) {
          setDestination(`/chat?companion=${lastCompanion.id}`);
        } else {
          setPickerCompanions(companions);
        }
      }
    }

    determineRoute();
  }, [user, loading]);

  const handlePickerSelect = (id: string) => {
    navigate(`/chat?companion=${id}`, { replace: true });
  };

  if (loading || (!destination && pickerCompanions.length === 0)) return <AuthSpinner />;

  if (pickerCompanions.length > 0) {
    return (
      <div className="min-h-screen" style={{ background: 'linear-gradient(175deg, #1e2a7a 0%, #141a55 40%, #0d0f3c 100%)' }}>
        <AnimatePresence>
          <CompanionPickerModal companions={pickerCompanions} onSelect={handlePickerSelect} />
        </AnimatePresence>
      </div>
    );
  }

  return <Navigate to={destination!} replace />;
}
