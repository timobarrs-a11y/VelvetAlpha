import { supabase } from './supabase';

export interface Companion {
  id: string;
  user_id: string;
  character_type: 'riley' | 'raven' | 'jake';
  relationship_type: 'friend' | 'romantic';
  created_at: string;
  last_message_at: string;
  is_active: boolean;
  first_message_sent: boolean;
}

export interface CompanionWithLastMessage extends Companion {
  last_message_text?: string;
  last_message_role?: 'user' | 'assistant';
  unread_count?: number;
}

export async function createCompanion(
  userId: string,
  characterType: 'riley' | 'raven' | 'jake',
  relationshipType: 'friend' | 'romantic'
): Promise<Companion | null> {
  const { data, error } = await supabase
    .from('companions')
    .insert({
      user_id: userId,
      character_type: characterType,
      relationship_type: relationshipType,
      first_message_sent: false,
      is_active: true,
      last_message_at: new Date().toISOString()
    })
    .select()
    .maybeSingle();

  if (error) {
    console.error('Error creating companion:', error);
    return null;
  }

  return data;
}

export async function getCompanions(userId: string): Promise<CompanionWithLastMessage[]> {
  const { data: companions, error } = await supabase
    .from('companions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error('Error fetching companions:', error);
    return [];
  }

  const companionsWithMessages = await Promise.all(
    companions.map(async (companion) => {
      const { data: lastMessage } = await supabase
        .from('conversations')
        .select('message, role, created_at')
        .eq('companion_id', companion.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        ...companion,
        last_message_text: lastMessage?.message,
        last_message_role: lastMessage?.role,
        unread_count: 0
      };
    })
  );

  return companionsWithMessages;
}

export async function getCompanion(companionId: string): Promise<Companion | null> {
  const { data, error } = await supabase
    .from('companions')
    .select('*')
    .eq('id', companionId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching companion:', error);
    return null;
  }

  return data;
}

export async function updateLastMessageTime(companionId: string): Promise<void> {
  const { error } = await supabase
    .from('companions')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', companionId);

  if (error) {
    console.error('Error updating last message time:', error);
  }
}

export async function markFirstMessageSent(companionId: string): Promise<void> {
  const { error } = await supabase
    .from('companions')
    .update({ first_message_sent: true })
    .eq('id', companionId);

  if (error) {
    console.error('Error marking first message sent:', error);
  }
}

export async function deactivateCompanion(companionId: string): Promise<void> {
  const { error } = await supabase
    .from('companions')
    .update({ is_active: false })
    .eq('id', companionId);

  if (error) {
    console.error('Error deactivating companion:', error);
  }
}

export async function getUserDefaultCompanion(userId: string): Promise<Companion | null> {
  const { data, error } = await supabase
    .from('companions')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error fetching default companion:', error);
    return null;
  }

  return data;
}
