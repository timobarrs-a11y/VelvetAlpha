import { supabase } from '../shared/supabase/client';
import type { Companion } from './companionService';

export interface GroupChat {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface GroupChatMember {
  id: string;
  group_chat_id: string;
  companion_id: string;
  joined_at: string;
  is_active: boolean;
  companion?: Companion;
}

export interface GroupChatMessage {
  id: string;
  group_chat_id: string;
  user_id: string;
  companion_id: string | null;
  role: 'user' | 'assistant';
  sender_name: string;
  content: string;
  created_at: string;
}

export interface GroupChatWithMembers extends GroupChat {
  members: GroupChatMember[];
  last_message?: GroupChatMessage;
}

export async function createGroupChat(
  name: string,
  companionIds: string[]
): Promise<GroupChat | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: group, error } = await supabase
    .from('group_chats')
    .insert({ user_id: user.id, name })
    .select()
    .maybeSingle();

  if (error || !group) {
    return null;
  }

  const members = companionIds.map(cid => ({
    group_chat_id: group.id,
    companion_id: cid,
  }));

  const { error: memberError } = await supabase
    .from('group_chat_members')
    .insert(members);

  if (memberError) {
    // member insert is best-effort; group creation still succeeds
  }

  return group;
}

export async function getGroupChats(): Promise<GroupChatWithMembers[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: groups, error } = await supabase
    .from('group_chats')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('updated_at', { ascending: false });

  if (error || !groups) {
    return [];
  }

  const results: GroupChatWithMembers[] = [];

  for (const group of groups) {
    const { data: members } = await supabase
      .from('group_chat_members')
      .select('*, companion:companions(*)')
      .eq('group_chat_id', group.id)
      .eq('is_active', true);

    const { data: lastMsg } = await supabase
      .from('group_chat_messages')
      .select('*')
      .eq('group_chat_id', group.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    results.push({
      ...group,
      members: (members || []).map(m => ({
        ...m,
        companion: m.companion || undefined,
      })),
      last_message: lastMsg || undefined,
    });
  }

  return results;
}

export async function getGroupChatMessages(
  groupChatId: string,
  limit = 100
): Promise<GroupChatMessage[]> {
  const { data, error } = await supabase
    .from('group_chat_messages')
    .select('*')
    .eq('group_chat_id', groupChatId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    return [];
  }

  return data || [];
}

export async function getGroupChatMembers(
  groupChatId: string
): Promise<GroupChatMember[]> {
  const { data, error } = await supabase
    .from('group_chat_members')
    .select('*, companion:companions(*)')
    .eq('group_chat_id', groupChatId)
    .eq('is_active', true);

  if (error) {
    return [];
  }

  return (data || []).map(m => ({
    ...m,
    companion: m.companion || undefined,
  }));
}

export async function sendGroupMessage(
  groupChatId: string,
  content: string,
  senderName: string,
  companionId?: string
): Promise<GroupChatMessage | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('group_chat_messages')
    .insert({
      group_chat_id: groupChatId,
      user_id: user.id,
      companion_id: companionId || null,
      role: companionId ? 'assistant' : 'user',
      sender_name: senderName,
      content,
    })
    .select()
    .maybeSingle();

  if (error) {
    return null;
  }

  await supabase
    .from('group_chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', groupChatId);

  return data;
}

export async function deleteGroupChat(groupChatId: string): Promise<boolean> {
  const { error } = await supabase
    .from('group_chats')
    .update({ is_active: false })
    .eq('id', groupChatId);

  if (error) {
    return false;
  }

  return true;
}
