import { supabase } from '../shared/supabase/client';

export interface UserProfile {
  id: string;
  name: string;
  birthday: string | null;
  gender: string | null;
  favorite_color: string | null;
  zodiac_sign: string | null;
  music_genre: string | null;
  hobbies: string[];
  sports: string[];
  interests: string[];
  news_categories: string[];
  political_leaning: 'democrat' | 'republican' | 'independent' | null;
  profile_completed: boolean;
  subscription_tier: string | null;
  avatar_config: any;
  created_at: string;
}

export interface UserProfileUpdate {
  name?: string;
  birthday?: string | null;
  gender?: string | null;
  favorite_color?: string | null;
  zodiac_sign?: string | null;
  music_genre?: string | null;
  hobbies?: string[];
  sports?: string[];
  news_categories?: string[];
  political_leaning?: 'democrat' | 'republican' | 'independent' | null;
  profile_completed?: boolean;
}

class UserProfileService {
  async getCurrentProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    return data;
  }

  async updateProfile(updates: UserProfileUpdate): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating user profile:', error);
      return null;
    }

    return data;
  }

  async isProfileComplete(): Promise<boolean> {
    const profile = await this.getCurrentProfile();
    if (!profile) return false;
    if (profile.profile_completed) return true;

    const hasCore = !!(
      profile.name &&
      profile.name !== 'babe' &&
      profile.birthday &&
      profile.gender
    );

    return hasCore;
  }

  async saveUserLevelAnswers(answers: {
    name: string;
    birthday: string;
    gender: string;
    favoriteColor: string;
    zodiacSign: string;
    hobbies: string;
    sports: string;
    musicGenre: string;
    newsTopics?: string[] | string;
  }): Promise<UserProfile | null> {
    const hobbiesArray = answers.hobbies
      ? answers.hobbies.split(',').map(h => h.trim()).filter(h => h)
      : [];
    const sportsArray = answers.sports
      ? answers.sports.split(',').map(s => s.trim()).filter(s => s)
      : [];
    const newsCategoriesArray = Array.isArray(answers.newsTopics)
      ? answers.newsTopics
      : (answers.newsTopics ? answers.newsTopics.split(',').map(n => n.trim()).filter(n => n) : []);

    return this.updateProfile({
      name: answers.name,
      birthday: answers.birthday || null,
      gender: answers.gender || null,
      favorite_color: answers.favoriteColor || null,
      zodiac_sign: answers.zodiacSign || null,
      music_genre: answers.musicGenre || null,
      hobbies: hobbiesArray,
      sports: sportsArray,
      news_categories: newsCategoriesArray,
      profile_completed: true,
    });
  }

  async backfillFromCompanion(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const profile = await this.getCurrentProfile();
    if (!profile) return;
    if (profile.profile_completed) return;

    const { data: companion } = await supabase
      .from('companions')
      .select('favorite_color, zodiac_sign, music_genre, hobbies, sports')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!companion) return;

    const updates: UserProfileUpdate = {};
    let hasUpdates = false;

    if (!profile.favorite_color && companion.favorite_color) {
      updates.favorite_color = companion.favorite_color;
      hasUpdates = true;
    }
    if (!profile.zodiac_sign && companion.zodiac_sign) {
      updates.zodiac_sign = companion.zodiac_sign;
      hasUpdates = true;
    }
    if (!profile.music_genre && companion.music_genre) {
      updates.music_genre = companion.music_genre;
      hasUpdates = true;
    }
    if ((!profile.hobbies || profile.hobbies.length === 0) && companion.hobbies?.length > 0) {
      updates.hobbies = companion.hobbies;
      hasUpdates = true;
    }
    if ((!profile.sports || profile.sports.length === 0) && companion.sports?.length > 0) {
      updates.sports = companion.sports;
      hasUpdates = true;
    }

    if (hasUpdates) {
      const hasCore = !!(profile.name && profile.name !== 'babe' && profile.birthday && profile.gender);
      if (hasCore) {
        updates.profile_completed = true;
      }
      await this.updateProfile(updates);
    }
  }
}

export const userProfileService = new UserProfileService();
