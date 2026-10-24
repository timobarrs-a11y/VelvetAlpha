import { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  MessageSquare,
  UserPlus,
  Search,
  X,
  Send,
  ArrowLeft,
  Check,
  Clock,
  Sparkles,
  CircleDot,
  Settings2,
  VenetianMask,
  EyeOff,
  Minus,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '../shared/supabase/client';
import { FriendCodeCard } from './FriendCodeCard';
import { useAuth } from '../auth/AuthProvider';
import {
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  getDiscoverySuggestions,
  getConversationList,
  getMessages,
  sendMessage as sendDM,
  markConversationRead,
  getOrCreateConversation,
  sendFriendRequest,
  respondToFriendRequest,
  cancelFriendRequest,
  unfriend as unfriendDb,
  blockUser,
  setTyping,
  clearTyping,
  setAvailableToChat as pushAvailability,
  getMyDiscoveryProfile,
  upsertMyDiscoveryProfile,
  setMyDiscoveryIdentity,
  syncDiscoveryFromProfile,
  AGE_RANGES,
  type FriendPeer,
  type Presence,
  type DiscoveryProfile,
  type ConversationSummary,
  type DirectMessage,
} from '../shared/supabase/queries/messaging';
import {
  getVelvetRopeEnabled,
  setVelvetRopeEnabled,
  getIncomingVRRequests,
  getVRConversationList,
  getVRMessages,
  sendVRMessage,
  markVRConversationRead,
  acceptVRRequest,
  declineVRRequest,
  closeVRConversation,
  requestAIVelvetRopeOpener,
  requestAIVelvetRopeReply,
  enterVelvetRopeQueue,
  leaveVelvetRopeQueue,
  tryVelvetRopeMatch,
  type VRRequest,
  type VRConversationSummary,
  type VRMessage,
} from '../shared/supabase/queries/velvetRope';

type View = 'friends' | 'conversations' | 'discover' | 'requests' | 'settings' | 'chat' | 'vr-chat';

interface ChatTarget {
  conversationId: string;
  peerId: string;
  peerName: string;
  peerAvatarUrl: string | null;
}

interface VRChatTarget {
  conversationId: string;
  peerHandle: string;
  matchType: 'ai' | 'human';
  status: 'active' | 'closed';
}

const INTEREST_SUGGESTIONS = [
  'music', 'gaming', 'movies', 'books', 'art', 'fitness', 'cooking',
  'travel', 'tech', 'fashion', 'photography', 'writing', 'anime', 'sports',
  'dogs', 'cats', 'coffee', 'hiking', 'design', 'coding', 'yoga', 'dance',
];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function PeerAvatar({ name, avatarUrl, size = 40, online }: { name: string; avatarUrl: string | null; size?: number; online?: boolean }) {
  if (avatarUrl) {
    return (
      <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <img
          src={avatarUrl}
          alt={name}
          className="rounded-full object-cover w-full h-full border border-white/10"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
        {online !== undefined && (
          <span
            className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
            style={{
              width: size * 0.28,
              height: size * 0.28,
              background: online ? '#22c55e' : '#6b7280',
              borderColor: 'var(--ds-surface, #1a1a2e)',
            }}
          />
        )}
      </div>
    );
  }
  return (
    <div
      className="relative flex-shrink-0 rounded-full flex items-center justify-center text-white font-semibold"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #f43f5e, #ec4899)',
        fontSize: size * 0.36,
      }}
    >
      {initialsFromName(name)}
      {online !== undefined && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-full border-2"
          style={{
            width: size * 0.28,
            height: size * 0.28,
            background: online ? '#22c55e' : '#6b7280',
            borderColor: 'var(--ds-surface, #1a1a2e)',
          }}
        />
      )}
    </div>
  );
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function MessagingOverlay({ onClose, onMinimize, embedded = false, initialView = 'conversations', initialFriendCode = null }: { onClose: () => void; onMinimize?: () => void; embedded?: boolean; initialView?: View; initialFriendCode?: string | null }) {
  const { user } = useAuth();
  const [view, setView] = useState<View>(initialView);
  const [friends, setFriends] = useState<FriendPeer[]>([]);
  const [incoming, setIncoming] = useState<FriendPeer[]>([]);
  const [outgoing, setOutgoing] = useState<FriendPeer[]>([]);
  const [discovery, setDiscovery] = useState<DiscoveryProfile[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [chatTarget, setChatTarget] = useState<ChatTarget | null>(null);
  const [vrEnabled, setVrEnabled] = useState(false);
  const [vrToggling, setVrToggling] = useState(false);
  const [vrRequests, setVrRequests] = useState<VRRequest[]>([]);
  const [vrConversations, setVrConversations] = useState<VRConversationSummary[]>([]);
  const [vrChatTarget, setVrChatTarget] = useState<VRChatTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [f, i, o, d, c, vrEn, vrReq, vrConv] = await Promise.all([
        getFriends().catch(() => [] as FriendPeer[]),
        getIncomingRequests().catch(() => [] as FriendPeer[]),
        getOutgoingRequests().catch(() => [] as FriendPeer[]),
        getDiscoverySuggestions().catch(() => [] as DiscoveryProfile[]),
        getConversationList().catch(() => [] as ConversationSummary[]),
        getVelvetRopeEnabled().catch(() => false),
        getIncomingVRRequests().catch(() => [] as VRRequest[]),
        getVRConversationList().catch(() => [] as VRConversationSummary[]),
      ]);
      setFriends(f);
      setIncoming(i);
      setOutgoing(o);
      setDiscovery(d);
      setConversations(c);
      setVrEnabled(vrEn);
      setVrRequests(vrReq);
      setVrConversations(vrConv);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Buddy list stays live: presence changes arrive over realtime, and a poll
  // catches friends drifting to away or offline (no write marks that).
  useEffect(() => {
    if (!user) return;
    const reloadFriends = () => { getFriends().then(setFriends).catch(() => {}); };
    const channel = supabase
      .channel(`buddy-presence-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'im_presence' }, reloadFriends)
      .subscribe();
    const poll = setInterval(reloadFriends, 30000);
    return () => { clearInterval(poll); supabase.removeChannel(channel); };
  }, [user]);

  const handleOpenConversation = useCallback(async (peer: { user_id: string; display_name: string; avatar_url: string | null }) => {
    if (!user) return;
    setError(null);
    try {
      const convId = await getOrCreateConversation(peer.user_id);
      if (!convId) {
        setError('Could not open conversation');
        return;
      }
      setChatTarget({
        conversationId: convId,
        peerId: peer.user_id,
        peerName: peer.display_name,
        peerAvatarUrl: peer.avatar_url,
      });
      setView('chat');
      await markConversationRead(convId).catch(() => {});
      // Refresh conversation list so unread counts update.
      getConversationList().then(setConversations).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to open chat');
    }
  }, [user]);

  const handleSendRequest = useCallback(async (otherUserId: string, introMessage?: string) => {
    setError(null);
    try {
      await sendFriendRequest(otherUserId, introMessage);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send request');
    }
  }, [refreshAll]);

  const handleRespond = useCallback(async (friendshipId: string, accept: boolean): Promise<boolean> => {
    setError(null);
    try {
      await respondToFriendRequest(friendshipId, accept);
      await refreshAll();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to respond');
      return false;
    }
  }, [refreshAll]);

  const handleCancel = useCallback(async (friendshipId: string) => {
    setError(null);
    try {
      await cancelFriendRequest(friendshipId);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel');
    }
  }, [refreshAll]);

  const handleUnfriend = useCallback(async (friendshipId: string) => {
    if (!confirm('Remove this friend? Your message history will stay.')) return;
    setError(null);
    try {
      await unfriendDb(friendshipId);
      setChatTarget(null);
      setView('friends');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to unfriend');
    }
  }, [refreshAll]);

  const handleBlock = useCallback(async (otherUserId: string) => {
    setError(null);
    try {
      await blockUser(otherUserId);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to block user');
    }
  }, [refreshAll]);

  const handleToggleVelvetRope = useCallback(async (enabled: boolean) => {
    setVrToggling(true);
    setError(null);
    try {
      await setVelvetRopeEnabled(enabled);
      setVrEnabled(enabled);
      if (!enabled) {
        await leaveVelvetRopeQueue().catch(() => {});
      }
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle Velvet Rope');
    } finally {
      setVrToggling(false);
    }
  }, [refreshAll]);

  const handleAcceptVRRequest = useCallback(async (requestId: string) => {
    setError(null);
    try {
      await acceptVRRequest(requestId);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to accept Velvet Rope request');
    }
  }, [refreshAll]);

  const handleDeclineVRRequest = useCallback(async (requestId: string) => {
    setError(null);
    try {
      await declineVRRequest(requestId);
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to decline Velvet Rope request');
    }
  }, [refreshAll]);

  const handleOpenVRConversation = useCallback(async (conv: VRConversationSummary) => {
    setError(null);
    setVrChatTarget({
      conversationId: conv.id,
      peerHandle: conv.peer_handle,
      matchType: conv.match_type,
      status: conv.status,
    });
    setView('vr-chat');
    await markVRConversationRead(conv.id).catch(() => {});
    getVRConversationList().then(setVrConversations).catch(() => {});
  }, []);

  const handleCloseVRConversation = useCallback(async (conversationId: string) => {
    if (!confirm('Close this Velvet Rope conversation? You can be matched with someone new.')) return;
    setError(null);
    try {
      await closeVRConversation(conversationId);
      setVrChatTarget(null);
      setView('conversations');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to close Velvet Rope conversation');
    }
  }, [refreshAll]);

  // Matchmaking: while the toggle is on, try to fill whichever slot (human
  // or AI) is still open. A user can have one human + one AI conversation
  // active simultaneously. The 5-minute AI gate is enforced server-side.
  useEffect(() => {
    if (!user || !vrEnabled) return;
    // Count active conversations by type.
    const activeHuman = vrConversations.filter(c => c.status === 'active' && c.match_type === 'human').length;
    const activeAI = vrConversations.filter(c => c.status === 'active' && c.match_type === 'ai').length;
    const pendingHuman = vrRequests.filter(r => r.match_type === 'human').length;
    const pendingAI = vrRequests.filter(r => r.match_type === 'ai').length;
    // If both slots are filled (active or pending), stop polling.
    if ((activeHuman > 0 || pendingHuman > 0) && (activeAI > 0 || pendingAI > 0)) return;
    let cancelled = false;

    const tryMatch = async () => {
      if (cancelled) return;
      try {
        // If the human slot is open, enter the queue and try to pair.
        if (activeHuman === 0 && pendingHuman === 0) {
          await enterVelvetRopeQueue().catch(() => {});
          if (cancelled) return;
          const matchId = await tryVelvetRopeMatch().catch(() => null);
          if (matchId && !cancelled) {
            await refreshAll();
            return;
          }
        }
        if (cancelled) return;
        // If the AI slot is open, try an AI opponent (server re-checks the
        // 5-minute gate).
        if (activeAI === 0 && pendingAI === 0) {
          const aiResult = await requestAIVelvetRopeOpener().catch(() => null);
          if (aiResult && !cancelled) {
            await refreshAll();
          }
        }
      } catch {
        // Silently ignore — will retry next interval.
      }
    };

    const initial = setTimeout(tryMatch, 10000);
    const interval = setInterval(tryMatch, 45000);
    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [user, vrEnabled, vrRequests, vrConversations, refreshAll]);

  const onlineCount = friends.filter(f => f.presence === 'online').length;
  const filteredFriends = friends.filter(f =>
    f.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (f.alias ?? '').toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const filteredDiscovery = discovery.filter(d =>
    d.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.alias ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.interests.some(i => i.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const incomingCount = incoming.length;
  const vrUnread = vrConversations.reduce((sum, c) => sum + c.unread_count, 0);
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0) + vrUnread;
  const totalRequestBadge = incomingCount + vrRequests.length;

  const TabButton = ({ id, label, icon: Icon, badge }: { id: View; label: string; icon: any; badge?: number }) => (
    <button
      onClick={() => { setView(id); setChatTarget(null); }}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
        view === id ? 'bg-white/10 text-ink' : 'text-ink-muted hover:text-ink hover:bg-white/5'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="hidden sm:inline">{label}</span>
      {!!badge && badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={embedded
        ? 'relative z-40 flex h-full w-full items-stretch justify-end'
        : 'fixed inset-0 z-[60] flex items-stretch sm:items-end sm:justify-end bg-black/60 p-0 backdrop-blur-sm sm:p-4'}
      onClick={embedded ? undefined : onClose}
    >
      <motion.div
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        className={embedded
          ? 'flex h-full w-full flex-col overflow-hidden'
          : 'flex h-full w-full flex-col overflow-hidden rounded-none border border-white/10 shadow-2xl sm:h-[min(720px,90vh)] sm:w-[420px] sm:rounded-2xl'}
        style={{ background: 'var(--ds-surface, #1a1a2e)', color: 'var(--ink, #fff)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-white/8 flex-shrink-0">
          {(view === 'chat' && chatTarget) || (view === 'vr-chat' && vrChatTarget) ? (
            <button
              onClick={() => { setView('conversations'); setChatTarget(null); setVrChatTarget(null); }}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
              title="Back"
            >
              <ArrowBackIcon />
            </button>
          ) : (
            <div className="p-1.5">
              <Sparkles className="w-5 h-5 text-rose-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-ink truncate">
              {view === 'chat' && chatTarget ? chatTarget.peerName
                : view === 'vr-chat' && vrChatTarget ? vrChatTarget.peerHandle
                : view === 'friends' ? 'Buddy List'
                : view === 'discover' ? 'Discover people'
                : view === 'requests' ? 'Friend requests'
                : view === 'settings' ? 'Your discovery card'
                : 'Messages'}
            </h2>
            <p className="text-[10px] text-ink-muted">
              {view === 'chat' && chatTarget ? 'Instant Messenger'
                : view === 'vr-chat' && vrChatTarget ? 'Velvet Rope'
                : 'Stay connected'}
            </p>
          </div>
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
              title="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs (hidden in chat views) + Velvet Rope toggle pill */}
        {view !== 'chat' && view !== 'vr-chat' && (
          <div className="flex items-center gap-1 px-2 py-2 border-b border-white/8 flex-shrink-0 overflow-x-auto">
            <TabButton id="conversations" label="Chats" icon={MessageSquare} badge={totalUnread} />
            <TabButton id="friends" label={onlineCount ? `Buddies · ${onlineCount}` : 'Buddies'} icon={Users} />
            <TabButton id="requests" label="Requests" icon={UserPlus} badge={totalRequestBadge} />
            <TabButton id="discover" label="Discover" icon={Search} />
            <TabButton id="settings" label="Profile" icon={Settings2} />
            <div className="flex-1" />
            {/* Velvet Rope toggle pill */}
            <button
              onClick={() => handleToggleVelvetRope(!vrEnabled)}
              disabled={vrToggling}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all flex-shrink-0 ${
                vrEnabled
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/5 text-ink-muted border border-white/8 hover:bg-white/10'
              }`}
              title={vrEnabled ? 'Velvet Rope is ON — click to turn off' : 'Turn on Velvet Rope to receive mystery requests'}
            >
              <VenetianMask className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Velvet Rope</span>
              <span className={`w-2 h-2 rounded-full ${vrEnabled ? 'bg-amber-400' : 'bg-white/20'}`} />
            </button>
          </div>
        )}

        {/* Search (for friends/discover) */}
        {(view === 'friends' || view === 'discover') && (
          <div className="px-3 py-2 border-b border-white/8 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={view === 'friends' ? 'Search friends...' : 'Search by name or interest...'}
                className="w-full bg-white/5 rounded-lg pl-8 pr-3 py-2 text-xs text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="mx-3 my-2 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          {loading && view !== 'chat' && (
            <div className="flex items-center justify-center py-12 text-ink-muted text-xs">Loading...</div>
          )}

          {(view === 'conversations' || view === 'friends') && (
            <FriendCodeCard
              initialCode={initialFriendCode}
              onChanged={refreshAll}
              onOpenChat={(peer) => handleOpenConversation({ user_id: peer.user_id, display_name: peer.display_name, avatar_url: peer.avatar_url })}
            />
          )}

          {view === 'conversations' && (
            <>
              <ConversationsView
                conversations={conversations}
                onOpen={(c) => handleOpenConversation({
                  user_id: c.peer_id,
                  display_name: c.peer_name,
                  avatar_url: c.peer_avatar_url,
                })}
                onRefresh={refreshAll}
              />
              {vrConversations.length > 0 && (
                <div className="pt-2">
                  <p className="px-3 pb-1 text-[10px] uppercase tracking-wider text-amber-400/80 font-semibold flex items-center gap-1">
                    <VenetianMask className="w-3 h-3" /> Velvet Rope
                  </p>
                  {vrConversations.map((vc) => (
                    <button
                      key={vc.id}
                      onClick={() => handleOpenVRConversation(vc)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-500/5 transition-colors text-left"
                    >
                      <div
                        className="relative flex-shrink-0 rounded-full flex items-center justify-center"
                        style={{ width: 44, height: 44, background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}
                      >
                        <VenetianMask className="w-5 h-5 text-amber-100" />
                        {vc.status === 'active' && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2" style={{ borderColor: 'var(--ds-surface, #1a1a2e)' }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-ink truncate">Velvet Rope</p>
                          <span className="text-[10px] text-ink-muted flex-shrink-0">{relativeTime(vc.last_message_at)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-ink-muted truncate">
                            {vc.status === 'closed' ? 'Ended' : (vc.last_message ?? 'No messages yet')}
                          </p>
                          {vc.unread_count > 0 && (
                            <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                              {vc.unread_count > 9 ? '9+' : vc.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {view === 'friends' && (
            <FriendsView
              friends={filteredFriends}
              onOpenChat={(f) => handleOpenConversation(f)}
              onUnfriend={handleUnfriend}
            />
          )}

          {view === 'requests' && (
            <>
              {vrRequests.length > 0 && (
                <div className="py-2">
                  <p className="px-3 pb-1 text-[10px] uppercase tracking-wider text-amber-400/80 font-semibold flex items-center gap-1">
                    <VenetianMask className="w-3 h-3" /> Velvet Rope
                  </p>
                  {vrRequests.map((vr) => (
                    <div key={vr.id} className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="relative flex-shrink-0 rounded-full flex items-center justify-center"
                          style={{ width: 42, height: 42, background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}
                        >
                          <VenetianMask className="w-5 h-5 text-amber-100" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink truncate flex items-center gap-1.5">
                            <EyeOff className="w-3 h-3 text-amber-400/70" />
                            {vr.masked_handle}
                          </p>
                          <p className="text-[11px] text-ink-muted truncate">
                            Velvet Rope · wants to play
                          </p>
                        </div>
                      </div>
                      {vr.opener_message && (
                        <div className="mt-2 rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-2">
                          <p className="text-[9px] uppercase tracking-wider text-amber-400/70 mb-1">Opener</p>
                          <p className="text-xs text-ink whitespace-pre-wrap break-words">{vr.opener_message}</p>
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={() => handleAcceptVRRequest(vr.id)}
                          className="flex-1 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-semibold transition-colors"
                        >
                          Play
                        </button>
                        <button
                          onClick={() => handleDeclineVRRequest(vr.id)}
                          className="px-3 py-1.5 rounded-lg text-xs text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <RequestsView
                incoming={incoming}
                outgoing={outgoing}
                onAccept={async (id) => {
                  // Accepting opens the chat with them straight away.
                  const peer = incoming.find(r => r.friendship_id === id);
                  if (await handleRespond(id, true) && peer) await handleOpenConversation(peer);
                }}
                onDecline={(id) => handleRespond(id, false)}
                onBlock={(uid) => handleBlock(uid)}
                onCancel={handleCancel}
              />
            </>
          )}

          {view === 'discover' && (
            <DiscoverView
              discovery={filteredDiscovery}
              onAdd={handleSendRequest}
            />
          )}

          {view === 'settings' && <DiscoverySettingsView onSaved={refreshAll} />}

          {view === 'chat' && chatTarget && (
            <ChatView target={chatTarget} onUnfriend={() => handleUnfriend(friends.find(f => f.user_id === chatTarget.peerId)?.friendship_id ?? '')} />
          )}

          {view === 'vr-chat' && vrChatTarget && (
            <VRChatView
              target={vrChatTarget}
              onClose={() => handleCloseVRConversation(vrChatTarget.conversationId)}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ArrowBackIcon() {
  return <ArrowLeft className="w-4 h-4" />;
}

// ---------------------------------------------------------------------------
// Conversations list
// ---------------------------------------------------------------------------
function ConversationsView({
  conversations,
  onOpen,
  onRefresh,
}: {
  conversations: ConversationSummary[];
  onOpen: (c: ConversationSummary) => void;
  onRefresh: () => void;
}) {
  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <MessageSquare className="w-6 h-6 text-ink-muted" />
        </div>
        <p className="text-sm text-ink font-medium">No conversations yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Add a friend or find someone in Discover to start chatting.
        </p>
        <button
          onClick={onRefresh}
          className="mt-4 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-ink transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }
  return (
    <div className="py-1">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onOpen(c)}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors text-left"
        >
          <PeerAvatar name={c.peer_name} avatarUrl={c.peer_avatar_url} size={44} online={c.is_online} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink truncate">{c.peer_name}</p>
              <span className="text-[10px] text-ink-muted flex-shrink-0">{relativeTime(c.last_message_at)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-ink-muted truncate">
                {c.last_message ?? 'No messages yet'}
              </p>
              {c.unread_count > 0 && (
                <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {c.unread_count > 9 ? '9+' : c.unread_count}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Friends list
// ---------------------------------------------------------------------------
function FriendsView({
  friends,
  onOpenChat,
  onUnfriend,
}: {
  friends: FriendPeer[];
  onOpenChat: (f: FriendPeer) => void;
  onUnfriend: (friendshipId: string) => void;
}) {
  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <Users className="w-6 h-6 text-ink-muted" />
        </div>
        <p className="text-sm text-ink font-medium">No friends yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Find people who share your interests in Discover.
        </p>
      </div>
    );
  }
  const groups: { key: Presence; label: string; people: FriendPeer[] }[] = [
    { key: 'online', label: 'Online', people: friends.filter(f => f.presence === 'online') },
    { key: 'away', label: 'Away', people: friends.filter(f => f.presence === 'away') },
    { key: 'offline', label: 'Offline', people: friends.filter(f => (f.presence ?? 'offline') === 'offline') },
  ];
  return (
    <div className="py-1">
      {groups.map(g => (
        <BuddyGroup key={g.key} group={g} onOpenChat={onOpenChat} onUnfriend={onUnfriend} />
      ))}
    </div>
  );
}

const PRESENCE_DOT: Record<Presence, string> = { online: '#22c55e', away: '#f59e0b', offline: '#6b7280' };

function BuddyGroup({
  group,
  onOpenChat,
  onUnfriend,
}: {
  group: { key: Presence; label: string; people: FriendPeer[] };
  onOpenChat: (f: FriendPeer) => void;
  onUnfriend: (friendshipId: string) => void;
}) {
  // Offline starts folded, like a buddy list; online and away start open.
  const [open, setOpen] = useState(group.key !== 'offline');
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted hover:text-ink"
        aria-expanded={open}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? '' : '-rotate-90'}`} />
        {group.label} ({group.people.length})
      </button>
      {open && group.people.map((f) => (
        <div key={f.user_id} className="group flex w-full items-center gap-2.5 px-3 py-1.5 hover:bg-white/5 transition-colors">
          <button type="button" onClick={() => onOpenChat(f)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left" title={`Message ${f.display_name}`}>
            <span className="relative flex-shrink-0">
              <PeerAvatar name={f.display_name} avatarUrl={f.avatar_url} size={32} />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2" style={{ background: PRESENCE_DOT[group.key], borderColor: 'var(--ds-surface, #1a1a2e)' }} />
            </span>
            <span className="min-w-0">
              <span className={`block truncate text-sm ${group.key === 'offline' ? 'text-ink-muted' : 'font-medium text-ink'}`}>{f.display_name}</span>
              <span className="block truncate text-[11px] text-ink-muted">
                {f.headline || (group.key === 'online' ? 'Online now' : group.key === 'away' ? `Away · active ${relativeTime(f.last_seen_at)}` : `Last seen ${relativeTime(f.last_seen_at)}`)}
              </span>
            </span>
          </button>
          <button
            onClick={() => onUnfriend(f.friendship_id)}
            className="p-1.5 rounded-lg text-ink-muted opacity-0 group-hover:opacity-100 hover:text-rose-400 hover:bg-white/5 transition"
            title="Unfriend"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------
function RequestsView({
  incoming,
  outgoing,
  onAccept,
  onDecline,
  onBlock,
  onCancel,
}: {
  incoming: FriendPeer[];
  outgoing: FriendPeer[];
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onBlock: (userId: string) => void;
  onCancel: (id: string) => void;
}) {
  if (incoming.length === 0 && outgoing.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <UserPlus className="w-6 h-6 text-ink-muted" />
        </div>
        <p className="text-sm text-ink font-medium">No connection requests</p>
        <p className="text-xs text-ink-muted mt-1">Find people to connect with in Discover.</p>
      </div>
    );
  }
  return (
    <div className="py-2">
      {incoming.length > 0 && (
        <>
          <p className="px-3 pb-1 text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Incoming</p>
          {incoming.map((r) => (
            <div key={r.friendship_id} className="px-3 py-2.5">
              <div className="flex items-center gap-3">
                <PeerAvatar name={r.display_name} avatarUrl={r.avatar_url} size={42} online={r.is_online} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {r.alias ? `@${r.alias}` : r.display_name}
                  </p>
                  <p className="text-[11px] text-ink-muted truncate">
                    {r.age_range ? `${r.age_range} · ` : ''}{r.headline || 'Wants to connect'}
                  </p>
                </div>
              </div>
              {r.intro_message && (
                <div className="mt-2 rounded-xl bg-white/5 border border-white/8 px-3 py-2">
                  <p className="text-[9px] uppercase tracking-wider text-ink-muted mb-1">Intro</p>
                  <p className="text-xs text-ink whitespace-pre-wrap break-words">{r.intro_message}</p>
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => onAccept(r.friendship_id)}
                  className="flex-1 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 text-xs font-semibold transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={() => onDecline(r.friendship_id)}
                  className="px-3 py-1.5 rounded-lg text-xs text-ink-muted hover:text-ink hover:bg-white/5 transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={() => onBlock(r.user_id)}
                  className="px-3 py-1.5 rounded-lg text-xs text-ink-muted hover:text-rose-300 hover:bg-white/5 transition-colors"
                >
                  Block
                </button>
              </div>
            </div>
          ))}
        </>
      )}
      {outgoing.length > 0 && (
        <>
          <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-ink-muted font-semibold">Sent</p>
          {outgoing.map((r) => (
            <div key={r.friendship_id} className="flex items-center gap-3 px-3 py-2.5">
              <PeerAvatar name={r.display_name} avatarUrl={r.avatar_url} size={40} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {r.alias ? `@${r.alias}` : r.display_name}
                </p>
                <p className="text-[11px] text-ink-muted flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Waiting for response
                </p>
              </div>
              <button
                onClick={() => onCancel(r.friendship_id)}
                className="px-2 py-1 rounded-lg text-xs text-ink-muted hover:text-rose-400 hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discover
// ---------------------------------------------------------------------------
function DiscoverView({
  discovery,
  onAdd,
}: {
  discovery: DiscoveryProfile[];
  onAdd: (userId: string, intro?: string) => void;
}) {
  const [introTarget, setIntroTarget] = useState<string | null>(null);
  const [introText, setIntroText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = (userId: string) => {
    setSending(true);
    onAdd(userId, introText.trim() || undefined);
    setSending(false);
    setIntroTarget(null);
    setIntroText('');
  };

  if (discovery.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-3">
          <Search className="w-6 h-6 text-ink-muted" />
        </div>
        <p className="text-sm text-ink font-medium">No one to discover yet</p>
        <p className="text-xs text-ink-muted mt-1">
          Set up your discovery card and add interests to find people you'd click with.
        </p>
      </div>
    );
  }
  return (
    <div className="py-2 space-y-2 px-3">
      {discovery.map((d) => {
        const expanded = introTarget === d.user_id;
        return (
          <div
            key={d.user_id}
            className="rounded-xl border border-white/8 bg-white/3 p-3"
          >
            <div className="flex items-center gap-3">
              <PeerAvatar name={d.display_name} avatarUrl={d.avatar_url} size={42} online={d.is_online} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {d.alias ? `@${d.alias}` : d.display_name}
                  </p>
                  {d.available_to_chat && (
                    <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                      <CircleDot className="w-2.5 h-2.5" /> Available
                    </span>
                  )}
                </div>
                {d.headline && <p className="text-[11px] text-ink-muted truncate">{d.headline}</p>}
                {(d.age_range || d.intro) && (
                  <p className="text-[10px] text-ink-muted truncate">
                    {d.age_range ? `${d.age_range}` : ''}{d.age_range && d.intro ? ' · ' : ''}{d.intro ?? ''}
                  </p>
                )}
              </div>
              {expanded ? (
                <button
                  onClick={() => { setIntroTarget(null); setIntroText(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-ink-muted hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
              ) : (
                <button
                  onClick={() => onAdd(d.user_id, undefined)}
                  disabled={d.request_pending}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    d.request_pending
                      ? 'bg-white/5 text-ink-muted cursor-not-allowed'
                      : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                  }`}
                >
                  {d.request_pending ? 'Sent' : 'Connect'}
                </button>
              )}
            </div>
            {d.interests.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {d.interests.slice(0, 8).map((tag) => {
                  const shared = d.shared_interests.some(
                    s => s.toLowerCase() === tag.toLowerCase(),
                  );
                  return (
                    <span
                      key={tag}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        shared
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-white/5 text-ink-muted border border-white/8'
                      }`}
                    >
                      {tag}
                    </span>
                  );
                })}
              </div>
            )}
            {d.shared_interests.length > 0 && (
              <p className="text-[10px] text-rose-300/80 mt-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {d.shared_interests.length} shared {d.shared_interests.length === 1 ? 'interest' : 'interests'}
              </p>
            )}
            {expanded && (
              <div className="mt-2.5 space-y-2">
                <textarea
                  value={introText}
                  onChange={(e) => setIntroText(e.target.value)}
                  placeholder="Write a short intro (optional)"
                  rows={3}
                  maxLength={280}
                  className="w-full bg-white/5 rounded-lg px-3 py-2 text-xs text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors resize-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-ink-muted">{introText.length}/280</span>
                  <button
                    onClick={() => handleSend(d.user_id)}
                    disabled={sending}
                    className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 disabled:opacity-50 transition-colors"
                  >
                    Send request
                  </button>
                </div>
              </div>
            )}
            {!expanded && !d.request_pending && (
              <button
                onClick={() => setIntroTarget(d.user_id)}
                className="mt-2 text-[10px] text-rose-300/80 hover:text-rose-200 transition-colors"
              >
                Add an intro message
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discovery settings — your public card
// ---------------------------------------------------------------------------
function DiscoverySettingsView({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [alias, setAlias] = useState('');
  const [ageRange, setAgeRange] = useState<string>('');
  const [intro, setIntro] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [discoverable, setDiscoverable] = useState(false);
  const [availableToChat, setAvailableToChat] = useState(false);
  const [customInterest, setCustomInterest] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      try {
        const profile = await getMyDiscoveryProfile();
        if (profile) {
          setDisplayName(profile.display_name ?? '');
          setHeadline(profile.headline ?? '');
          setAlias(profile.alias ?? '');
          setAgeRange(profile.age_range ?? '');
          setIntro(profile.intro ?? '');
          setAvatarUrl(profile.avatar_url ?? null);
          setInterests(profile.interests ?? []);
          setDiscoverable(profile.discoverable ?? false);
          setAvailableToChat(profile.available_to_chat ?? false);
        } else {
          // Bootstrap from user_profiles so the user doesn't start empty.
          const { data: up } = await supabase
            .from('user_profiles')
            .select('name, interests, avatar_config')
            .eq('id', user.id)
            .maybeSingle();
          if (up) {
            setDisplayName(up.name ?? '');
            setInterests((up.interests as string[]) ?? []);
            await syncDiscoveryFromProfile({
              name: up.name,
              interests: up.interests as string[] | null,
            }).catch(() => {});
          }
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
  }, [user]);

  const toggleInterest = (tag: string) => {
    setInterests(prev =>
      prev.some(i => i.toLowerCase() === tag.toLowerCase())
        ? prev.filter(i => i.toLowerCase() !== tag.toLowerCase())
        : [...prev, tag],
    );
  };

  const addCustomInterest = () => {
    const t = customInterest.trim().toLowerCase();
    if (!t) return;
    if (interests.some(i => i.toLowerCase() === t)) {
      setCustomInterest('');
      return;
    }
    setInterests(prev => [...prev, t]);
    setCustomInterest('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg(null);
    setLoadError(null);
    try {
      const trimmedAlias = alias.trim().toLowerCase();
      if (trimmedAlias) {
        await setMyDiscoveryIdentity(trimmedAlias, ageRange || null);
      }
      await upsertMyDiscoveryProfile({
        display_name: displayName.trim() || 'Anonymous',
        headline: headline.trim() || null,
        avatar_url: avatarUrl,
        interests,
        discoverable,
        intro: intro.trim() || null,
        available_to_chat: availableToChat,
      });
      if (availableToChat) pushAvailability(true).catch(() => {});
      setSavedMsg('Saved');
      setTimeout(() => setSavedMsg(null), 2500);
      onSaved();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {loadError && (
        <div className="px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          {loadError}
        </div>
      )}

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
          Alias (public handle)
        </label>
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="e.g. luna_77"
          maxLength={20}
          className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
        />
        <p className="mt-1 text-[10px] text-ink-muted">3–20 characters: letters, numbers, underscore, hyphen. This is how you'll appear in chat.</p>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
          Age range
        </label>
        <div className="flex flex-wrap gap-1.5">
          {AGE_RANGES.map(range => (
            <button
              key={range}
              onClick={() => setAgeRange(ageRange === range ? '' : range)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                ageRange === range
                  ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                  : 'bg-white/5 text-ink-muted border border-white/8 hover:bg-white/10'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-ink-muted">Only a range is shown — never your exact birth date.</p>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
          Display name
        </label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How others see you"
          className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
          Headline
        </label>
        <input
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="A one-line intro"
          className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
        />
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-ink-muted font-semibold mb-1">
          Short intro
        </label>
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder="A few sentences about you"
          rows={3}
          maxLength={280}
          className="w-full bg-white/5 rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors resize-none"
        />
        <p className="mt-1 text-[10px] text-ink-muted">{intro.length}/280</p>
      </div>

      <div>
        <label className="block text-[11px] uppercase tracking-wider text-ink-muted font-semibold mb-2">
          Your interests
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {INTEREST_SUGGESTIONS.map((tag) => {
            const active = interests.some(i => i.toLowerCase() === tag.toLowerCase());
            return (
              <button
                key={tag}
                onClick={() => toggleInterest(tag)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  active
                    ? 'bg-rose-500/25 text-rose-200 border border-rose-500/40'
                    : 'bg-white/5 text-ink-muted border border-white/8 hover:bg-white/10'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            value={customInterest}
            onChange={(e) => setCustomInterest(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustomInterest()}
            placeholder="Add your own..."
            className="flex-1 bg-white/5 rounded-lg px-3 py-1.5 text-xs text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
          />
          <button
            onClick={addCustomInterest}
            disabled={!customInterest.trim()}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-ink disabled:opacity-40 transition-colors"
          >
            Add
          </button>
        </div>
        {interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {interests.filter(i => !INTEREST_SUGGESTIONS.some(s => s.toLowerCase() === i.toLowerCase())).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-[10px] bg-rose-500/15 text-rose-200 border border-rose-500/30 flex items-center gap-1"
              >
                {tag}
                <button onClick={() => toggleInterest(tag)} className="opacity-70 hover:opacity-100">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <button
          onClick={() => setDiscoverable(!discoverable)}
          className={`relative w-10 h-6 rounded-full transition-colors ${discoverable ? 'bg-rose-500' : 'bg-white/10'}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${discoverable ? 'translate-x-4' : 'translate-x-0.5'}`}
          />
        </button>
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">Let others discover me</p>
          <p className="text-[11px] text-ink-muted">Only people you accept as friends can message you.</p>
        </div>
      </label>

      <label className="flex items-center gap-3 cursor-pointer">
        <button
          onClick={() => setAvailableToChat(!availableToChat)}
          className={`relative w-10 h-6 rounded-full transition-colors ${availableToChat ? 'bg-emerald-500' : 'bg-white/10'}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${availableToChat ? 'translate-x-4' : 'translate-x-0.5'}`}
          />
        </button>
        <div className="flex-1">
          <p className="text-sm font-medium text-ink">Available to chat</p>
          <p className="text-[11px] text-ink-muted">Show an “Available” badge so people online know you're open to talk.</p>
        </div>
      </label>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? 'Saving...' : savedMsg ? <><Check className="w-4 h-4" /> {savedMsg}</> : 'Save card'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat view
// ---------------------------------------------------------------------------
function ChatView({ target, onUnfriend }: { target: ChatTarget; onUnfriend: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [peerTyping, setPeerTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingPingRef = useRef<number>(0);

  // Load history
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const msgs = await getMessages(target.conversationId);
        setMessages(msgs);
        await markConversationRead(target.conversationId).catch(() => {});
      } catch (e) {
        setSendError(e instanceof Error ? e.message : 'Failed to load messages');
      } finally {
        setLoading(false);
      }
    })();
  }, [target.conversationId]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`im-chat-${target.conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'im_messages',
          filter: `conversation_id=eq.${target.conversationId}`,
        },
        (payload) => {
          const msg = payload.new as DirectMessage;
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.sender_id !== user?.id) {
            markConversationRead(target.conversationId).catch(() => {});
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'im_messages',
          filter: `conversation_id=eq.${target.conversationId}`,
        },
        (payload) => {
          const updated = payload.new as DirectMessage;
          setMessages(prev => prev.map(m => (m.id === updated.id ? updated : m)));
        },
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [target.conversationId, user?.id]);

  // Realtime subscription for typing
  useEffect(() => {
    if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
    const channel = supabase
      .channel(`im-typing-${target.conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'im_typing',
          filter: `conversation_id=eq.${target.conversationId}`,
        },
        (payload) => {
          const row = payload.new as { user_id: string; last_typed_at: string } | null;
          if (!row) {
            setPeerTyping(false);
            return;
          }
          if (row.user_id === user?.id) return;
          const age = Date.now() - new Date(row.last_typed_at).getTime();
          if (age < 4000) {
            setPeerTyping(true);
            lastTypingPingRef.current = Date.now();
            setTimeout(() => {
              if (Date.now() - lastTypingPingRef.current >= 3900) setPeerTyping(false);
            }, 4000);
          } else {
            setPeerTyping(false);
          }
        },
      )
      .subscribe();
    typingChannelRef.current = channel;

    return () => {
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current);
        typingChannelRef.current = null;
      }
    };
  }, [target.conversationId, user?.id]);

  // Clear typing on unmount
  useEffect(() => {
    return () => {
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
      clearTyping(target.conversationId).catch(() => {});
    };
  }, [target.conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping]);

  const handleInput = (value: string) => {
    setInput(value);
    if (!user) return;
    const now = Date.now();
    if (now - lastTypingPingRef.current > 2000 || value.length === 0) {
      if (value.length > 0) {
        setTyping(target.conversationId).catch(() => {});
        lastTypingPingRef.current = now;
      } else {
        clearTyping(target.conversationId).catch(() => {});
      }
    }
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    typingDebounceRef.current = setTimeout(() => {
      clearTyping(target.conversationId).catch(() => {});
    }, 3500);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user) return;
    setInput('');
    clearTyping(target.conversationId).catch(() => {});
    setSendError(null);
    try {
      const msg = await sendDM(target.conversationId, text);
      if (msg) {
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send');
      setInput(text);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-ink-muted text-xs">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mb-2">
              <MessageSquare className="w-5 h-5 text-ink-muted" />
            </div>
            <p className="text-xs text-ink-muted">Say hi to {target.peerName}!</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? 'bg-rose-500/90 text-white rounded-br-md'
                      : 'bg-white/8 text-ink rounded-bl-md border border-white/8'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p
                    className={`text-[9px] mt-0.5 flex items-center gap-1 ${
                      mine ? 'text-white/70 justify-end' : 'text-ink-muted'
                    }`}
                  >
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {mine && (m.read_at
                      ? <><Check className="w-2.5 h-2.5" /> Read</>
                      : <><CircleDot className="w-2.5 h-2.5" /> Sent</>
                    )}
                  </p>
                </div>
              </div>
            );
          })
        )}
        {peerTyping && (
          <div className="flex justify-start">
            <div className="bg-white/8 rounded-2xl rounded-bl-md px-3 py-2 border border-white/8">
              <div className="flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full bg-ink-muted animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {sendError && (
        <div className="mx-3 mb-1 px-2 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 text-[11px]">
          {sendError}
        </div>
      )}

      {/* Input */}
      <div className="p-2.5 border-t border-white/8 flex-shrink-0 flex items-center gap-2">
        <button
          onClick={onUnfriend}
          className="p-2 rounded-lg text-ink-muted hover:text-rose-400 hover:bg-white/5 transition-colors flex-shrink-0"
          title="Unfriend"
        >
          <Users className="w-4 h-4" />
        </button>
        <input
          value={input}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          placeholder={`Message ${target.peerName}...`}
          className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="p-2.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-colors disabled:opacity-40 disabled:hover:bg-rose-500 flex-shrink-0"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Velvet Rope chat view — labeled, masked-identity conversation
// ---------------------------------------------------------------------------
function VRChatView({ target, onClose }: { target: VRChatTarget; onClose: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<VRMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendError, setSendError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const msgs = await getVRMessages(target.conversationId);
        setMessages(msgs);
        await markVRConversationRead(target.conversationId).catch(() => {});
      } catch (e) {
        setSendError(e instanceof Error ? e.message : 'Failed to load messages');
      } finally {
        setLoading(false);
      }
    })();
  }, [target.conversationId]);

  // Realtime subscription for new Velvet Rope messages
  useEffect(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase
      .channel(`vr-chat-${target.conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'vr_messages',
          filter: `conversation_id=eq.${target.conversationId}`,
        },
        (payload) => {
          const msg = payload.new as VRMessage;
          setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
          if (msg.sender_id !== user?.id) {
            markVRConversationRead(target.conversationId).catch(() => {});
          }
        },
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [target.conversationId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !user) return;
    setInput('');
    setSendError(null);
    try {
      const msg = await sendVRMessage(target.conversationId, text);
      if (msg) {
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      }
      // If this is an AI match, request the AI's reply.
      if (target.matchType === 'ai' && target.status === 'active') {
        setAiThinking(true);
        try {
          const aiMsg = await requestAIVelvetRopeReply(
            target.conversationId,
            [...messages, msg].filter(Boolean).map(m => ({
              senderId: m.sender_id,
              content: m.content,
            })),
          );
          if (aiMsg) {
            setMessages(prev => (prev.some(m => m.id === aiMsg.id) ? prev : [...prev, aiMsg]));
          }
        } catch (e) {
          setSendError(e instanceof Error ? e.message : 'AI reply failed');
        } finally {
          setAiThinking(false);
        }
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send');
      setInput(text);
    }
  };

  const closed = target.status === 'closed';

  return (
    <div className="flex flex-col h-full">
      {/* Velvet Rope banner label */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-amber-500/15 bg-amber-500/5 flex-shrink-0">
        <VenetianMask className="w-3.5 h-3.5 text-amber-400" />
        <p className="text-[10px] text-amber-300/90 font-semibold uppercase tracking-wider">
          Velvet Rope
        </p>
        <div className="flex-1" />
        {closed && (
          <span className="text-[10px] text-ink-muted">This conversation has ended</span>
        )}
        <button
          onClick={onClose}
          disabled={closed}
          className="text-[10px] text-ink-muted hover:text-rose-300 transition-colors disabled:opacity-40"
        >
          End
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-ink-muted text-xs">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-2">
              <VenetianMask className="w-5 h-5 text-amber-400/70" />
            </div>
            <p className="text-xs text-ink-muted">The guessing game begins. Say something.</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[78%]">
                  <p className="text-[9px] mb-0.5 flex items-center gap-1 text-amber-400/60">
                    <VenetianMask className="w-2.5 h-2.5" />
                    Velvet Rope
                  </p>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm border ${
                      mine
                        ? 'bg-amber-500/90 text-white rounded-br-md border-amber-400/50'
                        : 'bg-amber-500/10 text-ink rounded-bl-md border-amber-500/25'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p
                      className={`text-[9px] mt-0.5 flex items-center gap-1 ${
                        mine ? 'text-white/70 justify-end' : 'text-ink-muted'
                      }`}
                    >
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {mine && (m.read_at
                        ? <><Check className="w-2.5 h-2.5" /> Read</>
                        : <><CircleDot className="w-2.5 h-2.5" /> Sent</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
        {aiThinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md px-3 py-2 text-sm bg-amber-500/10 border border-amber-500/25">
              <span className="text-ink-muted text-xs italic">The stranger is typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {sendError && (
        <div className="mx-3 mb-1 px-2 py-1.5 rounded-lg bg-rose-500/15 text-rose-300 text-[11px]">
          {sendError}
        </div>
      )}

      {/* Input */}
      <div className="p-2.5 border-t border-white/8 flex-shrink-0 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
          placeholder={closed ? 'This conversation has ended' : 'Send a message...'}
          disabled={closed}
          className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || closed}
          className="p-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-40 disabled:hover:bg-amber-500 flex-shrink-0"
          title="Send"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
