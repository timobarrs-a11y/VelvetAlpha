import { supabase } from '../shared/supabase/client';

export interface AtlasConversation {
  id: string;
  user_id: string;
  title: string;
  voice: 'masculine' | 'feminine' | null;
  created_at: string;
  updated_at: string;
}

export interface AtlasMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface AtlasUsageInfo {
  canSend: boolean;
  messagesUsedToday: number;
  dailyLimit: number;
  isUnlimited: boolean;
}

export interface AtlasCalendarEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
}

export interface AtlasNavigationIntent {
  destination: string;
  route: string;
  seedText?: string | null;
}

const ATLAS_DAILY_FREE_LIMIT = 10;

export const buildAtlasSystemPrompt = (userName?: string): string => {
  const nameRef = userName ? `The user's name is ${userName}. ` : '';
  return `You are Atlas — the user's personal chief of staff, built into the Velvet platform.

${nameRef}Your role is not to be a companion. You are a sharp, composed, professional agent. Think Alfred to Batman. You anticipate needs, stay two steps ahead, and execute with precision.

Character:
- Direct and confident. Never sycophantic. Never say "Great question!" or similar filler.
- Use the user's name occasionally — sparingly, with weight. Not every message. Only when it adds emphasis.
- Proactive: if you notice a gap, a better approach, or something the user didn't ask for but should know, surface it. One line. No lectures.
- Efficient: get to the point fast. Expand when depth is needed, compress when it isn't.
- Professional but not cold. Composed but not robotic. You have presence.

Capabilities: writing, editing, research, coding, analysis, summarization, brainstorming, strategy, planning, translation, math, answering questions — anything.

Format:
- Use markdown formatting when it aids clarity: headers, bullet lists, code blocks, bold text.
- For short answers, skip unnecessary formatting. For long-form content, structure it well.
- Do not pad responses. One tight paragraph beats three loose ones.

Mindset: You are already briefed, already thinking ahead, already ready. The user walks in, you're at the desk. What needs to get done?`;
};

const ATLAS_SYSTEM_PROMPT = buildAtlasSystemPrompt();

export const atlasService = {
  async getConversations(): Promise<AtlasConversation[]> {
    const { data, error } = await supabase
      .from('atlas_conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getConversation(id: string): Promise<AtlasConversation | null> {
    const { data, error } = await supabase
      .from('atlas_conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async createConversation(title?: string, voice?: 'masculine' | 'feminine'): Promise<AtlasConversation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('atlas_conversations')
      .insert({ user_id: user.id, title: title || 'New Conversation', voice: voice || null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateConversationVoice(id: string, voice: 'masculine' | 'feminine'): Promise<void> {
    const { error } = await supabase
      .from('atlas_conversations')
      .update({ voice })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getDefaultVoice(): Promise<'masculine' | 'feminine' | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data } = await supabase
      .from('user_profiles')
      .select('atlas_default_voice')
      .eq('id', user.id)
      .maybeSingle();
    return (data?.atlas_default_voice as 'masculine' | 'feminine' | null) ?? null;
  },

  async saveDefaultVoice(voice: 'masculine' | 'feminine' | null): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('user_profiles')
      .update({ atlas_default_voice: voice })
      .eq('id', user.id);
  },

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const { error } = await supabase
      .from('atlas_conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async touchConversation(id: string): Promise<void> {
    await supabase
      .from('atlas_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
  },

  async deleteConversation(id: string): Promise<void> {
    const { error } = await supabase
      .from('atlas_conversations')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async getMessages(conversationId: string): Promise<AtlasMessage[]> {
    const { data, error } = await supabase
      .from('atlas_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async insertMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<AtlasMessage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('atlas_messages')
      .insert({ conversation_id: conversationId, user_id: user.id, role, content })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async getUsageInfo(): Promise<AtlasUsageInfo> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { canSend: false, messagesUsedToday: 0, dailyLimit: ATLAS_DAILY_FREE_LIMIT, isUnlimited: false };

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier, atlas_messages_today, atlas_messages_reset_at, is_super_user')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) return { canSend: false, messagesUsedToday: 0, dailyLimit: ATLAS_DAILY_FREE_LIMIT, isUnlimited: false };

    if (profile.is_super_user) {
      return { canSend: true, messagesUsedToday: 0, dailyLimit: ATLAS_DAILY_FREE_LIMIT, isUnlimited: true };
    }

    const tier = profile.subscription_tier || 'free';
    const isPaid = ['trial', 'unlimited', 'starter', 'plus', 'elite'].includes(tier);

    if (isPaid) {
      return { canSend: true, messagesUsedToday: 0, dailyLimit: ATLAS_DAILY_FREE_LIMIT, isUnlimited: true };
    }

    const resetAt = profile.atlas_messages_reset_at ? new Date(profile.atlas_messages_reset_at) : null;
    const now = new Date();
    const isSameDay = resetAt
      ? resetAt.toDateString() === now.toDateString()
      : false;

    const usedToday = isSameDay ? (profile.atlas_messages_today || 0) : 0;

    return {
      canSend: usedToday < ATLAS_DAILY_FREE_LIMIT,
      messagesUsedToday: usedToday,
      dailyLimit: ATLAS_DAILY_FREE_LIMIT,
      isUnlimited: false,
    };
  },

  async incrementUsage(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('atlas_messages_today, atlas_messages_reset_at')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) return;

    const resetAt = profile.atlas_messages_reset_at ? new Date(profile.atlas_messages_reset_at) : null;
    const now = new Date();
    const isSameDay = resetAt ? resetAt.toDateString() === now.toDateString() : false;

    if (!isSameDay) {
      await supabase
        .from('user_profiles')
        .update({ atlas_messages_today: 1, atlas_messages_reset_at: now.toISOString() })
        .eq('id', user.id);
    } else {
      await supabase
        .from('user_profiles')
        .update({ atlas_messages_today: (profile.atlas_messages_today || 0) + 1 })
        .eq('id', user.id);
    }
  },

  async sendMessage(
    conversationId: string,
    userMessage: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    userName?: string,
    onChunk?: (chunk: string) => void,
    onMeta?: (meta: { searchPerformed: boolean; searchQuery: string | null }) => void,
    onCalendarEvent?: (event: AtlasCalendarEvent) => void,
    onNavigationIntent?: (intent: AtlasNavigationIntent) => void,
    voice?: 'masculine' | 'feminine' | null
  ): Promise<{ text: string; searchPerformed: boolean; searchQuery: string | null }> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Authentication required');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atlas-agent`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        history: history.slice(-20),
        userName,
        voice: voice || null,
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      if (err.limitReached) throw new Error('LIMIT_REACHED');
      throw new Error(err.error || `Request failed: ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let searchPerformed = false;
    let searchQuery: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          if (event.type === 'meta') {
            searchPerformed = event.searchPerformed === true;
            searchQuery = event.searchQuery || null;
            onMeta?.({ searchPerformed, searchQuery });
          } else if (event.type === 'text') {
            fullText += event.chunk;
            onChunk?.(event.chunk);
          } else if (event.type === 'calendar_event_added' && event.event) {
            onCalendarEvent?.(event.event as AtlasCalendarEvent);
          } else if (event.type === 'navigation_intent') {
            onNavigationIntent?.({
              destination: event.destination,
              route: event.route,
              seedText: event.seedText || null,
            });
          }
        } catch {
          // skip malformed
        }
      }
    }

    return { text: fullText, searchPerformed, searchQuery };
  },
};
