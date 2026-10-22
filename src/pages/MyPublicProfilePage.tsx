import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Users, Bot, Target, TrendingUp, Loader2, Pencil, EyeOff, Trophy,
  CheckCircle2, Flame,
} from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { PublicProfileImage } from '../components/PublicProfileImage';
import { getPublicProfile, PublicProfileData, PublicGoal } from '../services/publicProfileService';
import { getUserMedals, type UserMedal } from '../services/medalsService';
import { GOAL_TYPE_LABELS } from '../services/coachingService';
import { MedalShowcase } from '../components/medals/MedalShowcase';
import { MedalBadge } from '../components/medals/MedalBadge';

function goalProgressPercent(goal: PublicGoal): number {
  if (!goal.target_value || Number(goal.target_value) <= 0) return 0;
  return Math.min(100, Math.round(((goal.current_value ?? 0) / Number(goal.target_value)) * 100));
}

function goalDaysRemaining(goal: PublicGoal): number | null {
  if (!goal.target_date) return null;
  const target = new Date(goal.target_date);
  const now = new Date();
  const diff = Math.ceil((target.getTime() - now.getTime()) / 86400000);
  return diff;
}

export default function MyPublicProfilePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<PublicProfileData | null>(null);
  const [medals, setMedals] = useState<UserMedal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const p = await getPublicProfile(user.id);
    setData(p);
    getUserMedals().then(setMedals).catch(() => {});
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="ds-page flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
      </div>
    );
  }

  if (!data || !data.profile.is_public) {
    return (
      <div className="ds-page text-white">
        <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-[rgba(12,10,30,0.8)] backdrop-blur-sm">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/8 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold">My Public Profile</span>
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-white/5 mb-4">
            <EyeOff className="w-8 h-8 text-white/30" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Your profile isn't public yet</h2>
          <p className="text-sm text-white/40 max-w-sm mb-6">
            Make your profile visible to other members so they can discover you, follow your progress, and connect.
          </p>
          <button
            onClick={() => navigate('/my-profile/edit')}
            className="px-6 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:scale-[1.02] transition-all shadow-lg shadow-pink-500/20"
          >
            Set up my profile
          </button>
        </div>
      </div>
    );
  }

  const { profile, counts, goals, commitments } = data;

  return (
    <div className="ds-page text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-white/8 bg-[rgba(12,10,30,0.8)] backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/8 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold">My Public Profile</span>
        </div>
        <button
          onClick={() => navigate('/my-profile/edit')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 border border-white/10 text-xs font-semibold text-white/70 hover:bg-white/12 hover:text-white transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          Edit
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {/* Preview banner */}
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-pink-400/20 bg-pink-500/[0.04] px-4 py-2.5">
          <Users className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
          <p className="text-xs text-pink-300/70">This is how other members see your profile.</p>
        </div>

        {/* Avatar + identity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-5 mb-8"
        >
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10 bg-white/5">
            <PublicProfileImage profile={profile} className="h-full w-full" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white truncate">{profile.display_name}</h1>
              {profile.is_bot && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-semibold">
                  <Bot className="w-3 h-3" />
                  Bot
                </span>
              )}
            </div>
            {profile.headline && (
              <p className="text-white/50 text-sm mt-1">{profile.headline}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm">
              <span className="flex items-center gap-1.5 text-white/40">
                <Users className="w-3.5 h-3.5" />
                <span className="tabular-nums">{profile.follower_count}</span> followers
              </span>
              <span className="flex items-center gap-1.5 text-white/40">
                <Users className="w-3.5 h-3.5" />
                <span className="tabular-nums">{profile.following_count}</span> following
              </span>
            </div>
          </div>
        </motion.div>

        {/* Progress counts */}
        <div className="mb-8 rounded-xl border border-white/8 bg-white/[0.02] p-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {counts.active_goals > 0 && (
              <span className="flex items-center gap-1.5 text-white/60">
                <Target className="w-3.5 h-3.5 text-pink-400" />
                <span className="tabular-nums">{counts.active_goals}</span> active goals
              </span>
            )}
            {counts.commitments_kept > 0 && (
              <span className="flex items-center gap-1.5 text-white/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="tabular-nums">{counts.commitments_kept}</span> commitments kept
              </span>
            )}
            {counts.goals_completed > 0 && (
              <span className="flex items-center gap-1.5 text-white/60">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="tabular-nums">{counts.goals_completed}</span> goals completed
              </span>
            )}
            {counts.current_streak > 0 && (
              <span className="flex items-center gap-1.5 text-white/60">
                <Flame className="w-3.5 h-3.5 text-orange-400" />
                <span className="tabular-nums">{counts.current_streak}</span>-day streak
              </span>
            )}
            {counts.active_goals === 0 && counts.commitments_kept === 0 && counts.goals_completed === 0 && (
              <span className="text-white/30 text-xs">No progress yet.</span>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mb-8">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">About</h2>
            <p className="text-sm text-white/70 leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Medal showcase */}
        {medals.length > 0 && (
          <div className="mb-8">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3 flex items-center gap-1.5">
              <Trophy className="w-3 h-3" />
              Medals
            </h2>
            <div className="flex flex-col gap-4 p-4 rounded-xl border border-white/8 bg-white/[0.02]">
              <MedalShowcase medals={medals} isOwn onEdit={() => navigate('/medals')} />
              <div className="flex flex-wrap gap-2">
                {medals.filter(m => m.earned_at).map(m => (
                  <MedalBadge key={m.slug} icon={m.icon} tier={m.tier as any} size="sm" />
                ))}
              </div>
              <button onClick={() => navigate('/medals')} className="text-xs text-pink-400 hover:text-pink-300 transition-colors self-start">See all medals →</button>
            </div>
          </div>
        )}

        {/* Goals */}
        <div className="mb-8">
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3 flex items-center gap-1.5">
            <Target className="w-3 h-3" />
            Goals
          </h2>
          {goals.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-6 text-center">
              <p className="text-white/30 text-sm">No goals shared publicly yet. Toggle "Show on profile" on a goal to share it.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((goal, i) => {
                const pct = goalProgressPercent(goal);
                const daysLeft = goalDaysRemaining(goal);
                return (
                  <motion.div
                    key={goal.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-white/8 bg-white/[0.02] p-4"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">{goal.title}</h3>
                        <p className="text-xs text-white/40 mt-0.5">
                          {GOAL_TYPE_LABELS[goal.goal_type] ?? goal.goal_type}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        goal.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' :
                        goal.status === 'completed' ? 'bg-sky-500/15 text-sky-300' :
                        'bg-white/8 text-white/40'
                      }`}>
                        {goal.status}
                      </span>
                    </div>
                    {goal.target_value && (
                      <div>
                        <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {goal.current_value ?? 0} / {goal.target_value} {goal.unit ?? ''}
                          </span>
                          <span className="tabular-nums">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            className="h-full rounded-full bg-gradient-to-r from-pink-400 to-rose-400"
                          />
                        </div>
                      </div>
                    )}
                    {daysLeft !== null && daysLeft >= 0 && goal.status === 'active' && (
                      <p className="text-xs text-white/30 mt-2">{daysLeft} days remaining</p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Shown commitments */}
        {commitments.length > 0 && (
          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" />
              Commitments
            </h2>
            <div className="space-y-2">
              {commitments.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-white/8 bg-white/[0.02] p-3"
                >
                  <p className="text-sm text-white/70">{c.description}</p>
                  {c.completed_at && (
                    <p className="text-xs text-white/30 mt-1">Completed {new Date(c.completed_at).toLocaleDateString()}</p>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
