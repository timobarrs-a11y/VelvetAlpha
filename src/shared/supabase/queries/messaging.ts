import { supabase } from '../client';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type FriendshipStatus = 'pending' | 'accepted' | 'declined' | 'blocked';

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  created_at: string;
  updated_at: string;
  accepted_at: string | null;
}

export interface FriendPeer {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  headline: string | null;
  alias: string | null;
  age_range: string | null;
  intro: string | null;
  intro_message: string | null;
  friendship_id: string;
  status: FriendshipStatus;
  created_at: string;
  is_online: boolean;
  last_seen_at: string | null;
  presence?: Presence;
  available_to_chat: boolean;
}

export interface DiscoveryProfile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  headline: string | null;
  alias: string | null;
  age_range: string | null;
  intro: string | null;
  interests: string[];
  discoverable: boolean;
  available_to_chat: boolean;
  is_online: boolean;
  shared_interests: string[];
  already_friends: boolean;
  request_pending: boolean;
}

export const AGE_RANGES = ['18-24', '25-34', '35-44', '45-54', '55+'] as const;
export type AgeRange = typeof AGE_RANGES[number];

export function ageRangeLabel(range: string | null | undefined): string {
  if (!range) return '';
  return range;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface ConversationSummary {
  id: string;
  peer_id: string;
  peer_name: string;
  peer_avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_online: boolean;
  last_seen_at: string | null;
}

// ----------------------------------------------------------------------------
// Discovery profile (self)
// ----------------------------------------------------------------------------

export async function getMyDiscoveryProfile() {
  const { data, error } = await supabase
    .from('im_discovery_profiles')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`Failed to load discovery profile: ${error.message}`);
  return data;
}

export async function upsertMyDiscoveryProfile(updates: {
  display_name?: string;
  avatar_url?: string | null;
  headline?: string | null;
  interests?: string[];
  discoverable?: boolean;
  intro?: string | null;
  available_to_chat?: boolean;
}) {
  const { data, error } = await supabase
    .from('im_discovery_profiles')
    .upsert(updates, { onConflict: 'user_id' })
    .select()
    .maybeSingle();
  if (error) throw new Error(`Failed to save discovery profile: ${error.message}`);
  return data;
}

export async function setMyDiscoveryIdentity(alias: string, ageRange: string | null): Promise<void> {
  const { error } = await supabase.rpc('im_set_discovery_identity', {
    p_alias: alias,
    p_age_range: ageRange,
  });
  if (error) {
    if (error.code === '23505') throw new Error('That alias is taken');
    throw new Error(error.message || 'Could not save alias');
  }
}

// Mirror interests + name from user_profiles into im_discovery_profiles so
// discovery queries have everything they need without joining auth-gated tables.
export async function syncDiscoveryFromProfile(profile: {
  name?: string | null;
  avatar_config?: any;
  interests?: string[] | null;
}) {
  const updates: Record<string, unknown> = {};
  if (profile.name !== undefined) updates.display_name = profile.name ?? '';
  if (profile.interests !== undefined) updates.interests = profile.interests ?? [];
  if (Object.keys(updates).length === 0) return;
  const { error } = await supabase
    .from('im_discovery_profiles')
    .upsert(updates, { onConflict: 'user_id' });
  if (error) throw new Error(`Failed to sync discovery profile: ${error.message}`);
}

// ----------------------------------------------------------------------------
// Friends list
// ----------------------------------------------------------------------------

/** Buddy-list status. Heartbeats only run while the tab is visible, so a recent one means online. */
export type Presence = 'online' | 'away' | 'offline';
const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const AWAY_WINDOW_MS = 30 * 60 * 1000;

export function presenceOf(isOnline: boolean | null | undefined, lastSeenAt: string | null | undefined): Presence {
  if (!isOnline || !lastSeenAt) return 'offline';
  const age = Date.now() - new Date(lastSeenAt).getTime();
  if (age < ONLINE_WINDOW_MS) return 'online';
  return age < AWAY_WINDOW_MS ? 'away' : 'offline';
}

export async function getFriends(): Promise<FriendPeer[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('im_friendships')
    .select('id, requester_id, addressee_id, status, created_at, updated_at, accepted_at')
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
    .in('status', ['accepted', 'pending', 'blocked']);
  if (error) throw new Error(`Failed to load friends: ${error.message}`);
  if (!data) return [];

  const friendRows = (data as Friendship[]).filter(f => f.status === 'accepted');
  const peerIds = friendRows.map(f =>
    f.requester_id === user.id ? f.addressee_id : f.requester_id,
  );
  if (peerIds.length === 0) return [];

  const [profiles, presence] = await Promise.all([
    supabase.from('im_discovery_profiles').select('user_id, display_name, avatar_url, headline, alias, age_range, intro, available_to_chat').in('user_id', peerIds),
    supabase.from('im_presence').select('user_id, is_online, last_seen_at, available_to_chat').in('user_id', peerIds),
  ]);

  const profileMap = new Map((profiles.data ?? []).map((p: any) => [p.user_id, p]));
  const presenceMap = new Map((presence.data ?? []).map((p: any) => [p.user_id, p]));
  const names = await displayNames(peerIds.filter(id => !profileMap.get(id)?.display_name));

  return friendRows.map(f => {
    const peerId = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    const profile = profileMap.get(peerId);
    const pres = presenceMap.get(peerId);
    return {
      user_id: peerId,
      display_name: profile?.display_name ?? names.get(peerId) ?? 'Anonymous',
      avatar_url: profile?.avatar_url ?? null,
      headline: profile?.headline ?? null,
      alias: profile?.alias ?? null,
      age_range: profile?.age_range ?? null,
      intro: profile?.intro ?? null,
      intro_message: null,
      friendship_id: f.id,
      status: f.status,
      created_at: f.created_at,
      is_online: presenceOf(pres?.is_online, pres?.last_seen_at) === 'online',
      last_seen_at: pres?.last_seen_at ?? null,
      presence: presenceOf(pres?.is_online, pres?.last_seen_at),
      available_to_chat: pres?.available_to_chat ?? false,
    };
  });
}

// ----------------------------------------------------------------------------
// Friend requests (incoming + outgoing)
// ----------------------------------------------------------------------------

export async function getIncomingRequests(): Promise<FriendPeer[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('im_friendships')
    .select('id, requester_id, addressee_id, status, created_at, intro_message')
    .eq('addressee_id', user.id)
    .eq('status', 'pending');
  if (error) throw new Error(`Failed to load requests: ${error.message}`);
  if (!data || data.length === 0) return [];

  const requesterIds = (data as any[]).map(f => f.requester_id);
  const [profiles, presence] = await Promise.all([
    supabase.from('im_discovery_profiles').select('user_id, display_name, avatar_url, headline, alias, age_range, intro').in('user_id', requesterIds),
    supabase.from('im_presence').select('user_id, is_online, last_seen_at, available_to_chat').in('user_id', requesterIds),
  ]);
  const profileMap = new Map((profiles.data ?? []).map((p: any) => [p.user_id, p]));
  const presenceMap = new Map((presence.data ?? []).map((p: any) => [p.user_id, p]));
  const names = await displayNames(requesterIds.filter(id => !profileMap.get(id)?.display_name));

  return (data as any[]).map(f => {
    const profile = profileMap.get(f.requester_id);
    const pres = presenceMap.get(f.requester_id);
    return {
      user_id: f.requester_id,
      display_name: profile?.display_name ?? names.get(f.requester_id) ?? 'Anonymous',
      avatar_url: profile?.avatar_url ?? null,
      headline: profile?.headline ?? null,
      alias: profile?.alias ?? null,
      age_range: profile?.age_range ?? null,
      intro: profile?.intro ?? null,
      intro_message: f.intro_message ?? null,
      friendship_id: f.id,
      status: f.status,
      created_at: f.created_at,
      is_online: pres?.is_online ?? false,
      last_seen_at: pres?.last_seen_at ?? null,
      available_to_chat: pres?.available_to_chat ?? false,
    };
  });
}

export async function getOutgoingRequests(): Promise<FriendPeer[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('im_friendships')
    .select('id, requester_id, addressee_id, status, created_at, intro_message')
    .eq('requester_id', user.id)
    .eq('status', 'pending');
  if (error) throw new Error(`Failed to load outgoing requests: ${error.message}`);
  if (!data || data.length === 0) return [];

  const addresseeIds = (data as any[]).map(f => f.addressee_id);
  const [profiles, presence] = await Promise.all([
    supabase.from('im_discovery_profiles').select('user_id, display_name, avatar_url, headline, alias, age_range, intro').in('user_id', addresseeIds),
    supabase.from('im_presence').select('user_id, is_online, last_seen_at, available_to_chat').in('user_id', addresseeIds),
  ]);
  const profileMap = new Map((profiles.data ?? []).map((p: any) => [p.user_id, p]));
  const presenceMap = new Map((presence.data ?? []).map((p: any) => [p.user_id, p]));
  const names = await displayNames(addresseeIds.filter(id => !profileMap.get(id)?.display_name));

  return (data as any[]).map(f => {
    const profile = profileMap.get(f.addressee_id);
    const pres = presenceMap.get(f.addressee_id);
    return {
      user_id: f.addressee_id,
      display_name: profile?.display_name ?? names.get(f.addressee_id) ?? 'Anonymous',
      avatar_url: profile?.avatar_url ?? null,
      headline: profile?.headline ?? null,
      alias: profile?.alias ?? null,
      age_range: profile?.age_range ?? null,
      intro: profile?.intro ?? null,
      intro_message: f.intro_message ?? null,
      friendship_id: f.id,
      status: f.status,
      created_at: f.created_at,
      is_online: pres?.is_online ?? false,
      last_seen_at: pres?.last_seen_at ?? null,
      available_to_chat: pres?.available_to_chat ?? false,
    };
  });
}

/**
 * Names for people the user is connected to who have no messenger card, from
 * their member profile or account nickname (server checks the connection).
 */
async function displayNames(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await supabase.rpc('im_display_names', { p_user_ids: userIds });
  if (error || !Array.isArray(data)) return new Map();
  return new Map((data as Array<{ user_id: string; display_name: string }>).map(r => [r.user_id, r.display_name]));
}

// ----------------------------------------------------------------------------
// Friend codes
// ----------------------------------------------------------------------------

/** Show a code as "1234 5678". */
export function formatFriendCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  return digits.length === 8 ? `${digits.slice(0, 4)} ${digits.slice(4)}` : digits;
}

export function friendCodeLink(code: string): string {
  return `${window.location.origin}/add/${code.replace(/\D/g, '')}`;
}

export async function getMyFriendCode(): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_my_friend_code');
  if (error) return null;
  return (data as string | null) ?? null;
}

export async function getFriendCode(userId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('get_friend_code', { p_user_id: userId });
  if (error) return null;
  return (data as string | null) ?? null;
}

export interface FriendCodeMatch {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export type AddByCodeResult =
  | { kind: 'invalid' | 'not_found' | 'self' }
  | { kind: 'friends' | 'accepted' | 'requested' | 'already_requested'; peer: FriendCodeMatch };

/**
 * Add someone by their friend code: already friends → ready to chat; they had
 * asked you → accepted; otherwise a request is sent.
 */
export async function addFriendByCode(code: string): Promise<AddByCodeResult> {
  const digits = code.replace(/\D/g, '');
  if (digits.length !== 8) return { kind: 'invalid' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  const { data, error } = await supabase.rpc('find_user_by_friend_code', { p_code: digits });
  if (error) throw new Error(`Could not look up that code: ${error.message}`);
  const peer = (Array.isArray(data) ? data[0] : null) as FriendCodeMatch | null;
  if (!peer) return { kind: 'not_found' };
  if (peer.user_id === user.id) return { kind: 'self' };

  const { data: existing } = await supabase
    .from('im_friendships')
    .select('id, requester_id, status')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${peer.user_id}),and(requester_id.eq.${peer.user_id},addressee_id.eq.${user.id})`)
    .limit(1)
    .maybeSingle();
  const row = existing as { id: string; requester_id: string; status: FriendshipStatus } | null;

  if (row?.status === 'accepted') return { kind: 'friends', peer };
  if (row?.status === 'blocked') return { kind: 'not_found' };
  if (row?.status === 'pending' && row.requester_id === peer.user_id) {
    await respondToFriendRequest(row.id, true);
    return { kind: 'accepted', peer };
  }
  if (row) return { kind: 'already_requested', peer };

  await sendFriendRequest(peer.user_id, 'Added you with your friend code');
  return { kind: 'requested', peer };
}

// ----------------------------------------------------------------------------
// Friend request actions
// ----------------------------------------------------------------------------

export async function sendFriendRequest(
  otherUserId: string,
  introMessage?: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  if (user.id === otherUserId) throw new Error("Can't friend yourself");

  const trimmedIntro = introMessage?.trim() || null;
  const { error } = await supabase
    .from('im_friendships')
    .insert({
      requester_id: user.id,
      addressee_id: otherUserId,
      status: 'pending',
      intro_message: trimmedIntro,
    });
  if (error) {
    // Unique-pair index may fire if a row already exists in any state.
    if (error.code === '23505') return;
    throw new Error(`Failed to send request: ${error.message}`);
  }
}

export async function respondToFriendRequest(friendshipId: string, accept: boolean): Promise<void> {
  const { error } = await supabase
    .from('im_friendships')
    .update({
      status: accept ? 'accepted' : 'declined',
      accepted_at: accept ? new Date().toISOString() : null,
    })
    .eq('id', friendshipId);
  if (error) throw new Error(`Failed to respond: ${error.message}`);
}

export async function cancelFriendRequest(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('im_friendships').delete().eq('id', friendshipId);
  if (error) throw new Error(`Failed to cancel request: ${error.message}`);
}

export async function unfriend(friendshipId: string): Promise<void> {
  const { error } = await supabase.from('im_friendships').delete().eq('id', friendshipId);
  if (error) throw new Error(`Failed to unfriend: ${error.message}`);
}

export async function blockUser(otherUserId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('im_blocks')
    .insert({ blocker_id: user.id, blocked_id: otherUserId });
  if (error && error.code !== '23505') {
    throw new Error(`Failed to block: ${error.message}`);
  }
}

export async function unblockUser(otherUserId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  const { error } = await supabase
    .from('im_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', otherUserId);
  if (error) throw new Error(`Failed to unblock: ${error.message}`);
}

// ----------------------------------------------------------------------------
// Discovery — find people by shared interests
// ----------------------------------------------------------------------------

export async function getDiscoverySuggestions(limit = 24): Promise<DiscoveryProfile[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: me } = await supabase
    .from('im_discovery_profiles')
    .select('interests')
    .maybeSingle();

  const myInterests = (me?.interests as string[]) ?? [];

  const { data, error } = await supabase
    .from('im_discovery_profiles')
    .select('user_id, display_name, avatar_url, headline, alias, age_range, intro, interests, discoverable, available_to_chat')
    .eq('discoverable', true)
    .neq('user_id', user.id)
    .limit(limit);
  if (error) throw new Error(`Failed to load suggestions: ${error.message}`);
  if (!data) return [];

  const otherUserIds = (data as any[]).map(d => d.user_id);
  const [friendRows, blockRows, presenceRows] = await Promise.all([
    supabase
      .from('im_friendships')
      .select('id, requester_id, addressee_id, status')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .in('status', ['pending', 'accepted', 'blocked']),
    supabase
      .from('im_blocks')
      .select('blocked_id')
      .eq('blocker_id', user.id),
    supabase
      .from('im_presence')
      .select('user_id, is_online, last_seen_at, available_to_chat')
      .in('user_id', otherUserIds),
  ]);

  const friendSet = new Set<string>();
  const pendingSet = new Set<string>();
  (friendRows.data ?? []).forEach((f: any) => {
    const peer = f.requester_id === user.id ? f.addressee_id : f.requester_id;
    if (f.status === 'accepted') friendSet.add(peer);
    if (f.status === 'pending') pendingSet.add(peer);
  });
  const blockedByMe = new Set((blockRows.data ?? []).map((b: any) => b.blocked_id));
  const presenceMap = new Map((presenceRows.data ?? []).map((p: any) => [p.user_id, p]));
  const mySet = new Set(myInterests.map(s => s.toLowerCase()));

  return (data as any[])
    .filter(d => !friendSet.has(d.user_id) && !blockedByMe.has(d.user_id))
    .map(d => {
      const theirInterests: string[] = d.interests ?? [];
      const shared = theirInterests.filter(i => mySet.has(String(i).toLowerCase()));
      const pres = presenceMap.get(d.user_id);
      return {
        user_id: d.user_id,
        display_name: d.display_name || 'Anonymous',
        avatar_url: d.avatar_url ?? null,
        headline: d.headline ?? null,
        alias: d.alias ?? null,
        age_range: d.age_range ?? null,
        intro: d.intro ?? null,
        interests: theirInterests,
        discoverable: d.discoverable,
        available_to_chat: pres?.available_to_chat ?? false,
        shared_interests: shared,
        already_friends: false,
        request_pending: pendingSet.has(d.user_id),
        is_online: pres?.is_online ?? false,
      };
    })
    .sort((a, b) => {
      // Available now first, then most shared interests, then alphabetical.
      if (!!b.available_to_chat !== !!a.available_to_chat) {
        return a.available_to_chat ? -1 : 1;
      }
      if (b.shared_interests.length !== a.shared_interests.length) {
        return b.shared_interests.length - a.shared_interests.length;
      }
      return a.display_name.localeCompare(b.display_name);
    });
}

// ----------------------------------------------------------------------------
// Conversations
// ----------------------------------------------------------------------------

export async function getOrCreateConversation(otherUserId: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('im_get_or_create_conversation', {
    other_user: otherUserId,
  });
  if (error) {
    throw new Error(`Failed to open conversation: ${error.message}`);
  }
  return (data as string) ?? null;
}

export async function getConversationList(): Promise<ConversationSummary[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('im_conversations')
    .select('id, user_a_id, user_b_id, last_message_at')
    .or(`user_a_id.eq.${user.id},user_b_id.eq.${user.id}`)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (error) throw new Error(`Failed to load conversations: ${error.message}`);
  if (!data || data.length === 0) return [];

  const convs = data as any[];
  const peerIds = convs.map(c => (c.user_a_id === user.id ? c.user_b_id : c.user_a_id));

  const [profiles, presence, lastMessages, unread] = await Promise.all([
    supabase.from('im_discovery_profiles').select('user_id, display_name, avatar_url').in('user_id', peerIds),
    supabase.from('im_presence').select('user_id, is_online, last_seen_at').in('user_id', peerIds),
    Promise.all(convs.map(async c => {
      const { data: lm } = await supabase
        .from('im_messages')
        .select('content, created_at')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return { conv_id: c.id, last: lm as any };
    })),
    Promise.all(convs.map(async c => {
      const { count, error: ce } = await supabase
        .from('im_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .neq('sender_id', user.id)
        .is('read_at', null);
      if (ce) return { conv_id: c.id, count: 0 };
      return { conv_id: c.id, count: count ?? 0 };
    })),
  ]);

  const profileMap = new Map((profiles.data ?? []).map((p: any) => [p.user_id, p]));
  const presenceMap = new Map((presence.data ?? []).map((p: any) => [p.user_id, p]));
  const lastMap = new Map(lastMessages.map(l => [l.conv_id, l.last]));
  const unreadMap = new Map(unread.map(u => [u.conv_id, u.count]));
  const names = await displayNames(peerIds.filter(id => !profileMap.get(id)?.display_name));

  return convs.map(c => {
    const peerId = c.user_a_id === user.id ? c.user_b_id : c.user_a_id;
    const profile = profileMap.get(peerId);
    const pres = presenceMap.get(peerId);
    const last = lastMap.get(c.id);
    return {
      id: c.id,
      peer_id: peerId,
      peer_name: profile?.display_name ?? names.get(peerId) ?? 'Anonymous',
      peer_avatar_url: profile?.avatar_url ?? null,
      last_message: last?.content ?? null,
      last_message_at: last?.created_at ?? c.last_message_at ?? null,
      unread_count: unreadMap.get(c.id) ?? 0,
      is_online: pres?.is_online ?? false,
      last_seen_at: pres?.last_seen_at ?? null,
    };
  });
}

// ----------------------------------------------------------------------------
// Messages
// ----------------------------------------------------------------------------

export async function getMessages(conversationId: string, limit = 100): Promise<DirectMessage[]> {
  const { data, error } = await supabase
    .from('im_messages')
    .select('id, conversation_id, sender_id, content, read_at, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return (data ?? []) as DirectMessage[];
}

export async function sendMessage(conversationId: string, content: string): Promise<DirectMessage | null> {
  const { data, error } = await supabase
    .from('im_messages')
    .insert({ conversation_id: conversationId, content })
    .select('id, conversation_id, sender_id, content, read_at, created_at')
    .maybeSingle();
  if (error) throw new Error(`Failed to send message: ${error.message}`);

  // Keep last_message_at fresh for conversation list ordering.
  await supabase
    .from('im_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data as DirectMessage | null;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('im_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', user.id)
    .is('read_at', null);
  if (error) throw new Error(`Failed to mark read: ${error.message}`);
}

// ----------------------------------------------------------------------------
// Typing indicator
// ----------------------------------------------------------------------------

export async function setTyping(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('im_typing')
    .upsert(
      { conversation_id: conversationId, last_typed_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) throw new Error(`Failed to set typing: ${error.message}`);
}

export async function clearTyping(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from('im_typing')
    .delete()
    .eq('conversation_id', conversationId);
  // Row may not exist; ignore "not found".
  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to clear typing: ${error.message}`);
  }
}

export async function getPeerTyping(conversationId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from('im_typing')
    .select('user_id, last_typed_at')
    .eq('conversation_id', conversationId)
    .neq('user_id', user.id);
  if (error || !data || data.length === 0) return false;
  const cutoff = Date.now() - 4000; // typing expires after 4s of silence
  return data.some((t: any) => new Date(t.last_typed_at).getTime() > cutoff);
}

// ----------------------------------------------------------------------------
// Presence
// ----------------------------------------------------------------------------

export async function setOnline(isOnline: boolean): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('im_presence')
    .upsert(
      { is_online: isOnline, last_seen_at: now, updated_at: now },
      { onConflict: 'user_id' },
    );
  if (error) throw new Error(`Failed to update presence: ${error.message}`);
}

export async function setAvailableToChat(available: boolean): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('im_presence')
    .upsert(
      { available_to_chat: available, updated_at: now },
      { onConflict: 'user_id' },
    );
  if (error) throw new Error(`Failed to update availability: ${error.message}`);
}
