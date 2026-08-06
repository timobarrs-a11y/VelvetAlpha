import { supabase } from '../shared/supabase/client';

export interface RealPerson {
  id: string;
  user_id: string;
  name: string;
  relationship: string;
  birthday: string | null;
  city: string | null;
  state: string | null;
  favorite_color: string | null;
  hobbies: string[];
  favorite_foods: string[];
  dietary_restrictions: string[];
  favorite_tv_shows: string[];
  movie_genres: string[];
  sports_teams: string[];
  music_genres: string[];
  travel_destinations: string[];
  clothing_size_shirt: string | null;
  clothing_size_shoe: string | null;
  clothing_size_dress: string | null;
  ring_size: string | null;
  things_mentioned_wanting: string | null;
  survey_completed: boolean;
  survey_completed_at: string | null;
  avatar_color: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyTokenInfo {
  name: string;
  relationship: string;
}

const AVATAR_COLORS = ['emerald', 'sky', 'rose', 'amber', 'violet', 'teal', 'cyan', 'orange'];

function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export const realPeopleService = {
  async getAll(): Promise<RealPerson[]> {
    const { data, error } = await supabase
      .from('real_people')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []) as RealPerson[];
  },

  async create(name: string, relationship: string): Promise<RealPerson> {
    const { data, error } = await supabase
      .from('real_people')
      .insert({
        name,
        relationship,
        avatar_color: randomAvatarColor(),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as RealPerson;
  },

  async update(id: string, updates: Partial<RealPerson>): Promise<void> {
    const { error } = await supabase
      .from('real_people')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('real_people')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async createSurveyToken(personId: string): Promise<string> {
    const { data, error } = await supabase.rpc('create_survey_token', {
      p_person_id: personId,
    });
    if (error) throw new Error(error.message);
    return data as string;
  },

  async getSurveyTokens(personId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('person_survey_tokens')
      .select('token')
      .eq('person_id', personId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data || []).map((r: { token: string }) => r.token);
  },

  async getPersonViaToken(token: string): Promise<SurveyTokenInfo | null> {
    const { data, error } = await supabase.rpc('get_person_via_survey_token', {
      p_token: token,
    });
    if (error) throw new Error(error.message);
    if (!data || (data as SurveyTokenInfo[]).length === 0) return null;
    const rows = data as SurveyTokenInfo[];
    return rows[0];
  },

  async submitSurvey(
    token: string,
    answers: {
      name?: string;
      relationship?: string;
      birthday?: string;
      city?: string;
      state?: string;
      favorite_color?: string;
      hobbies?: string[];
      favorite_foods?: string[];
      dietary_restrictions?: string[];
      favorite_tv_shows?: string[];
      movie_genres?: string[];
      sports_teams?: string[];
      music_genres?: string[];
      travel_destinations?: string[];
      clothing_size_shirt?: string;
      clothing_size_shoe?: string;
      clothing_size_dress?: string;
      ring_size?: string;
      things_mentioned_wanting?: string;
    },
  ): Promise<boolean> {
    const { data, error } = await supabase.rpc('update_person_via_survey_token', {
      p_token: token,
      p_name: answers.name ?? null,
      p_relationship: answers.relationship ?? null,
      p_birthday: answers.birthday ?? null,
      p_city: answers.city ?? null,
      p_state: answers.state ?? null,
      p_favorite_color: answers.favorite_color ?? null,
      p_hobbies: answers.hobbies ?? null,
      p_favorite_foods: answers.favorite_foods ?? null,
      p_dietary_restrictions: answers.dietary_restrictions ?? null,
      p_favorite_tv_shows: answers.favorite_tv_shows ?? null,
      p_movie_genres: answers.movie_genres ?? null,
      p_sports_teams: answers.sports_teams ?? null,
      p_music_genres: answers.music_genres ?? null,
      p_travel_destinations: answers.travel_destinations ?? null,
      p_clothing_size_shirt: answers.clothing_size_shirt ?? null,
      p_clothing_size_shoe: answers.clothing_size_shoe ?? null,
      p_clothing_size_dress: answers.clothing_size_dress ?? null,
      p_ring_size: answers.ring_size ?? null,
      p_things_mentioned_wanting: answers.things_mentioned_wanting ?? null,
    });
    if (error) throw new Error(error.message);
    return data as boolean;
  },

  buildSurveyUrl(token: string): string {
    const origin = window.location.origin;
    return `${origin}/survey/${token}`;
  },
};
