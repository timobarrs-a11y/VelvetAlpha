import { supabase } from '../shared/supabase/client';
import { calendarService, UserEvent } from './calendarService';

export const RELATIONSHIP_MILESTONES = [
  { days: 7, label: '7 days', key: 'chat_day_7' },
  { days: 30, label: '30 days', key: 'chat_day_30' },
  { days: 100, label: '100 days', key: 'chat_day_100' },
  { days: 365, label: '1 year', key: 'chat_day_365' },
] as const;

export const RELATIONSHIP_EVENT_TYPES = {
  ANCHOR: 'relationship_anchor',
  MILESTONE: 'relationship_milestone',
} as const;

interface RelationshipDay {
  id: string;
  user_id: string;
  companion_id: string;
  interaction_date: string;
  message_count: number;
  created_at: string;
}

interface TemporalMilestone {
  id: string;
  user_id: string;
  companion_id: string;
  milestone_type: string;
  milestone_date: string;
  calendar_event_id: string | null;
  acknowledged: boolean;
  created_at: string;
}

class RelationshipCalendarService {
  async recordInteractionDate(
    userId: string,
    companionId: string,
    messageDate: Date
  ): Promise<number> {
    try {
      const dateOnly = messageDate.toISOString().split('T')[0];

      const { data: existing, error: fetchError } = await supabase
        .from('relationship_days')
        .select('*')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .eq('interaction_date', dateOnly)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      if (existing) {
        await supabase
          .from('relationship_days')
          .update({ message_count: existing.message_count + 1 })
          .eq('id', existing.id);
      } else {
        const { error: insertError } = await supabase
          .from('relationship_days')
          .insert({
            user_id: userId,
            companion_id: companionId,
            interaction_date: dateOnly,
            message_count: 1,
          });

        if (insertError) {
          throw insertError;
        }
      }

      const { data: totalData, error: countError } = await supabase
        .rpc('get_total_chat_days', {
          p_user_id: userId,
          p_companion_id: companionId,
        });

      if (countError) {
        return 0;
      }

      return totalData || 0;
    } catch (error) {
      console.error('Error in recordInteractionDate:', error);
      return 0;
    }
  }

  async getRelationshipDaysForMonth(
    userId: string,
    companionId: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<RelationshipDay[]> {
    try {
      let query = supabase
        .from('relationship_days')
        .select('*')
        .eq('user_id', userId)
        .gte('interaction_date', startDate.toISOString().split('T')[0])
        .lte('interaction_date', endDate.toISOString().split('T')[0]);

      if (companionId) {
        query = query.eq('companion_id', companionId);
      }

      const { data, error } = await query;

      if (error) {
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getRelationshipDaysForMonth:', error);
      return [];
    }
  }

  async createAnchorEvent(
    userId: string,
    companionId: string,
    companionName: string,
    creationDate: Date
  ): Promise<UserEvent | null> {
    try {
      const existingAnchor = await supabase
        .from('user_events')
        .select('*')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .eq('event_type', RELATIONSHIP_EVENT_TYPES.ANCHOR)
        .maybeSingle();

      if (existingAnchor.data) {
        return existingAnchor.data;
      }

      const event = await calendarService.createEvent({
        user_id: userId,
        companion_id: companionId,
        title: `Met ${companionName}`,
        description: `Started your relationship with ${companionName}`,
        event_type: RELATIONSHIP_EVENT_TYPES.ANCHOR as any,
        event_date: creationDate.toISOString(),
        all_day: true,
        recurring: 'none',
        completed: false,
        metadata: {
          companion_id: companionId,
          event_subtype: 'relationship_start',
        },
      });

      return event;
    } catch (error) {
      console.error('Error creating anchor event:', error);
      return null;
    }
  }

  async checkAndCreateMilestones(
    userId: string,
    companionId: string,
    totalChatDays: number
  ): Promise<void> {
    try {
      const { data: companion } = await supabase
        .from('companions')
        .select('custom_name')
        .eq('id', companionId)
        .single();

      const companionName = companion?.custom_name || 'your companion';

      for (const milestone of RELATIONSHIP_MILESTONES) {
        if (totalChatDays === milestone.days) {
          const { data: existing } = await supabase
            .from('temporal_milestones')
            .select('*')
            .eq('user_id', userId)
            .eq('companion_id', companionId)
            .eq('milestone_type', milestone.key)
            .maybeSingle();

          if (existing) {
            continue;
          }

          const today = new Date();
          const event = await calendarService.createEvent({
            user_id: userId,
            companion_id: companionId,
            title: `${milestone.label} with ${companionName}`,
            description: `You've chatted with ${companionName} on ${milestone.days} different days!`,
            event_type: RELATIONSHIP_EVENT_TYPES.MILESTONE as any,
            event_date: today.toISOString(),
            all_day: true,
            recurring: 'none',
            completed: false,
            metadata: {
              companion_id: companionId,
              milestone_days: milestone.days,
              event_subtype: 'chat_days',
            },
          });

          if (event) {
            await supabase.from('temporal_milestones').insert({
              user_id: userId,
              companion_id: companionId,
              milestone_type: milestone.key,
              milestone_date: today.toISOString().split('T')[0],
              calendar_event_id: event.id,
              acknowledged: false,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in checkAndCreateMilestones:', error);
    }
  }

  async getCompanionRelationshipStats(
    userId: string,
    companionId: string
  ): Promise<{
    totalChatDays: number;
    milestones: TemporalMilestone[];
  }> {
    try {
      const { data: totalData } = await supabase
        .rpc('get_total_chat_days', {
          p_user_id: userId,
          p_companion_id: companionId,
        });

      const { data: milestones } = await supabase
        .from('temporal_milestones')
        .select('*')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .order('milestone_date', { ascending: true });

      return {
        totalChatDays: totalData || 0,
        milestones: milestones || [],
      };
    } catch (error) {
      console.error('Error getting relationship stats:', error);
      return {
        totalChatDays: 0,
        milestones: [],
      };
    }
  }

  async backfillRelationshipDays(
    userId: string,
    companionId: string
  ): Promise<{ success: boolean; daysCreated: number }> {
    try {
      const { data: existing } = await supabase
        .from('relationship_days')
        .select('id')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .limit(1);

      if (existing && existing.length > 0) {
        return { success: true, daysCreated: 0 };
      }

      const { data: conversations } = await supabase
        .from('conversations')
        .select('created_at')
        .eq('user_id', userId)
        .eq('companion_id', companionId)
        .order('created_at', { ascending: true });

      if (!conversations || conversations.length === 0) {
        return { success: true, daysCreated: 0 };
      }

      const dateMap = new Map<string, number>();
      conversations.forEach((conv) => {
        const date = new Date(conv.created_at).toISOString().split('T')[0];
        dateMap.set(date, (dateMap.get(date) || 0) + 1);
      });

      const relationshipDays = Array.from(dateMap.entries()).map(([date, count]) => ({
        user_id: userId,
        companion_id: companionId,
        interaction_date: date,
        message_count: count,
      }));

      if (relationshipDays.length > 0) {
        const { error } = await supabase
          .from('relationship_days')
          .insert(relationshipDays);

        if (error) {
          console.error('Error backfilling relationship days:', error);
          return { success: false, daysCreated: 0 };
        }
      }

      return { success: true, daysCreated: relationshipDays.length };
    } catch (error) {
      console.error('Error in backfillRelationshipDays:', error);
      return { success: false, daysCreated: 0 };
    }
  }
}

export const relationshipCalendarService = new RelationshipCalendarService();
