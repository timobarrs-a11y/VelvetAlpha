import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EyeOff, Lock } from 'lucide-react';
import { joinSpace, requestToJoinSpace } from '../../services/spacesService';
import type { DirectorySpace, SpaceVisibility } from '../../types/spaces';
import { toast } from '../../shared/ui/Toast';

export const DOOR_LABELS: Record<SpaceVisibility, string> = {
  open: 'Open',
  request: 'Request',
  invite: 'Invite only',
  private: 'Private',
  hidden: 'Hidden',
};

export const DOOR_CHIP: Record<SpaceVisibility, string> = {
  open: 'bg-emerald-500/15 text-emerald-400',
  request: 'bg-amber-500/15 text-amber-400',
  invite: 'bg-sky-500/15 text-sky-400',
  private: 'bg-rose-500/15 text-rose-400',
  hidden: 'bg-violet-500/15 text-violet-300',
};

/** One line per door, for pickers. */
export const DOOR_OPTIONS: { key: SpaceVisibility; label: string; desc: string }[] = [
  { key: 'open', label: 'Open', desc: 'Anyone can join instantly' },
  { key: 'request', label: 'Request', desc: 'You approve each request' },
  { key: 'invite', label: 'Invite only', desc: 'Listed, but people need a link' },
  { key: 'private', label: 'Private', desc: 'Listed, but owners and mods add people' },
  { key: 'hidden', label: 'Hidden', desc: 'Not listed or searchable. Invite link or add friends only' },
];

export function DoorChip({ visibility }: { visibility: SpaceVisibility }) {
  return (
    <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-medium ${DOOR_CHIP[visibility] ?? DOOR_CHIP.private}`}>
      {DOOR_LABELS[visibility] ?? visibility}
    </span>
  );
}

/** The lock or eye next to a space's name, for any door that isn't open. */
export function DoorIcon({ visibility, className = 'w-3 h-3' }: { visibility: SpaceVisibility; className?: string }) {
  if (visibility === 'open') return null;
  const Icon = visibility === 'hidden' ? EyeOff : Lock;
  return <Icon className={`${className} text-ink-muted flex-shrink-0`} aria-label={DOOR_LABELS[visibility]} />;
}

/** Open / Join / Request / Requested / Invite only / Members only, for a directory row. */
export function DoorAction({ space, onChanged }: {
  space: DirectorySpace;
  onChanged: (patch: Partial<DirectorySpace>) => void;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>, ok: string, patch: Partial<DirectorySpace>) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChanged(patch);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  if (space.is_member) {
    return (
      <button
        onClick={() => navigate(`/spaces/${space.board_id}`)}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-ink transition-colors"
      >
        Open
      </button>
    );
  }
  if (space.visibility === 'open') {
    return (
      <button
        onClick={() => run(() => joinSpace(space.board_id), 'Joined!', { is_member: true, member_count: space.member_count + 1 })}
        disabled={busy}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-xs text-pink-300 border border-pink-500/30 transition-colors disabled:opacity-50"
      >
        {busy ? '...' : 'Join'}
      </button>
    );
  }
  if (space.visibility === 'request') {
    if (space.has_pending_request) {
      return <span className="flex-shrink-0 text-xs text-amber-400 px-3 py-1.5">Requested</span>;
    }
    return (
      <button
        onClick={() => run(() => requestToJoinSpace(space.board_id), 'Request sent!', { has_pending_request: true })}
        disabled={busy}
        className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs text-amber-300 border border-amber-500/30 transition-colors disabled:opacity-50"
      >
        {busy ? '...' : 'Request'}
      </button>
    );
  }
  if (space.visibility === 'invite') {
    return <span className="flex-shrink-0 text-xs text-sky-400/70 px-3 py-1.5">Invite only</span>;
  }
  return <span className="flex-shrink-0 text-xs text-ink-muted px-3 py-1.5">Members only</span>;
}
