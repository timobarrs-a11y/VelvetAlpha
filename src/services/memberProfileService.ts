import { supabase } from '../shared/supabase/client';

export interface MemberProfile {
  user_id: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  avatar_config: Record<string, unknown> | null;
  profile_image_type: 'avatar' | 'smilie';
  profile_smilie_code: string | null;
  is_public: boolean;
  shared_goal_ids: string[];
  follower_count: number;
  following_count: number;
  discoverable: boolean;
  is_bot: boolean;
  created_at: string;
  updated_at: string;
}

export async function getMyMemberProfile(): Promise<MemberProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const existing = await getMemberProfile(user.id);
  if (existing) return existing;

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('name, avatar_config')
    .eq('id', user.id)
    .maybeSingle();

  return upsertMyMemberProfile({
    display_name: userProfile?.name || 'Member',
    avatar_config: userProfile?.avatar_config ?? null,
    is_public: true,
    discoverable: true,
  });
}

export async function getMemberProfile(userId: string): Promise<MemberProfile | null> {
  const { data, error } = await supabase
    .from('member_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[memberProfileService] getMemberProfile error:', error.message);
    return null;
  }
  return (data as MemberProfile) ?? null;
}

export async function upsertMyMemberProfile(updates: {
  display_name?: string;
  headline?: string | null;
  bio?: string | null;
  avatar_config?: Record<string, unknown> | null;
  profile_image_type?: 'avatar' | 'smilie';
  profile_smilie_code?: string | null;
  is_public?: boolean;
  shared_goal_ids?: string[];
  discoverable?: boolean;
}): Promise<MemberProfile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('member_profiles')
    .upsert(
      { user_id: user.id, ...updates, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select('*')
    .maybeSingle();

  if (error) {
    console.error('[memberProfileService] upsert error:', error.message);
    throw new Error(error.message);
  }
  return (data as MemberProfile) ?? null;
}

export async function followUser(followeeId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  if (user.id === followeeId) return;

  const { error } = await supabase
    .from('member_follows')
    .insert({ follower_id: user.id, followee_id: followeeId });

  if (error && !error.message.includes('duplicate')) {
    throw new Error(error.message);
  }
}

export async function unfollowUser(followeeId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('member_follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('followee_id', followeeId);

  if (error) throw new Error(error.message);
}

export async function isFollowing(followeeId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('member_follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('followee_id', followeeId)
    .maybeSingle();

  return !!data;
}

export async function getFollowingIds(): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('member_follows')
    .select('followee_id')
    .eq('follower_id', user.id);

  return (data ?? []).map(r => r.followee_id);
}

export async function getFollowers(userId: string, limit = 50): Promise<MemberProfile[]> {
  const { data } = await supabase
    .from('member_follows')
    .select('follower_id')
    .eq('followee_id', userId)
    .limit(limit);

  const followerIds = (data ?? []).map(r => r.follower_id);
  if (followerIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('member_profiles')
    .select('*')
    .in('user_id', followerIds);

  return (profiles as MemberProfile[]) ?? [];
}

export async function getFollowing(userId: string, limit = 50): Promise<MemberProfile[]> {
  const { data } = await supabase
    .from('member_follows')
    .select('followee_id')
    .eq('follower_id', userId)
    .limit(limit);

  const followeeIds = (data ?? []).map(r => r.followee_id);
  if (followeeIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from('member_profiles')
    .select('*')
    .in('user_id', followeeIds);

  return (profiles as MemberProfile[]) ?? [];
}
