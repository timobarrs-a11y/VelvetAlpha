import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Plus, Pin, Users, Info, Activity } from 'lucide-react';
import { PageShell } from '../shared/ui/PageShell';
import { PageHeader } from '../shared/ui/PageHeader';
import { Button } from '../shared/ui/Button';
import { LoadingState } from '../shared/ui/LoadingState';
import { EmptyState } from '../shared/ui/EmptyState';
import { CreateBoardModal } from '../components/community/CommunityComponents';
import { fetchBoards } from '../services/communityService';
import type { BoardWithCounts } from '../types/community';

const COLOR_MAP: Record<string, string> = {
  blue: '#3b82f6',
  rose: '#f43f5e',
  emerald: '#10b981',
  amber: '#f59e0b',
  violet: '#8b5cf6',
  slate: '#64748b',
  teal: '#14b8a6',
  pink: '#ec4899',
};

export default function CommunityPage() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchBoards();
    setBoards(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <PageShell
        width="lg"
        header={
          <PageHeader
            title="Community"
            subtitle="Boards, conversations, and connection"
            icon={MessageSquare}
            accent="#3b82f6"
            back="/lobby"
            actions={
              <Button size="sm" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setShowCreate(true)}>
                New Board
              </Button>
            }
          >
            <div className="flex items-center gap-2 px-1 py-2">
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <Info className="w-3.5 h-3.5" />
                <span>Some content may be AI-generated.</span>
              </div>
            </div>
          </PageHeader>
        }
      >
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
          <div className="rounded-xl border border-white/8 overflow-hidden">
            {/* Table header */}
            <div className="hidden md:flex items-center px-4 py-2.5 bg-white/[0.03] border-b border-white/8 text-[11px] font-bold tracking-wider uppercase text-white/30">
              <div className="flex-1 min-w-0">Board</div>
              <div className="w-20 text-center shrink-0">Posts</div>
              <div className="w-24 text-right shrink-0">Owner</div>
            </div>

            {/* Board rows */}
            <div className="divide-y divide-white/[0.06]">
              {boards.map((board) => {
                const color = COLOR_MAP[board.color] ?? '#64748b';
                return (
                  <button
                    key={board.id}
                    onClick={() => navigate(`/community/board/${board.id}`)}
                    className="w-full flex items-center px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/40"
                  >
                    {/* Icon + name + description */}
                    <div className="flex-1 min-w-0 flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}1a`, border: `1px solid ${color}33` }}
                      >
                        <MessageSquare className="w-4 h-4" style={{ color }} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-white truncate hover:text-sky-300 transition-colors">
                            {board.name}
                          </span>
                          {board.is_pinned && (
                            <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" />
                          )}
                        </div>
                        {board.description && (
                          <p className="text-xs text-white/40 mt-0.5 truncate leading-relaxed">
                            {board.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Post count */}
                    <div className="hidden md:flex w-20 shrink-0 justify-center">
                      <span className="text-sm text-white/50 tabular-nums">{board.post_count}</span>
                    </div>

                    {/* Owner badge */}
                    <div className="hidden md:flex w-24 shrink-0 justify-end">
                      {board.is_owner && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                          Owner
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <CreateBoardModal
          isOpen={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={(boardId) => navigate(`/community/board/${boardId}`)}
        />
      </PageShell>
    </>
  );
}
