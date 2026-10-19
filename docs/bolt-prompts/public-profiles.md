# Bolt prompts: Public Profiles ("The Wall")

How to use: paste the **Context block** first, then **one phase prompt at a time**.
Let Bolt finish, test it in the app, then move on. Each phase ships something usable
on its own. Don't paste all four at once; Bolt does much better with one focused job.

---

## Design decisions (already thought through, so Bolt doesn't have to)

1. **One public identity, not a second profile system.** `im_discovery_profiles`
   already has `alias` (unique, case-insensitive), `headline`, `intro`, `interests`,
   `age_range`, `discoverable`, `available_to_chat`. The public profile extends this
   table. The private `user_profiles` row (questionnaire answers, zodiac, etc.) is
   never shown publicly.
2. **No faces by design.** The profile picture is the user's illustrated avatar
   (existing `AvatarV2` / `avatar_config`) or their **signature smilie**. There is no
   profile-photo upload. Photos are only allowed inside posts (phase 4).
3. **Nothing private becomes public on its own.** Commitments are often extracted from
   private AI chats (`coaching_commitments.extracted_from_message`). Sharing is opt-in
   per item, and the user approves or edits the exact public wording (`public_text`)
   before it's shown. Public data is served through `SECURITY DEFINER` RPCs that return
   only safe columns. RLS on the private tables is never loosened.
4. **The mood smilie is the post's identity**, like old message-board post icons. It's
   the first thing you pick in the composer and the biggest thing on the post card. The
   475-smilie bank has unreadable codes as labels, so we add a curated **Mood Shelf**
   (labeled categories). The full bank is still searchable behind "More".
5. **Progress is the content engine.** Empty walls kill social features. Completing a
   commitment or hitting a goal offers a one-tap "Share this win" that makes a
   milestone post. Users never face a blank box.
6. **Entertainment is built in:** animated smilies, a mood status, vibe themes,
   confetti on milestones, "Cheers" (a special reaction), progress bars. It's playful
   and old-school, but stays inside the locked Velvet design tokens.
7. **Safety at the database level:** blocks hide everything in both directions, the
   wall owner controls who can post on their wall, the owner can delete anything on
   their own wall, reports auto-hide content, and rate limits are enforced with
   triggers. Photos are re-encoded in the browser, which strips EXIF data including GPS.

---

## Context block (paste first, every time)

```
You're working in an existing React 18 + Vite + TypeScript + Tailwind + Supabase app
(framer-motion, zustand, @tanstack/react-query, lucide-react, react-router v7).
Do NOT restructure existing code or rename existing tables/components. Extend them.

Key existing pieces to reuse (read them before writing code):
- Design system: src/design/README.md, src/design/design-system.css (use .ds-page,
  .ds-card, .ds-pill, .ds-badge, .ds-chip and --ds-* tokens; the dark-purple palette
  is locked). Shared UI primitives: src/shared/ui/* (PageShell, PageHeader, Card,
  Button, EmptyState, Skeleton, ModalShell, Toast, Pill).
- Routes: src/routes/appRoutes.tsx (protected routes wrapped with P(...)).
- Messaging, friends, discovery: src/shared/supabase/queries/messaging.ts
  (getMyDiscoveryProfile, upsertMyDiscoveryProfile, setMyDiscoveryIdentity,
  sendFriendRequest(with intro), respondToFriendRequest, getFriends, blockUser,
  getOrCreateConversation, getDiscoverySuggestions) and the UI in
  src/components/MessagingOverlay.tsx (views: friends, conversations, discover,
  requests, settings). Tables: im_discovery_profiles, im_friendships, im_presence,
  im_blocks, im_conversations, im_messages.
- Smilies: src/config/smilieRegistry.ts (SMILIES, REACTION_SMILIES, renderSmilies,
  images in /public/smilies), src/components/community/SmiliePicker.tsx,
  src/components/community/SmilieText.tsx.
- Community boards (pattern to mirror for posts/comments/reactions/reports/
  notifications): community_posts, community_comments, community_reactions,
  community_reports, community_notifications, get_community_badges(p_user_id),
  src/components/community/NotificationBell.tsx, BadgeDisplay.tsx.
- Goals & commitments: user_goals (title, target_value, current_value, unit,
  target_date, status) and coaching_commitments (description, status, due_date,
  completed_at, progress_note, category, is_user_created, goal_id).
  Pages: src/pages/CoachingCommitmentsPage.tsx, src/pages/GoalDetailPage.tsx.
- Avatars: src/components/AvatarV2.tsx (illustrated avatar from avatar_config).
- Age gating: user_profiles.age_verified_at; AgeVerificationModal.tsx.

Rules:
- New SQL goes in a new file in supabase/migrations/ with a header comment block like
  the existing migrations (Why / New tables / Security / Notes). Idempotent
  (IF NOT EXISTS, DROP POLICY IF EXISTS). RLS on every new table.
- Never expose private columns publicly. Public reads go through SECURITY DEFINER
  RPCs with SET search_path = public that return only safe fields and respect
  im_blocks in both directions.
- Mobile-first (works at 360px wide), keyboard accessible, skeletons while loading,
  optimistic UI for reactions/posts, friendly empty states that tell the user what
  to do next.
- Run typecheck and lint before finishing.
```

---

## Phase 1: Profile page + shared goals (read-only for visitors)

```
Build the public profile page: "The Wall".

DATABASE (one migration):
1. Extend im_discovery_profiles with:
   - bio text (max 500, CHECK)
   - signature_smilie text (a smilie code from the registry; shown as the
     profile icon when the user has no avatar, and as a badge next to the alias)
   - mood_smilie text, mood_text text (max 80), mood_updated_at timestamptz
     (the "current mood" status, like an away message)
   - vibe_theme text NOT NULL DEFAULT 'velvet' CHECK IN ('velvet','sunset','ocean',
     'forest','ember','midnight','neon') (a preset banner gradient, NOT a photo)
   - wall_policy text NOT NULL DEFAULT 'friends' CHECK IN ('everyone','friends','off')
   - show_online boolean NOT NULL DEFAULT true
   - joined_at timestamptz NOT NULL DEFAULT now()
2. Add to user_goals AND coaching_commitments:
   - is_public boolean NOT NULL DEFAULT false
   - public_text text (max 200; the user-approved wording shown publicly)
   - shared_at timestamptz
   Do NOT change existing RLS on these tables.
3. RPC get_public_profile(p_alias text) RETURNS json, SECURITY DEFINER:
   - Looks up by lower(alias), requires discoverable = true OR caller is owner.
   - Returns null if either party has blocked the other (im_blocks).
   - Returns: user_id, alias, display_name, headline, bio, intro, interests,
     age_range, avatar_url, signature_smilie, mood_smilie, mood_text,
     mood_updated_at, vibe_theme, wall_policy, joined_at,
     is_online (only if show_online AND im_presence.is_online),
     available_to_chat,
     friendship_status relative to caller ('self'|'none'|'pending_out'|
       'pending_in'|'friends') plus friendship_id,
     stats: { goals_active, goals_completed, commitments_completed (public ones),
       friend_count, cheers_received (0 for now) },
     badges: get_community_badges(user_id),
     public_goals: [{id, public_text, goal_type, current_value, target_value,
       unit, target_date, status, shared_at}],
     public_commitments: [{id, public_text, status, due_date, completed_at,
       category, shared_at}] (latest 20).
   Never return description, notes, extracted_from_message, email or real names.
4. RPC set_item_public(p_kind text ('goal'|'commitment'), p_id uuid,
   p_is_public boolean, p_public_text text): owner only, validates length,
   sets shared_at.

FRONTEND:
- Route /u/:alias -> src/pages/PublicProfilePage.tsx. Also /me redirects to the
  caller's own /u/:alias (if no alias, open the identity setup from the
  messaging settings view).
- Layout (mobile: single column; desktop: two columns, 1/3 sidebar + 2/3 main):
  * Banner: gradient from vibe_theme with soft animated glow (framer-motion,
    respect prefers-reduced-motion). Over it: big AvatarV2 (or signature smilie
    in a ds-chip circle), alias with signature smilie badge, headline, age range
    pill, interest chips, online dot ("Online now" / "Available to chat").
  * Mood status bubble: "<mood smilie> feeling: <mood_text> · 2h ago". The
    owner taps it to change it (popover with Mood Shelf + 80-char text).
  * Action bar (visitor): Add friend (opens intro-message modal and calls
    sendFriendRequest), Pending / Accept, Message (only if friends ->
    getOrCreateConversation, then open MessagingOverlay on that chat), "..."
    menu with Block and Report.
    Action bar (owner): Edit profile, Share your profile (copy link), Preview as
    visitor toggle.
  * Stats row: Active goals · Wins · Friends · Badges (count-up animation).
  * "Working on" section: public goals as cards with an animated progress bar
    (current/target + unit), days-to-target, and a status pill.
  * "Commitments" section: public commitments as a checklist-style timeline
    (done ones get a check + completed date; open ones show due date).
  * Main column placeholder for the wall (phase 3) with an EmptyState.
- Edit Profile modal (ModalShell): bio, headline, intro, interests (chip input),
  signature smilie (Mood Shelf picker), vibe theme (swatch picker with live
  preview of the banner), wall policy, show online. Save via a new
  upsertPublicProfile() in messaging.ts.
- Sharing UX in CoachingCommitmentsPage and GoalDetailPage: add a "Share on my
  wall" toggle per item. Turning it on opens a small modal: "This is what others
  will see:" with an editable text field pre-filled from the title/description
  (trimmed to 200), plus a privacy line: "Only this text is shared. Your chats
  and notes stay private." Confirm -> set_item_public. Show a small globe icon
  on items that are public.
- MOOD SHELF: in smilieRegistry.ts add
  export const MOOD_SHELF: { category: string; label: string; code: string }[]
  with categories: Hyped, Proud, Grinding, Chill, Grateful, Tired, Frustrated,
  LOL, Thinking, Love. Seed it with codes from REACTION_SMILIES (3-4 per
  category) and leave a clear TODO so the owner can re-curate by eye. Build
  src/components/community/MoodPicker.tsx: tabs per category, labeled big tiles,
  "Recent" (localStorage, try/catch) first, and a "Whole smilie bank" tab that
  reuses the SmiliePicker search. Picking is one tap; selected state is obvious.
- In MessagingOverlay discover cards and friend rows: tapping the avatar/alias
  opens /u/:alias. Add a "View profile" item too.
- Add "My Wall" to the app navigation wherever Profile/Community are linked.

Acceptance: a visitor sees only discoverable profiles; private goal/commitment
text never appears unless shared; blocked users get a "Profile not available"
state; works at 360px.
```

---

## Phase 2: People directory ("The Lounge")

```
Build a directory where users find others by interest from anywhere.

DATABASE:
- RPC search_people(p_query text, p_interests text[], p_online_only boolean,
  p_available_only boolean, p_sort text ('match'|'active'|'new'),
  p_limit int, p_offset int) RETURNS SETOF json, SECURITY DEFINER:
  * Only discoverable profiles with an alias, excluding the caller, excluding
    blocks in both directions.
  * Returns alias, display_name, headline, avatar_url, signature_smilie,
    mood_smilie, mood_text, vibe_theme, interests, age_range, available_to_chat,
    is_online (respecting show_online), top 2 public goal public_texts,
    shared_interests (the intersection with the caller's interests),
    match_score (count of shared interests), friendship_status.
  * 'match' sorts by match_score desc then online; 'active' by last_seen_at;
    'new' by joined_at.
  * im_presence is friends-only under RLS, so read it inside this function and
    expose only the boolean.
  * Index whatever the query needs (GIN on interests, lower(alias)).

FRONTEND: /people -> src/pages/PeoplePage.tsx
- Header: "The Lounge" plus a live count "N people online now".
- Sticky filter bar: search (alias/headline), interest chips (the caller's own
  interests pre-selected; tap to toggle; "+ more" opens all interests seen),
  toggles: Online now, Available to chat; sort segment: Best match / Active /
  New here.
- Card grid (1 col mobile, 2 tablet, 3-4 desktop). Each card is tinted by the
  person's vibe_theme: avatar or signature smilie, alias, mood bubble, headline,
  "You both like: fitness, reading" highlight, 2 goal snippets with a little
  target icon, and an online/available dot. Card actions: View wall, Add friend
  (intro modal), Message (if friends). Hover/press micro-animation.
- Infinite scroll with skeleton cards; empty state with a "Loosen filters" button.
- "Shuffle" button: pulls 6 random people who share at least one interest
  ("Meet someone new"), shown with a card-flip animation. This is the fun way in.
- Replace the body of MessagingOverlay's 'discover' view with a compact version
  of the same cards (reuse a shared PersonCard component) plus a "Open the
  Lounge" link to /people.
- Nav link "The Lounge" next to Community.

Acceptance: filtering by an interest finds a test user who has it; blocked users
never appear; non-discoverable users never appear; online dot respects
show_online.
```

---

## Phase 3: Wall posts with a mood smilie, comments, reactions, Cheers

```
Add posting to The Wall. Mirror the community_* patterns for consistency.

DATABASE:
- profile_posts: id, wall_owner_id (uuid FK auth.users), author_id
  (default auth.uid()), kind text CHECK IN ('update','milestone','wall') ,
  body text (1-2000), mood_smilie text NOT NULL, linked_goal_id uuid NULL,
  linked_commitment_id uuid NULL, visibility text CHECK IN ('public','friends')
  DEFAULT 'public', is_hidden boolean DEFAULT false, edited_at, created_at,
  comment_count int, cheer_count int.
  * 'update'/'milestone' require author_id = wall_owner_id.
  * 'wall' (someone posting on another's wall) is allowed only per the owner's
    wall_policy ('everyone' = any non-blocked discoverable user, 'friends' =
    accepted friends, 'off' = nobody). Enforce in an INSERT policy or trigger.
  * Linked goal/commitment must belong to the author and be is_public.
- profile_post_comments: id, post_id, author_id, body (1-1000), mood_smilie NULL,
  is_hidden, created_at. Allowed if the caller can see the post and isn't blocked.
- profile_post_reactions: post_id, user_id, smilie_code (text <= 60), plus a
  special code 'cheer'. PK (post_id, user_id, smilie_code).
- profile_post_reports: mirror community_reports. A trigger auto-hides a post or
  comment at 3 distinct reports.
- Delete: author can delete their own; the wall owner can delete anything on
  their wall. Edit: author only, within 24h (sets edited_at).
- Rate limit triggers: max 20 posts/day and 100 comments/day per author.
- Visibility: SELECT via RPC get_wall(p_alias, p_before timestamptz, p_limit)
  that applies discoverable, block, visibility = friends, and is_hidden rules
  and returns author alias/avatar/signature smilie, reaction tallies, whether the
  caller cheered, and the linked goal's public snapshot (progress bar data).
- cheers_received in get_public_profile = sum of 'cheer' reactions on the
  owner's posts.
- Notifications: extend community_notifications.type CHECK to add
  'wall_post','wall_comment','wall_reaction','wall_cheer','friend_milestone'
  and target_type to add 'profile_post'. Insert via triggers. NotificationBell
  links them to /u/:alias#post-<id>.

FRONTEND:
- Composer at the top of the wall (owner: "What's the update?"; visitor, if
  allowed: "Leave something on <alias>'s wall"):
  * Step 1 is the mood: a large dashed tile "Pick your mood" opens MoodPicker.
    The chosen smilie sits big at the left of the composer, so the post feels
    like it's about the feeling.
  * Text area with inline smilie insertion (existing SmiliePicker + SmilieText
    rendering), 2000 char counter, "Link a goal" dropdown (own public goals
    only), visibility toggle (Public / Friends), Post button. Ctrl/Cmd+Enter
    posts. Drafts are saved to localStorage (try/catch).
- Post card: big mood smilie (64px, animated gifs play) as the left gutter icon
  like classic forums; author alias, time, "posted on X's wall" when kind=wall;
  body via SmilieText; if linked to a goal, an embedded mini goal card with a
  progress bar. Below: Cheer button (special animated reaction with a burst
  effect and counter), quick reactions (6 from the Mood Shelf + "more"),
  comment count. Owner/author "..." menu: edit, delete, report.
- MILESTONE posts look special: gold-tinted ds-card border, a "WIN" badge,
  confetti burst the first time it scrolls into view (once per post per viewer,
  reduced-motion safe).
- "Share this win" flow: when a commitment is marked complete or a goal hits
  its target (CoachingCommitmentsPage, GoalDetailPage), show a toast/modal:
  "Nice! Share it on your wall?" pre-filled with a milestone post (mood from the
  Proud category, text "Done: <public_text>", linked goal). If the item isn't
  public yet, the same modal lets them approve the public wording. One tap posts.
- Comments: collapsed preview (latest 2), expand inline, optional mood smilie
  per comment.
- Optimistic posting, reacting and commenting (react-query mutations with
  rollback). Realtime: subscribe to new posts on the open wall and show a "N new
  posts" pill instead of jumping the scroll.

Acceptance: wall_policy is enforced for all three values; blocked users can't
post, comment, react or see posts; owner deletion works on others' wall posts;
3 reports hide a post; milestone flow creates a linked post.
```

---

## Phase 4: Photos in posts + friends feed

```
Add photos to wall posts cheaply and safely, plus a friends' updates feed.

STORAGE:
- Supabase storage bucket 'profile-media' (public read, so images load fast
  without signed URLs; non-guessable paths), file_size_limit 600 KB,
  allowed_mime_types image/webp, image/jpeg. Follow the pattern in
  supabase/migrations/20260228022452_create_chat_wallpapers_storage_bucket.sql.
- Path format: <user_id>/<post_uuid>/<random>.webp. Policies: insert and delete
  only within your own user_id folder.
- profile_posts gets photo_paths text[] DEFAULT '{}' with CHECK
  (array_length <= 4). profile_post_photos is NOT needed.
- Trigger: max 15 photos uploaded per user per day (count the photo_paths
  added on insert).
- When a post is deleted or hidden, delete its storage objects (edge function or
  pg trigger calling storage API; or a nightly cleanup job of orphans).

CLIENT:
- src/utils/compressImage.ts: decode with createImageBitmap, draw onto a canvas
  at max 1600px on the long edge, export WebP at quality 0.8 (fall back to JPEG
  if WebP is unsupported), and retry at a lower quality until under 500 KB.
  Re-encoding strips EXIF/GPS. Note that in a comment.
  Reject files over 15 MB before decoding. Handle HEIC with a friendly error.
- Composer: "Add photos" button + drag-and-drop + paste, up to 4. Thumbnail
  strip with remove/reorder, upload progress, and a required alt-text field
  ("Describe it for people who can't see it", prefilled empty).
- Post card: 1 photo = full width; 2 = side by side; 3-4 = grid. Tap opens a
  lightbox (swipe, arrows, Esc). Lazy-load with loading="lazy" and a blurred
  placeholder. Reported/hidden posts hide their photos too.
- Gentle reminder in the photo picker: "Show your progress, not your face. No
  personal info in photos." (tone: friendly, not scolding).

FRIENDS FEED:
- RPC get_friends_feed(p_before, p_limit): recent update/milestone posts from
  accepted friends, block-aware.
- On /people add a tab "Friends' updates" (and a compact widget in the lobby if
  there's a natural slot): the same post cards, newest first, with milestone
  posts emphasized.

Acceptance: a 10 MB phone photo uploads as < 500 KB WebP with no EXIF; can't
upload into someone else's folder; a 5th photo is blocked; the lightbox works on
mobile.
```

---

## Later ideas (not for Bolt yet)

- Weekly "Wins Roundup" auto-post or digest for friends.
- Accountability buddies: two friends link a shared goal and see each other's
  check-ins.
- Profile guestbook stickers: drop a smilie sticker on someone's banner.
- AI-assisted moderation pass on photos and text before publishing (Claude
  vision), once volume justifies the cost.
