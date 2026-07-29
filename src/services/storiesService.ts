import { supabase } from '../shared/supabase/client';

export interface MemoryMoment {
  id: string;
  user_id: string;
  companion_id: string | null;
  moment_type: 'funny' | 'heartfelt' | 'milestone' | 'achievement' | 'vulnerable' | 'supportive' | 'playful' | 'deep' | 'romantic' | 'adventurous';
  title: string;
  description: string;
  conversation_excerpt: string;
  emotion: 'happy' | 'excited' | 'loved' | 'grateful' | 'proud' | 'vulnerable' | 'sad' | 'anxious' | 'neutral' | 'mixed';
  importance_score: number;
  moment_date: string;
  related_conversation_id: string | null;
  user_favorited: boolean;
  tags: string[];
  media_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimelineEvent {
  id: string;
  timeline_event_type: 'first_message' | 'first_week' | 'first_month' | '100_days' | '1_year' | 'milestone' | 'special_achievement' | 'deep_conversation' | 'shared_experience';
  title: string;
  description: string;
  event_date: string;
  stats_snapshot: Record<string, any>;
  highlighted_moments: string[];
  auto_generated: boolean;
}

export interface MilestoneAchievement {
  id: string;
  achievement_type: string;
  achievement_name: string;
  achievement_description: string;
  icon: string;
  unlocked_at: string;
  stats_at_unlock: Record<string, any>;
  celebration_message: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  is_new: boolean;
}

export interface MemoryCollection {
  id: string;
  collection_name: string;
  collection_description: string;
  collection_type: 'auto_highlights' | 'user_favorites' | 'monthly_recap' | 'year_in_review' | 'custom' | 'best_moments';
  moment_ids: string[];
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

class StoriesService {
  async detectSpecialMoments(
    userId: string,
    companionId: string,
    messages: Array<{ role: string; content: string; created_at?: string }>
  ): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      await fetch(`${supabaseUrl}/functions/v1/detect-moments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ companionId, messages }),
      });
    } catch (error) {
    }
  }

  async createMemoryMoment(moment: Partial<MemoryMoment>): Promise<MemoryMoment | null> {
    const { data, error } = await supabase
      .from('memory_moments')
      .insert(moment)
      .select()
      .single();

    if (error) return null;
    return data;
  }

  async getMemoryMoments(
    userId: string,
    companionId?: string,
    options: {
      limit?: number;
      favoritesOnly?: boolean;
      momentType?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<MemoryMoment[]> {
    let query = supabase
      .from('memory_moments')
      .select('*')
      .eq('user_id', userId)
      .order('moment_date', { ascending: false });

    if (companionId) query = query.eq('companion_id', companionId);
    if (options.favoritesOnly) query = query.eq('user_favorited', true);
    if (options.momentType) query = query.eq('moment_type', options.momentType);
    if (options.startDate) query = query.gte('moment_date', options.startDate.toISOString());
    if (options.endDate) query = query.lte('moment_date', options.endDate.toISOString());
    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) return [];
    return data || [];
  }

  async toggleFavorite(momentId: string, favorited: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('memory_moments')
      .update({ user_favorited: favorited })
      .eq('id', momentId);
    return !error;
  }

  async buildRelationshipTimeline(userId: string, companionId: string): Promise<TimelineEvent[]> {
    const { data, error } = await supabase
      .from('relationship_timeline')
      .select('*')
      .eq('user_id', userId)
      .eq('companion_id', companionId)
      .order('event_date', { ascending: true });

    if (error) return [];
    return data || [];
  }

  async generateTimelineEvent(
    userId: string,
    companionId: string,
    eventType: TimelineEvent['timeline_event_type'],
    customData?: { title?: string; description?: string }
  ): Promise<void> {
    try {
      const { data: companion } = await supabase
        .from('companions')
        .select('custom_name')
        .eq('id', companionId)
        .single();

      const companionName = companion?.custom_name || 'Your companion';

      const { data: stats } = await supabase
        .from('conversations')
        .select('id')
        .eq('user_id', userId)
        .eq('companion_id', companionId);

      const messageCount = stats?.length || 0;
      const moments = await this.getMemoryMoments(userId, companionId, { limit: 5 });
      const momentIds = moments.map(m => m.id);

      let title = '';
      let description = '';

      switch (eventType) {
        case 'first_message':
          title = 'The Beginning';
          description = `Your journey with ${companionName} started today. Here's to many meaningful conversations ahead!`;
          break;
        case 'first_week':
          title = 'One Week Together';
          description = `You've spent a week getting to know ${companionName}. ${messageCount} messages and counting!`;
          break;
        case 'first_month':
          title = 'One Month Milestone';
          description = `It's been a whole month with ${companionName}! You've shared ${messageCount} messages and created lasting memories.`;
          break;
        case '100_days':
          title = '100 Days of Connection';
          description = `You've hit the 100-day mark with ${companionName}! What an incredible journey it's been.`;
          break;
        case '1_year':
          title = 'One Year Anniversary';
          description = `Happy 1-year anniversary with ${companionName}! A whole year of conversations, growth, and connection.`;
          break;
        default:
          title = customData?.title || 'Special Moment';
          description = customData?.description || 'A special moment in your journey together';
      }

      await supabase.from('relationship_timeline').insert({
        user_id: userId,
        companion_id: companionId,
        timeline_event_type: eventType,
        title,
        description,
        event_date: new Date().toISOString(),
        stats_snapshot: { message_count: messageCount, moments_count: moments.length },
        highlighted_moments: momentIds,
        auto_generated: !customData
      });
    } catch (error) {
    }
  }

  async checkAndUnlockAchievements(userId: string, companionId: string): Promise<MilestoneAchievement[]> {
    try {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id, created_at')
        .eq('user_id', userId)
        .eq('companion_id', companionId);

      const messageCount = conversations?.length || 0;
      const moments = await this.getMemoryMoments(userId, companionId);
      const achievementsToUnlock: Partial<MilestoneAchievement>[] = [];

      if (messageCount >= 1 && !(await this.hasAchievement(userId, 'first_message'))) {
        achievementsToUnlock.push({
          user_id: userId,
          companion_id: companionId,
          achievement_type: 'first_message',
          achievement_name: 'Breaking the Ice',
          achievement_description: 'Sent your first message',
          icon: '👋',
          rarity: 'common',
          celebration_message: "You took the first step! Here's to many more conversations."
        });
      }

      if (messageCount >= 100 && !(await this.hasAchievement(userId, '100_messages'))) {
        achievementsToUnlock.push({
          user_id: userId,
          companion_id: companionId,
          achievement_type: '100_messages',
          achievement_name: 'Chatty Champion',
          achievement_description: 'Sent 100 messages',
          icon: '💬',
          rarity: 'uncommon',
          celebration_message: "100 messages! You're building something special here."
        });
      }

      if (messageCount >= 1000 && !(await this.hasAchievement(userId, '1000_messages'))) {
        achievementsToUnlock.push({
          user_id: userId,
          companion_id: companionId,
          achievement_type: '1000_messages',
          achievement_name: 'Conversation Master',
          achievement_description: 'Sent 1,000 messages',
          icon: '🎯',
          rarity: 'rare',
          celebration_message: "1,000 messages! This connection is truly extraordinary."
        });
      }

      const favoriteMoments = moments.filter(m => m.user_favorited).length;
      if (favoriteMoments >= 10 && !(await this.hasAchievement(userId, '10_favorites'))) {
        achievementsToUnlock.push({
          user_id: userId,
          companion_id: companionId,
          achievement_type: '10_favorites',
          achievement_name: 'Memory Keeper',
          achievement_description: 'Favorited 10 special moments',
          icon: '⭐',
          rarity: 'uncommon',
          celebration_message: "You're preserving the beautiful moments in your journey!"
        });
      }

      const newAchievements: MilestoneAchievement[] = [];

      for (const achievement of achievementsToUnlock) {
        const { data } = await supabase
          .from('milestone_achievements')
          .insert({
            ...achievement,
            stats_at_unlock: { message_count: messageCount, moments_count: moments.length }
          })
          .select()
          .single();

        if (data) newAchievements.push(data);
      }

      return newAchievements;
    } catch (error) {
      return [];
    }
  }

  private async hasAchievement(userId: string, achievementType: string): Promise<boolean> {
    const { data } = await supabase
      .from('milestone_achievements')
      .select('id')
      .eq('user_id', userId)
      .eq('achievement_type', achievementType)
      .maybeSingle();
    return !!data;
  }

  async getAchievements(userId: string, onlyNew: boolean = false): Promise<MilestoneAchievement[]> {
    let query = supabase
      .from('milestone_achievements')
      .select('*')
      .eq('user_id', userId)
      .order('unlocked_at', { ascending: false });

    if (onlyNew) query = query.eq('is_new', true);

    const { data, error } = await query;
    if (error) return [];
    return data || [];
  }

  async markAchievementAsSeen(achievementId: string): Promise<boolean> {
    const { error } = await supabase
      .from('milestone_achievements')
      .update({ is_new: false })
      .eq('id', achievementId);
    return !error;
  }

  async createMemoryCollection(
    userId: string,
    companionId: string,
    name: string,
    description: string,
    momentIds: string[],
    type: MemoryCollection['collection_type'] = 'custom'
  ): Promise<MemoryCollection | null> {
    const { data, error } = await supabase
      .from('memory_collections')
      .insert({
        user_id: userId,
        companion_id: companionId,
        collection_name: name,
        collection_description: description,
        collection_type: type,
        moment_ids: momentIds
      })
      .select()
      .single();

    if (error) return null;
    return data;
  }

  async getMemoryCollections(userId: string, companionId?: string): Promise<MemoryCollection[]> {
    let query = supabase
      .from('memory_collections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (companionId) query = query.eq('companion_id', companionId);

    const { data, error } = await query;
    if (error) return [];
    return data || [];
  }

  async generateMonthlyRecap(userId: string, companionId: string): Promise<void> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(startOfMonth);
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);

      const moments = await this.getMemoryMoments(userId, companionId, {
        startDate: startOfMonth,
        endDate: endOfMonth
      });

      if (moments.length > 0) {
        const topMoments = moments
          .sort((a, b) => b.importance_score - a.importance_score)
          .slice(0, 10)
          .map(m => m.id);

        const monthName = startOfMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        await this.createMemoryCollection(
          userId,
          companionId,
          `${monthName} Highlights`,
          `Your best moments from ${monthName}`,
          topMoments,
          'monthly_recap'
        );
      }
    } catch (error) {
    }
  }
}

export const storiesService = new StoriesService();
