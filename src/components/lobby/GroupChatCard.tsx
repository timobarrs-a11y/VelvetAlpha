import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { Avatar } from '../Avatar';
import type { GroupChatWithMembers } from '../../services/groupChatService';
import { companionAvatarConfig, formatTimeAgo } from './lobbyUtils';

export const GROUP_TONE = '#2dd4bf';

interface GroupChatCardProps {
  group: GroupChatWithMembers;
  onOpen: () => void;
  onDelete: (e: React.MouseEvent) => void;
  delay?: number;
}

export function GroupChatCard({ group, onOpen, onDelete, delay = 0 }: GroupChatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      role="button"
      tabIndex={0}
      data-interactive
      className="ds-card ds-card--interactive group relative p-5"
      style={{ '--ds-tone': GROUP_TONE, '--ds-card-hover-border': 'rgba(45,212,191,0.55)' } as React.CSSProperties}
    >
      <button
        type="button"
        onClick={onDelete}
        className="absolute top-3 right-3 p-1.5 bg-danger-500/90 hover:bg-danger-600 text-white rounded-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-all z-10"
        title="Delete group chat"
        aria-label="Delete group chat"
      >
        <Trash2 className="w-3 h-3" />
      </button>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex -space-x-2">
          {group.members.slice(0, 3).map((member, mi) => (
            <div key={member.id} className="w-9 h-9 rounded-full overflow-hidden"
              style={{ border: '2px solid var(--ds-surface-3)', zIndex: 3 - mi }}>
              <Avatar config={companionAvatarConfig(member.companion ?? {})} className="w-full h-full" />
            </div>
          ))}
          {group.members.length > 3 && (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs text-ink-muted font-bold"
              style={{ background: 'var(--ds-surface-2)', border: '2px solid var(--ds-surface-3)' }}>
              +{group.members.length - 3}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-ink truncate transition-colors group-hover:text-[var(--ds-tone)] font-display text-sm">{group.name}</h3>
          <p className="text-xs text-ink-muted truncate">{group.members.map(m => m.companion?.custom_name).filter(Boolean).join(', ')}</p>
        </div>
      </div>

      {group.last_message && (
        <p className="text-xs text-ink-muted truncate mb-2">
          <span className="font-medium text-ink-subtle">{group.last_message.sender_name}:</span>{' '}
          {group.last_message.content}
        </p>
      )}
      <p className="ds-divider text-xs text-ink-subtle pt-2">{formatTimeAgo(group.updated_at)}</p>
    </motion.div>
  );
}
