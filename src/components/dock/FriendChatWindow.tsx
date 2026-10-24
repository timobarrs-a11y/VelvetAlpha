import { useEffect, useState } from 'react';
import { Bell, Minus, X } from 'lucide-react';
import { enablePush, pushState, syncPushSubscription, type PushState } from '../../services/pushNotifications';
import { ChatView } from '../MessagingOverlay';
import type { FriendTarget } from './DockContext';

/** A real person's chat in the dock: yellow, so people never get mixed up with AI. */
const PUSH_DISMISSED_KEY = 'velvet.push_prompt_dismissed';

/** Offer notifications so a friend's message reaches you when Velvet is closed. */
function PushPrompt() {
  const [state, setState] = useState<PushState>(() => pushState());
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(PUSH_DISMISSED_KEY) === '1'; } catch { return false; }
  });
  useEffect(() => { if (state === 'granted') syncPushSubscription().catch(() => {}); }, [state]);
  if (dismissed || (state !== 'default' && state !== 'needs-install')) return null;
  const dismiss = () => {
    try { localStorage.setItem(PUSH_DISMISSED_KEY, '1'); } catch { /* storage blocked */ }
    setDismissed(true);
  };
  return (
    <div className="flex items-center gap-2 border-b border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-[11px] text-amber-100/90">
      <Bell className="h-3.5 w-3.5 flex-shrink-0 text-amber-300" />
      <span className="min-w-0 flex-1">
        {state === 'needs-install'
          ? 'To get notified on iPhone: Share → Add to Home Screen, then open Velvet from there.'
          : 'Get notified when friends message you, even with Velvet closed.'}
      </span>
      {state === 'default' && (
        <button type="button" onClick={() => enablePush().then(setState).catch(() => {})} className="flex-shrink-0 rounded-md bg-amber-300 px-2 py-1 font-semibold text-[#1d1a10]">
          Turn on
        </button>
      )}
      <button type="button" onClick={dismiss} className="flex-shrink-0 text-amber-100/50 hover:text-amber-100" aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function FriendChatWindow({ friend, onMinimize, onClose }: { friend: FriendTarget; onMinimize: () => void; onClose: () => void }) {
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
        <button type="button" onClick={onMinimize} className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label={`Minimize ${friend.peerName}`} title="Minimize">
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label={`Close ${friend.peerName}`} title="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <PushPrompt />
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatView target={friend} onUnfriend={onClose} />
      </div>
    </div>
  );
}
