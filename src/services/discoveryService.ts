import { supabase } from '../shared/supabase/client';
import { MemberProfile } from './memberProfileService';

export interface DiscoverableMember extends MemberProfile {
  shared_goal_titles: string[];
  shared_goal_types: string[];
}

interface DiscoverableGoalRow {
  user_id: string;
  goal_type: string;
  title: string | null;
}

interface DiscoverableGoalRpcResult {
  success: boolean;
  goals: DiscoverableGoalRow[];
}

export async function discoverMembersByGoalType(goalType?: string, limit = 30): Promise<DiscoverableMember[]> {
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profiles, error } = await supabase
    .from('member_profiles')
    .select('user_id, display_name, headline, avatar_config, profile_image_type, profile_smilie_code, is_public, shared_goal_ids, follower_count, following_count, discoverable, is_bot, created_at, updated_at')
    .eq('is_public', true)
    .eq('discoverable', true)
    .neq('user_id', user?.id ?? '')
    .limit(limit);

  if (error) {
    console.error('[discoveryService] query error:', error.message);
    return [];
  }

  const memberProfiles = (profiles ?? []) as MemberProfile[];
  if (memberProfiles.length === 0) return [];

  const userIds = memberProfiles.map(p => p.user_id);

  // Use SECURITY DEFINER function to get goal types (always visible) and
  // titles (only when show_on_profile = true) for other users' goals
  const { data: rpcData, error: rpcError } = await supabase.rpc('get_discoverable_goals', { p_user_ids: userIds });
  if (rpcError) {
    console.error('[discoveryService] get_discoverable_goals error:', rpcError.message);
    return memberProfiles.map(p => ({ ...p, shared_goal_titles: [], shared_goal_types: [] } as DiscoverableMember));
  }

  const rpcResult = rpcData as DiscoverableGoalRpcResult;
  const allGoals = rpcResult?.goals ?? [];

  // Group goals by user
  const goalsByUser = new Map<string, DiscoverableGoalRow[]>();
  for (const g of allGoals) {
    const arr = goalsByUser.get(g.user_id) ?? [];
    arr.push(g);
    goalsByUser.set(g.user_id, arr);
  }

  // If filtering by goal type, only include members who have at least one goal of that type
  const filtered = goalType
    ? memberProfiles.filter(p => {
        const userGoals = goalsByUser.get(p.user_id) ?? [];
        return userGoals.some(g => g.goal_type === goalType);
      })
    : memberProfiles;

  return filtered.map(p => {
    const userGoals = goalsByUser.get(p.user_id) ?? [];
    const visibleGoals = userGoals.filter(g => g.title !== null);
    return {
      ...p,
      shared_goal_titles: visibleGoals.map(g => g.title!),
      shared_goal_types: [...new Set(userGoals.map(g => g.goal_type))],
    } as DiscoverableMember;
  });
}

export async function discoverMembersBySharedGoal(myGoalId: string, limit = 20): Promise<DiscoverableMember[]> {
  const { data: myGoal } = await supabase
    .from('user_goals')
    .select('goal_type')
    .eq('id', myGoalId)
    .maybeSingle();

  if (!myGoal) return [];

  return discoverMembersByGoalType(myGoal.goal_type, limit);
}
