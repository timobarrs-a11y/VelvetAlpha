import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, Loader2, Trash2, Reply } from 'lucide-react';
import type { RoomMessage, SpaceMember, SpaceRoom, RoleTag } from '../../types/spaces';
import {
  getRoomMessages, sendRoomMessage, deleteRoomMessage, markRoomRead, getSpaceMembers,
} from '../../services/spacesService';
import { supabase } from '../../shared/supabase/client';
import { useAuth } from '../../auth/AuthProvider';
import { MessageComposer } from './MessageComposer';

interface Props {
  room: SpaceRoom;
  boardId: string;
  isMember: boolean;
  canModerate: boolean;
  onJoin: () => void;
  socialAccessError?: string | null;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;

const MENTION_RE = /<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>/gi;

function renderBody(body: string, _memberMap: Map<string, SpaceMember>, currentUserId: string | undefined): { text: string; isMention: boolean } {
  const mentionsMe = currentUserId && body.includes(`<@${currentUserId}>`);
  return { text: body, isMention: !!mentionsMe };
}

function BodyWithMentions({ body, memberMap }: { body: string; memberMap: Map<string, SpaceMember> }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(MENTION_RE.source, 'gi');
  let key = 0;

  while ((match = re.exec(body)) !== null) {
    if (match.index > lastIndex) {
      parts.push(body.slice(lastIndex, match.index));
    }
    const userId = match[1];
    const member = memberMap.get(userId);
    const name = member?.display_name ?? 'Member';
    parts.push(
      <span key={`mention-${key++}`} className="text-pink-400 bg-pink-500/10 rounded px-1 font-medium">
        @{name}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) {
    parts.push(body.slice(lastIndex));
  }

  return <>{parts}</>;
}

function RoleTagPill({ tag }: { tag: RoleTag }) {
  return (
    <span
      className="text-[9px] px-1.5 py-0.5 rounded font-medium"
      style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
    >
      {tag.name}
    </span>
  );
}

export function RoomChat({ room, boardId, isMember, canModerate, onJoin, socialAccessError }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [memberMap, setMemberMap] = useState<Map<string, SpaceMember>>(new Map());
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const oldestRef = useRef<string | null>(null);
  const wasNearBottomRef = useRef(true);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const msgs = await getRoomMessages(room.id);
      messageIdsRef.current = new Set(msgs.map(m => m.id));
      setMessages(msgs);
      if (msgs.length > 0) {
        oldestRef.current = msgs[0].created_at;
        setHasMore(msgs.length >= 50);
      }
      await markRoomRead(room.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [room.id]);

  const loadMembers = useCallback(async () => {
    try {
      const m = await getSpaceMembers(boardId);
      setMembers(m);
      setMemberMap(new Map(m.map(mem => [mem.user_id, mem])));
    } catch { /* non-critical */ }
  }, [boardId]);

  useEffect(() => {
    loadMessages();
    loadMembers();
  }, [loadMessages, loadMembers]);

  useEffect(() => {
    setReplyTo(null);
  }, [room.id]);

  // Realtime
  useEffect(() => {
    if (!room.id) return;
    const channel = supabase.channel(`room-${room.id}`);
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_room_messages', filter: `room_id=eq.${room.id}` }, async (payload) => {
        const newMsg = payload.new as RoomMessage;
        if (messageIdsRef.current.has(newMsg.id)) return;
        messageIdsRef.current.add(newMsg.id);
        let authorName = 'Member';
        let authorAvatar: unknown = null;
        let authorIsBot = false;
        if (newMsg.author_id && memberMap.has(newMsg.author_id)) {
          const m = memberMap.get(newMsg.author_id)!;
          authorName = m.display_name;
          authorAvatar = m.avatar_config;
          authorIsBot = m.is_bot;
        } else if (newMsg.author_id) {
          try {
            const freshMembers = await getSpaceMembers(boardId);
            setMembers(freshMembers);
            setMemberMap(new Map(freshMembers.map(m2 => [m2.user_id, m2])));
            const m = freshMembers.find(m2 => m2.user_id === newMsg.author_id);
            if (m) { authorName = m.display_name; authorAvatar = m.avatar_config; authorIsBot = m.is_bot; }
          } catch { /* non-critical */ }
        }
        const enriched: RoomMessage = {
          ...newMsg,
          author_name: authorName,
          author_avatar: authorAvatar,
          author_is_bot: authorIsBot,
        };
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, enriched];
        });
        if (document.visibilityState === 'visible') {
          markRoomRead(room.id).catch(() => {});
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_room_messages', filter: `room_id=eq.${room.id}` }, (payload) => {
        const updated = payload.new as RoomMessage;
        setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
      })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [room.id, boardId, memberMap]);

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [loading, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    wasNearBottomRef.current = nearBottom;
    setShowJump(!nearBottom && messages.length > 0);
  }, [messages.length]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !oldestRef.current) return;
    setLoadingMore(true);
    try {
      const older = await getRoomMessages(room.id, oldestRef.current);
      if (older.length === 0) { setHasMore(false); return; }
      const newOnes = older.filter(m => !messageIdsRef.current.has(m.id));
      newOnes.forEach(m => messageIdsRef.current.add(m.id));
      oldestRef.current = older[0].created_at;
      setHasMore(older.length >= 50);
      const el = scrollRef.current;
      const prevScrollHeight = el?.scrollHeight ?? 0;
      setMessages(prev => [...newOnes, ...prev]);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
      });
    } catch { /* non-critical */ } finally {
      setLoadingMore(false);
    }
  }, [room.id, hasMore, loadingMore]);

  const handleSend = useCallback(async (body: string, replyToId?: string) => {
    setError(null);
    setJoinError(null);
    try {
      const msg = await sendRoomMessage(room.id, body, replyToId);
      if (msg) {
        messageIdsRef.current.add(msg.id);
        const enriched: RoomMessage = {
          ...msg,
          author_name: memberMap.get(user?.id ?? '')?.display_name ?? 'You',
          author_avatar: memberMap.get(user?.id ?? '')?.avatar_config ?? null,
          author_is_bot: false,
        } as RoomMessage;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, enriched]);
        if (wasNearBottomRef.current) {
          requestAnimationFrame(() => scrollToBottom(true));
        }
        await markRoomRead(room.id);
      }
    } catch (e: any) {
      if (e.code === 'not_a_member') {
        setJoinError('Join this space to chat.');
      } else if (e.code === 'social_access_required') {
        setJoinError('Verify your age and start your membership to chat.');
      } else if (e.code === 'slow_down') {
        setError('Slow down a little.');
      } else if (e.code === 'Content policy violation') {
        setError(e.message || 'Content policy violation.');
      } else {
        setError(e.message || 'Failed to send message.');
      }
      throw e;
    }
  }, [room.id, user?.id, memberMap, scrollToBottom]);

  const handleDelete = useCallback(async (messageId: string) => {
    try {
      await deleteRoomMessage(messageId);
    } catch {
      setError('Failed to delete message.');
    }
  }, []);

  // Group messages
  const groups: RoomMessage[][] = [];
  for (const msg of messages) {
    const lastGroup = groups[groups.length - 1];
    const lastMsg = lastGroup?.[lastGroup.length - 1];
    if (lastMsg && lastMsg.author_id === msg.author_id && !msg.deleted_at && !lastMsg.deleted_at &&
        new Date(msg.created_at).getTime() - new Date(lastMsg.created_at).getTime() < GROUP_WINDOW_MS) {
      lastGroup.push(msg);
    } else {
      groups.push([msg]);
    }
  }

  const isAnnouncement = room.kind === 'announcements';
  const showComposer = isMember && (!isAnnouncement || canModerate);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-ink-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0"
      >
        {hasMore && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full text-center text-xs text-ink-muted hover:text-ink py-2 transition-colors"
          >
            {loadingMore ? 'Loading...' : '↑ Load earlier messages'}
          </button>
        )}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-ink-muted">No messages yet.</p>
            <p className="text-xs text-ink-muted/60 mt-1">Be the first to say something.</p>
          </div>
        )}
        {groups.map((group, gi) => {
          const first = group[0];
          const authorName = first.author_name ?? 'Member';
          const isMe = first.author_id === user?.id;
          const canDelete = isMe || canModerate;
          const authorMember = first.author_id ? memberMap.get(first.author_id) : undefined;
          const authorTag = authorMember?.tags?.[0];
          const groupMentionsMe = group.some(msg => user?.id && msg.body.includes(`<@${user.id}>`));
          return (
            <div key={gi} className={`group/msg rounded-lg ${groupMentionsMe ? 'bg-pink-500/[0.06] -mx-1 px-1' : ''}`}>
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => first.author_id && navigate(isMe ? '/my-profile' : `/member/${first.author_id}`)}
                  disabled={!first.author_id}
                  title={`View ${authorName}'s profile`}
                  className={`text-xs font-medium hover:underline ${first.author_is_bot ? 'text-violet-400' : isMe ? 'text-pink-300' : 'text-ink'}`}
                >
                  {authorName}
                </button>
                {first.author_is_bot && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold">AI</span>
                )}
                {first.is_ai_generated && !first.author_is_bot && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300 font-semibold">AI</span>
                )}
                {authorTag && <RoleTagPill tag={authorTag} />}
                <span className="text-[10px] text-ink-muted/60">
                  {new Date(first.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {group.map((msg, mi) => {
                const isDeleted = !!msg.deleted_at;
                const reply = msg.reply_to_id ? messages.find(m => m.id === msg.reply_to_id) : null;
                const { isMention } = renderBody(msg.body, memberMap, user?.id);
                return (
                  <div key={msg.id} className="group/hover relative flex items-start gap-2 py-0.5 hover:bg-white/[0.03] -mx-1 px-1 rounded">
                    {mi > 0 && <span className="w-0 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      {reply && (
                        <div className="text-[10px] text-ink-muted/70 border-l-2 border-white/10 pl-2 mb-0.5 truncate">
                          {reply.author_name}: {reply.body}
                        </div>
                      )}
                      <p className={`text-sm leading-relaxed ${isDeleted ? 'text-ink-muted/40 italic' : isMention ? 'text-ink' : 'text-ink/90'}`}>
                        {isDeleted ? '[deleted]' : <BodyWithMentions body={msg.body} memberMap={memberMap} />}
                      </p>
                    </div>
                    {!isDeleted && (
                      <div className="flex-shrink-0 opacity-0 group-hover/hover:opacity-100 transition-opacity flex items-center gap-1">
                        <button
                          onClick={() => setReplyTo({ id: msg.id, authorName })}
                          className="p-1 rounded text-ink-muted hover:text-ink hover:bg-white/5"
                          title="Reply"
                        >
                          <Reply className="w-3 h-3" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(msg.id)}
                            className="p-1 rounded text-ink-muted hover:text-rose-400 hover:bg-white/5"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {showJump && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-20 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-pink-500 text-white text-xs font-medium shadow-lg flex items-center gap-1.5 hover:bg-pink-600 transition-colors z-10"
        >
          New messages <ArrowDown className="w-3 h-3" />
        </button>
      )}

      {error && (
        <div className="px-3 py-1.5 mx-3 mb-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}
      {joinError && (
        <div className="px-3 py-1.5 mx-3 mb-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs">
          {joinError}
        </div>
      )}

      {showComposer ? (
        <MessageComposer
          onSend={handleSend}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          placeholder={isAnnouncement && canModerate ? 'Post an announcement...' : 'Send a message...'}
          members={members}
        />
      ) : isAnnouncement && !canModerate ? (
        <div className="flex-shrink-0 px-3 py-3 border-t border-white/8 text-center">
          <p className="text-xs text-ink-muted">Only hosts post here.</p>
        </div>
      ) : !isMember ? (
        <div className="flex-shrink-0 px-3 py-3 border-t border-white/8">
          <button
            onClick={onJoin}
            className="w-full py-2.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 text-sm font-medium transition-colors"
          >
            Join to chat
          </button>
        </div>
      ) : socialAccessError ? (
        <div className="flex-shrink-0 px-3 py-3 border-t border-white/8 text-center">
          <p className="text-xs text-ink-muted">{socialAccessError}</p>
        </div>
      ) : null}
    </div>
  );
}
