import { supabase } from '../client';
import { insertMessageByUserAndCompanion } from './message';

export async function getConversation(conversationId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get conversation: ${error.message}`);
  }

  return data;
}

export async function createConversation(payload: {
  user_id: string;
  companion_id: string;
  title?: string;
}) {
  const { data, error } = await supabase
    .from('conversations')
    .insert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create conversation: ${error.message}`);
  }

  return data;
}

export async function getConversationsByUser(userId: string) {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, companions(*)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get conversations: ${error.message}`);
  }

  return data || [];
}

export async function updateConversation(conversationId: string, updates: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('conversations')
    .update(updates)
    .eq('id', conversationId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update conversation: ${error.message}`);
  }

  return data;
}

export async function deleteConversation(conversationId: string) {
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (error) {
    throw new Error(`Failed to delete conversation: ${error.message}`);
  }
}

export { insertMessageByUserAndCompanion as insertConversationMessage };
