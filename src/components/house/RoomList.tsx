import { Hash, Megaphone } from 'lucide-react';
import type { SpaceRoom } from '../../types/spaces';

interface Props {
  rooms: SpaceRoom[];
  activeRoomId: string | null;
  onSelect: (room: SpaceRoom) => void;
}

export function RoomList({ rooms, activeRoomId, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-0.5 px-2 py-2 overflow-y-auto min-h-0">
      {rooms.map(room => {
        const active = room.id === activeRoomId;
        const Icon = room.kind === 'announcements' ? Megaphone : Hash;
        return (
          <button
            key={room.id}
            onClick={() => onSelect(room)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors text-left ${
              active ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${active ? 'text-ink' : 'text-ink-muted'}`} />
            <div className="flex-1 min-w-0">
              <span className={`text-sm truncate ${active ? 'text-ink font-medium' : 'text-ink-muted'}`}>
                {room.name}
              </span>
              {room.topic && (
                <span className="block text-[10px] text-ink-muted/70 truncate">{room.topic}</span>
              )}
            </div>
            {room.kind === 'announcements' && (
              <span className="flex-shrink-0 text-[9px] uppercase tracking-wider text-amber-400/70">Ann</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
