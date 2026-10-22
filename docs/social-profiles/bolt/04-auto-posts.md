# Phase 4: Auto-posts (progress as reward)

> Read `docs/social-profiles/spec.md` §4 before starting. Phases 1–3 must be
> done. Start with a short numbered plan, then build it.

## Goal

When a member makes progress, the app posts it to their profile **for them**,
as a small trophy. **Posts are generic by default** ("Kept a commitment ·
🔥 12-day streak"); they name a goal or commitment only if the member turned
on "Show on profile" for that item. They never have to write updates.
They can add a one-line note, undo it, or turn it off per goal. Members can also
write their own posts.

## What exists today
- **Coaching tables** (linked correctly after phase 2): `coaching_commitments`,
  `coach_plan_steps`, `user_goals`.
- **Achievements.** `milestone_achievements` (has `rarity`).
- **Streaks.** Check-in streaks (`current_streak`).
- **Visibility.** `show_on_profile` on `user_goals` and
  `coaching_commitments`, plus the member's "Auto-post my progress" switch
  (phase 3).
- **Moderation.** `supabase/functions/_shared/moderation.ts` (`moderateInput`).

## Build
- **Tables.**
  - `social_post_events`: queue written by triggers, service role only.
  - `social_posts`: `id, author_id, kind ('auto'|'manual'), source_type,
    source_id, goal_id, body, note, created_at, deleted_at`.
- **Triggers** write to `social_post_events` when auto-posting is on and the
  member isn't invisible:

  | Event | Source |
  |---|---|
  | Commitment completed | `coaching_commitments.status` set to completed |
  | Plan step completed | `coach_plan_steps.completed_at` set |
  | Goal completed | `user_goals.status` set to completed |
  | Goal progress | crosses 25 / 50 / 75 % |
  | Check-in streak | hits 3, 7, 14, 30, 60, 100, 180 or 365 days |
  | Achievement | `milestone_achievements` insert with rarity uncommon or higher |

- **Worker** (edge function on cron, every few minutes) turns events into
  posts:
  - **Templates only.** Store the event type and ids, not the text. Render the
    text **at read time** against current visibility:
    - generic by default: "Kept a commitment", "Completed a plan step",
      "Finished a goal 🏆", "Halfway to a goal", plus the streak;
    - name the goal or commitment only when that item has
      `show_on_profile = true`. Hiding it later turns old posts generic again.
  - Never use `extracted_from_message`, step descriptions, or any chat or
    journal text.
  - **Bundling.** Events on the same goal within 6 hours become one post.
  - **Daily cap.** At most 3 auto-posts per user per day; overflow goes into a
    daily recap post.
- **Feed on the profile page** (the placeholder from phase 3): newest first,
  with each post's goal chip.
- **First-post toast.** The user's first auto-post shows a one-time toast: "We
  shared your progress (no details) to your profile" with **Undo** and **Turn
  off auto-posts**.
- **Post controls.**
  - Add or edit a one-line note on any of your auto-posts.
  - Delete any post (soft delete, hidden immediately).
- **Manual posts.** A "Post an update" box (optional goal link). The text goes
  through `moderateInput` before it's visible.
- **RLS.** Read only if `can_use_social` holds for both sides, the author's
  profile is visible, and neither has blocked the other.

## Non-negotiables
- **Generic by default.** No goal title or commitment text appears in any
  post unless that exact item is shown on the profile.
- **No private text.** No chat text, journal text or private notes ever
  appear in a post.
- **Users stay in control.** Every post can be undone or deleted, and
  auto-posting can be turned off per goal.

## Done when
- [ ] Completing a commitment makes one **generic** post within minutes.
- [ ] Turning on "Show on profile" for that commitment shows its text in the
      post; turning it off makes the post generic again.
- [ ] Three completions on the same goal within an hour make **one** bundled
      post.
- [ ] The first auto-post shows the toast. Undo removes the post, and "Turn
      off" stops future ones.
- [ ] `npm run lint`, `npx vitest run` and `npm run build` pass.
