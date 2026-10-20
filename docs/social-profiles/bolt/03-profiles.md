# Phase 3: Public profiles and shared goals

> Read `docs/social-profiles/spec.md` §3 before starting. Phase 1 (access gate)
> must be done. Start with a short numbered plan, then build it.

## Goal

Every member can have a public profile. It shows an **avatar (never a face
photo)**, a display name, a headline, optional gender, interests, the goals
they chose to share with progress and streaks, and their posts (posts come in
phase 4). **Nothing else is ever public.**

## What exists today
- **`im_discovery_profiles`** (migration
  `20261019051408_..._create_real_time_messaging_overlay_system.sql.sql`):
  - columns: `user_id`, `display_name`, `avatar_url`, `headline`,
    `interests[]`, `discoverable` (default false);
  - RLS: read if discoverable or own.
  - **Extend this table. Don't make a new profile table.**
- **`user_profiles`** is readable only by its owner. **Keep it that way.**
  Never create a view, join or RPC that exposes it to other users.
- **Avatar system.** `user_profiles.avatar_config` (jsonb), rendered by
  `src/components/AvatarV2.tsx` / `Avatar.tsx`.
- **Goals.** `user_goals`, plus streaks in the check-in / customization tables
  (`current_streak`, `longest_streak`).
- **Gate.** `can_use_social(uid)` from phase 1.

## Build
- **Extend `im_discovery_profiles`.**
  - Add `avatar_config jsonb`, `gender text`, `show_gender boolean default
    false`.
  - Lock `avatar_url` so it can only hold our own generated avatar render
    URLs (check constraint on the storage prefix), or drop its use. **No
    uploads.**
- **New table `social_shared_goals`.**
  - Columns: `user_id`, `goal_id → user_goals on delete cascade`,
    `auto_post boolean default true`, `show_details boolean default false`,
    `created_at`, `PRIMARY KEY (user_id, goal_id)`.
  - RLS: owner writes; others read only via the profile RPC.
- **RPC `get_public_profile(p_user_id uuid)`** (SECURITY DEFINER). Returns
  **only**:
  - display name, avatar_config, headline, gender (only if `show_gender`),
    interests;
  - shared goals with `title, goal_type, current_value, target_value, unit,
    target_date, status` and current streak.
  - **Never** `notes` or any other column.
  - It returns nothing if:
    - the viewer or the target fails `can_use_social`,
    - the target isn't discoverable (unless it's the viewer's own profile),
    - either has blocked the other (`im_blocks`).
- **Profile page** at `/u/:userId`: avatar, name, headline, gender (if shown),
  interest chips, and shared goal cards with progress bar and streak.
  - Leave a placeholder for the posts feed (phase 4).
  - **No follower or following counts anywhere.**
- **Profile editor** (in settings or the existing `ProfilePage`):
  - "Make my profile visible" toggle (`discoverable`),
  - display name, headline,
  - "Show my gender" toggle,
  - interests,
  - avatar, pulled from the user's current avatar with a "Refresh from my
    avatar" button,
  - a per-goal "Share this goal" toggle, with sub-toggles "Auto-post progress"
    and "Show commitment details".
  - Saving copies the chosen values into `im_discovery_profiles`. Nothing is
    copied automatically.
- **Preview.** An "as others see it" button shows the profile through
  `get_public_profile`.

## Non-negotiables
- **Only these fields are public:** avatar, display name, headline, optional
  gender, interests, shared goals (listed fields only), posts.
- **Nothing private leaks.** Nothing from journals, coaching chat, memories,
  insights, location, political leaning or `notes` is ever reachable by
  another user.
- **No face photos, no uploads.**
- **`user_profiles` stays owner-only.**
- **Everything is gated** by `can_use_social` and blocks.

## Done when
- [ ] A user shares one of two goals; another user sees only that goal, with
      only the listed fields.
- [ ] Turning off "Show my gender" hides it.
- [ ] Turning off "Make my profile visible" hides the profile from everyone
      else.
- [ ] Blocked users can't load each other's profiles in either direction.
- [ ] Querying `user_profiles` or `user_goals` for another user from the
      browser console returns nothing.
- [ ] `npm run lint`, `npx vitest run` and `npm run build` pass.
