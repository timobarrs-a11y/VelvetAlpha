import { useState } from 'react';
import { Minus, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { sendMessage } from '../../shared/supabase/queries/messaging';
import { FriendCheckers } from './FriendCheckers';
import { ChatView } from '../MessagingOverlay';
import type { FriendTarget } from './DockContext';

/** A real person's chat in the dock: yellow, so people never get mixed up with AI. */
const invitedKey = (conversationId: string) => `velvet.checkers.invited.${conversationId}`;

export function FriendChatWindow({ friend, onMinimize, onClose }: { friend: FriendTarget; onMinimize: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const [playing, setPlaying] = useState(false);
  // Once opened, the board stays mounted (hidden behind chat) so it keeps receiving moves.
  const [started, setStarted] = useState(false);

  const togglePlay = () => {
    if (!playing) {
      // First time from this chat: tell them where to find the board.
      let invited = false;
      try { invited = sessionStorage.getItem(invitedKey(friend.conversationId)) === '1'; } catch { /* storage blocked */ }
      if (!invited) {
        sendMessage(friend.conversationId, '♟️ Let\'s play checkers! Tap ♟ at the top of our chat.').catch(() => {});
        try { sessionStorage.setItem(invitedKey(friend.conversationId), '1'); } catch { /* storage blocked */ }
      }
    }
    setStarted(true);
    setPlaying(p => !p);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-amber-300/25 bg-amber-300/[0.07] px-3 py-2.5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-amber-300/80 bg-amber-300/15 text-base font-bold text-amber-200">
          {friend.peerAvatarUrl
            ? <img src={friend.peerAvatarUrl} alt="" className="h-full w-full object-cover" />
            : friend.peerName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-amber-100">{friend.peerName}</p>
          <p className="truncate text-[10px] text-amber-200/70">Friend · real person</p>
        </div>
        <button
          type="button"
          onClick={togglePlay}
          className={`rounded-lg px-2 py-1 text-base leading-none transition-colors ${playing ? 'bg-amber-300/25' : 'hover:bg-white/10'}`}
          aria-pressed={playing}
          aria-label={playing ? 'Back to chat' : `Play checkers with ${friend.peerName}`}
          title={playing ? 'Back to chat' : 'Play checkers'}
        >
          ♟
        </button>
        <button type="button" onClick={onMinimize} className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label={`Minimize ${friend.peerName}`} title="Minimize">
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label={`Close ${friend.peerName}`} title="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {started && user && (
          <div className={playing ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            <FriendCheckers conversationId={friend.conversationId} myId={user.id} peerId={friend.peerId} peerName={friend.peerName} />
          </div>
        )}
        {!playing && <ChatView target={friend} onUnfriend={onClose} />}
      </div>
    </div>
  );
}
