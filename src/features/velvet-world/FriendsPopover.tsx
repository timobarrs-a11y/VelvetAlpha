import { X } from 'lucide-react';

export interface FriendRow {
  id: string;
  name: string;
  address: string;
  isMember: boolean;
  hasPlot: boolean;
}

interface FriendsPopoverProps {
  friends: FriendRow[];
  yourAddress: string;
  onVisit: (id: string) => void;
  onClose: () => void;
}

export function FriendsPopover({ friends, yourAddress, onVisit, onClose }: FriendsPopoverProps) {
  return (
    <div
      className="z-7 absolute right-4 top-[84px] w-[280px] grid gap-2.5 rounded-2xl border border-white/10 p-3.5"
      style={{ background: 'rgba(24,19,34,0.92)', backdropFilter: 'blur(14px) saturate(1.2)' }}
    >
      <div className="flex items-center justify-between">
        <h3 className="m-0 font-extrabold text-[16px] text-white" style={{ fontFamily: '"Bricolage Grotesque", sans-serif' }}>Friends</h3>
        <button onClick={onClose} className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] bg-white/8 text-white/60 hover:bg-white/12" aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {friends.length === 0 && (
        <p className="text-[12px] text-white/40">No friends yet. Tap a billboard on your block to add one.</p>
      )}

      {friends.map((f) => (
        <div key={f.id} className="flex items-center gap-2.5">
          <div
            className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] font-extrabold text-[12px] text-white"
            style={{ background: f.isMember ? '#F5B82E' : '#6B6070' }}
          >
            {f.name[0]}
          </div>
          <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-white">
            {f.name}
            <small className="block font-medium text-[12px] text-white/40">{f.hasPlot ? f.address : "Hasn't moved in yet"}</small>
          </span>
          {f.hasPlot && (
            <button
              onClick={() => onVisit(f.id)}
              className="rounded-[10px] border border-white/15 bg-transparent px-2.5 py-1.5 text-[12.5px] font-semibold text-white/60 hover:text-white hover:border-white/30 transition-colors"
            >
              Visit
            </button>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2.5">
        <div className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] font-extrabold text-[12px] text-white" style={{ background: '#F06A9B' }}>
          Y
        </div>
        <span className="min-w-0 flex-1 text-[13.5px] font-semibold text-white">
          Your house
          <small className="block font-medium text-[12px] text-white/40">{yourAddress}</small>
        </span>
        <button
          onClick={() => onVisit('__you__')}
          className="rounded-[10px] border border-white/15 bg-transparent px-2.5 py-1.5 text-[12.5px] font-semibold text-white/60 hover:text-white hover:border-white/30 transition-colors"
        >
          Go
        </button>
      </div>

      <p className="m-0 text-[12px] text-white/40">Neighbors change every day. Friends are always one tap away.</p>
    </div>
  );
}
