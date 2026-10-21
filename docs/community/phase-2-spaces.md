# Phase 2: Spaces, live rooms and the House

## Prompt to paste into Bolt

> Read `docs/community/phase-2-spaces.md` and build it exactly as written.
> Only open the files it names. Copy `docs/community/sql/phase-2-spaces-and-rooms.sql`
> into a new migration without changing it, and create the edge function from
> `docs/community/code/community-room-send.ts`. Phase 1 must already be applied.

---

## What the person sees

1. They finish the questionnaire, having picked Gaming, Basketball, Anime and
   Hip-Hop. On their first visit to **House** they're already in Welcome,
   Updates, Gaming Lounge, Sports Talk and Movies/Music & Pop Culture.
2. Each space has **rooms** (`# general`, `# looking-for-group`, `# basketball`)
   with live chat, plus the existing **Posts** tab.
3. "**4 here now**" with avatars shows who's in the space right now.
4. Unread rooms and spaces show a count.
5. "**You might like**" cards suggest matching spaces they haven't joined.
6. **Velvet Alpha** is a private space. It's listed (with a lock) but only
   members can read it. Tim adds alpha testers from his friends list.

## Step 1: Migration

Create a migration with the exact contents of
`docs/community/sql/phase-2-spaces-and-rooms.sql`. Summary:

| Object | Purpose |
|---|---|
| `community_boards.visibility` (`open`/`private`), `member_count`, `auto_join_all` | Space settings |
| `community_board_members` (board_id, user_id, role `owner`/`mod`/`member`, source, joined_at) | Membership. Clients can self-join open spaces and leave. |
| `community_rooms` (id, board_id, name, topic, kind `chat`/`announcements`, sort_order, last_message_at) | Rooms. Owners/mods manage them. |
| `community_room_messages` (id, room_id, board_id, author_id, body, reply_to_id, kind, deleted_at, created_at) | Live messages. **No client insert**: sending goes through the edge function. Realtime enabled. |
| `community_room_reads` (room_id, user_id, last_read_at) | Unread tracking. The client upserts its own rows. |
| `community_interest_map` (interest, board_id, room_name, gender_filter) | Questionnaire answer → space. Edit rows to change placement. |
| `community_space_dismissals` (user_id, board_id) | "Not interested" on a suggestion |
| Posts/comments policies + `community_search` | Private spaces' posts are hidden from non-members, including in search |

RPCs (all `supabase.rpc(...)`):

| RPC | Returns | Use |
|---|---|---|
| `join_spaces_from_interests()` | int (spaces added) | After the questionnaire; and on House load if the user has no spaces |
| `get_my_spaces()` | board_id, name, description, icon, color, category, visibility, member_count, role, unread_count, last_message_at | House sidebar |
| `get_space_suggestions(p_limit)` | board_id, name, description, icon, color, visibility, member_count, matched_interests[] | "You might like" |
| `get_space_members(p_board_id)` | user_id, display_name, avatar_config, role, is_bot, joined_at | Member list; also resolves names for realtime messages |
| `get_room_messages(p_room_id, p_before, p_limit)` | id, room_id, author_id, author_name, author_avatar, author_is_bot, body, reply_to_id, kind, is_ai_generated, deleted_at, created_at (**newest first**) | Chat history |
| `delete_room_message(p_message_id)` | boolean | Author, or space owner/mod/admin |
| `add_friend_to_space(p_board_id, p_friend_id)` | boolean | Owner/mod adds an accepted friend (Velvet Alpha) |

Direct table access the client may use:
- `community_board_members` **insert** `{ board_id, user_id: me, role: 'member', source: 'manual' }` (join an open space), **delete** own row (leave)
- `community_rooms` **select** (rooms of a space, ordered by `sort_order`)
- `community_room_reads` **upsert** `{ room_id, user_id: me, last_read_at: new Date().toISOString() }`, onConflict `room_id,user_id`
- `community_space_dismissals` **insert** `{ board_id }` (dismiss a suggestion)

## Step 2: Edge function `community-room-send`

Create `supabase/functions/community-room-send/index.ts` with the exact
contents of `docs/community/code/community-room-send.ts`, and add this to
`supabase/config.toml` next to the other functions:

```toml
[functions.community-room-send]
verify_jwt = true
```

Request `POST { room_id, body, reply_to_id? }` → `200 { message }`.
Errors to handle in the UI (`error` field):

| Status | `error` | Show |
|---|---|---|
| 403 | `not_a_member` | Replace the composer with a **Join to chat** button |
| 403 | `social_access_required` | "Verify your age and start your membership to chat." Link to the existing lock screen flow (`useAccess().showLockScreen`). |
| 403 | `read_only` | (Shouldn't happen: hide the composer in announcement rooms for non-hosts) |
| 403 | `Content policy violation` | Show `message` |
| 429 | `slow_down` | "Slow down a little." Keep the draft. |

## Step 3: Frontend

### 3a. Types: `src/types/spaces.ts` (new)

```ts
export type SpaceVisibility = 'open' | 'private';
export type SpaceRole = 'owner' | 'mod' | 'member';

export interface MySpace {
  board_id: string; name: string; description: string | null; icon: string; color: string;
  category: string; visibility: SpaceVisibility; member_count: number; role: SpaceRole;
  unread_count: number; last_message_at: string | null;
}
export interface SpaceSuggestion {
  board_id: string; name: string; description: string | null; icon: string; color: string;
  visibility: SpaceVisibility; member_count: number; matched_interests: string[];
}
export interface SpaceRoom {
  id: string; board_id: string; name: string; topic: string | null;
  kind: 'chat' | 'announcements'; sort_order: number; last_message_at: string | null;
}
export interface SpaceMember {
  user_id: string; display_name: string; avatar_config: unknown; role: SpaceRole; is_bot: boolean; joined_at: string;
}
export interface RoomMessage {
  id: string; room_id: string; author_id: string | null; author_name: string; author_avatar: unknown;
  author_is_bot: boolean; body: string; reply_to_id: string | null; kind: 'user' | 'system' | 'bot';
  is_ai_generated: boolean; deleted_at: string | null; created_at: string;
}
```

### 3b. Service: `src/services/spacesService.ts` (new)

Use `import { supabase } from '../shared/supabase/client';`. Functions:

```ts
getMySpaces(): Promise<MySpace[]>                       // rpc get_my_spaces
ensurePlaced(): Promise<MySpace[]>                       // getMySpaces(); if empty → rpc join_spaces_from_interests → getMySpaces()
getSpaceSuggestions(limit = 5): Promise<SpaceSuggestion[]>
dismissSuggestion(boardId): Promise<void>
joinSpace(boardId): Promise<void>                        // insert member row (see Step 1)
leaveSpace(boardId): Promise<void>
getRooms(boardId): Promise<SpaceRoom[]>
getRoomMessages(roomId, before?: string): Promise<RoomMessage[]>   // rpc; reverse() to oldest→newest
sendRoomMessage(roomId, body, replyToId?): Promise<RoomMessage>    // fetch the edge function (pattern below)
deleteRoomMessage(messageId): Promise<void>
markRoomRead(roomId): Promise<void>
getSpaceMembers(boardId): Promise<SpaceMember[]>
addFriendToSpace(boardId, friendId): Promise<void>
```

Call the edge function the same way `src/shared/supabase/queries/velvetRope.ts`
calls `velvet-rope-ai`:

```ts
const SEND_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/community-room-send`;

export async function sendRoomMessage(roomId: string, body: string, replyToId?: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not signed in');
  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ room_id: roomId, body, reply_to_id: replyToId ?? null }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message ?? data.error ?? 'Send failed'), { code: data.error, status: res.status });
  return data.message;
}
```

### 3c. Realtime and presence

**Messages.** Copy the pattern in `MessagingOverlay.tsx` (the `im-chat-${conversationId}`
channel, around line 1410): subscribe to `INSERT` and `UPDATE` on
`community_room_messages` with `filter: room_id=eq.${roomId}`. The realtime
payload has no author name, so look up `author_id` in a `Map` built from
`getSpaceMembers(boardId)`. If it's missing, refetch members once. De-dupe by
`id`, because the sender also gets their own message back from `sendRoomMessage`.

**Presence** (no table needed):

```ts
const channel = supabase.channel(`space-presence-${boardId}`, { config: { presence: { key: user.id } } });
channel
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState<{ display_name: string }>();
    setHereNow(Object.entries(state).map(([userId, metas]) => ({ userId, name: metas[0]?.display_name })));
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') await channel.track({ display_name: myDisplayName });
  });
return () => { supabase.removeChannel(channel); };
```

**Sidebar unread.** Re-run `getMySpaces()` when a realtime insert arrives for
a space the user isn't viewing, debounced to about 2 seconds. One channel per
open room is enough. Don't subscribe to every space.

### 3d. Pages and components

Routes in `src/routes/appRoutes.tsx` (lazy import, same `P(...)` wrapper as the others):

```
/house                      HousePage (overview)
/house/:boardId             HousePage (space, defaults to #general)
/house/:boardId/:roomName   HousePage (space + room)
/house/browse               BrowseSpacesPage
```

`src/pages/HousePage.tsx` plus `src/components/house/`:

- **Desktop**: three columns.
  - **Left, `SpaceSidebar.tsx`**: "My Spaces" from `ensurePlaced()`, each with icon, name, unread count, and a lock if `visibility === 'private'`. "+ Find spaces" button at the bottom goes to `/house/browse`.
  - **Middle**: with no space selected, show the **overview** (below). With a space selected: `SpaceHeader.tsx` (icon, name, member count, Join/Leave, tabs **Rooms** | **Posts**; Posts navigates to the existing `/community/board/:boardId`), `RoomList.tsx` (`# name`, unread dot) and `RoomChat.tsx`.
  - **Right, `HereNow.tsx`**: "N here now" avatars from presence, then the member list (owners/mods first, bots labeled "AI").
- **Mobile** (< 768px): one column. Space list → tap a space → rooms → tap a room → chat. Back buttons. No horizontal scroll.
- **Overview** (`/house`): greeting, "Your spaces" tiles with unread counts and latest activity, "You might like" (`SpaceSuggestions.tsx`: card with name, member count, "Because you like Basketball, Anime", **Join** and **Not interested**), and "Friends online" using `getFriends()` from `src/shared/supabase/queries/messaging.ts` (`FriendPeer.is_online`).
- **`RoomChat.tsx`**:
  - Load the latest 50 messages; "Load earlier" at the top uses `before = oldest.created_at`.
  - Group consecutive messages from the same author within 5 minutes.
  - Deleted messages show "[deleted]" in muted text.
  - Hovering your own message, or any message if you're owner/mod, shows Delete (`deleteRoomMessage`).
  - Reply: a small "Replying to {name}" bar above the composer; show a one-line quote above replies.
  - Call `markRoomRead(roomId)` on open and whenever a new message arrives while the tab is visible.
  - Auto-scroll to the bottom only if the user is already near the bottom; otherwise show a "New messages ↓" pill.
  - Labels: AI messages and bot authors get the small existing "AI" style used for `is_ai_generated` posts.
- **`MessageComposer.tsx`**: textarea, Enter sends, Shift+Enter adds a newline, 2000-character limit with a counter after 1800, disabled while sending. Not a member: replace with a **Join to chat** button. Announcement room and not owner/mod: hide the composer and show "Only hosts post here."
- **`AddFriendsModal.tsx`** (owner/mod of a private space only): list `getFriends()` minus current members, with an **Add** button (`addFriendToSpace`). Use `ModalShell` from `src/shared/ui`.
- **`BrowseSpacesPage.tsx`** (`/house/browse`): approved spaces grouped by `category` (query `community_boards` where `is_approved = true`, ordered by `sort_order`), each card with member count, lock icon for private, and **Join** / **Joined** / "Members only". Search box uses the existing `searchCommunity()` from `communityService.ts` and shows only `result_type === 'board'` results.

Use the existing UI kit in `src/shared/ui` (`Button`, `Card`, `Pill`, `ModalShell`,
`EmptyState`, `LoadingState`, `Toast`) and the dark glass styling of
`CommunityPage.tsx`.

**Space icons:** `community_boards.icon` stores a lucide icon name, but nothing
renders it today. Add `src/components/house/SpaceIcon.tsx` with an explicit
map (don't import all of lucide). These are every name in use, all checked
against lucide-react 0.344:
`BookOpen, Briefcase, Cat, ChefHat, Coffee, Cpu, Dumbbell, Film, Gamepad2, Heart, MessageSquare, Palette, Plane, Sparkles, Sun, Trophy`.
Fall back to `MessageSquare`. Color names in `community_boards.color` are
`amber, blue, emerald, green, pink, purple, rose, teal, violet`. Map them to
the matching Tailwind 400 shade.

### 3e. Wire-up in existing files

1. **`src/pages/UserProfileQuestionnairePageV2.tsx`**, in `handleComplete`, right after `saveUserLevelAnswers(...)` succeeds:
   ```ts
   supabase.rpc('join_spaces_from_interests').then(() => {}, () => {});
   ```
   Don't await it and don't block on failure. Add `import { supabase } from '../shared/supabase/client';`.
   Optionally, in `buildBridgeLines`, add `Saving you a seat in ${hobbies[0]}...` when hobbies exist.
2. **`src/components/SignedInWorkspace.tsx`**, `connectTools` (around line 255): add
   `{ label: 'House', path: '/house', tone: '#f472b6', icon: <Home className="h-3.5 w-3.5" /> }`
   as the **first** item, and remove the `Community` item (House links to posts). Import `Home` from
   `lucide-react`. The mobile drawer reuses `SidebarContent`, so this covers mobile too.
3. **`src/pages/HomeShellPage.tsx`** (line ~178) and **`src/pages/CompanionLobbyPage.tsx`** (line ~102): change `'/community'` to `'/house'`.
4. Leave `/community` and its pages working (old links, the Posts tab).

## Step 4: Set up Velvet Alpha (Tim, once)

1. Make sure your alpha friends are your **friends** in the messaging overlay.
2. Open House → Velvet Alpha → **Add friends**, and add them.
3. Post a welcome in `# announcements`.

## Done when

- [ ] A brand-new user who picks Gaming + Basketball in the questionnaire lands in Welcome, Updates, Gaming Lounge and Sports Talk without doing anything.
- [ ] An existing user who already did the questionnaire is already placed (migration backfill).
- [ ] Two browsers in the same room see each other's messages instantly, and both appear in "here now."
- [ ] A non-member can read an open space's rooms but sees **Join to chat** instead of the composer.
- [ ] A non-member sees Velvet Alpha listed with a lock, can't open its rooms or posts, and `/community/search` never returns its posts.
- [ ] Unread counts appear on spaces and clear when the room is opened.
- [ ] `# announcements` in Velvet Alpha and `# general` in Updates hide the composer for regular members.
- [ ] Sending 21 messages in a minute shows "Slow down a little."
- [ ] Layout works at 375px wide.
- [ ] `npm run typecheck` and `npm run build` pass.
