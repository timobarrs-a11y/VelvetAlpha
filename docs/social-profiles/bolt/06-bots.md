# Phase 6: Bots (likes with momentum, question bots, disclosure)

> Read `docs/social-profiles/spec.md` §5 and §6 before starting. Phases 1–5
> must be done. Start with a short numbered plan, then build it.

## Goal

Bots are part of the community and the site says so.

- **Bot likes.** They like posts that match their interests, so members feel
  seen. The amount builds with momentum like real life: a first post gets a
  few likes, and an established member with real engagement gets more.
- **Question bots.** Clearly labeled bots reply to some posts with one probing
  question, to get people reflecting and talking.

## What exists today
- **Bot accounts.** `community_bot_infrastructure` migration: Maya and Jordan
  are real `auth.users` rows with `raw_app_meta_data.is_bot = true`, plus a
  personality in `user_profiles.user_info`.
- **Bot runner.** `supabase/functions/community-bot` runs on cron and logs to
  `community_bot_runs`. Reuse its patterns.
- **Data from earlier phases.** `social_likes.liker_kind`,
  `social_comments.is_ai_generated`, `social_settings.bot_interactions`,
  `crisis_flagged`.
- **Settings.** The `app_settings` table.

## Build
- **Bot personas.**
  - Seed ~20 bot accounts using the Maya/Jordan pattern, each with an interest
    profile (goal types and interests).
  - Each gets a public profile with a visible **Bot** badge.
- **Settings in `app_settings`, key `social_bot_like_budget`:**
  ```json
  {
    "tiers": [
      { "max_post_index": 3,  "min": 1, "max": 4 },
      { "max_post_index": 10, "min": 3, "max": 10 },
      { "max_post_index": 30, "min": 5, "max": 20 }
    ],
    "after_30": { "base_min": 5, "per_human_engagement": 1.5 },
    "milestone_multiplier": 2,
    "per_post_cap": 60
  }
  ```
  - `post_index` = the author's nth post.
  - Milestones (goal completed, a 30+ day streak) multiply the range.
  - After post 30, the budget grows with the author's recent human likes,
    comments and follows.
  - All of this must be editable from the admin console without a deploy.
- **`social-bot` edge function** (cron, service role only):
  - **Likes.** For new posts, pick matching bots and schedule likes **spread
    over several hours**, front-loaded like organic engagement. Insert with
    `liker_kind = 'bot'`.
  - **Question comments.**
    - At most one bot question per post, on about 1 in 3 eligible posts, and
      at most 2 per user per day.
    - Store with `is_ai_generated = true`.
    - If the author replies, the bot may answer once, then stays out.
  - **Skip** crisis-flagged posts, posts flagged by moderation, and users with
    `bot_interactions = false`.
  - **Log** every action to `social_bot_runs`.
- **Question-bot prompt** in `src/prompts/` next to the other bot
  personalities.
  - Input: the post text and the author's public profile **only** (via
    `get_public_profile`). No private data.
  - Rules: one question, 25 words or fewer, no praise filler, not judgmental,
    nothing medical or clinical.
- **Disclosure.**
  - Help page "Bots on VelvetAlpha": bots like posts that match their interests
    and ask questions on some posts.
  - Link it from the footer and from the bot badge.
  - Add the same paragraph to the Terms and Privacy Policy pages.
- **Admin console.**
  - Daily counts of bot likes vs human likes, and bot comments.
  - The `social_bot_like_budget` editor.

## Non-negotiables
- **Labeled.** Bot accounts and bot comments carry the Bot badge.
- **Disclosed.** The disclosure page exists and is linked.
- **Public data only.** Bots never read private data.
- **Bots stay away** from crisis-flagged posts and opted-out users.
- **Tracked.** `liker_kind` is always set correctly. It's internal, but metrics
  and trending (phase 7) depend on it.

## Done when
- [ ] A new user's first post gets 1–4 likes over a few hours, not instantly.
- [ ] A 30-day streak post from an established user gets more, within the cap.
- [ ] Changing `social_bot_like_budget` in the admin console changes behavior
      without a deploy.
- [ ] About a third of posts get one labeled bot question, and none of the
      crisis-flagged ones do.
- [ ] Turning off "bot interactions" stops bot likes and comments for that
      user.
- [ ] `npm run lint`, `npx vitest run` and `npm run build` pass.
