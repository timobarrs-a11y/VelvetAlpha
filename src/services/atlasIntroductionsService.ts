import { supabase } from '../shared/supabase/client';

export interface AtlasIntroduction {
  user_id: string;
  display_name: string;
  headline: string | null;
  avatar_config: Record<string, unknown> | null;
  is_bot: boolean;
  follower_count: number;
  shared_goal_types: string[];
  shared_goal_titles: string[];
}

export async function getAtlasIntroductions(limit = 5): Promise<AtlasIntroduction[]> {
  try {
    const { data, error } = await supabase.rpc('get_atlas_introductions', {
      p_limit: limit,
    });

    if (error) {
      console.error('[atlasIntroductions] error:', error.message);
      return [];
    }

    if (!data?.success) return [];
    return (data.introductions as AtlasIntroduction[]) ?? [];
  } catch (e) {
    console.error('[atlasIntroductions] failed:', e);
    return [];
  }
}
