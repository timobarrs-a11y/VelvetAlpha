# Phase 3: Public profiles and shared goals

> Read `docs/social-profiles/spec.md` §3 before starting. Phase 1 (access gate)
> must be done. Start with a short numbered plan, then build it.

## Goal

Every member has a public profile, **visible by default**. It shows an
**avatar (never a face photo)**, a display name, a headline, optional gender,
interests, **progress counts** (active goals, goals completed, commitments
kept, plan steps done, current streak) and their posts (phase 4).

**Goal and commitment contents are hidden by default.** Each goal and each
commitment has a **Show on profile** toggle (off by default). Only shown items
reveal their text. **Nothing else is ever public.**

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
- **Per-item visibility.** Add `show_on_profile boolean not null default
  false` to `user_goals` and `coaching_commitments` (owner-writable).
- **RPC `get_public_profile(p_user_id uuid)`** (SECURITY DEFINER). Returns
  **only**:
  - display name, avatar_config, headline, gender (only if `show_gender`),
    interests;
  - progress counts: active goals, goals completed, commitments kept, plan
    steps done, current streak;
  - **shown** goals only (`show_on_profile = true`): `title, goal_type,
    current_value, target_value, unit, target_date, status`;
  - **shown** commitments only: `description` and due/completed date.
  - **Never** `notes`, `extracted_from_message`, step descriptions or any
    other column.
  - It returns nothing if:
    - the viewer or the target fails `can_use_social`,
    - the target isn't discoverable (unless it's the viewer's own profile),
    - either has blocked the other (`im_blocks`).
- **Profile page** at `/u/:userId`: avatar, name, headline, gender (if shown),
  interest chips, the progress counts row, and cards for shown goals and
  commitments.
  - Leave a placeholder for the posts feed (phase 4).
  - Show follower and following counts.
- **Profile editor** (in settings or the existing `ProfilePage`):
  - "Go invisible" toggle. Profiles are **visible by default** from day 1;
    invisible hides the profile from everyone else and from discovery,
  - display name, headline,
  - "Show my gender" toggle,
  - interests,
  - avatar, pulled from the user's current avatar with a "Refresh from my
    avatar" button,
  - a "Show on profile" toggle on every goal and every commitment (also
    reachable from the Plan and Commitments tabs), off by default,
  - an "Auto-post my progress" switch (on by default; posts are generic unless
    an item is shown).
  - Saving copies the chosen values into `im_discovery_profiles`. Nothing is
    copied automatically.
- **Preview.** An "as others see it" button shows the profile through
  `get_public_profile`.

## Non-negotiables
- **Only these fields are public:** avatar, display name, headline, optional
  gender, interests, progress counts, shown goals and commitments (listed
  fields only), posts.
- **Contents hidden by default.** A goal or commitment's text is public only
  after its owner turns on "Show on profile".
- **Nothing private leaks.** Nothing from journals, coaching chat, memories,
  insights, location, political leaning or `notes` is ever reachable by
  another user.
- **No face photos, no uploads.**
- **`user_profiles` stays owner-only.**
- **Everything is gated** by `can_use_social` and blocks.

## Done when
- [ ] A new member's profile shows counts only; no goal or commitment text.
- [ ] Turning on "Show on profile" for one goal reveals only that goal's listed
      fields; turning it off hides it again.
- [ ] Turning off "Show my gender" hides it.
- [ ] A brand-new member's profile is visible to others by default.
- [ ] Turning on "Go invisible" hides the profile from everyone else.
- [ ] Blocked users can't load each other's profiles in either direction.
- [ ] Querying `user_profiles` or `user_goals` for another user from the
      browser console returns nothing.
- [ ] `npm run lint`, `npx vitest run` and `npm run build` pass.
