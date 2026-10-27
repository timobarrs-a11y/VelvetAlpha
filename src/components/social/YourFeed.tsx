import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Globe, TrendingUp, Sparkles } from 'lucide-react';
import { PublicProfileImage } from '../PublicProfileImage';
import { getFeedPosts, getPublicFeed, getTrendingPosts, type ProgressPostWithAuthor } from '../../services/progressFeedService';
import { isHelper } from '../../utils/relationshipType';
import { getAtlasIntroductions, AtlasIntroduction } from '../../services/atlasIntroductionsService';
import { followUser } from '../../services/memberProfileService';
import { Segmented } from '../../shared/ui/Pill';
import { LoadingState } from '../../shared/ui/LoadingState';
import { EmptyState } from '../../shared/ui/EmptyState';
import { PostCard } from './PostCard';
import { CompanionStatusCard } from './CompanionStatusCard';
import { refreshCompanionStatuses, loadCompanionStatuses, type CompanionStatusFeed, type CompanionStatusPost } from '../../services/companionStatusService';
import { StatusComposer } from './StatusComposer';
import { useFeedPosts } from './useFeedPosts';
import { AuthoredBadge } from './AuthoredBadge';

type Scope = 'following' | 'everyone' | 'trending';

const LOADERS: Record<Scope, () => ReturnType<typeof getFeedPosts>> = {
  following: () => getFeedPosts(30),
  everyone: () => getPublicFeed(30),
  trending: () => getTrendingPosts(30),
};

function IntroductionCard({ intro, onFollow }: {
  intro: AtlasIntroduction;
  onFollow: (userId: string) => void;
}) {
  const navigate = useNavigate();
  const [followed, setFollowed] = useState(false);

  const handleFollow = async () => {
    await followUser(intro.user_id);
    setFollowed(true);
    onFollow(intro.user_id);
  };

  const introProfile = {
    avatar_config: intro.avatar_config,
    profile_image_type: intro.profile_image_type as 'avatar' | 'smilie',
    profile_smilie_code: intro.profile_smilie_code,
  };

  const hasTitles = intro.shared_goal_titles && intro.shared_goal_titles.length > 0;
  const goalTypeLabels = (intro.shared_goal_types ?? []).map(t =>
    t.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  );
  const connectionText = hasTitles
    ? `You're both working on ${intro.shared_goal_titles.slice(0, 2).join(' and ')}`
    : goalTypeLabels.length > 0
      ? `You're both working on a ${goalTypeLabels[0]} goal`
      : 'You share common goals';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-violet-400/20 bg-violet-500/[0.04] p-4"
    >
      <div className="flex items-center gap-1.5 mb-3">
        <Sparkles className="w-3.5 h-3.5 text-violet-300" />
        <span className="text-xs font-semibold text-violet-300">Atlas suggests a connection</span>
      </div>
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(`/member/${intro.user_id}`)}
          className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-white/5 hover:border-white/20 transition-colors"
        >
          <PublicProfileImage profile={introProfile} className="h-full w-full" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button onClick={() => navigate(`/member/${intro.user_id}`)} className="text-sm font-semibold text-white truncate hover:text-pink-300 transition-colors">
              {intro.display_name}
            </button>
            {intro.is_bot && (
              <AuthoredBadge size="sm" />
            )}
          </div>
          {intro.headline && <p className="text-xs text-white/40 truncate mt-0.5">{intro.headline}</p>}
          <p className="text-xs text-violet-300/60 mt-1">{connectionText}</p>
        </div>
        <button
          onClick={handleFollow}
          disabled={followed}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-shrink-0 ${
            followed ? 'bg-white/8 text-white/40' : 'bg-violet-500/80 hover:bg-violet-500 text-white'
          }`}
        >
          {followed ? 'Following' : 'Follow'}
        </button>
      </div>
    </motion.div>
  );
}

/**
 * "Your Feed": statuses and progress wins from people you follow (or
 * everyone, or what's trending), with a box to post your own.
 */
export function YourFeed() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<Scope>('following');
  const [introductions, setIntroductions] = useState<AtlasIntroduction[]>([]);
  const load = useCallback(() => LOADERS[scope](), [scope]);
  const { posts, likedIds, loading, currentUserId, reload, onLikeChange, onDeleted } = useFeedPosts(load);

  // Your companions' own statuses sit in the feed you follow, in time order with everyone else's.
  const [companionFeed, setCompanionFeed] = useState<CompanionStatusFeed | null>(null);
  useEffect(() => {
    if (scope !== 'following') { setCompanionFeed(null); return; }
    let live = true;
    loadCompanionStatuses().then(f => { if (live) setCompanionFeed(f); }).catch(() => {});
    // Post whatever has come due, then show it.
    refreshCompanionStatuses()
      .then(() => loadCompanionStatuses())
      .then(f => { if (live) setCompanionFeed(f); })
      .catch(() => {});
    return () => { live = false; };
  }, [scope]);

  const timeline = useMemo(() => {
    const items: Array<{ at: number; post?: ProgressPostWithAuthor; status?: CompanionStatusPost }> = posts.map(post => ({ at: new Date(post.created_at).getTime(), post }));
    if (scope === 'following') {
      for (const status of companionFeed?.posts ?? []) items.push({ at: new Date(status.visible_at).getTime(), status });
    }
    return items.sort((a, b) => b.at - a.at);
  }, [posts, companionFeed, scope]);
  const mentionable = useMemo(
    () => [...(companionFeed?.companions.values() ?? [])].filter(c => !isHelper(c.relationship_type)),
    [companionFeed],
  );

  useEffect(() => {
    if (scope !== 'following') { setIntroductions([]); return; }
    let live = true;
    getAtlasIntroductions(3).then(i => { if (live) setIntroductions(i); }).catch(() => {});
    return () => { live = false; };
  }, [scope]);

  return (
    <div className="p-4 space-y-3 max-w-2xl mx-auto w-full">
      <StatusComposer onPosted={reload} />

      <div className="flex justify-center pt-1">
        <Segmented
          value={scope}
          onChange={setScope}
          options={[
            { value: 'following', label: 'Following', icon: <Users className="w-3.5 h-3.5" /> },
            { value: 'everyone', label: 'Everyone', icon: <Globe className="w-3.5 h-3.5" /> },
            { value: 'trending', label: 'Trending', icon: <TrendingUp className="w-3.5 h-3.5" /> },
          ]}
        />
      </div>

      {!loading && introductions.length > 0 && (
        <div className="space-y-2">
          {introductions.map(intro => (
            <IntroductionCard
              key={intro.user_id}
              intro={intro}
              onFollow={() => setIntroductions(prev => prev.filter(i => i.user_id !== intro.user_id))}
            />
          ))}
        </div>
      )}

      {loading && timeline.length === 0 ? (
        <LoadingState label="Loading your feed..." />
      ) : timeline.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="w-7 h-7" />}
          title={scope === 'trending' ? 'Nothing trending yet' : 'No posts yet'}
          description={
            scope === 'following'
              ? 'Follow people to see their statuses and wins here, or see what everyone is posting.'
              : 'Be the first: post a status above.'
          }
          action={scope === 'following' ? { label: 'See everyone', onClick: () => setScope('everyone') } : undefined}
        />
      ) : (
        timeline.map((item, i) => item.status ? (
          <CompanionStatusCard
            key={`companion-${item.status.id}`}
            post={item.status}
            index={i}
            companion={companionFeed?.companions.get(item.status.companion_id)}
            companions={mentionable}
            initialComments={(companionFeed?.comments ?? []).filter(c => c.post_id === item.status!.id)}
          />
        ) : (
          <PostCard
            key={item.post!.id}
            post={item.post!}
            index={i}
            liked={likedIds.has(item.post!.id)}
            currentUserId={currentUserId}
            onLikeChange={onLikeChange}
            onDeleted={onDeleted}
          />
        ))
      )}

      {!loading && scope === 'following' && timeline.length > 0 && (
        <p className="text-center text-xs text-white/30 pt-2">
          Want more here?{' '}
          <button onClick={() => navigate('/discover')} className="underline hover:text-white/60">Find people to follow</button>
        </p>
      )}
    </div>
  );
}
