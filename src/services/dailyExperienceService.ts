import { supabase } from '../shared/supabase/client';

export interface DailyExperience {
  id?: string;
  user_id: string;
  companion_id: string;
  date: string;
  narrative: string;
  mood: string;
  energy_level: number;
  highlights: any[];
  conversation_hooks: any[];
  status_timeline: any[];
  real_world_references: any[];
  created_at?: string;
}

export async function generateDailyExperience(userId: string, companionId: string): Promise<DailyExperience> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/daily-experience?companionId=${companionId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to generate daily experience: ${response.status}`);
  }

  return response.json();
}
