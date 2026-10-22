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
