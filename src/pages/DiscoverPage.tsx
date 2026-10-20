import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Compass, Target, Users, Loader2, UserPlus, UserMinus, Bot, Sparkles,
} from 'lucide-react';
import { Avatar } from '../components/Avatar';
import { migrateAvatarConfig } from '../utils/avatarConfig';
import type { AvatarConfigV2 } from '../types/avatar-v2';
import {
  discoverMembersByGoalType,
  DiscoverableMember,
} from '../services/discoveryService';
import { followUser, unfollowUser, isFollowing, getFollowingIds } from '../services/memberProfileService';
import { GOAL_TYPE_LABELS } from '../services/coachingService';
import { PageShell } from '../shared/ui/PageShell';
import { LoadingState } from '../shared/ui/LoadingState';
import { EmptyState } from '../shared/ui/EmptyState';

const GOAL_TYPES = Object.entries(GOAL_TYPE_LABELS).map(([value, label]) => ({ value, label }));

function MemberCard({ member, index, following, onToggleFollow }: {
  member: DiscoverableMember;
  index: number;
  following: boolean;
  onToggleFollow: (userId: string) => void;
}) {
  const navigate = useNavigate();
  const avatarConfig = member.avatar_config ? migrateAvatarConfig(member.avatar_config) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.4) }}
      className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 hover:border-white/12 transition-colors"
    >
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(`/member/${member.user_id}`)}
          className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-white/5 hover:border-white/20 transition-colors"
        >
          {avatarConfig ? (
            <Avatar config={avatarConfig as AvatarConfigV2} className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-white/30">
              {member.display_name.slice(0, 2).toUpperCase()}
            </div>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigate(`/member/${member.user_id}`)}
              className="text-sm font-semibold text-white truncate hover:text-pink-300 transition-colors"
            >
              {member.display_name}
            </button>
            {member.is_bot && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-semibold">
                <Bot className="w-2.5 h-2.5" />
                Bot
              </span>
            )}
          </div>
          {member.headline && (
            <p className="text-xs text-white/40 truncate mt-0.5">{member.headline}</p>
          )}
          {member.shared_goal_titles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {member.shared_goal_titles.slice(0, 3).map(title => (
                <span key={title} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-400/20 text-pink-300 text-[10px] font-medium">
                  <Target className="w-2.5 h-2.5" />
                  {title.length > 30 ? title.slice(0, 30) + '...' : title}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-3 mt-2 text-[10px] text-white/30">
            <span className="flex items-center gap-1">
              <Users className="w-2.5 h-2.5" />
              {member.follower_count} followers
            </span>
          </div>
        </div>
        <button
          onClick={() => onToggleFollow(member.user_id)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
            following
              ? 'bg-white/8 border border-white/10 text-white/50 hover:bg-red-500/10 hover:text-red-300'
              : 'bg-pink-500/80 hover:bg-pink-500 text-white'
          }`}
        >
          {following ? <UserMinus className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
          {following ? 'Following' : 'Follow'}
        </button>
      </div>
    </motion.div>
  );
}

export default function DiscoverPage() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<DiscoverableMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGoalType, setSelectedGoalType] = useState<string | undefined>(undefined);
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [data, followingIds] = await Promise.all([
      discoverMembersByGoalType(selectedGoalType, 40),
      getFollowingIds(),
    ]);
    setMembers(data);
    setFollowingSet(new Set(followingIds));
    setLoading(false);
  }, [selectedGoalType]);

  useEffect(() => { load(); }, [load]);

  const handleToggleFollow = async (userId: string) => {
    const isCurrentlyFollowing = followingSet.has(userId);
    setFollowingSet(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(userId);
      } else {
        await followUser(userId);
      }
    } catch {
      // Revert on error
      setFollowingSet(prev => {
        const next = new Set(prev);
        if (isCurrentlyFollowing) next.add(userId);
        else next.delete(userId);
        return next;
      });
    }
  };

  return (
    <PageShell
      width="md"
      header={
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-pink-400" />
            <h1 className="text-lg font-bold text-white">Discover</h1>
          </div>
        </div>
      }
    >
      {/* Goal type filter */}
      <div className="px-4 py-3 border-b border-white/8">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-pink-400" />
          <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Filter by goal</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedGoalType(undefined)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              !selectedGoalType ? 'bg-pink-500/15 text-pink-300 border border-pink-400/30' : 'bg-white/5 text-white/40 border border-white/8 hover:bg-white/8'
            }`}
          >
            All goals
          </button>
          {GOAL_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setSelectedGoalType(value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedGoalType === value ? 'bg-pink-500/15 text-pink-300 border border-pink-400/30' : 'bg-white/5 text-white/40 border border-white/8 hover:bg-white/8'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="p-4 space-y-3">
        {loading ? (
          <LoadingState label="Discovering members..." />
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Compass className="w-7 h-7" />}
            title="No members found"
            description={
              selectedGoalType
                ? `No public members working on ${GOAL_TYPE_LABELS[selectedGoalType] ?? selectedGoalType} yet. Try a different goal or check back later.`
                : 'No public members to discover yet. Be the first to make your profile public in Settings!'
            }
            action={{ label: 'Go to feed', onClick: () => navigate('/feed') }}
          />
        ) : (
          members.map((member, i) => (
            <MemberCard
              key={member.user_id}
              member={member}
              index={i}
              following={followingSet.has(member.user_id)}
              onToggleFollow={handleToggleFollow}
            />
          ))
        )}
      </div>
    </PageShell>
  );
}
