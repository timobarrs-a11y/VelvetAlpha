import { supabase } from '../shared/supabase/client';

export interface PublicProfileData {
  profile: {
    user_id: string;
    display_name: string;
    headline: string | null;
    bio: string | null;
    avatar_config: Record<string, unknown> | null;
    profile_image_type: 'avatar' | 'smilie';
    profile_smilie_code: string | null;
    is_public: boolean;
    follower_count: number;
    following_count: number;
    is_bot: boolean;
  };
  counts: {
    active_goals: number;
    goals_completed: number;
    commitments_kept: number;
    plan_steps_done: number;
    current_streak: number;
  };
  goals: PublicGoal[];
  commitments: PublicCommitment[];
  is_owner: boolean;
  /** Friends, the owner, and anyone viewing a public-facing profile. Absent before the database update. */
  has_full_access?: boolean;
}

export interface PublicGoal {
  id: string;
  title: string;
  goal_type: string;
  current_value: number | null;
  target_value: number | null;
  unit: string | null;
  target_date: string | null;
  status: string;
}

export interface PublicCommitment {
  id: string;
  description: string;
  due_date: string | null;
  completed_at: string | null;
  status: string;
}

interface PublicProfileRpcResult {
  success: boolean;
  profile: PublicProfileData['profile'];
  counts: PublicProfileData['counts'];
  goals: PublicGoal[];
  commitments: PublicCommitment[];
  is_owner: boolean;
  has_full_access?: boolean;
}

export async function getPublicProfile(userId: string): Promise<PublicProfileData | null> {
  const { data, error } = await supabase.rpc('get_public_profile', { p_user_id: userId });
  if (error) {
    console.error('[publicProfileService] get_public_profile error:', error.message);
    return null;
  }
  const result = data as PublicProfileRpcResult;
  if (!result?.success || !result.profile) return null;
  return {
    profile: result.profile,
    counts: result.counts,
    goals: result.goals ?? [],
    commitments: result.commitments ?? [],
    is_owner: result.is_owner,
    has_full_access: result.has_full_access,
  };
}

export async function toggleGoalShowOnProfile(goalId: string, show: boolean): Promise<void> {
  const { error } = await supabase
    .from('user_goals')
    .update({ show_on_profile: show, updated_at: new Date().toISOString() })
    .eq('id', goalId);
  if (error) throw new Error(error.message);
}

export async function toggleCommitmentShowOnProfile(commitmentId: string, show: boolean): Promise<void> {
  const { error } = await supabase
    .from('coaching_commitments')
    .update({ show_on_profile: show, updated_at: new Date().toISOString() })
    .eq('id', commitmentId);
  if (error) throw new Error(error.message);
}

/** What anyone may see about anyone: the name they chose, interests, favorite color, zodiac and a broad outline of what they work on. */
export interface ProfileCard {
  card: {
    user_id: string;
    display_name: string;
    headline: string | null;
    profile_image_type: 'avatar' | 'smilie';
    profile_smilie_code: string | null;
    is_bot: boolean;
    interests: string[];
    favorite_color: string | null;
    zodiac_sign: string | null;
    /** Goal types only (for example "fitness"), never the goals themselves. */
    goal_areas: string[];
  };
  relation: {
    is_self: boolean;
    is_friend: boolean;
    /** The full page: friends, yourself, or a public-facing profile. */
    has_full_access: boolean;
    friend_request: 'none' | 'sent' | 'received';
  };
  reach: {
    who_can_message: 'everyone' | 'friends' | 'nobody';
    accepts_friend_requests: boolean;
    shares_accomplishments: boolean;
  };
}

export async function getProfileCard(userId: string): Promise<ProfileCard | null> {
  const { data, error } = await supabase.rpc('get_profile_card', { p_user_id: userId });
  if (error) {
    console.error('[publicProfileService] get_profile_card error:', error.message);
    return null;
  }
  const result = data as ({ success: boolean } & Partial<ProfileCard>) | null;
  if (!result?.success || !result.card || !result.relation || !result.reach) return null;
  return { card: result.card, relation: result.relation, reach: result.reach };
}
