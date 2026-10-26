import { supabase } from '../shared/supabase/client';
import { getUserContext, contextToPromptBlock } from './memoryBus';
import { expandOccurrences, withOccurrenceCompleted } from './calendarRecurrence';

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
  // Set on one occurrence of a repeating event (see calendarRecurrence.ts):
  // the date the series started, and this occurrence's local day.
  series_date?: string;
  occurrence_date?: string;
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

async function callEdgeFunction(path: string, body: Record<string, any>): Promise<{ suggested: number } | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const response = await fetch(`${supabaseUrl}/functions/v1/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (_error) {
    return null;
  }
}

async function fetchRecentConversationText(userId: string, companionId: string, limit: number = 30): Promise<string> {
  const { data, error } = await supabase
    .from('conversations')
    .select('role, content')
    .eq('user_id', userId)
    .eq('companion_id', companionId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data || data.length === 0) return '';

  return data
    .reverse()
    .map(m => `${m.role === 'user' ? 'User' : 'Companion'}: ${m.content}`)
    .join('\n');
}

// Occurrence fields exist only in the app, never as columns.
function stripOccurrence(event: Partial<UserEvent>): Partial<UserEvent> {
  const { series_date: _series, occurrence_date: _occurrence, ...row } = event;
  return row;
}

class CalendarService {
  /**
   * Events between two dates. With both dates, repeating events are expanded
   * into each occurrence in the range; without them, rows come back as stored.
   */
  async getUserEvents(userId: string, startDate?: Date, endDate?: Date): Promise<UserEvent[]> {
    if (!startDate || !endDate) {
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

    const [oneOff, repeating] = await Promise.all([
      supabase
        .from('user_events')
        .select('*')
        .eq('user_id', userId)
        .or('recurring.is.null,recurring.eq.none')
        .gte('event_date', startDate.toISOString())
        .lte('event_date', endDate.toISOString()),
      // Any repeating event that started before the range ends may fall in it.
      supabase
        .from('user_events')
        .select('*')
        .eq('user_id', userId)
        .neq('recurring', 'none')
        .lte('event_date', endDate.toISOString()),
    ]);
    if (oneOff.error || repeating.error) return [];
    return expandOccurrences([...(oneOff.data || []), ...(repeating.data || [])], startDate, endDate);
  }

  /**
   * Commitments due between two dates, shaped as calendar items so the calendar
   * shows a goal's steps beside events. They're read-only there apart from
   * ticking off; `metadata.commitment_id` marks them.
   */
  async getCommitmentEvents(userId: string, startDate: Date, endDate: Date): Promise<UserEvent[]> {
    const { data, error } = await supabase
      .from('coaching_commitments')
      .select('id, description, due_date, status, created_at')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress', 'completed'])
      .gte('due_date', startDate.toISOString())
      .lte('due_date', endDate.toISOString())
      .order('due_date', { ascending: true });
    if (error || !data) return [];
    return data.map(c => ({
      id: `commitment:${c.id}`,
      user_id: userId,
      companion_id: null,
      title: c.description,
      description: '',
      event_type: 'task',
      event_date: c.due_date,
      reminder_time: null,
      all_day: true,
      location: null,
      completed: c.status === 'completed',
      recurring: 'none',
      metadata: { commitment_id: c.id },
      created_at: c.created_at,
      updated_at: c.created_at,
    }));
  }

  /** Ticks an event off, or un-ticks it. For a repeating event, only that day. */
  async setCompleted(event: UserEvent, completed: boolean): Promise<UserEvent | null> {
    const commitmentId = event.metadata?.commitment_id;
    if (typeof commitmentId === 'string') {
      const { error } = await supabase
        .from('coaching_commitments')
        .update({
          status: completed ? 'completed' : 'pending',
          completed_at: completed ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', commitmentId);
      return error ? null : { ...event, completed };
    }
    if (event.occurrence_date) {
      const { data, error } = await supabase
        .from('user_events')
        .select('metadata')
        .eq('id', event.id)
        .single();
      if (error) return null;
      return this.updateEvent(event.id, {
        metadata: withOccurrenceCompleted(data?.metadata, event.occurrence_date, completed),
      });
    }
    return this.updateEvent(event.id, { completed });
  }

  async createEvent(event: Partial<UserEvent>): Promise<UserEvent | null> {
    const { data, error } = await supabase
      .from('user_events')
      .insert(stripOccurrence(event))
      .select()
      .single();

    if (error) return null;
    return data;
  }

  async updateEvent(eventId: string, updates: Partial<UserEvent>): Promise<UserEvent | null> {
    const { data, error } = await supabase
      .from('user_events')
      .update(stripOccurrence(updates))
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

  /** For the calendar views: events and commitments between two dates, in time order. */
  async getCalendarItems(userId: string, startDate: Date, endDate: Date): Promise<UserEvent[]> {
    const [events, commitments] = await Promise.all([
      this.getUserEvents(userId, startDate, endDate),
      this.getCommitmentEvents(userId, startDate, endDate),
    ]);
    return [...events, ...commitments].sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
  }

  /** For the calendar views: the next few days' events and commitments. */
  async getUpcomingCalendarItems(userId: string, daysAhead: number = 7): Promise<UserEvent[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + daysAhead);
    return this.getCalendarItems(userId, now, future);
  }

  async getUpcomingEvents(userId: string, daysAhead: number = 7): Promise<UserEvent[]> {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + daysAhead);
    return this.getUserEvents(userId, now, future);
  }

  async generateEventSuggestions(
    userId: string,
    companionId: string,
    recentConversations?: string
  ): Promise<{ suggested: number } | null> {
    const conversationText = recentConversations ?? await fetchRecentConversationText(userId, companionId);
    if (!conversationText.trim()) return { suggested: 0 };

    let memoryContext = '';
    try {
      const ctx = await getUserContext(userId, { surface: 'calendar', maxFacts: 5, maxTopics: 4 });
      memoryContext = contextToPromptBlock(ctx, { includeGoals: true, includeFacts: true, includeTopics: true });
    } catch { /* best-effort */ }

    return callEdgeFunction('suggest-events-gifts', {
      type: 'events',
      companionId,
      recentConversations: conversationText,
      memoryContext,
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
    userId: string,
    companionId: string,
    recipient: string,
    occasion: string,
    conversationContext?: string
  ): Promise<{ suggested: number } | null> {
    const contextText = conversationContext ?? await fetchRecentConversationText(userId, companionId);
    if (!contextText.trim()) return { suggested: 0 };

    return callEdgeFunction('suggest-events-gifts', {
      type: 'gifts',
      companionId,
      recipient,
      occasion,
      conversationContext: contextText,
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
