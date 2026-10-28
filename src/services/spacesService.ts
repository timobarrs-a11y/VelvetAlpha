import { supabase } from '../shared/supabase/client';
import type { MySpace, SpaceSuggestion, SpaceRoom, SpaceMember, RoomMessage, DirectorySpace, JoinRequest, InvitePreview, InviteRow, RoleTag, SpaceView, SpaceVisibility } from '../types/spaces';

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

/* ===== Phase 4: Crews ===== */

export async function getSpaceDirectory(parentId?: string | null, query?: string | null): Promise<DirectorySpace[]> {
  const { data, error } = await supabase.rpc('get_space_directory', {
    p_parent_id: parentId ?? null,
    p_query: query ?? null,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as DirectorySpace[];
}

export async function requestToJoinSpace(boardId: string, message?: string): Promise<void> {
  const { error } = await supabase.rpc('request_to_join_space', {
    p_board_id: boardId,
    p_message: message ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function getJoinRequests(boardId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase.rpc('get_join_requests', { p_board_id: boardId });
  if (error) throw new Error(error.message);
  return (data ?? []) as JoinRequest[];
}

export async function decideJoinRequest(requestId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc('decide_join_request', { p_request_id: requestId, p_approve: approve });
  if (error) throw new Error(error.message);
}

export async function createSpaceInvite(boardId: string, maxUses: number | null, expiresInHours: number | null): Promise<string> {
  const { data, error } = await supabase.rpc('create_space_invite', {
    p_board_id: boardId,
    p_max_uses: maxUses,
    p_expires_in_hours: expiresInHours,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function getInvitePreview(code: string): Promise<InvitePreview | null> {
  const { data, error } = await supabase.rpc('get_invite_preview', { p_code: code });
  if (error || !data) return null;
  return (data as InvitePreview[])[0] ?? null;
}

export async function redeemSpaceInvite(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('redeem_space_invite', { p_code: code });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function setMemberRole(boardId: string, userId: string, role: 'mod' | 'member'): Promise<void> {
  const { error } = await supabase.rpc('set_member_role', { p_board_id: boardId, p_user_id: userId, p_role: role });
  if (error) throw new Error(error.message);
}

export async function transferSpaceOwnership(boardId: string, newOwner: string): Promise<void> {
  const { error } = await supabase.rpc('transfer_space_ownership', { p_board_id: boardId, p_new_owner: newOwner });
  if (error) throw new Error(error.message);
}

export async function removeSpaceMember(boardId: string, userId: string, ban: boolean, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('remove_space_member', {
    p_board_id: boardId, p_user_id: userId, p_ban: ban, p_reason: reason ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function unbanSpaceMember(boardId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('unban_space_member', { p_board_id: boardId, p_user_id: userId });
  if (error) throw new Error(error.message);
}

export async function updateSpaceSettings(input: {
  boardId: string; name?: string | null; description?: string | null;
  icon?: string | null; color?: string | null; visibility?: SpaceVisibility | null;
}): Promise<void> {
  const { error } = await supabase.rpc('update_space_settings', {
    p_board_id: input.boardId,
    p_name: input.name ?? null,
    p_description: input.description ?? null,
    p_icon: input.icon ?? null,
    p_color: input.color ?? null,
    p_visibility: input.visibility ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function createCrew(input: {
  parentId: string; name: string; description: string; icon: string; color: string;
  visibility: SpaceVisibility; category: string;
}): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('community_boards')
    .insert({
      name: input.name,
      description: input.description,
      icon: input.icon,
      color: input.color,
      visibility: input.visibility,
      owner_id: user.id,
      parent_board_id: input.parentId,
      category: input.category,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

export async function getRoleTags(boardId: string): Promise<RoleTag[]> {
  const { data, error } = await supabase
    .from('community_role_tags')
    .select('id, name, color, sort_order')
    .eq('board_id', boardId)
    .order('sort_order');
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as RoleTag[];
}

export async function createRoleTag(boardId: string, name: string, color: string): Promise<void> {
  const { error } = await supabase
    .from('community_role_tags')
    .insert({ board_id: boardId, name, color });
  if (error) throw new Error(error.message);
}

export async function deleteRoleTag(tagId: string): Promise<void> {
  const { error } = await supabase.from('community_role_tags').delete().eq('id', tagId);
  if (error) throw new Error(error.message);
}

export async function assignMemberTag(boardId: string, userId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('community_member_tags')
    .insert({ board_id: boardId, user_id: userId, tag_id: tagId });
  if (error) throw new Error(error.message);
}

export async function removeMemberTag(boardId: string, userId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('community_member_tags')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId)
    .eq('tag_id', tagId);
  if (error) throw new Error(error.message);
}

export async function getInvites(boardId: string): Promise<InviteRow[]> {
  const { data, error } = await supabase
    .from('community_invites')
    .select('code, board_id, max_uses, uses, expires_at, revoked, created_at')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as InviteRow[];
}

export async function revokeInvite(code: string): Promise<void> {
  const { error } = await supabase
    .from('community_invites')
    .update({ revoked: true })
    .eq('code', code);
  if (error) throw new Error(error.message);
}

export async function createRoom(boardId: string, name: string, topic: string | null, kind: 'chat' | 'announcements'): Promise<void> {
  const { error } = await supabase
    .from('community_rooms')
    .insert({ board_id: boardId, name, topic, kind });
  if (error) throw new Error(error.message);
}

export async function deleteRoom(roomId: string): Promise<void> {
  const { error } = await supabase.from('community_rooms').delete().eq('id', roomId);
  if (error) throw new Error(error.message);
}

export async function updateRoom(roomId: string, name: string, topic: string | null): Promise<void> {
  const { error } = await supabase
    .from('community_rooms')
    .update({ name, topic })
    .eq('id', roomId);
  if (error) throw new Error(error.message);
}

export async function reorderRoom(roomId: string, direction: 'up' | 'down'): Promise<void> {
  const { data: room } = await supabase
    .from('community_rooms')
    .select('sort_order, board_id')
    .eq('id', roomId)
    .maybeSingle();
  if (!room) return;
  const target = direction === 'up' ? room.sort_order - 1 : room.sort_order + 1;
  const { data: swap } = await supabase
    .from('community_rooms')
    .select('id')
    .eq('board_id', room.board_id)
    .eq('sort_order', target)
    .maybeSingle();
  if (!swap) return;
  await supabase.from('community_rooms').update({ sort_order: target }).eq('id', roomId);
  await supabase.from('community_rooms').update({ sort_order: room.sort_order }).eq('id', swap.id);
}

/** One space or crew as the House shows it, member or not. Null when it doesn't exist or is hidden from me. */
export async function getSpaceCard(boardId: string): Promise<SpaceView | null> {
  const { data, error } = await supabase.rpc('get_space_card', { p_board_id: boardId });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  return row ? (row as SpaceView) : null;
}
