# Phase 4: Auto-posts (progress as reward)

> Read `docs/social-profiles/spec.md` §4 before starting. Phases 1–3 must be
> done. Start with a short numbered plan, then build it.

## Goal

When a member makes progress on a goal they shared, the app posts it to their
profile **for them**, as a small trophy. They never have to write updates.
They can add a one-line note, undo it, or turn it off per goal. Members can also
write their own posts.

## What exists today
- **Coaching tables** (linked correctly after phase 2): `coaching_commitments`,
  `coach_plan_steps`, `user_goals`.
- **Achievements.** `milestone_achievements` (has `rarity`).
- **Streaks.** Check-in streaks (`current_streak`).
- **Sharing settings.** `social_shared_goals` (phase 3), with `auto_post` and
  `show_details`.
- **Moderation.** `supabase/functions/_shared/moderation.ts` (`moderateInput`).

## Build
- **Tables.**
  - `social_post_events`: queue written by triggers, service role only.
  - `social_posts`: `id, author_id, kind ('auto'|'manual'), source_type,
    source_id, goal_id, body, note, created_at, deleted_at`.
- **Triggers** write to `social_post_events`, **only if** the goal is in
  `social_shared_goals` with `auto_post = true`:

  | Event | Source |
  |---|---|
  | Commitment completed | must have `goal_id`; commitments without a goal **never** post |
  | Plan step completed | the step's plan is linked to a shared goal |
  | Goal completed | `user_goals.status` set to completed |
  | Goal progress | crosses 25 / 50 / 75 % |
  | Check-in streak | hits 3, 7, 14, 30, 60, 100, 180 or 365 days |
  | Achievement | `milestone_achievements` insert with rarity uncommon or higher |

- **Worker** (edge function on cron, every few minutes) turns events into
  posts:
  - **Templates only.** Never use `extracted_from_message` or any chat text.
    - Default: "Completed a step toward **{goal}** · 🔥 {n}-day streak".
    - Use commitment or step titles only when `show_details = true`.
  - **Bundling.** Events on the same goal within 6 hours become one post.
  - **Daily cap.** At most 3 auto-posts per user per day; overflow goes into a
    daily recap post.
- **Feed on the profile page** (the placeholder from phase 3): newest first,
  with each post's goal chip.
- **First-post toast.** The user's first auto-post shows a one-time toast: "We
  shared this to your profile" with **Undo** and **Turn off for this goal**.
- **Post controls.**
  - Add or edit a one-line note on any of your auto-posts.
  - Delete any post (soft delete, hidden immediately).
- **Manual posts.** A "Post an update" box (optional goal link). The text goes
  through `moderateInput` before it's visible.
- **RLS.** Read only if `can_use_social` holds for both sides, the author's
  profile is visible, and neither has blocked the other.

## Non-negotiables
- **Opt-in only.** Nothing posts for a goal the user didn't share with
  auto-post on.
- **No private text.** No chat text, journal text or private notes ever
  appear in a post.
- **Users stay in control.** Every post can be undone or deleted, and
  auto-posting can be turned off per goal.

## Done when
- [ ] Completing a commitment on a shared goal makes one post within minutes.
      On an unshared goal it makes none.
- [ ] Three completions on the same goal within an hour make **one** bundled
      post.
- [ ] The first auto-post shows the toast. Undo removes the post, and "Turn
      off" stops future ones.
- [ ] `show_details` off: the post shows only the goal title.
- [ ] `npm run lint`, `npm run test` and `npm run build` pass.
