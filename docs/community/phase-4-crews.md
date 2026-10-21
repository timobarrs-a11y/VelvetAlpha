# Phase 4: Crews

## Prompt to paste into Bolt

> Read `docs/community/phase-4-crews.md` and build it exactly as written.
> Only open the files it names. Copy `docs/community/sql/phase-4-crews.sql`
> into a new migration without changing it. Phases 2 and 3 must already be applied.

---

## What the person sees

- **Browse** shows every space and, inside each, its **crews** (sub-spaces):
  "Gaming Lounge → 2K27 Crew · 14 members · Request to join". Locked crews
  are still listed and searchable. That's the whole point.
- Any member of a space can **start a crew** inside it, and it's live
  immediately. (Top-level spaces still go to Tim for approval.)
- A crew's door can be: **Open** (tap to join), **Request** (owner/mod
  approves), **Invite only** (link), or **Private** (owners add friends).
- Owners promote **mods**. Owners and mods remove or **ban** people, make
  **invite links**, manage rooms, and give out **colored role tags**
  ("Point Guard", "Captain").
- Type `@` in chat to **mention** someone. They get a notification.

## Step 1: Migration

Create a migration with the exact contents of `docs/community/sql/phase-4-crews.sql`.

| Change | Detail |
|---|---|
| `community_boards.visibility` | now `open`, `request`, `invite` or `private` |
| `community_boards.parent_board_id` | crew → parent space. A sub-space created by a member of the parent is auto-approved. |
| `community_board_bans` | per-space bans; checked on join, request and invite |
| `community_join_requests` | pending/approved/declined; owners and mods get a `join_request` notification |
| `community_invites` | 8-character codes, optional max uses and expiry (default 7 days) |
| `community_role_tags`, `community_member_tags` | colored tags per space |
| Notification types | adds `mention`, `join_request`, `join_approved` (details in `meta`) |
| `get_space_members` | now also returns `tags` (jsonb array of `{id, name, color}`) |

RPCs:

| RPC | Who | Notes |
|---|---|---|
| `get_space_directory(p_parent_id, p_query)` | anyone | `(null, null)` = top-level spaces; `(id, null)` = crews inside a space; `(null, 'text')` = search all levels. Returns board_id, parent_board_id, name, description, icon, color, category, visibility, member_count, is_member, has_pending_request, sub_space_count. |
| `request_to_join_space(p_board_id, p_message)` | anyone | `request` spaces only |
| `get_join_requests(p_board_id)` | owner/mod | Pending requests: id, user_id, display_name, avatar_config, message, created_at |
| `decide_join_request(p_request_id, p_approve)` | owner/mod | Approving adds the member and notifies them |
| `create_space_invite(p_board_id, p_max_uses, p_expires_in_hours)` | owner/mod | Returns the code. Link is `${location.origin}/join/${code}`. |
| `get_invite_preview(p_code)` | anyone | Space card + `is_valid` |
| `redeem_space_invite(p_code)` | anyone | Returns board_id |
| `set_member_role(p_board_id, p_user_id, 'mod' \| 'member')` | owner | |
| `transfer_space_ownership(p_board_id, p_new_owner)` | owner | Old owner becomes mod |
| `remove_space_member(p_board_id, p_user_id, p_ban, p_reason)` | owner (anyone but self), mod (members only) | `p_ban = true` also bans |
| `unban_space_member(p_board_id, p_user_id)` | owner/mod | |
| `update_space_settings(p_board_id, p_name, p_description, p_icon, p_color, p_visibility)` | owner/mod | Null fields are left unchanged |

Direct table access: owners/mods can insert, update and delete `community_rooms` and
`community_role_tags`, and insert and delete `community_member_tags`; owners/mods can read
`community_join_requests` and `community_invites` for their space, and revoke an invite with
`update community_invites set revoked = true`. Room names must match
`^[a-z0-9]+(-[a-z0-9]+)*$`, max 32 characters (slugify what the user types).

**Starting a crew** is a plain insert. The Phase 2 trigger then adds `#general` and makes the creator the owner:

```ts
supabase.from('community_boards').insert({
  name, description, icon, color, visibility,          // 'open' | 'request' | 'invite'
  owner_id: user.id, parent_board_id: parentId, category: parentCategory,
}).select().single();
```

## Step 2: Edge function

Nothing to do. The `community-room-send` function from Phase 2 already turns
`<@user-uuid>` tokens into `mention` notifications. It was a no-op until this
migration added the notification type.

## Step 3: Frontend

1. **`/house/browse`** (rewrite `BrowseSpacesPage.tsx` on top of `get_space_directory`):
   - Top level: spaces grouped by category. Each card shows a visibility chip: **Open**, **Request**, **Invite only**, **Private**. Show "N crews" when `sub_space_count > 0`.
   - Clicking a space shows its crews (`get_space_directory(boardId)`) plus a **Start a crew** button for members.
   - The action button depends on visibility and state: Open → **Join**; Request → **Request to join** (optional message), or **Requested** when `has_pending_request`; Invite → "Invite only. Ask a member for a link."; Private → "Members add people"; `is_member` → **Open**.
   - The search box calls `get_space_directory(null, query)` and searches crews too.
2. **House sidebar (`SpaceSidebar.tsx`)**: nest crews under their parent space, indented, using `parent_board_id`. `get_my_spaces` doesn't return it, so fetch `community_boards.parent_board_id` for the listed ids once.
3. **`StartCrewModal.tsx`**: name, description, icon (pick from the Phase 2 `SpaceIcon` set), color, door (Open / Request / Invite only). On success, navigate to `/house/:newId`.
4. **`SpaceSettingsModal.tsx`** (gear in `SpaceHeader`, owners and mods only), with tabs:
   - **General**: name, description, icon, color, door → `update_space_settings`.
   - **Rooms**: list, add (name + topic + chat/announcements), rename, reorder (up/down → `sort_order`), delete (confirm). `#general` can't be deleted.
   - **Members**: `get_space_members` with role chip and tags. Owner: Make mod / Remove mod, Transfer ownership (confirm). Owner/mod: Remove, Remove & ban (reason). Assign or remove tags.
   - **Requests**: `get_join_requests(boardId)` (name, avatar, message, time) with Approve / Decline → `decide_join_request`.
   - **Invites**: create (uses: 1 / 10 / unlimited; expires: 1 day / 7 days / never), copy link, list active codes with uses, revoke.
   - **Tags**: create (name + color swatch), delete.
5. **`/join/:code`**, new `JoinInvitePage.tsx` with the route in `appRoutes.tsx`: `get_invite_preview` → a card with name, description, member count → **Join** (`redeem_space_invite`) → navigate to `/house/:boardId`. Invalid → "This invite expired or was used up." Not signed in → the app's existing sign-in redirect, then back.
6. **Mentions in `MessageComposer.tsx`**: typing `@` opens a member picker (filter `get_space_members` by name, arrow keys and Enter). Picking inserts `<@user_id>` into the text, shown as a chip in the input if that's easy, otherwise plain `@Name` that is swapped for the token on send. In `RoomChat.tsx`, render `<@uuid>` as a highlighted `@DisplayName`, and highlight the whole message when it mentions me.
7. **Role tags in chat**: next to each author's name, show their first tag as a small pill in its color.
8. **`NotificationBell.tsx`**: render the new types from `meta`:
   - `mention`: "{actor} mentioned you in #{room}" → `/house/{meta.board_id}`. Get the room name from `community_rooms` by `meta.room_id`, or just say "in a room".
   - `join_request`: "{actor} wants to join {meta.board_name}" → opens that space's settings on the Requests tab.
   - `join_approved`: "You're in! Welcome to {meta.board_name}" → `/house/{meta.board_id}`.

## Done when

- [ ] A Gaming Lounge member starts "2K27 Crew" (Request) and it appears immediately under Gaming Lounge in Browse, with a lock chip, for everyone.
- [ ] Searching "2k" in Browse finds the crew.
- [ ] A non-member requests to join, the owner gets a notification, approves, and the requester gets "You're in!" and sees the crew in their sidebar.
- [ ] A one-use invite link works once, then shows "expired or used up."
- [ ] A mod can remove a member but not the owner or another mod. A banned user can't rejoin, request or redeem an invite.
- [ ] A colored tag appears next to the member's name in chat.
- [ ] `@` autocomplete works, and the mentioned person gets a notification that opens the room.
- [ ] `npm run typecheck` and `npm run build` pass.
