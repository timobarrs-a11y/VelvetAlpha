# Phase 5: Likes, comments, moderation, DM message requests

> Read `docs/social-profiles/spec.md` §5 and §7 before starting. Phases 1–4
> must be done. Start with a short numbered plan, then build it.

## Goal

Members can like and comment on posts and message each other, with strong
safety controls.

- **Likes:** a **count** on every post, visible to everyone. Nobody sees
  *who* liked, including the author.
- **DMs to people you're not connected with** arrive as **message requests**
  the recipient accepts or declines.

## What exists today
- **Moderation.** `supabase/functions/_shared/moderation.ts` (`moderateInput`,
  `recordModerationStrike`) and the `moderation_flags` table.
- **Reports.** `community_reports`: `target_type` check is in ('post',
  'comment', 'board'); the admin console reads it.
- **Blocks.** `im_blocks` (blocker_id, blocked_id).
- **IM.** Tables `im_friendships` (status pending, accepted, declined or
  blocked), `im_conversations` and `im_messages`; UI in
  `src/components/MessagingOverlay.tsx`. Today only friends can message.
- **Notifications.** `community_notifications`: type check in ('reply',
  'reaction', 'badge', 'weekly').

## Build
- **Likes.**
  - Table `social_likes (post_id, liker_id, liker_kind 'human'|'bot',
    created_at, UNIQUE(post_id, liker_id))`.
  - Humans can insert and delete only their own `human` likes.
  - RPC `get_like_counts(post_ids uuid[])` returns counts only. There's no
    client path to the list of likers.
  - UI: a heart button and count on every post.
- **Comments.**
  - Table `social_comments (id, post_id, author_id, body, is_ai_generated
    default false, created_at, deleted_at)`.
  - **Pre-screen** with `moderateInput` before the comment is visible.
    Blocked content is rejected with a reason; borderline content is held and
    logged to `moderation_flags`.
  - **Who can comment** is a per-user setting in `social_settings`:
    - `everyone` (default),
    - `mutuals` (they follow each other; the follows table comes in phase 7,
      so add `social_follows` now if needed),
    - `nobody`.
- **`social_settings` table**: `user_id PK, comment_permission,
  bot_interactions boolean default true, atlas_intros boolean default true,
  allow_message_requests text default 'everyone' check in
  ('everyone','following')`.
- **Reports.**
  - Extend `community_reports.target_type` with `social_post`,
    `social_comment`, `profile` and `message_request`.
  - Add a report button on posts, comments, profiles and requests. Include the
    `possible_minor` reason from phase 1.
- **Blocks.** Enforce `im_blocks` in RLS on every social table, in both
  directions. Add a Block button on profiles.
- **Message requests.**
  - Add `im_friendships.request_message text`.
  - "Message" on a profile when not connected creates a pending friendship
    with the first message. The message goes through `moderateInput`.
  - The recipient gets a **Requests** section in `MessagingOverlay`, showing
    the message, a link to the sender's profile, and **Accept**, **Decline**
    and **Block**.
  - Accept opens the conversation with the first message in it. Decline is
    silent: the sender is never told.
  - Limits: pending requests per sender per day, 10 during the welcome window
    and 30 after (`app_settings.message_request_daily_cap`).
  - Respect the recipient's `allow_message_requests` setting.
  - This works the same for welcome-window members as for everyone else.
- **Crisis content.**
  - When a post, comment or request trips self-harm or acute-distress signals:
    - mark it `crisis_flagged` (no boosting, no bots, not in discovery);
    - show the author private support resources.
  - Add the classifier to `_shared/moderation.ts` next to the existing checks.
- **Notifications.**
  - Extend the type check with `social_like`, `social_comment`,
    `social_follow`, `message_request` and `atlas_intro`.
  - **Batch likes:** "Your 14-day streak got 23 likes", at most once every few
    hours per post.

## Non-negotiables
- **Counts only.** Like lists are never exposed to any client.
- **Screened first.** Every human comment and request is screened before it's
  visible.
- **Blocks everywhere.** Blocks hide everything in both directions.
- **Silent declines.**

## Done when
- [ ] Liking shows the updated count to everyone; there's no way to see who
      liked from the browser.
- [ ] "Nobody can comment" hides the comment box for others and rejects inserts
      server-side.
- [ ] An abusive comment is rejected; a borderline one is held and logged.
- [ ] A message request arrives under Requests. Accept opens the chat; Decline
      leaves the sender seeing nothing.
- [ ] The 11th request in a day from a welcome-window account is refused.
- [ ] Blocked users can't see, like, comment on or message each other.
- [ ] `npm run lint`, `npm run test` and `npm run build` pass.
