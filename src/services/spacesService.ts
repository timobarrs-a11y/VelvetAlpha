import { supabase } from '../shared/supabase/client';
import type { MySpace, SpaceSuggestion, SpaceRoom, SpaceMember, RoomMessage } from '../types/spaces';

const SEND_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/community-room-send`;

export async function getMySpaces(): Promise<MySpace[]> {
  const { data, error } = await supabase.rpc('get_my_spaces');
  if (error) throw new Error(error.message);
  return (data ?? []) as MySpace[];
}

export async function ensurePlaced(): Promise<MySpace[]> {
  let spaces = await getMySpaces();
  if (spaces.length === 0) {
    await supabase.rpc('join_spaces_from_interests');
    spaces = await getMySpaces();
  }
  return spaces;
}

export async function getSpaceSuggestions(limit = 5): Promise<SpaceSuggestion[]> {
  const { data, error } = await supabase.rpc('get_space_suggestions', { p_limit: limit });
  if (error) throw new Error(error.message);
  return (data ?? []) as SpaceSuggestion[];
}

export async function dismissSuggestion(boardId: string): Promise<void> {
  const { error } = await supabase.from('community_space_dismissals').insert({ board_id: boardId });
  if (error) throw new Error(error.message);
}

export async function joinSpace(boardId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('community_board_members')
    .insert({ board_id: boardId, user_id: user.id, role: 'member', source: 'manual' });
  if (error) throw new Error(error.message);
}

export async function leaveSpace(boardId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('community_board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', user.id);
  if (error) throw new Error(error.message);
}

export async function getRooms(boardId: string): Promise<SpaceRoom[]> {
  const { data, error } = await supabase
    .from('community_rooms')
    .select('id, board_id, name, topic, kind, sort_order, last_message_at')
    .eq('board_id', boardId)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as SpaceRoom[];
}

export async function getRoomMessages(roomId: string, before?: string): Promise<RoomMessage[]> {
  const { data, error } = await supabase.rpc('get_room_messages', {
    p_room_id: roomId,
    p_before: before ?? null,
    p_limit: 50,
  });
  if (error) throw new Error(error.message);
  const msgs = (data ?? []) as RoomMessage[];
  return msgs.reverse();
}

export async function sendRoomMessage(roomId: string, body: string, replyToId?: string): Promise<RoomMessage> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');
  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ room_id: roomId, body, reply_to_id: replyToId ?? null }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message ?? data.error ?? 'Send failed'), { code: data.error, status: res.status });
  return data.message as RoomMessage;
}

export async function deleteRoomMessage(messageId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_room_message', { p_message_id: messageId });
  if (error) throw new Error(error.message);
}

export async function markRoomRead(roomId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('community_room_reads')
    .upsert({ room_id: roomId, user_id: user.id, last_read_at: new Date().toISOString() }, { onConflict: 'room_id,user_id' });
  if (error) throw new Error(error.message);
}

export async function getSpaceMembers(boardId: string): Promise<SpaceMember[]> {
  const { data, error } = await supabase.rpc('get_space_members', { p_board_id: boardId });
  if (error) throw new Error(error.message);
  return (data ?? []) as SpaceMember[];
}

export async function addFriendToSpace(boardId: string, friendId: string): Promise<void> {
  const { error } = await supabase.rpc('add_friend_to_space', { p_board_id: boardId, p_friend_id: friendId });
  if (error) throw new Error(error.message);
}
