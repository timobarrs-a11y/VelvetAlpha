import { supabase } from '../shared/supabase/client';
import { MemberProfile } from './memberProfileService';

export interface DiscoverableMember extends MemberProfile {
  shared_goal_titles: string[];
  shared_goal_types: string[];
}

export async function discoverMembersByGoalType(goalType?: string, limit = 30): Promise<DiscoverableMember[]> {
  const { data: { user } } = await supabase.auth.getUser();

  // Query public, discoverable profiles
  let query = supabase
    .from('member_profiles')
    .select('*')
    .eq('is_public', true)
    .eq('discoverable', true)
    .neq('user_id', user?.id ?? '')
    .limit(limit);

  if (goalType) {
    // Filter by goal type via the shared goals — we need to join through user_goals
    // Since shared_goal_ids is an array, we query user_goals for matching type,
    // then filter profiles whose shared_goal_ids intersect
    const { data: matchingGoals } = await supabase
      .from('user_goals')
      .select('id, user_id, title, goal_type')
      .eq('goal_type', goalType);

    if (!matchingGoals || matchingGoals.length === 0) return [];

    const goalIds = matchingGoals.map(g => g.id);
    const { data: profiles } = await query;

    // Filter profiles that share at least one goal of this type
    const filtered = (profiles as MemberProfile[] ?? []).filter(p =>
      p.shared_goal_ids.some(id => goalIds.includes(id))
    );

    return enrichWithGoals(filtered, matchingGoals);
  }

  const { data: profiles } = await query;
  return enrichWithGoals((profiles as MemberProfile[]) ?? []);
}

async function enrichWithGoals(
  profiles: MemberProfile[],
  matchingGoals?: { id: string; user_id: string; title: string; goal_type: string }[]
): Promise<DiscoverableMember[]> {
  if (profiles.length === 0) return [];

  // If we don't have pre-fetched goals, fetch goals for all profile users
  let goalsByUser: Map<string, { id: string; title: string; goal_type: string }[]>;

  if (matchingGoals) {
    goalsByUser = new Map();
    for (const g of matchingGoals) {
      const arr = goalsByUser.get(g.user_id) ?? [];
      arr.push({ id: g.id, title: g.title, goal_type: g.goal_type });
      goalsByUser.set(g.user_id, arr);
    }
  } else {
    const userIds = profiles.map(p => p.user_id);
    const { data: allGoals } = await supabase
      .from('user_goals')
      .select('id, user_id, title, goal_type')
      .in('user_id', userIds);

    goalsByUser = new Map();
    for (const g of (allGoals ?? [])) {
      const arr = goalsByUser.get(g.user_id) ?? [];
      arr.push({ id: g.id, title: g.title, goal_type: g.goal_type });
      goalsByUser.set(g.user_id, arr);
    }
  }

  return profiles.map(p => {
    const userGoals = goalsByUser.get(p.user_id) ?? [];
    const sharedGoals = userGoals.filter(g => p.shared_goal_ids.includes(g.id));
    return {
      ...p,
      shared_goal_titles: sharedGoals.map(g => g.title),
      shared_goal_types: [...new Set(sharedGoals.map(g => g.goal_type))],
    };
  });
}

export async function discoverMembersBySharedGoal(myGoalId: string, limit = 20): Promise<DiscoverableMember[]> {
  // Find the goal type for this goal
  const { data: myGoal } = await supabase
    .from('user_goals')
    .select('goal_type')
    .eq('id', myGoalId)
    .maybeSingle();

  if (!myGoal) return [];

  return discoverMembersByGoalType(myGoal.goal_type, limit);
}
