import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Heart, Users, Bot, Target, TrendingUp,
  Loader2, UserPlus, UserMinus,
} from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { Avatar } from '../components/Avatar';
import { migrateAvatarConfig } from '../utils/avatarConfig';
import type { AvatarConfigV2 } from '../types/avatar-v2';
import {
  getMemberProfile,
  followUser,
  unfollowUser,
  isFollowing,
  MemberProfile,
} from '../services/memberProfileService';
import { getGoals, goalProgressPercent, goalDaysRemaining, GOAL_TYPE_LABELS, CoachingGoal } from '../services/coachingService';

export default function MemberProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [goals, setGoals] = useState<CoachingGoal[]>([]);
  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [p, isFollowingResult] = await Promise.all([
      getMemberProfile(userId),
      isFollowing(userId),
    ]);
    setProfile(p);
    setFollowing(isFollowingResult);

    if (p && p.shared_goal_ids.length > 0) {
      // Fetch the shared goals — they belong to this user, so we query their goals
      const { data: goalData, error } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', userId)
        .in('id', p.shared_goal_ids)
        .order('created_at', { ascending: false });
      if (!error) setGoals((goalData as CoachingGoal[]) ?? []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const handleToggleFollow = async () => {
    if (!userId) return;
    setFollowLoading(true);
    try {
      if (following) {
        await unfollowUser(userId);
        setFollowing(false);
      } else {
        await followUser(userId);
        setFollowing(true);
      }
    } catch {
      // best-effort
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="ds-page flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="ds-page flex flex-col items-center justify-center px-6 text-center">
        <p className="text-white/40 text-sm">This member's profile is not public.</p>
        <button onClick={() => navigate('/feed')} className="mt-4 text-pink-400 text-sm">
          Back to feed
        </button>
      </div>
    );
  }

  const avatarConfig = profile.avatar_config
    ? migrateAvatarConfig(profile.avatar_config)
    : null;

  return (
    <div className="ds-page text-white">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-[rgba(12,10,30,0.8)] backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-white/8 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-semibold">Profile</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-20">
        {/* Avatar + identity */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-5 mb-8"
        >
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 border border-white/10 bg-white/5">
            {avatarConfig ? (
              <Avatar config={avatarConfig as AvatarConfigV2} className="w-full h-full" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white/30">
                {profile.display_name.slice(0, 2).toUpperCase()}
              </div>
            )}
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

        {/* Follow button */}
        <div className="mb-8">
          <button
            onClick={handleToggleFollow}
            disabled={followLoading}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
              following
                ? 'bg-white/8 border border-white/10 text-white/60 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30'
                : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white hover:scale-[1.02] shadow-lg shadow-pink-500/20'
            } disabled:opacity-50`}
          >
            {followLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : following ? (
              <>
                <UserMinus className="w-4 h-4" />
                Following
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                Follow
              </>
            )}
          </button>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div className="mb-8">
            <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">About</h2>
            <p className="text-sm text-white/70 leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Shared goals */}
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3 flex items-center gap-1.5">
            <Target className="w-3 h-3" />
            Shared Goals
          </h2>
          {goals.length === 0 ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-6 text-center">
              <p className="text-white/30 text-sm">No shared goals yet.</p>
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
      </div>
    </div>
  );
}
