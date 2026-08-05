import { supabase } from '../shared/supabase/client';

export interface UserEvent {
  id: string;
  user_id: string;
  companion_id: string | null;
  title: string;
  description: string;
  event_type:
    | 'reminder' | 'appointment' | 'anniversary' | 'birthday'
    | 'milestone' | 'date_idea' | 'task' | 'goal_deadline'
    | 'relationship_anchor' | 'relationship_milestone'
    | 'vacation' | 'kids_event' | 'graduation' | 'doctor_appointment'
    | 'personal_holiday' | 'community_holiday' | 'national_day';
  event_date: string;
  reminder_time: string | null;
  all_day: boolean;
  location: string | null;
  completed: boolean;
  recurring: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface EventSuggestion {
  id: string;
  suggested_title: string;
  suggested_description: string;
  suggested_type: string;
  suggested_date: string | null;
  reasoning: string;
  confidence_score: number;
  accepted: boolean;
  dismissed: boolean;
  created_at: string;
}

export interface Anniversary {
  id: string;
  anniversary_type: 'relationship_started' | 'first_message' | 'special_moment' | 'custom';
  title: string;
  description: string;
  original_date: string;
  celebration_message: string;
  notify_days_before: number;
  is_active: boolean;
  metadata: Record<string, any>;
}

export interface GiftSuggestion {
  id: string;
  recipient: string;
  occasion: string;
  gift_idea: string;
  reasoning: string;
  price_range: 'budget' | 'moderate' | 'premium' | 'luxury';
  where_to_buy: string;
  relevance_score: number;
  based_on_context: string;
  user_reaction: 'loved_it' | 'considering' | 'not_interested' | 'purchased' | null;
  created_at: string;
}

async function callEdgeFunction(path: string, body: Record<string, unknown>): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    await fetch(`${supabaseUrl}/functions/v1/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
  }
}

class CalendarService {
  async getUserEvents(userId: string, startDate?: Date, endDate?: Date): Promise<UserEvent[]> {
    let query = supabase
      .from('user_events')
      .select('*')
      .eq('user_id', userId)
      .order('event_date', { ascending: true });

    if (startDate) query = query.gte('event_date', startDate.toISOString());
    if (endDate) query = query.lte('event_date', endDate.toISOString());

    const { data, error } = await query;
    if (error) return [];
    return data || [];
  }

  async createEvent(event: Partial<UserEvent>): Promise<UserEvent | null> {
    const { data, error } = await supabase
      .from('user_events')
      .insert(event)
      .select()
      .single();

    if (error) return null;
    return data;
  }

  async updateEvent(eventId: string, updates: Partial<UserEvent>): Promise<UserEvent | null> {
    const { data, error } = await supabase
      .from('user_events')
      .update(updates)
      .eq('id', eventId)
      .select()
      .single();

    if (error) return null;
    return data;
  }

  async deleteEvent(eventId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_events')
      .delete()
      .eq('id', eventId);
    return !error;
  }

  async getUpcomingEvents(userId: string, daysAhead: number = 7): Promise<UserEvent[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + daysAhead);
    return this.getUserEvents(userId, now, future);
  }

  async generateEventSuggestions(
    _userId: string,
    companionId: string,
    recentConversations: string
  ): Promise<void> {
    await callEdgeFunction('suggest-events-gifts', {
      type: 'events',
      companionId,
      recentConversations,
    });
  }

  async getEventSuggestions(userId: string): Promise<EventSuggestion[]> {
    const { data, error } = await supabase
      .from('event_suggestions')
      .select('*')
      .eq('user_id', userId)
      .eq('accepted', false)
      .eq('dismissed', false)
      .order('confidence_score', { ascending: false });

    if (error) return [];
    return data || [];
  }

  async acceptEventSuggestion(suggestionId: string, userId: string): Promise<UserEvent | null> {
    const { data: suggestion } = await supabase
      .from('event_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .single();

    if (!suggestion) return null;

    const event = await this.createEvent({
      user_id: userId,
      companion_id: suggestion.companion_id,
      title: suggestion.suggested_title,
      description: suggestion.suggested_description,
      event_type: suggestion.suggested_type,
      event_date: suggestion.suggested_date || new Date().toISOString(),
      all_day: !suggestion.suggested_date,
      recurring: 'none',
      completed: false,
      metadata: { from_suggestion: true, suggestion_id: suggestionId }
    });

    if (event) {
      await supabase
        .from('event_suggestions')
        .update({ accepted: true, created_event_id: event.id })
        .eq('id', suggestionId);
    }

    return event;
  }

  async dismissEventSuggestion(suggestionId: string): Promise<boolean> {
    const { error } = await supabase
      .from('event_suggestions')
      .update({ dismissed: true })
      .eq('id', suggestionId);
    return !error;
  }

  async createAnniversary(anniversary: Partial<Anniversary>): Promise<Anniversary | null> {
    const { data, error } = await supabase
      .from('anniversaries')
      .insert(anniversary)
      .select()
      .single();

    if (error) return null;
    return data;
  }

  async getUpcomingAnniversaries(userId: string, daysAhead: number = 30): Promise<Anniversary[]> {
    const { data, error } = await supabase
      .from('anniversaries')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error) return [];

    const today = new Date();
    const upcoming = (data || []).filter(anniversary => {
      const annivDate = new Date(anniversary.original_date);
      annivDate.setFullYear(today.getFullYear());
      if (annivDate < today) annivDate.setFullYear(today.getFullYear() + 1);
      const daysUntil = Math.ceil((annivDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return daysUntil <= daysAhead && daysUntil >= 0;
    });

    return upcoming.sort((a, b) => {
      const dateA = new Date(a.original_date);
      const dateB = new Date(b.original_date);
      dateA.setFullYear(today.getFullYear());
      dateB.setFullYear(today.getFullYear());
      return dateA.getTime() - dateB.getTime();
    });
  }

  async generateGiftSuggestions(
    _userId: string,
    companionId: string,
    recipient: string,
    occasion: string,
    conversationContext: string
  ): Promise<void> {
    await callEdgeFunction('suggest-events-gifts', {
      type: 'gifts',
      companionId,
      recipient,
      occasion,
      conversationContext,
    });
  }

  async getGiftSuggestions(userId: string, occasion?: string): Promise<GiftSuggestion[]> {
    let query = supabase
      .from('gift_suggestions')
      .select('*')
      .eq('user_id', userId)
      .is('user_reaction', null)
      .order('relevance_score', { ascending: false });

    if (occasion) query = query.eq('occasion', occasion);

    const { data, error } = await query;
    if (error) return [];
    return data || [];
  }

  async updateGiftReaction(
    giftId: string,
    reaction: 'loved_it' | 'considering' | 'not_interested' | 'purchased'
  ): Promise<boolean> {
    const { error } = await supabase
      .from('gift_suggestions')
      .update({ user_reaction: reaction })
      .eq('id', giftId);
    return !error;
  }
}

export const calendarService = new CalendarService();
