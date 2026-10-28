import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, MessageCircle, Smile, Award, Check, X, AtSign, UserPlus, DoorOpen } from 'lucide-react';
import {
  fetchNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from '../../services/communityService';
import type { NotificationWithActor } from '../../types/community';

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_ICON = {
  reply: MessageCircle,
  reaction: Smile,
  badge: Award,
  weekly: Bell,
  mention: AtSign,
  join_request: UserPlus,
  join_approved: DoorOpen,
};

const TYPE_COLOR = {
  reply: 'text-sky-400',
  reaction: 'text-amber-400',
  badge: 'text-emerald-400',
  weekly: 'text-violet-400',
  mention: 'text-pink-400',
  join_request: 'text-amber-400',
  join_approved: 'text-emerald-400',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<NotificationWithActor[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const refreshUnread = useCallback(async () => {
    const count = await getUnreadNotificationCount();
    setUnread(count);
  }, []);

  useEffect(() => {
    refreshUnread();
    const interval = setInterval(refreshUnread, 30000);
    return () => clearInterval(interval);
  }, [refreshUnread]);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const { notifications: notifs } = await fetchNotifications(20);
    setNotifications(notifs);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open && notifications.length === 0) {
      loadNotifications();
    }
  }, [open, notifications.length, loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = async (notif: NotificationWithActor) => {
    if (!notif.read) {
      await markNotificationRead(notif.id);
      setUnread((u) => Math.max(0, u - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)),
      );
    }
    const meta = notif.meta as Record<string, unknown> | null;
    if (notif.type === 'badge') {
      navigate('/medals');
    } else if (notif.type === 'mention') {
      const boardId = meta?.board_id as string | undefined;
      if (boardId) navigate(`/spaces/${boardId}`);
    } else if (notif.type === 'join_approved') {
      const boardId = meta?.board_id as string | undefined;
      if (boardId) navigate(`/spaces/${boardId}`);
    } else if (notif.type === 'join_request') {
      const boardId = meta?.board_id as string | undefined;
      if (boardId) navigate(`/spaces/${boardId}`);
    } else if (notif.post_id) {
      navigate(`/community/post/${notif.post_id}`);
    }
    setOpen(false);
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const handleDelete = async (e: React.MouseEvent, notifId: string) => {
    e.stopPropagation();
    await deleteNotification(notifId);
    setNotifications((prev) => prev.filter((n) => n.id !== notifId));
    setUnread((u) => Math.max(0, u - 1));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg border border-white/8 bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/15 transition-all"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-white/60" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-sky-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[var(--ds-surface-2)]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border border-white/10 bg-[var(--ds-surface-2)] shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <span className="text-sm font-bold text-white/80">Notifications</span>
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                  <Check className="w-3 h-3" />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-white/30">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="w-6 h-6 text-white/15 mx-auto mb-2" />
                  <p className="text-sm text-white/30">No notifications yet</p>
                  <p className="text-xs text-white/20 mt-1">
                    You'll be notified when someone replies or reacts to your posts.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((notif) => {
                    const Icon = TYPE_ICON[notif.type] ?? Bell;
                    const color = TYPE_COLOR[notif.type] ?? 'text-white/40';
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleClick(notif)}
                        className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors group border-b border-white/[0.04] last:border-0 ${
                          notif.read ? 'bg-transparent' : 'bg-sky-500/[0.05] hover:bg-sky-500/[0.08]'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/70 leading-relaxed">
                            {notif.type === 'reply' && (
                              <>
                                <span className="font-semibold text-white/90">
                                  {notif.actor_name ?? 'Someone'}
                                </span>{' '}
                                replied to your post
                              </>
                            )}
                            {notif.type === 'reaction' && (
                              <>
                                <span className="font-semibold text-white/90">
                                  {notif.actor_name ?? 'Someone'}
                                </span>{' '}
                                reacted to your {notif.target_type}
                              </>
                            )}
                            {notif.type === 'badge' && `You earned ${(notif.meta as any)?.name ?? 'a new medal'}!`}
                            {notif.type === 'weekly' && 'A new weekly thread is up'}
                            {notif.type === 'mention' && (
                              <>
                                <span className="font-semibold text-white/90">
                                  {notif.actor_name ?? 'Someone'}
                                </span>{' '}
                                mentioned you
                              </>
                            )}
                            {notif.type === 'join_request' && (
                              <>
                                <span className="font-semibold text-white/90">
                                  {notif.actor_name ?? 'Someone'}
                                </span>{' '}
                                wants to join {(notif.meta as any)?.board_name ?? 'a space'}
                              </>
                            )}
                            {notif.type === 'join_approved' && (
                              <>
                                You're in! Welcome to{' '}
                                <span className="font-semibold text-white/90">
                                  {(notif.meta as any)?.board_name ?? 'the space'}
                                </span>
                              </>
                            )}
                          </p>
                          <span className="text-[10px] text-white/25 mt-0.5 inline-block">
                            {timeAgo(notif.created_at)}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, notif.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-white/20 hover:text-red-400"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
