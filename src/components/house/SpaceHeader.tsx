import { Link } from 'react-router-dom';
import { ChevronRight, Hash, LogIn, LogOut, Users, MessageSquare, Settings, Tent } from 'lucide-react';
import type { SpaceView } from '../../types/spaces';
import { SpaceIcon } from './SpaceIcon';
import { DoorChip, DoorIcon } from './doors';

export type SpaceTab = 'rooms' | 'posts' | 'crews';

interface Props {
  space: SpaceView;
  onJoin: () => void;
  onLeave: () => void;
  onAddFriends?: () => void;
  onOpenSettings?: () => void;
  activeTab: SpaceTab;
  onTabChange: (tab: SpaceTab) => void;
}

export function SpaceHeader({ space, onJoin, onLeave, onAddFriends, onOpenSettings, activeTab, onTabChange }: Props) {
  const canModerate = space.role === 'owner' || space.role === 'mod';
  const joined = space.role !== null;
  const addsPeople = space.visibility === 'private' || space.visibility === 'hidden';

  const tabs: { key: SpaceTab; label: string; icon: typeof Hash; count?: number }[] = [
    { key: 'rooms', label: 'Rooms', icon: Hash },
    { key: 'posts', label: 'Posts', icon: MessageSquare },
    { key: 'crews', label: 'Crews', icon: Tent, count: space.sub_space_count },
  ];

  return (
    <div className="flex-shrink-0 px-4 py-3 border-b border-white/8">
      {space.parent_board_id && space.parent_name && (
        <Link
          to={`/spaces/${space.parent_board_id}?tab=crews`}
          className="inline-flex items-center gap-1 mb-1.5 text-[11px] text-ink-muted hover:text-ink transition-colors"
        >
          {space.parent_name} <ChevronRight className="w-3 h-3" /> <span className="text-ink/80">Crew</span>
        </Link>
      )}
      <div className="flex items-center gap-3 mb-3">
        <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <SpaceIcon name={space.icon} color={space.color} className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-ink truncate">{space.name}</h1>
            <DoorIcon visibility={space.visibility} className="w-3.5 h-3.5" />
            {space.visibility === 'hidden' && <DoorChip visibility="hidden" />}
          </div>
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            <Users className="w-3 h-3" />
            <span>{space.member_count} members</span>
            {space.role === 'owner' && <span className="ml-1 text-amber-400">· Owner</span>}
            {space.role === 'mod' && <span className="ml-1 text-blue-400">· Mod</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canModerate && addsPeople && onAddFriends && (
            <button
              onClick={onAddFriends}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-ink transition-colors"
            >
              Add friends
            </button>
          )}
          {canModerate && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-ink-muted hover:text-ink transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          {!joined && space.visibility === 'open' && (
            <button
              onClick={onJoin}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-xs text-pink-300 border border-pink-500/30 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" /> Join
            </button>
          )}
          {joined && space.role === 'member' && (
            <button
              onClick={onLeave}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-ink-muted transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Leave
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === t.key ? 'bg-white/10 text-ink' : 'text-ink-muted hover:text-ink hover:bg-white/5'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
            {!!t.count && <span className="text-[10px] text-ink-muted">{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
