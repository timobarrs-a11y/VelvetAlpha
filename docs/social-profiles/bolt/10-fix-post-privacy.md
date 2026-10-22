# Fix: generic-by-default progress (urgent, run before anything else)

> **For Bolt:** this fixes privacy problems in what's already on `main`. Start
> with a short numbered plan (files and migrations), then build it. Inspect the
> code rather than guess. Don't change anything outside this scope.

## The decision

Profiles stay **public by default**, and follower counts stay visible. But
progress is **generic by default**:

- **Profiles show counts, not contents:** "3 active goals · 12 commitments
  kept · 🔥 9-day streak".
- **Auto-posts are generic:** "Kept a commitment", "Completed a plan step",
  "Finished a goal 🏆", "Hit a 30-day streak 🔥".
- **Show on profile is per item.** Every goal and every commitment has a
  **Show on profile** toggle, **off by default**. Only when it's on can other
  members see that item's title or text, on the profile and in posts.
- **Hiding works backwards.** Hiding an item again makes it disappear from the
  profile **and** turns any older post that mentioned it back into generic
  text.

## What's wrong on `main` today

1. **Auto-posts publish private text.**
   - **Where:** `supabase/migrations/20261020183350_20261020192000_progress_posts_and_triggers.sql`.
   - **Commitments:** `trg_post_on_commitment_completed` writes
     `NEW.description` into `progress_posts.body` and the goal title into
     `title`. Commitment descriptions often come straight from private coaching
     chats.
   - **Plan steps:** `trg_post_on_plan_step_completed` writes the step title and
     plan title.
   - **Goals:** `trg_post_on_goal_completed` writes the goal title.
   - **Why it's urgent:** all of this happens for every member, because
     profiles are now public by default.
2. **Atlas introductions leak every goal title.**
   - **Where:** `get_atlas_introductions` in
     `20261020183832_20261020194000_atlas_introductions.sql`.
   - **What leaks:** it returns `shared_goal_titles` built from **all** of the
     other member's active or completed goals, not just shared ones. Any
     signed-in user can call it.
   - **Also:** it doesn't check `im_blocks`.
3. **Member profile goals are fetched from the browser.**
   - **Where:** `src/pages/MemberProfilePage.tsx` (~L43) and
     `MyPublicProfilePage.tsx`.
   - **What happens:** they query another member's `user_goals` rows directly
     with `select('*')`. RLS on `user_goals` is owner-only, so this silently
     returns nothing. The fix is **not** to open up `user_goals`, which would
     expose `notes` and everything else. Use a function instead (below).

## Build

### 1. Visibility flags
- **Columns.** Add `show_on_profile boolean not null default false` to
  `user_goals` and `coaching_commitments`, and add it to the client column
  UPDATE grant so the owner can toggle it.
- **Migrate the old field.** Goals currently in
  `member_profiles.shared_goal_ids`: set their `show_on_profile = true` (the
  member chose to share them). Then stop using `shared_goal_ids` (keep the
  column for now, write nothing new to it).
- **Toggles in the UI:**
  - in `PublicProfileSettings.tsx` (list of goals and commitments with a toggle
    each),
  - on each goal in the Plan/goal views,
  - on each commitment in the Commitments view.

### 2. Generic auto-posts, rendered at read time
- **Change the three triggers** so they store only the event: `post_type`,
  `ref_target_type`, `ref_target_id` and `goal_id`, with **generic** `title`
  text and **no** `body`:

  | `post_type` | Generic title |
  |---|---|
  | commitment completed | "Kept a commitment" |
  | plan step completed | "Completed a plan step" |
  | goal completed | "Finished a goal 🏆" |

  Never copy `description`, step titles, plan titles or goal titles into the
  row.
- **Create `get_progress_feed(...)` / `get_member_posts(p_user_id, ...)`**
  (SECURITY DEFINER, `search_path = public, pg_temp`). They return posts with
  the display text **resolved now**:
  - **Commitment post:** if the commitment has `show_on_profile`, show "Kept a
    commitment: {description}"; otherwise the generic title.
  - **Step post:** if the step's goal has `show_on_profile`, show "Completed a
    step toward {goal title}"; otherwise generic.
  - **Goal post:** if the goal has `show_on_profile`, show "Finished {goal
    title} 🏆"; otherwise generic.
  - **The viewer's own posts** can show full detail to the viewer only.
- **Point the UI at the functions.** `ProgressFeedPage`, the member profile
  feed and any other place that reads `progress_posts` for display should
  switch to these functions. Remove direct client SELECT of `progress_posts`
  for other users' rows (the RLS policy `select_public_progress_posts`), or
  limit it to columns that are always generic.
- **Backfill.** Rewrite every existing `progress_posts` row: set the generic
  `title` for its `post_type` and set `body = null`. The original text must be
  **gone** from the table, not just hidden in the UI.
- **First-post toast.** Text: "We shared your progress (no details) to your
  profile", with **Undo** and **Turn off auto-posts**.

### 3. Public profile through a function
- **Create `get_public_profile(p_user_id)`** (SECURITY DEFINER). It returns:
  - the existing public `member_profiles` fields;
  - **progress counts:** active goals, goals completed, commitments kept, plan
    steps done, current streak;
  - **shown goals only:** `title, goal_type, current_value, target_value, unit,
    target_date, status`;
  - **shown commitments only:** `description` and due/completed date.

  It never returns `notes`, `extracted_from_message`, step descriptions or any
  other column. It returns nothing if the member is invisible
  (`is_public = false`) or either side has blocked the other.
- **Switch the pages.** `MemberProfilePage.tsx` and `MyPublicProfilePage.tsx`
  use this function and stop querying `user_goals` directly.
- **Counts row on the profile:** "3 active goals · 12 commitments kept ·
  🔥 9-day streak".

### 4. Atlas introductions
- **Rewrite `get_atlas_introductions`:**
  - match on `goal_type` (fine to use for everyone);
  - return `shared_goal_types` for all matches, and `shared_goal_titles`
    **only** from goals with `show_on_profile = true`;
  - exclude blocked users in both directions.
- **Atlas prompt.** Update the Atlas prompt or card so it mentions a goal
  title only when one is returned, otherwise the goal type ("also working on a
  fitness goal").

### 5. Discovery
- **`discoveryService.ts` and its queries:** group cards by `goal_type` for
  everyone. Build title-based cards ("12 people training for a 5K") **only**
  from goals with `show_on_profile = true`.

## Non-negotiables
- **Hidden means hidden everywhere.** With `show_on_profile` off, a goal's
  title or a commitment's text is unreachable by any other user through any
  table, view, function, post, discovery card or Atlas result.
- **Old text is removed.** The existing posts' private text is removed from
  the database, not just hidden.
- **`user_goals` and `coaching_commitments` stay owner-only** under RLS. Other
  users only get data through the SECURITY DEFINER functions above.
- **Unchanged:** public-by-default profiles, follower counts, and the
  "invisible" option.

## Done when
- [ ] As user A, complete a commitment with private-sounding text. As user B,
      the feed and A's profile show only "Kept a commitment".
- [ ] A turns on "Show on profile" for that commitment, and B now sees its
      text. A turns it off, and B sees "Kept a commitment" again on the same
      post.
- [ ] `select title, body from progress_posts` shows no commitment
      descriptions, goal titles or step titles in any row, including old rows.
- [ ] B calling `get_atlas_introductions` gets no titles of A's hidden goals.
- [ ] B's view of A's profile shows the counts row and only the goals and
      commitments A chose to show. A's profile page no longer queries
      `user_goals` from the browser.
- [ ] `npm run lint`, `npx vitest run` and `npm run build` pass.
