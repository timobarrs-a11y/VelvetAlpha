import { supabase } from '../shared/supabase/client';
import { MemoryService } from './memoryService';

export interface CoreConversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface CoreMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface CoreUsageInfo {
  canSend: boolean;
  messagesUsedToday: number;
  dailyLimit: number;
  isUnlimited: boolean;
}

// Kept in sync with CORE_DAILY_FREE_LIMIT in supabase/functions/core-chat.
const CORE_DAILY_FREE_LIMIT = 8;
const PAID_TIERS = ['trial', 'unlimited', 'starter', 'plus', 'elite'];

export const coreService = {
  // --- Threads ---------------------------------------------------------------

  async getConversations(): Promise<CoreConversation[]> {
    const { data, error } = await supabase
      .from('core_conversations')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getConversation(id: string): Promise<CoreConversation | null> {
    const { data, error } = await supabase
      .from('core_conversations')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async createConversation(title?: string): Promise<CoreConversation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('core_conversations')
      .insert({ user_id: user.id, title: title || 'New thread' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateConversationTitle(id: string, title: string): Promise<void> {
    const { error } = await supabase
      .from('core_conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async touchConversation(id: string): Promise<void> {
    await supabase
      .from('core_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);
  },

  async deleteConversation(id: string): Promise<void> {
    const { error } = await supabase
      .from('core_conversations')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  // --- Messages --------------------------------------------------------------

  async getMessages(conversationId: string): Promise<CoreMessage[]> {
    const { data, error } = await supabase
      .from('core_messages')
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
  ): Promise<CoreMessage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    const { data, error } = await supabase
      .from('core_messages')
      .insert({ conversation_id: conversationId, user_id: user.id, role, content })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  async deleteMessage(id: string): Promise<void> {
    await supabase.from('core_messages').delete().eq('id', id);
  },

  /**
   * Delete a message and everything after it in the thread. Used by
   * edit-and-resend (drop the edited user turn + its reply) and regenerate
   * (drop the assistant turn being replaced).
   */
  async deleteMessagesFrom(conversationId: string, createdAt: string, inclusive = true): Promise<void> {
    const base = supabase
      .from('core_messages')
      .delete()
      .eq('conversation_id', conversationId);
    await (inclusive ? base.gte('created_at', createdAt) : base.gt('created_at', createdAt));
  },

  // --- Metering (separate from companion message counts) ---------------------

  async getUsageInfo(): Promise<CoreUsageInfo> {
    const fallback: CoreUsageInfo = {
      canSend: false, messagesUsedToday: 0, dailyLimit: CORE_DAILY_FREE_LIMIT, isUnlimited: false,
    };
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fallback;

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier, core_messages_today, core_messages_reset_at, is_super_user')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile) return fallback;

    if (profile.is_super_user || PAID_TIERS.includes(profile.subscription_tier || 'free')) {
      return { canSend: true, messagesUsedToday: 0, dailyLimit: CORE_DAILY_FREE_LIMIT, isUnlimited: true };
    }

    const resetAt = profile.core_messages_reset_at ? new Date(profile.core_messages_reset_at) : null;
    const now = new Date();
    const isSameDay = resetAt ? resetAt.toDateString() === now.toDateString() : false;
    const usedToday = isSameDay ? (profile.core_messages_today || 0) : 0;

    return {
      canSend: usedToday < CORE_DAILY_FREE_LIMIT,
      messagesUsedToday: usedToday,
      dailyLimit: CORE_DAILY_FREE_LIMIT,
      isUnlimited: false,
    };
  },

  async getUserName(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return '';
    const { data } = await supabase
      .from('user_profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();
    return data?.name ? String(data.name).split(' ')[0] : '';
  },

  // --- Memory: the differentiator -------------------------------------------

  /**
   * Assemble cross-surface memory context for a Core turn. Reads from the same
   * semantic memory layer as Companion/Coach/Correspondent, so Core answers
   * with knowledge of the user's ongoing situations without being re-told.
   * Returns '' when nothing relevant is retrieved.
   */
  async assembleMemoryContext(userId: string, message: string): Promise<string> {
    const parts: string[] = [];

    // Stable profile context — who they are, what they're into.
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('name, interests, hobbies')
        .eq('id', userId)
        .maybeSingle();
      if (profile) {
        const bits: string[] = [];
        const interests = [
          ...(Array.isArray(profile.interests) ? profile.interests : []),
          ...(Array.isArray(profile.hobbies) ? profile.hobbies : []),
        ].filter(Boolean).slice(0, 8);
        if (interests.length > 0) bits.push(`Interests: ${interests.join(', ')}.`);
        if (bits.length > 0) parts.push(`PROFILE:\n${bits.join('\n')}`);
      }
    } catch { /* non-fatal */ }

    // Semantic retrieval — clusters, ongoing storylines, most relevant memories.
    try {
      const { SemanticMemoryService } = await import('./semanticMemoryService');
      const enriched = await SemanticMemoryService.getEnrichedContext(userId, message, 10);
      if (enriched && enriched.trim().length > 0) parts.push(enriched.trim());
    } catch { /* non-fatal */ }

    // Keyword/semantic relationship memories as a fallback layer.
    try {
      const relevant = await MemoryService.getRelevantMemories(userId, message, 6);
      const formatted = MemoryService.formatMemoriesForContext(relevant);
      if (formatted && formatted.trim().length > 0) parts.push(formatted.trim());
    } catch { /* non-fatal */ }

    return parts.join('\n\n');
  },

  /**
   * Stream a Core reply. Assembles cross-surface memory, streams tokens from the
   * core-chat edge function, and writes durable facts back to the shared memory
   * layer tagged with surface provenance ('core').
   */
  async sendMessage(
    userMessage: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    opts: {
      userName?: string;
      onChunk?: (chunk: string) => void;
      signal?: AbortSignal;
    } = {}
  ): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!session?.access_token || !user) throw new Error('Authentication required');

    const memoryContext = await this.assembleMemoryContext(user.id, userMessage);

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/core-chat`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: userMessage,
        history: history.slice(-20),
        memoryContext,
        userName: opts.userName,
      }),
      signal: opts.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }));
      if (err.limitReached) throw new Error('LIMIT_REACHED');
      throw new Error(err.message || err.error || `Request failed: ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let streamError: string | null = null;

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
          const evt = JSON.parse(trimmed);
          if (evt.type === 'text') {
            fullText += evt.chunk;
            opts.onChunk?.(evt.chunk);
          } else if (evt.type === 'error') {
            streamError = evt.message || 'Something went wrong.';
          }
        } catch { /* skip malformed */ }
      }
    }

    if (!fullText && streamError) throw new Error(streamError);

    // Write durable facts back to the shared memory layer, tagged 'core'.
    if (fullText) {
      MemoryService.extractAndStoreMemories(user.id, userMessage, fullText, history, 'core')
        .catch(() => { /* fire-and-forget; never block the reply */ });
    }

    return fullText;
  },
};
