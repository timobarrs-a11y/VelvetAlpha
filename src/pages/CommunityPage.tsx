import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageSquare, Plus, Users, Pin, Info } from 'lucide-react';
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {boards.map((board, i) => {
              const color = COLOR_MAP[board.color] ?? '#64748b';
              return (
                <motion.button
                  key={board.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  onClick={() => navigate(`/community/board/${board.id}`)}
                  className="card-interactive p-5 text-left rounded-2xl"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}20`, border: `1px solid ${color}40` }}
                    >
                      <MessageSquare className="w-5 h-5" style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-white truncate">{board.name}</h3>
                        {board.is_pinned && <Pin className="w-3 h-3 text-amber-400 flex-shrink-0" fill="currentColor" />}
                      </div>
                      {board.description && (
                        <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-relaxed">{board.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-3">
                        <span className="flex items-center gap-1 text-xs text-white/40">
                          <MessageSquare className="w-3 h-3" />
                          {board.post_count} posts
                        </span>
                        {board.is_owner && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/60">
                            Owner
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
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
