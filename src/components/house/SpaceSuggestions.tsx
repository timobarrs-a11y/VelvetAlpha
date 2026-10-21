import { Lock, X } from 'lucide-react';
import { useState } from 'react';
import type { SpaceSuggestion } from '../../types/spaces';
import { SpaceIcon } from './SpaceIcon';
import { joinSpace, dismissSuggestion } from '../../services/spacesService';
import { toast } from '../../shared/ui/Toast';

interface Props {
  suggestions: SpaceSuggestion[];
  onJoined: () => void;
  onDismissed: () => void;
}

export function SpaceSuggestions({ suggestions, onJoined, onDismissed }: Props) {
  const [busy, setBusy] = useState<string | null>(null);

  const handleJoin = async (boardId: string) => {
    setBusy(boardId);
    try {
      await joinSpace(boardId);
      toast.success('Joined space!');
      onJoined();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to join');
    } finally {
      setBusy(null);
    }
  };

  const handleDismiss = async (boardId: string) => {
    setBusy(boardId);
    try {
      await dismissSuggestion(boardId);
      onDismissed();
    } catch {
      toast.error('Failed to dismiss');
    } finally {
      setBusy(null);
    }
  };

  if (suggestions.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">You might like</h3>
      <div className="space-y-2">
        {suggestions.map(s => (
          <div
            key={s.board_id}
            className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/8"
          >
            <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
              <SpaceIcon name={s.icon} color={s.color} className="w-4.5 h-4.5" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-ink truncate">{s.name}</span>
                {s.visibility === 'private' && <Lock className="w-3 h-3 text-ink-muted flex-shrink-0" />}
              </div>
              {s.description && (
                <p className="text-xs text-ink-muted/70 truncate mt-0.5">{s.description}</p>
              )}
              <p className="text-[10px] text-pink-300/70 mt-1">
                Because you like {s.matched_interests.slice(0, 3).join(', ')}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => handleJoin(s.board_id)}
                  disabled={busy === s.board_id}
                  className="px-3 py-1 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-xs text-pink-300 border border-pink-500/30 transition-colors disabled:opacity-50"
                >
                  {busy === s.board_id ? '...' : 'Join'}
                </button>
                <button
                  onClick={() => handleDismiss(s.board_id)}
                  disabled={busy === s.board_id}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-ink-muted hover:text-ink transition-colors"
                >
                  <X className="w-3 h-3" /> Not interested
                </button>
              </div>
            </div>
            <span className="flex-shrink-0 text-[10px] text-ink-muted/60 mt-1">{s.member_count} members</span>
          </div>
        ))}
      </div>
    </div>
  );
}
