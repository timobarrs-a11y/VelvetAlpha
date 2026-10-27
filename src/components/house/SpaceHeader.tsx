import { Lock, LogIn, LogOut, Users, MessageSquare, Settings } from 'lucide-react';
import type { MySpace } from '../../types/spaces';
import { SpaceIcon } from './SpaceIcon';

interface Props {
  space: MySpace;
  onJoin: () => void;
  onLeave: () => void;
  onAddFriends?: () => void;
  onOpenSettings?: () => void;
  activeTab: 'rooms' | 'posts';
  onTabChange: (tab: 'rooms' | 'posts') => void;
}

export function SpaceHeader({ space, onJoin, onLeave, onAddFriends, onOpenSettings, activeTab, onTabChange }: Props) {
  const canModerate = space.role === 'owner' || space.role === 'mod';
  const joined = space.role === 'owner' || space.role === 'mod' || space.role === 'member';

  return (
    <div className="flex-shrink-0 px-4 py-3 border-b border-white/8">
      <div className="flex items-center gap-3 mb-3">
        <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
          <SpaceIcon name={space.icon} color={space.color} className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-ink truncate">{space.name}</h1>
            {space.visibility !== 'open' && <Lock className="w-3.5 h-3.5 text-ink-muted flex-shrink-0" />}
          </div>
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            <Users className="w-3 h-3" />
            <span>{space.member_count} members</span>
            {space.role === 'owner' && <span className="ml-1 text-amber-400">· Owner</span>}
            {space.role === 'mod' && <span className="ml-1 text-blue-400">· Mod</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canModerate && space.visibility === 'private' && onAddFriends && (
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
        <button
          onClick={() => onTabChange('rooms')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'rooms' ? 'bg-white/10 text-ink' : 'text-ink-muted hover:text-ink hover:bg-white/5'
          }`}
        >
          Rooms
        </button>
        <button
          onClick={() => onTabChange('posts')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            activeTab === 'posts' ? 'bg-white/10 text-ink' : 'text-ink-muted hover:text-ink hover:bg-white/5'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Posts
        </button>
      </div>
    </div>
  );
}
