import { useEffect, useState } from 'react';
import { Minus, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { FRIEND_GAMES, gameInvite, sendMessage, type FriendGameId } from '../../shared/supabase/queries/messaging';
import { ChatView } from '../MessagingOverlay';
import type { FriendTarget } from './DockContext';
import { FriendCheckers } from './FriendCheckers';
import { FriendDrawGuess } from './FriendDrawGuess';
import { FriendRps } from './FriendRps';
import { FriendPaint } from './FriendPaint';

type Game = FriendGameId;
const GAME_ORDER: Game[] = ['draw', 'paint', 'rps', 'checkers'];

/** A real person's chat in the dock: yellow, so people never get mixed up with AI. */
export function FriendChatWindow({ friend, gameRequest, onMinimize, onClose }: {
  friend: FriendTarget;
  /** Open this game (they tapped Play on an invite). */
  gameRequest?: { id: Game; nonce: number; invite?: boolean };
  onMinimize: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [playing, setPlaying] = useState<Game | null>(null);
  // Games stay mounted once opened (hidden behind chat) so they keep receiving moves.
  const [started, setStarted] = useState<Game[]>([]);

  /** Open a game; when you start it (not join), the other person gets an invite with a Play alert. */
  const openGame = (game: Game, invite: boolean) => {
    setMenuOpen(false);
    if (invite && !started.includes(game)) sendMessage(friend.conversationId, gameInvite(game)).catch(() => {});
    setStarted(s => (s.includes(game) ? s : [...s, game]));
    setPlaying(game);
  };

  useEffect(() => {
    if (gameRequest) openGame(gameRequest.id, !!gameRequest.invite);
  }, [gameRequest?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

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
              {GAME_ORDER.map(id => (
                <button key={id} type="button" onClick={() => openGame(id, true)} className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-white/85 hover:bg-white/10">
                  <span className="text-lg">{FRIEND_GAMES[id].icon}</span>{FRIEND_GAMES[id].label}
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
      {/* Games always on show, so nobody has to find a menu to invite. */}
      {!playing && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-white/8 px-3 py-2 scrollbar-hide">
          <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-amber-200/70">Play</span>
          {GAME_ORDER.map(id => (
            <button
              key={id}
              type="button"
              onClick={() => openGame(id, true)}
              className="flex flex-shrink-0 items-center gap-1 rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[11px] font-semibold text-amber-100 hover:bg-amber-300/20"
              title={`Invite ${friend.peerName} to ${FRIEND_GAMES[id].label}`}
            >
              <span>{FRIEND_GAMES[id].icon}</span>{FRIEND_GAMES[id].label}
            </button>
          ))}
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col">
        {user && started.map(g => (
          <div key={g} className={playing === g ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
            {g === 'checkers' && <FriendCheckers conversationId={friend.conversationId} myId={user.id} peerId={friend.peerId} peerName={friend.peerName} />}
            {g === 'draw' && <FriendDrawGuess conversationId={friend.conversationId} myId={user.id} peerId={friend.peerId} peerName={friend.peerName} />}
            {g === 'paint' && <FriendPaint conversationId={friend.conversationId} peerName={friend.peerName} onSent={() => setPlaying(null)} />}
            {g === 'rps' && <FriendRps conversationId={friend.conversationId} peerName={friend.peerName} />}
          </div>
        ))}
        {!playing && <ChatView target={friend} onUnfriend={onClose} onJoinGame={(g) => openGame(g, false)} />}
      </div>
    </div>
  );
}
