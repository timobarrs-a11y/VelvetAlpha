import { useState, useEffect } from 'react';
import { ModalShell } from '../../shared/ui';
import { getFriends, type FriendPeer } from '../../shared/supabase/queries/messaging';
import { getSpaceMembers, addFriendToSpace } from '../../services/spacesService';
import { toast } from '../../shared/ui/Toast';
import type { SpaceMember } from '../../types/spaces';
import { UserPlus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
}

export function AddFriendsModal({ isOpen, onClose, boardId }: Props) {
  const [friends, setFriends] = useState<FriendPeer[]>([]);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    Promise.all([getFriends(), getSpaceMembers(boardId)])
      .then(([f, m]) => { setFriends(f); setMembers(m); })
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [isOpen, boardId]);

  const memberIds = new Set(members.map(m => m.user_id));
  const available = friends.filter(f => !memberIds.has(f.user_id));

  const handleAdd = async (friendId: string) => {
    setBusy(friendId);
    try {
      await addFriendToSpace(boardId, friendId);
      toast.success('Friend added to space!');
      setMembers(prev => [...prev, { user_id: friendId, display_name: friends.find(f => f.user_id === friendId)?.display_name ?? 'Member', avatar_config: null, role: 'member', is_bot: false, joined_at: new Date().toISOString(), tags: [] }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setBusy(null);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} title="Add friends to space" size="sm">
      {loading && <p className="text-sm text-ink-muted text-center py-6">Loading...</p>}
      {!loading && available.length === 0 && (
        <p className="text-sm text-ink-muted text-center py-6">
          All your friends are already in this space, or you don't have friends yet.
        </p>
      )}
      {!loading && available.length > 0 && (
        <div className="space-y-1.5">
          {available.map(friend => (
            <div key={friend.user_id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors">
              <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center text-xs text-white font-bold">
                {friend.display_name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-ink truncate block">{friend.display_name}</span>
                {friend.headline && <span className="text-[10px] text-ink-muted truncate block">{friend.headline}</span>}
              </div>
              <button
                onClick={() => handleAdd(friend.user_id)}
                disabled={busy === friend.user_id}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-xs text-pink-300 border border-pink-500/30 transition-colors disabled:opacity-50"
              >
                <UserPlus className="w-3 h-3" /> Add
              </button>
            </div>
          ))}
        </div>
      )}
    </ModalShell>
  );
}
