import { useState } from 'react';
import { Minus, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { sendMessage } from '../../shared/supabase/queries/messaging';
import { FriendCheckers } from './FriendCheckers';
import { FriendDrawGuess } from './FriendDrawGuess';
import { FriendRps } from './FriendRps';
import { FriendPaint } from './FriendPaint';

type Game = 'checkers' | 'draw' | 'rps' | 'paint';
const GAMES: { id: Game; icon: string; label: string; invite: string }[] = [
  { id: 'draw', icon: '🎨', label: 'Draw & Guess', invite: "🎨 Let's play Draw & Guess! Tap 🎮 at the top of our chat." },
  { id: 'paint', icon: '🖌️', label: 'Doodle together', invite: '🖌️ Come doodle with me! Tap 🎮 at the top of our chat.' },
  { id: 'rps', icon: '✊', label: 'Rock Paper Scissors', invite: '✊ Rock Paper Scissors? Tap 🎮 at the top of our chat.' },
  { id: 'checkers', icon: '♟️', label: 'Checkers', invite: "♟️ Let's play checkers! Tap 🎮 at the top of our chat." },
];
import { ChatView } from '../MessagingOverlay';
import type { FriendTarget } from './DockContext';

/** A real person's chat in the dock: yellow, so people never get mixed up with AI. */
const invitedKey = (conversationId: string, game: Game) => `velvet.game.invited.${game}.${conversationId}`;

export function FriendChatWindow({ friend, onMinimize, onClose }: { friend: FriendTarget; onMinimize: () => void; onClose: () => void }) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [playing, setPlaying] = useState<Game | null>(null);
  // Games stay mounted once opened (hidden behind chat) so they keep receiving moves.
  const [started, setStarted] = useState<Game[]>([]);

  const openGame = (game: Game) => {
    setMenuOpen(false);
    // First time this session: tell them where to find it.
    let invited = false;
    try { invited = sessionStorage.getItem(invitedKey(friend.conversationId, game)) === '1'; } catch { /* storage blocked */ }
    if (!invited) {
      sendMessage(friend.conversationId, GAMES.find(g => g.id === game)!.invite).catch(() => {});
      try { sessionStorage.setItem(invitedKey(friend.conversationId, game), '1'); } catch { /* storage blocked */ }
    }
    setStarted(s => (s.includes(game) ? s : [...s, game]));
    setPlaying(game);
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
        <div className="relative">
          <button
            type="button"
            onClick={() => (playing ? setPlaying(null) : setMenuOpen(o => !o))}
            className={`rounded-lg px-2 py-1 text-base leading-none transition-colors ${playing || menuOpen ? 'bg-amber-300/25' : 'hover:bg-white/10'}`}
            aria-expanded={menuOpen}
            aria-label={playing ? 'Back to chat' : `Play a game with ${friend.peerName}`}
            title={playing ? 'Back to chat' : 'Games'}
          >
            {playing ? '💬' : '🎮'}
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#14122a] py-1 shadow-xl">
              {GAMES.map(g => (
                <button key={g.id} type="button" onClick={() => openGame(g.id)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10">
                  <span className="text-lg">{g.icon}</span>{g.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" onClick={onMinimize} className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label={`Minimize ${friend.peerName}`} title="Minimize">
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-white/60 transition-colors hover:bg-white/10 hover:text-white" aria-label={`Close ${friend.peerName}`} title="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {user && started.map(g => (
          <div key={g} className={playing === g ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            {g === 'checkers' && <FriendCheckers conversationId={friend.conversationId} myId={user.id} peerId={friend.peerId} peerName={friend.peerName} />}
            {g === 'draw' && <FriendDrawGuess conversationId={friend.conversationId} myId={user.id} peerId={friend.peerId} peerName={friend.peerName} />}
            {g === 'paint' && <FriendPaint conversationId={friend.conversationId} peerName={friend.peerName} onSent={() => setPlaying(null)} />}
            {g === 'rps' && <FriendRps conversationId={friend.conversationId} peerName={friend.peerName} />}
          </div>
        ))}
        {!playing && <ChatView target={friend} onUnfriend={onClose} />}
      </div>
    </div>
  );
}
