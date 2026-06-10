import { supabase } from '../shared/supabase/client';
import { getLocalDateString, computeStreak } from './temporalAwarenessService';
import { affectionService, type RelationshipIntent, type RelationshipStatus } from './affectionService';
import { relationshipCalendarService } from './relationshipCalendarService';

export interface RelationshipStats {
  user_id: string;
  companion_id: string;
  last_interaction_at: string;
  previous_interaction_at: string | null;
  last_interaction_date: string;
  created_at: string;
  updated_at: string;
  active_conversation_days: number;
  total_messages: number;
  elapsed_days_since_creation: number;
  current_streak_days: number;
  longest_streak_days: number;
  previous_interaction_date: string | null;
  longest_gap_days: number;
  current_gap_hours: number;
  avg_messages_per_active_day: number;
  relationship_intent: RelationshipIntent;
  relationship_status: RelationshipStatus;
  affection_base: number;
  affection_last_updated_at: string;
}

function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

class RelationshipTrackingService {
  async updateOnUserMessage(
    userId: string,
    companionId: string,
    now: Date,
    timezone?: string
  ): Promise<RelationshipStats | null> {
    try {
      const currentLocalDate = getLocalDateString(now, timezone);

      const { data: existing } = await supabase
        .from('relationship_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .maybeSingle();

      if (!existing) {
        return await this.initializeStats(userId, companionId, now, currentLocalDate);
      }

      return await this.updateStats(existing, userId, companionId, now, currentLocalDate, timezone);
    } catch (error) {
      console.error('Error updating relationship stats:', error);
      return null;
    }
  }

  private async initializeStats(
    userId: string,
    companionId: string,
    now: Date,
    currentLocalDate: string
  ): Promise<RelationshipStats | null> {
    try {
      const { data: companion } = await supabase
        .from('companions')
        .select('created_at, relationship_type')
        .eq('id', companionId)
        .single();

      const creationDate = companion?.created_at ? new Date(companion.created_at) : now;
      const elapsedDays = Math.floor((now.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));

      const relationshipIntent: RelationshipIntent =
        companion?.relationship_type === 'friend' ? 'friend' :
        companion?.relationship_type === 'romantic' ? 'companion' : 'evolve';

      const relationshipStatus: RelationshipStatus = affectionService.getDefaultStatus(relationshipIntent);
      const affectionBase = affectionService.getDefaultBase(relationshipIntent);

      const initialStats = {
        user_id: userId,
        companion_id: companionId,
        last_interaction_at: now.toISOString(),
        previous_interaction_at: null,
        last_interaction_date: currentLocalDate,
        active_conversation_days: 1,
        total_messages: 1,
        elapsed_days_since_creation: elapsedDays,
        current_streak_days: 1,
        longest_streak_days: 1,
        previous_interaction_date: null,
        longest_gap_days: 0,
        current_gap_hours: 0,
        avg_messages_per_active_day: 1,
        relationship_intent: relationshipIntent,
        relationship_status: relationshipStatus,
        affection_base: affectionBase,
        affection_last_updated_at: now.toISOString(),
      };

      const { data, error } = await supabase
        .from('relationship_stats')
        .upsert(initialStats, {
          onConflict: 'user_id,companion_id',
        })
        .select()
        .single();

      if (error) {
        console.error('Error initializing stats:', error);
        return null;
      }

      await this.updateRelationshipDay(userId, companionId, currentLocalDate);

      try {
        await relationshipCalendarService.checkAndCreateMilestones(
          userId,
          companionId,
          1
        );
      } catch (milestoneError) {
        console.error('Error checking milestones on init:', milestoneError);
      }

      return data;
    } catch (error) {
      console.error('Error in initializeStats:', error);
      return null;
    }
  }

  private async updateStats(
    existing: any,
    userId: string,
    companionId: string,
    now: Date,
    currentLocalDate: string,
    timezone?: string
  ): Promise<RelationshipStats | null> {
    try {
      const lastInteractionAt = new Date(existing.last_interaction_at);
      const lastInteractionDate = existing.last_interaction_date;

      const gapHours = (now.getTime() - lastInteractionAt.getTime()) / (1000 * 60 * 60);

      const isSameDay = currentLocalDate === lastInteractionDate;

      let newActiveDays = existing.active_conversation_days;
      let newTotalMessages = existing.total_messages + 1;

      if (!isSameDay) {
        newActiveDays += 1;
        await this.updateRelationshipDay(userId, companionId, currentLocalDate);
      } else {
        await this.updateRelationshipDay(userId, companionId, currentLocalDate);
      }

      const { newStreakDays, streakBroke } = computeStreak(
        currentLocalDate,
        lastInteractionDate,
        existing.current_streak_days
      );

      let newLongestStreak = existing.longest_streak_days;
      if (newStreakDays > newLongestStreak) {
        newLongestStreak = newStreakDays;
      }

      let newLongestGap = existing.longest_gap_days;
      if (streakBroke && lastInteractionDate) {
        const currentDateParsed = parseLocalDate(currentLocalDate);
        const lastDateParsed = parseLocalDate(lastInteractionDate);
        const gapDays = Math.floor((currentDateParsed.getTime() - lastDateParsed.getTime()) / (1000 * 60 * 60 * 24));
        if (gapDays > newLongestGap) {
          newLongestGap = gapDays;
        }
      }

      const { data: companion } = await supabase
        .from('companions')
        .select('created_at')
        .eq('id', companionId)
        .single();

      const creationDate = companion?.created_at ? new Date(companion.created_at) : now;
      const elapsedDays = Math.floor((now.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));

      const avgMessages = newActiveDays > 0 ? newTotalMessages / newActiveDays : 0;

      const updates = {
        previous_interaction_at: existing.last_interaction_at,
        last_interaction_at: now.toISOString(),
        last_interaction_date: currentLocalDate,
        previous_interaction_date: !isSameDay ? lastInteractionDate : existing.previous_interaction_date,
        active_conversation_days: newActiveDays,
        total_messages: newTotalMessages,
        elapsed_days_since_creation: elapsedDays,
        current_streak_days: newStreakDays,
        longest_streak_days: newLongestStreak,
        longest_gap_days: newLongestGap,
        current_gap_hours: gapHours,
        avg_messages_per_active_day: Number(avgMessages.toFixed(2)),
        updated_at: now.toISOString(),
      };

      const { data, error } = await supabase
        .from('relationship_stats')
        .update(updates)
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .select()
        .single();

      if (error) {
        console.error('Error updating stats:', error);
        return null;
      }

      if (data && !isSameDay) {
        try {
          await relationshipCalendarService.checkAndCreateMilestones(
            userId,
            companionId,
            newActiveDays
          );
        } catch (milestoneError) {
          console.error('Error checking milestones:', milestoneError);
        }
      }

      return data;
    } catch (error) {
      console.error('Error in updateStats:', error);
      return null;
    }
  }

  private async updateRelationshipDay(
    userId: string,
    companionId: string,
    localDate: string
  ): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('relationship_days')
        .select('*')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .eq('interaction_date', localDate)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('relationship_days')
          .update({
            message_count: existing.message_count + 1,
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('relationship_days').insert({
          user_id: userId,
          companion_id: companionId,
          interaction_date: localDate,
          message_count: 1,
        });
      }
    } catch (error) {
      console.error('Error updating relationship day:', error);
    }
  }

  async getRelationshipStats(
    userId: string,
    companionId: string
  ): Promise<RelationshipStats | null> {
    try {
      const { data, error } = await supabase
        .from('relationship_stats')
        .select('*')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching relationship stats:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getRelationshipStats:', error);
      return null;
    }
  }

  async backfillStatsFromConversations(
    userId: string,
    companionId: string,
    timezone?: string
  ): Promise<{ success: boolean; stats: RelationshipStats | null }> {
    try {
      const { data: conversations } = await supabase
        .from('conversations')
        .select('role, created_at')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .eq('role', 'user')
        .order('created_at', { ascending: true });

      if (!conversations || conversations.length === 0) {
        return { success: true, stats: null };
      }

      const { data: companion } = await supabase
        .from('companions')
        .select('created_at, relationship_type')
        .eq('id', companionId)
        .single();

      const creationDate = companion?.created_at ? new Date(companion.created_at) : new Date(conversations[0].created_at);

      const relationshipIntent: RelationshipIntent =
        companion?.relationship_type === 'friend' ? 'friend' :
        companion?.relationship_type === 'romantic' ? 'companion' : 'evolve';

      const relationshipStatus: RelationshipStatus = affectionService.getDefaultStatus(relationshipIntent);
      const affectionBase = affectionService.getDefaultBase(relationshipIntent);

      const dateMap = new Map<string, number>();
      conversations.forEach((conv) => {
        const localDate = getLocalDateString(new Date(conv.created_at), timezone);
        dateMap.set(localDate, (dateMap.get(localDate) || 0) + 1);
      });

      const sortedDates = Array.from(dateMap.keys()).sort();

      let currentStreakDays = 0;
      let longestStreakDays = 0;
      let longestGapDays = 0;
      let previousDate: string | null = null;

      sortedDates.forEach((date, index) => {
        if (index === 0) {
          currentStreakDays = 1;
          longestStreakDays = 1;
        } else {
          const current = parseLocalDate(date);
          const last = parseLocalDate(sortedDates[index - 1]);
          const daysDiff = Math.floor((current.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

          if (daysDiff === 1) {
            currentStreakDays += 1;
            if (currentStreakDays > longestStreakDays) {
              longestStreakDays = currentStreakDays;
            }
          } else {
            if (daysDiff > longestGapDays) {
              longestGapDays = daysDiff;
            }
            currentStreakDays = 1;
          }
        }

        previousDate = sortedDates[index - 1] || null;
      });

      const lastConversation = conversations[conversations.length - 1];
      const lastInteractionAt = new Date(lastConversation.created_at);
      const lastLocalDate = sortedDates[sortedDates.length - 1];

      const previousInteractionAt = conversations.length > 1
        ? new Date(conversations[conversations.length - 2].created_at).toISOString()
        : null;

      const now = new Date();
      const elapsedDays = Math.floor((now.getTime() - creationDate.getTime()) / (1000 * 60 * 60 * 24));
      const gapHours = (now.getTime() - lastInteractionAt.getTime()) / (1000 * 60 * 60);

      const totalMessages = conversations.length;
      const activeDays = dateMap.size;
      const avgMessages = activeDays > 0 ? totalMessages / activeDays : 0;

      const backfillStats = {
        user_id: userId,
        companion_id: companionId,
        last_interaction_at: lastInteractionAt.toISOString(),
        previous_interaction_at: previousInteractionAt,
        last_interaction_date: lastLocalDate,
        previous_interaction_date: previousDate,
        active_conversation_days: activeDays,
        total_messages: totalMessages,
        elapsed_days_since_creation: elapsedDays,
        current_streak_days: currentStreakDays,
        longest_streak_days: longestStreakDays,
        longest_gap_days: longestGapDays,
        current_gap_hours: gapHours,
        avg_messages_per_active_day: Number(avgMessages.toFixed(2)),
        relationship_intent: relationshipIntent,
        relationship_status: relationshipStatus,
        affection_base: affectionBase,
        affection_last_updated_at: lastInteractionAt.toISOString(),
      };

      const { data, error } = await supabase
        .from('relationship_stats')
        .upsert(backfillStats, {
          onConflict: 'user_id,companion_id',
        })
        .select()
        .single();

      if (error) {
        console.error('Error backfilling stats:', error);
        return { success: false, stats: null };
      }

      return { success: true, stats: data };
    } catch (error) {
      console.error('Error in backfillStatsFromConversations:', error);
      return { success: false, stats: null };
    }
  }
}

export const relationshipTrackingService = new RelationshipTrackingService();
