import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Users } from 'lucide-react';
import { requestToJoinSpace } from '../../services/spacesService';
import type { SpaceView } from '../../types/spaces';
import { SpaceIcon } from './SpaceIcon';
import { DoorChip } from './doors';
import { toast } from '../../shared/ui/Toast';

interface Props {
  space: SpaceView;
  onRequested: () => void;
  /** Shown under the card (the space's crews). */
  children?: ReactNode;
}

/** What a space or crew looks like from outside a closed door: who it is, and how to get in. */
export function SpaceDoorCard({ space, onRequested, children }: Props) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');

  const request = async () => {
    setBusy(true);
    try {
      await requestToJoinSpace(space.board_id, message.trim() || undefined);
      toast.success('Request sent!');
      onRequested();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to request');
    } finally {
      setBusy(false);
    }
  };

  // Invite links look like /join/abcd1234; accept the whole link or just the code.
  const inviteCode = code.trim().split('/').filter(Boolean).pop() ?? '';

  return (
    <div className="flex-1 overflow-y-auto flex flex-col items-center gap-6 p-6 min-h-0">
      <div className="w-full max-w-sm my-auto rounded-2xl bg-white/5 border border-white/8 p-6 text-center">
        {space.parent_board_id && space.parent_name && (
          <Link
            to={`/spaces/${space.parent_board_id}?tab=crews`}
            className="inline-flex items-center gap-1 mb-3 text-[11px] text-ink-muted hover:text-ink transition-colors"
          >
            {space.parent_name} <ChevronRight className="w-3 h-3" /> Crew
          </Link>
        )}
        <span className="mx-auto w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mb-3">
          <SpaceIcon name={space.icon} color={space.color} className="w-7 h-7" />
        </span>
        <div className="flex items-center justify-center gap-2 mb-1">
          <h2 className="text-lg font-bold text-ink truncate">{space.name}</h2>
          <DoorChip visibility={space.visibility} />
        </div>
        {space.description && <p className="text-sm text-ink-muted mb-2">{space.description}</p>}
        <p className="flex items-center justify-center gap-1 text-xs text-ink-muted mb-5">
          <Users className="w-3 h-3" /> {space.member_count} members
          {space.sub_space_count > 0 && <span>· {space.sub_space_count} crews</span>}
        </p>

        {space.visibility === 'request' && (
          space.has_pending_request ? (
            <p className="text-sm text-amber-400">Requested. You'll get a notification when they decide.</p>
          ) : (
            <div className="space-y-2">
              <input
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={200}
                placeholder="Say hi (optional)"
                className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
              />
              <button
                onClick={request}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-sm text-amber-300 border border-amber-500/30 transition-colors disabled:opacity-50"
              >
                {busy ? '...' : 'Request to join'}
              </button>
            </div>
          )
        )}

        {space.visibility === 'invite' && (
          <form
            onSubmit={e => { e.preventDefault(); if (inviteCode) navigate(`/join/${inviteCode}`); }}
            className="space-y-2"
          >
            <p className="text-xs text-ink-muted">This one needs an invite link from a member.</p>
            <input
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Paste an invite link or code"
              className="w-full bg-white/5 rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 outline-none focus:bg-white/8 transition-colors"
            />
            <button
              type="submit"
              disabled={!inviteCode}
              className="w-full py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sm text-sky-300 border border-sky-500/30 transition-colors disabled:opacity-50"
            >
              Use invite
            </button>
          </form>
        )}

        {(space.visibility === 'private' || space.visibility === 'hidden') && (
          <p className="text-sm text-ink-muted">Members only. The owner or a mod adds people.</p>
        )}
      </div>
      {children}
    </div>
  );
}
