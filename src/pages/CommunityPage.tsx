import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  MessageSquare, Plus, Pin, Check, X, Clock,
  ShieldCheck, Users, MessageCircle, Sparkles, ArrowRight, Search,
} from 'lucide-react';
import { PageShell } from '../shared/ui/PageShell';
import { CommunityIndexHeader } from '../components/community/CommunityHeroHeader';
import { LoadingState } from '../shared/ui/LoadingState';
import { EmptyState } from '../shared/ui/EmptyState';
import { CreateBoardModal } from '../components/community/CommunityComponents';
import { fetchBoards, approveBoard, rejectBoard, isSuperUser, fetchBoardLatestActivity } from '../services/communityService';
import { toast } from '../shared/ui';
import type { BoardWithCounts } from '../types/community';

const COLOR_MAP: Record<string, { hex: string; soft: string }> = {
  blue:    { hex: '#3b82f6', soft: 'rgba(59,130,246,0.12)' },
  rose:    { hex: '#f43f5e', soft: 'rgba(244,63,94,0.12)' },
  emerald: { hex: '#10b981', soft: 'rgba(16,185,129,0.12)' },
  amber:   { hex: '#f59e0b', soft: 'rgba(245,158,11,0.12)' },
  violet:  { hex: '#8b5cf6', soft: 'rgba(139,92,246,0.12)' },
  slate:   { hex: '#64748b', soft: 'rgba(100,116,139,0.12)' },
  teal:    { hex: '#14b8a6', soft: 'rgba(20,184,166,0.12)' },
  pink:    { hex: '#ec4899', soft: 'rgba(236,72,153,0.12)' },
};

const CATEGORY_ORDER = [
  'Community Hub',
  'Life & Relationships',
  'Family',
  'Interests & Hobbies',
  'Self-Improvement',
  'Companion Corner',
  'General',
];

const CATEGORY_ICONS: Record<string, string> = {
  'Community Hub': '💬',
  'Life & Relationships': '❤️',
  'Family': '👨‍👩‍👧',
  'Interests & Hobbies': '🎮',
  'Self-Improvement': '📈',
  'Companion Corner': '🤝',
  'General': '📋',
};

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

interface BoardWithActivity extends BoardWithCounts {
  latestActivity?: string | null;
}

export default function CommunityPage() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [superUser, setSuperUser] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, su] = await Promise.all([fetchBoards(), isSuperUser()]);
    const boardsWithActivity = await Promise.all(
      data.map(async (b) => {
        const latestActivity = b.post_count > 0 ? await fetchBoardLatestActivity(b.id) : null;
        return { ...b, latestActivity };
      })
    );
    setBoards(boardsWithActivity);
    setSuperUser(su);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleApprove = async (boardId: string) => {
    setApproving(boardId);
    const ok = await approveBoard(boardId);
    setApproving(null);
    if (ok) {
      toast.success('Board approved.');
      await load();
    } else {
      toast.error('Could not approve board.');
    }
  };

  const handleReject = async (boardId: string) => {
    setRejecting(boardId);
    const ok = await rejectBoard(boardId);
    setRejecting(null);
    if (ok) {
      toast.success('Board rejected.');
      await load();
    } else {
      toast.error('Could not reject board.');
    }
  };

  const approvedBoards = boards.filter((b) => b.is_approved);
  const pendingBoards = boards.filter((b) => !b.is_approved);
  const featuredBoards = approvedBoards.filter((b) => b.is_pinned);
  const regularBoards = approvedBoards.filter((b) => !b.is_pinned);
  const totalPosts = approvedBoards.reduce((sum, b) => sum + b.post_count, 0);

  // Group regular boards by category
  const boardsByCategory = CATEGORY_ORDER
    .map((cat) => ({
      category: cat,
      boards: regularBoards.filter((b) => (b.category || 'General') === cat),
    }))
    .filter((g) => g.boards.length > 0);

  return (
    <PageShell
      width="xl"
      header={
        <CommunityIndexHeader
          title="Community"
          subtitle="Boards, conversations, and connection"
          icon={MessageSquare}
          back="/lobby"
          backLabel="Lobby"
          stats={
            !loading && approvedBoards.length > 0 ? (
              <>
                <span className="flex items-center gap-1.5 text-xs text-white/40">
                  <Users className="w-3.5 h-3.5" />
                  <span className="font-semibold text-white/70 tabular-nums">{approvedBoards.length}</span> boards
                </span>
                <span className="flex items-center gap-1.5 text-xs text-white/40">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="font-semibold text-white/70 tabular-nums">{totalPosts}</span> posts
                </span>
              </>
            ) : undefined
          }
        />
      }
    >
      {/* Search bar */}
      <div className="mb-5">
        <button
          onClick={() => navigate('/community/search')}
          className="w-full flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/15 px-4 py-3 text-sm text-white/30 hover:text-white/50 transition-all group"
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          <span>Search posts and boards...</span>
        </button>
      </div>

      {loading ? (
        <LoadingState label="Loading boards..." />
      ) : boards.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="w-7 h-7" />}
          title="No boards yet"
          description="Be the first to create a community board and start the conversation."
          action={{ label: 'Create a board', onClick: () => setShowCreate(true) }}
        />
      ) : (
        <div className="flex flex-col gap-7">
          {/* Pending approval section (super user only) */}
          {superUser && pendingBoards.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] overflow-hidden"
            >
              <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-500/15">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-amber-300">
                  Pending Approval
                </h2>
                <span className="text-xs text-amber-400/60 ml-auto">{pendingBoards.length} awaiting review</span>
              </div>
              <div className="divide-y divide-amber-500/10">
                {pendingBoards.map((board) => {
                  const color = COLOR_MAP[board.color] ?? COLOR_MAP.slate;
                  return (
                    <div key={board.id} className="flex items-center gap-3 px-4 py-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: color.soft, border: `1px solid ${color.hex}33` }}
                      >
                        <MessageSquare className="w-4 h-4" style={{ color: color.hex }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{board.name}</div>
                        {board.description && (
                          <p className="text-xs text-white/40 truncate mt-0.5">{board.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleApprove(board.id)}
                          disabled={approving === board.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(board.id)}
                          disabled={rejecting === board.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
                        >
                          <X className="w-3.5 h-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Pending board notice (non-super user sees their own pending boards) */}
          {!superUser && pendingBoards.length > 0 && (
            <div className="rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-white/50">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>
                  Your board <span className="font-semibold text-white/80">{pendingBoards[0].name}</span> is awaiting moderator approval.
                </span>
              </div>
            </div>
          )}

          {/* Featured / pinned boards */}
          {featuredBoards.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold tracking-wide text-white/70 uppercase">Featured</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {featuredBoards.map((board, i) => {
                  const color = COLOR_MAP[board.color] ?? COLOR_MAP.slate;
                  return (
                    <motion.button
                      key={board.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => navigate(`/community/board/${board.id}`)}
                      className="ds-tile group relative p-4 text-left overflow-hidden"
                      style={{
                        // @ts-expect-error CSS custom property
                        '--ds-tile-accent': color.hex,
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center"
                          style={{ background: color.soft, border: `1px solid ${color.hex}33` }}
                        >
                          <MessageSquare className="w-5 h-5" style={{ color: color.hex }} />
                        </div>
                        {board.is_pinned && (
                          <Pin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" fill="currentColor" />
                        )}
                      </div>
                      <h3 className="text-base font-bold text-white leading-tight mb-1 group-hover:text-white transition-colors">
                        {board.name}
                      </h3>
                      {board.description && (
                        <p className="text-sm text-white/50 line-clamp-2 leading-relaxed mb-3">
                          {board.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-white/40">
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3" />
                          {board.post_count} {board.post_count === 1 ? 'post' : 'posts'}
                        </span>
                        {board.latestActivity && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {timeAgo(board.latestActivity)}
                          </span>
                        )}
                        {board.is_owner && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                            Owner
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Boards grouped by category */}
          {boardsByCategory.map((group) => (
            <div key={group.category}>
              <div className="flex items-center gap-2 mb-3.5">
                <span className="text-base">{CATEGORY_ICONS[group.category] ?? '📋'}</span>
                <h2 className="text-sm font-bold tracking-wide text-white/70 uppercase">{group.category}</h2>
                <span className="text-xs text-white/30 tabular-nums">{group.boards.length}</span>
                <div className="h-px flex-1 bg-white/8" />
              </div>
              <div className="rounded-2xl border border-white/8 overflow-hidden">
                {group.boards.map((board, i) => {
                  const color = COLOR_MAP[board.color] ?? COLOR_MAP.slate;
                  return (
                    <motion.button
                      key={board.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.03, 0.4) }}
                      onClick={() => navigate(`/community/board/${board.id}`)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-white/[0.06] last:border-b-0 transition-all hover:bg-white/[0.03] group"
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105"
                        style={{ background: color.soft, border: `1px solid ${color.hex}33` }}
                      >
                        <MessageSquare className="w-4 h-4" style={{ color: color.hex }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-white truncate group-hover:text-sky-300 transition-colors">
                            {board.name}
                          </span>
                          {board.is_owner && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40 flex-shrink-0">
                              Owner
                            </span>
                          )}
                        </div>
                        {board.description && (
                          <p className="text-xs text-white/40 mt-0.5 truncate leading-relaxed">
                            {board.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="flex items-center gap-1.5 text-xs text-white/40">
                          <MessageCircle className="w-3 h-3" />
                          <span className="tabular-nums">{board.post_count}</span>
                        </div>
                        {board.latestActivity && (
                          <span className="text-[10px] text-white/25 hidden sm:inline flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {timeAgo(board.latestActivity)}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Start a board — inline, contextual, not floating */}
          <div className="flex justify-center pt-1">
            <button
              onClick={() => setShowCreate(true)}
              className="group flex items-center gap-2 px-5 py-2.5 rounded-full text-sm text-white/50 hover:text-white/90 border border-white/8 hover:border-white/15 hover:bg-white/[0.02] transition-all"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90" />
              <span>Start a new board</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 -ml-1 transition-all" />
            </button>
          </div>
        </div>
      )}

      <CreateBoardModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          load();
        }}
      />
    </PageShell>
  );
}
