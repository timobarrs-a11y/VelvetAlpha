import { supabase } from '../client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type VRMatchType = 'ai' | 'human';
export type VRRequestStatus = 'pending' | 'accepted' | 'declined' | 'expired';
export type VRConversationStatus = 'active' | 'closed';

export interface VRRequest {
  id: string;
  addressee_id: string;
  requester_id: string | null;
  match_type: VRMatchType;
  masked_handle: string;
  opener_message: string;
  status: VRRequestStatus;
  created_at: string;
  responded_at: string | null;
}

export interface VRConversationSummary {
  id: string;
  peer_id: string | null;
  peer_handle: string;
  match_type: VRMatchType;
  status: VRConversationStatus;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export interface VRMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------
// Toggle state
// ----------------------------------------------------------------------------

export async function getVelvetRopeEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('velvet_rope_enabled, velvet_rope_first_seen_at')
    .maybeSingle();
  if (error) return false;
  return !!data?.velvet_rope_enabled;
}

export async function setVelvetRopeEnabled(enabled: boolean): Promise<void> {
  // Server-side: it also stamps the first time it's turned on, which gates AI
  // matches, so the client can't set that itself.
  const { error } = await supabase.rpc('set_velvet_rope_enabled', { p_enabled: enabled });
  if (error) throw new Error(`Failed to toggle Velvet Rope: ${error.message}`);

  if (!enabled) {
    // Closing the toggle closes any active Velvet Rope conversations (both
    // human and AI slots) and leaves the matchmaking queue.
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('velvet_rope_active_conv_id, velvet_rope_active_ai_conv_id')
      .maybeSingle();
    const humanConv = profile?.velvet_rope_active_conv_id;
    const aiConv = profile?.velvet_rope_active_ai_conv_id;
    for (const id of [humanConv, aiConv]) {
      if (id) {
        try {
          await supabase.rpc('vr_close_conversation', { p_conv_id: id });
        } catch {
          // Best-effort close.
        }
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Requests
// ----------------------------------------------------------------------------

export async function getIncomingVRRequests(): Promise<VRRequest[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('vr_requests')
    .select('id, addressee_id, requester_id, match_type, masked_handle, opener_message, status, created_at, responded_at')
    .eq('addressee_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to load Velvet Rope requests: ${error.message}`);
  return (data ?? []) as VRRequest[];
}

export async function acceptVRRequest(requestId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('vr_accept_request', { p_request_id: requestId });
  if (error) throw new Error(`Failed to accept Velvet Rope request: ${error.message}`);
  return (data as string) ?? null;
}

export async function declineVRRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc('vr_decline_request', { p_request_id: requestId });
  if (error) throw new Error(`Failed to decline Velvet Rope request: ${error.message}`);
}

// ----------------------------------------------------------------------------
// Conversations
// ----------------------------------------------------------------------------

export async function getVRConversationList(): Promise<VRConversationSummary[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('vr_conversations')
    .select('id, user_a_id, user_b_id, match_type, status, created_at, closed_at, last_message_at')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to load Velvet Rope conversations: ${error.message}`);
  if (!data || data.length === 0) return [];

  const convs = data as any[];
  const results = await Promise.all(convs.map(async c => {
    const peerId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id;
    const { data: lm } = await supabase
      .from('vr_messages')
      .select('content, created_at')
      .eq('conversation_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { count } = await supabase
      .from('vr_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', c.id)
      .neq('sender_id', user.id)
      .is('read_at', null);
    return {
      id: c.id,
      peer_id: peerId === user.id ? null : peerId,
      peer_handle: 'Velvet Rope',
      match_type: c.match_type as VRMatchType,
      status: c.status as VRConversationStatus,
      last_message: lm?.content ?? null,
      last_message_at: lm?.created_at ?? c.last_message_at ?? null,
      unread_count: count ?? 0,
      created_at: c.created_at,
    };
  }));
  return results;
}

// ----------------------------------------------------------------------------
// Messages
// ----------------------------------------------------------------------------

export async function getVRMessages(conversationId: string, limit = 100): Promise<VRMessage[]> {
  const { data, error } = await supabase
    .from('vr_messages')
    .select('id, conversation_id, sender_id, content, read_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed to load Velvet Rope messages: ${error.message}`);
  return (data ?? []) as VRMessage[];
}

export async function sendVRMessage(conversationId: string, content: string): Promise<VRMessage | null> {
  const { data, error } = await supabase
    .from('vr_messages')
    .insert({ conversation_id: conversationId, content })
    .select('id, conversation_id, sender_id, content, read_at, created_at')
    .maybeSingle();
  if (error) throw new Error(`Failed to send Velvet Rope message: ${error.message}`);

  await supabase
    .from('vr_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as VRMessage | null;
}

export async function markVRConversationRead(conversationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('vr_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null);
  if (error) throw new Error(`Failed to mark Velvet Rope read: ${error.message}`);
}

export async function closeVRConversation(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('vr_close_conversation', { p_conv_id: conversationId });
  if (error) throw new Error(`Failed to close Velvet Rope conversation: ${error.message}`);
}

// ----------------------------------------------------------------------------
// AI opponent (edge function)
// ----------------------------------------------------------------------------

const VR_AI_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/velvet-rope-ai`;

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
  } as Record<string, string>;
}

export async function requestAIVelvetRopeOpener(): Promise<{ requestId: string | null; opener: string } | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');
  const res = await fetch(VR_AI_URL, {
    method: 'POST',
    headers: authHeaders(session.access_token),
    body: JSON.stringify({ action: 'request' }),
  });
  if (res.status === 403) return null; // not eligible
  if (!res.ok) throw new Error(`AI request failed (${res.status})`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  return { requestId: data.requestId ?? null, opener: data.opener ?? '' };
}

export async function requestAIVelvetRopeReply(
  conversationId: string,
  history: { senderId: string | null; content: string }[],
): Promise<VRMessage | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');
  const res = await fetch(VR_AI_URL, {
    method: 'POST',
    headers: authHeaders(session.access_token),
    body: JSON.stringify({ action: 'reply', conversationId, history }),
  });
  if (!res.ok) throw new Error(`AI reply failed (${res.status})`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error);
  return (data.message as VRMessage) ?? null;
}

// ----------------------------------------------------------------------------
// Human matchmaking queue
// ----------------------------------------------------------------------------

export async function enterVelvetRopeQueue(): Promise<boolean> {
  const { data, error } = await supabase.rpc('vr_enter_queue');
  if (error) throw new Error(`Failed to enter Velvet Rope queue: ${error.message}`);
  return !!data;
}

export async function leaveVelvetRopeQueue(): Promise<void> {
  const { error } = await supabase.rpc('vr_leave_queue');
  if (error) throw new Error(`Failed to leave Velvet Rope queue: ${error.message}`);
}

export async function tryVelvetRopeMatch(): Promise<string | null> {
  const { data, error } = await supabase.rpc('vr_try_match');
  if (error) throw new Error(`Velvet Rope match attempt failed: ${error.message}`);
  return (data as string) ?? null;
}

// ----------------------------------------------------------------------------
// Typing indicator (reuses the im_typing table — Velvet Rope conv id is used as
// the conversation_id, and the existing RLS policy checks im_conversations, so
// we skip typing indicators for Velvet Rope for now until a dedicated table is
// added. Left as a no-op stub so the UI can call it without branching.)
// ----------------------------------------------------------------------------

export async function setVRTyping(_conversationId: string): Promise<void> {}
export async function clearVRTyping(_conversationId: string): Promise<void> {}
