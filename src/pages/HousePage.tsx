import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../shared/supabase/client';
import {
  ensurePlaced, getMySpaces, getRooms, getSpaceSuggestions, joinSpace, leaveSpace,
} from '../services/spacesService';
import { getFriends, type FriendPeer } from '../shared/supabase/queries/messaging';
import type { MySpace, SpaceRoom, SpaceSuggestion } from '../types/spaces';
import { SpaceSidebar } from '../components/house/SpaceSidebar';
import { SpaceHeader } from '../components/house/SpaceHeader';
import { RoomList } from '../components/house/RoomList';
import { RoomChat } from '../components/house/RoomChat';
import { HereNow } from '../components/house/HereNow';
import { SpaceSuggestions } from '../components/house/SpaceSuggestions';
import { AddFriendsModal } from '../components/house/AddFriendsModal';
import { SpaceSettingsModal } from '../components/house/SpaceSettingsModal';
import { SpaceIcon } from '../components/house/SpaceIcon';

export default function HousePage() {
  const { boardId, roomName } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [spaces, setSpaces] = useState<MySpace[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [activeSpace, setActiveSpace] = useState<MySpace | null>(null);
  const [rooms, setRooms] = useState<SpaceRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<SpaceRoom | null>(null);
  const [activeTab, setActiveTab] = useState<'rooms' | 'posts'>('rooms');
  const [suggestions, setSuggestions] = useState<SpaceSuggestion[]>([]);
  const [friends, setFriends] = useState<FriendPeer[]>([]);
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [myName, setMyName] = useState('Member');
  const [mobileView, setMobileView] = useState<'spaces' | 'rooms' | 'chat'>('spaces');
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSpaces = useCallback(async () => {
    try {
      const s = await ensurePlaced();
      setSpaces(s);
      return s;
    } catch {
      return [];
    } finally {
      setLoadingSpaces(false);
    }
  }, []);

  const loadSuggestions = useCallback(async () => {
    try {
      const s = await getSpaceSuggestions(5);
      setSuggestions(s);
    } catch { /* non-critical */ }
  }, []);

  const loadFriends = useCallback(async () => {
    try {
      const f = await getFriends();
      setFriends(f.filter(friend => friend.is_online));
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    loadSpaces();
    loadSuggestions();
    loadFriends();
    // Get display name for presence
    supabase
      .from('member_profiles')
      .select('display_name')
      .eq('user_id', user?.id ?? '')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setMyName(data.display_name);
        else {
          supabase
            .from('user_profiles')
            .select('name')
            .eq('id', user?.id ?? '')
            .maybeSingle()
            .then(({ data: d2 }) => { if (d2?.name) setMyName(d2.name); });
        }
      });
  }, [user?.id, loadSpaces, loadSuggestions, loadFriends]);

  // Resolve active space from boardId param
  useEffect(() => {
    if (!boardId) {
      setActiveSpace(null);
      setActiveRoom(null);
      setMobileView('spaces');
      return;
    }
    const space = spaces.find(s => s.board_id === boardId) ?? null;
    setActiveSpace(space);
    setActiveTab('rooms');
    if (space) {
      getRooms(boardId).then(r => {
        setRooms(r);
        const targetRoom = roomName
          ? r.find(rm => rm.name === roomName) ?? r[0]
          : r[0];
        setActiveRoom(targetRoom ?? null);
        if (targetRoom) setMobileView('chat');
      }).catch(() => setRooms([]));
    } else {
      setRooms([]);
      setActiveRoom(null);
    }
  }, [boardId, roomName, spaces]);

  const refreshSpaces = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      getMySpaces().then(setSpaces).catch(() => {});
    }, 2000);
  }, []);

  // Realtime for sidebar unread
  useEffect(() => {
    if (spaces.length === 0) return;
    const channel = supabase.channel('house-sidebar');
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_room_messages' }, () => {
        if (!activeRoom) refreshSpaces();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [spaces.length, activeRoom, refreshSpaces]);

  const handleSelectSpace = useCallback((id: string) => {
    navigate(`/house/${id}`);
  }, [navigate]);

  const handleSelectRoom = useCallback((room: SpaceRoom) => {
    if (activeSpace) {
      navigate(`/house/${activeSpace.board_id}/${room.name}`);
    }
    setActiveRoom(room);
    setMobileView('chat');
  }, [activeSpace, navigate]);

  const handleJoin = useCallback(async () => {
    if (!activeSpace) return;
    try {
      await joinSpace(activeSpace.board_id);
      const updated = await getMySpaces();
      setSpaces(updated);
      const s = updated.find(sp => sp.board_id === activeSpace.board_id);
      if (s) setActiveSpace(s);
      loadSuggestions();
    } catch { /* error handled in RoomChat */ }
  }, [activeSpace, loadSuggestions]);

  const handleLeave = useCallback(async () => {
    if (!activeSpace) return;
    try {
      await leaveSpace(activeSpace.board_id);
      navigate('/house');
      const updated = await getMySpaces();
      setSpaces(updated);
      loadSuggestions();
    } catch { /* non-critical */ }
  }, [activeSpace, navigate, loadSuggestions]);

  const handleTabChange = useCallback((tab: 'rooms' | 'posts') => {
    setActiveTab(tab);
    if (tab === 'posts' && activeSpace) {
      navigate(`/community/board/${activeSpace.board_id}`);
    }
  }, [activeSpace, navigate]);

  const isMember = activeSpace?.role === 'member' || activeSpace?.role === 'mod' || activeSpace?.role === 'owner';
  const canModerate = activeSpace?.role === 'owner' || activeSpace?.role === 'mod';
  const isPrivate = activeSpace?.visibility === 'private';

  // Overview content
  const Overview = () => (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1">The House</h1>
          <p className="text-sm text-ink-muted">Your spaces, your people, all in one place.</p>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Your spaces</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {spaces.map(space => (
              <button
                key={space.board_id}
                onClick={() => handleSelectSpace(space.board_id)}
                className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/8 hover:bg-white/8 transition-colors text-left"
              >
                <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                  <SpaceIcon name={space.icon} color={space.color} className="w-5 h-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-ink truncate">{space.name}</span>
                    {space.visibility === 'private' && <Lock className="w-3 h-3 text-ink-muted flex-shrink-0" />}
                  </div>
                  <span className="text-[10px] text-ink-muted">{space.member_count} members</span>
                  {space.last_message_at && (
                    <span className="text-[10px] text-ink-muted/60 block">
                      Last activity {new Date(space.last_message_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {space.unread_count > 0 && (
                  <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-pink-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {space.unread_count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <SpaceSuggestions
          suggestions={suggestions}
          onJoined={() => { loadSpaces(); loadSuggestions(); }}
          onDismissed={() => loadSuggestions()}
        />

        {friends.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">Friends online</h3>
            <div className="flex flex-wrap gap-2">
              {friends.map(f => (
                <div key={f.user_id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/8">
                  <span className="relative">
                    <span className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-[10px] text-white font-bold">
                      {f.display_name.charAt(0).toUpperCase()}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[var(--ds-surface-2)]" />
                  </span>
                  <span className="text-xs text-ink">{f.display_name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="ds-page text-white flex flex-col h-full overflow-hidden">
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-2 px-3 py-2.5 border-b border-white/8 flex-shrink-0">
        {mobileView !== 'spaces' && (
          <button
            onClick={() => setMobileView(mobileView === 'chat' ? 'rooms' : 'spaces')}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <h1 className="text-sm font-bold flex-1">
          {mobileView === 'spaces' && 'The House'}
          {mobileView === 'rooms' && activeSpace?.name}
          {mobileView === 'chat' && `#${activeRoom?.name ?? ''}`}
        </h1>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left sidebar — spaces */}
        <div className={`${mobileView === 'spaces' ? 'flex' : 'hidden'} md:flex w-full md:w-64 lg:w-72 flex-shrink-0 border-r border-white/8 min-h-0`}>
          <SpaceSidebar
            spaces={spaces}
            activeBoardId={boardId ?? null}
            onSelect={(id) => { handleSelectSpace(id); setMobileView('rooms'); }}
            loading={loadingSpaces}
          />
        </div>

        {/* Middle — space content */}
        <div className={`${mobileView === 'rooms' || mobileView === 'chat' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-h-0`}>
          {!activeSpace ? (
            <Overview />
          ) : isPrivate && !isMember ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Lock className="w-8 h-8 text-ink-muted mb-3" />
              <h2 className="text-lg font-bold text-ink mb-1">Private space</h2>
              <p className="text-sm text-ink-muted mb-4 max-w-xs">
                This space is for members only. Ask the owner for an invite.
              </p>
            </div>
          ) : (
            <>
              <SpaceHeader
                space={activeSpace}
                onJoin={handleJoin}
                onLeave={handleLeave}
                onAddFriends={() => setShowAddFriends(true)}
                onOpenSettings={() => setShowSettings(true)}
                activeTab={activeTab}
                onTabChange={handleTabChange}
              />
              <div className="flex flex-1 min-h-0">
                {/* Room list */}
                <div className={`${mobileView === 'rooms' ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-48 lg:w-56 flex-shrink-0 border-r border-white/8 min-h-0`}>
                  <RoomList
                    rooms={rooms}
                    activeRoomId={activeRoom?.id ?? null}
                    onSelect={(r) => handleSelectRoom(r)}
                  />
                </div>
                {/* Chat */}
                <div className={`${mobileView === 'chat' ? 'flex' : 'hidden'} md:flex flex-1 flex-col min-h-0 relative`}>
                  {activeRoom ? (
                    <RoomChat
                      room={activeRoom}
                      boardId={activeSpace.board_id}
                      isMember={isMember}
                      canModerate={canModerate}
                      onJoin={handleJoin}
                    />
                  ) : (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-sm text-ink-muted">Select a room</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right sidebar — here now (desktop only) */}
        {activeSpace && (!isPrivate || isMember) && (
          <div className="hidden lg:flex w-64 flex-shrink-0 border-l border-white/8 min-h-0">
            <HereNow boardId={activeSpace.board_id} myDisplayName={myName} />
          </div>
        )}
      </div>

      {showAddFriends && activeSpace && (
        <AddFriendsModal
          isOpen={showAddFriends}
          onClose={() => setShowAddFriends(false)}
          boardId={activeSpace.board_id}
        />
      )}

      {showSettings && activeSpace && (
        <SpaceSettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          boardId={activeSpace.board_id}
          boardName={activeSpace.name}
          boardIcon={activeSpace.icon}
          boardColor={activeSpace.color}
          boardDescription={activeSpace.description ?? ''}
          boardVisibility={activeSpace.visibility}
          isOwner={activeSpace.role === 'owner'}
        />
      )}
    </div>
  );
}
