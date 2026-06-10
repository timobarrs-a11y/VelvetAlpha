import { supabase } from '../client';
import { relationshipCalendarService } from '../../../services/relationshipCalendarService';

export async function getMessages(conversationId: string, limit?: number) {
  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }

  return data || [];
}

export async function insertMessage(payload: {
  conversation_id: string;
  sender_id: string;
  content: string;
  role: 'user' | 'assistant';
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to insert message: ${error.message}`);
  }

  return data;
}

export async function getMessagesByConversation(conversationId: string, options?: {
  limit?: number;
  offset?: number;
  ascending?: boolean;
}) {
  const { limit, offset, ascending = true } = options || {};

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending });

  if (limit) {
    query = query.limit(limit);
  }

  if (offset) {
    query = query.range(offset, offset + (limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get messages: ${error.message}`);
  }

  return data || [];
}

export async function deleteMessage(messageId: string) {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId);

  if (error) {
    throw new Error(`Failed to delete message: ${error.message}`);
  }
}

export async function insertMessageByUserAndCompanion(payload: {
  user_id: string;
  companion_id: string;
  role: 'user' | 'assistant';
  content: string;
  client_message_id?: string;
  message_type?: string;
  metadata?: Record<string, unknown>;
  bot_source?: string;
}) {
  const { data, error } = await supabase
    .from('conversations')
    .upsert(payload, { onConflict: 'client_message_id', ignoreDuplicates: true })
    .select()
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to insert message: ${error.message}`);
  }

  let row = data;

  if (!row && payload.client_message_id) {
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .eq('client_message_id', payload.client_message_id)
      .maybeSingle();
    row = existing ?? null;
  }

  if (row) {
    try {
      const totalChatDays = await relationshipCalendarService.recordInteractionDate(
        payload.user_id,
        payload.companion_id,
        new Date(row.created_at)
      );

      await relationshipCalendarService.checkAndCreateMilestones(
        payload.user_id,
        payload.companion_id,
        totalChatDays
      );
    } catch (relationshipError) {
      console.error('Failed to update relationship tracking:', relationshipError);
    }
  }

  return row;
}
