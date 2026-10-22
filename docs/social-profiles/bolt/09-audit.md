# Audit: was the social + coaching plan fully implemented?

> **For Bolt:** this is an **audit, not a build**. Don't change any code or
> run any migration until I approve the fix list at the end.
>
> - **Inspect the actual code for every item.** Don't answer from memory of
>   what you built. Open the file, the migration or the function and cite it.
> - If two migrations touch the same thing, the **latest** one wins. Check
>   the final state, not the first version.
> - **Names may differ.** Table and function names below come from the
>   original spec. The build may use others (for example `member_profiles` /
>   `member_follows` instead of `im_discovery_profiles` / `social_follows`).
>   Judge by **behavior**, and name the actual table or function in Evidence.
> - This checklist is self-contained. If `docs/social-profiles/spec.md` exists
>   in the repo, use it for extra detail. If it doesn't, this list is the
>   source of truth.

## How to report

For every item below, give one row:

| ID | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|

- **Status** is one of:
  - **PASS**: built and matches.
  - **PARTIAL**: built, but missing a piece (say which).
  - **DIFFERENT**: built in a way that contradicts the requirement.
  - **MISSING**: not built.
- **Evidence** is a `file:line`, migration filename, function name, or SQL
  query result. A PASS with no evidence counts as MISSING.

Then finish with:

1. **Fix list**, ordered: security/privacy first, then things that contradict
   decisions, then missing features. For each fix, give the files and
   migrations it needs and a size (S/M/L).
2. **Conflicts with the community plan** (`docs/community/`: spaces, rooms,
   medals, crews). List anything where the two plans overlap or fight each
   other, for example:
   - two profile tables,
   - two achievement/medal systems,
   - two follow or friend systems,
   - two notification types for the same event.

   Recommend which one to keep.
3. **Checks you couldn't run** (anything needing the Supabase dashboard,
   Stripe, or a real email) so I can do them by hand.
4. Results of `npm run lint`, `npx vitest run` and `npm run build`.

## Security checks: run these against the database, don't just read code

Use SQL with `set local role authenticated` and
`set local request.jwt.claims` to act as specific users. Create two test users
A and B. Report each query and its result.

- **S1.** As A, `select * from user_profiles where id = B` returns nothing.
- **S2.** As A, `select * from user_goals where user_id = B` returns nothing,
  including B's **shared** goals. Shared goals must only come through the
  public profile function or view.
- **S3.** As A, try to `update user_profiles set age_verified_at = now(),
  birthday = '1990-01-01' where id = A`. It must fail.
- **S4.** As A, try to write `welcome_expires_at`, `subscription_tier`,
  `subscription_status`, `is_banned`, `social_paused`, `is_bot`, or any
  follower/like count on your own rows. Every one must fail. (Counts are
  shown publicly, but only triggers or the server may change them.)
- **S5.** As A, try to read the list of users who liked a post. Only a count
  may be readable.
- **S6.** A blocks B (`im_blocks`). As B, A's profile, posts and comments are
  invisible, and liking, commenting, following and messaging A all fail. Then
  check the reverse direction.
- **S7.** As an anonymous (`anon`) user, every social table and function
  returns nothing or is denied.

## 1. Access: welcome window → card trial → membership

- **A1.** Signup collects date of birth. Under 18 is rejected in the UI
  **and** on the server.
- **A2.** `age_verified_at` and `birthday` are written only server-side (an
  RPC like `verify_age` or a signup trigger), and are no longer in the client
  column UPDATE grant.
- **A3.** The `user_profiles` row is created by a server trigger on
  `auth.users` insert. The browser no longer inserts it in
  `authService.signUp`.
- **A4.** There's a "check your inbox" screen with resend (rate-limited) and
  "change email".
- **A5.** Cloudflare Turnstile (invisible) is on the signup form, and its
  token is passed as `captchaToken`.
- **A6.** The 48-hour welcome window starts at **email confirmation**
  (`email_confirmed_at`), not at signup, and is set server-side
  (`welcome_expires_at`).
- **A7.** One welcome window per **normalized** email: lowercase, `+tag`
  stripped, gmail dots removed. The record survives account deletion.
  Disposable-email domains get no window.
- **A8.** The daily AI message cap during the window (default 200, read from
  `app_settings`) is enforced in **every** edge function that calls Claude for
  the user: at least `chat-turn`, `atlas-agent` and `velvet-game-turn`. List
  any that call Claude but don't enforce it.
- **A9.** There's a per-user per-minute AI rate limit on those same functions.
- **A10.** There's a countdown banner, plus a reminder notification and email
  at about 6 hours left.
- **A11.** When access lapses, a lock screen offers exactly two choices: "Keep
  going free for 3 more days" (card required) and "Start my membership".
  Nothing is deleted, and the user's own goals and progress are viewable
  read-only.
- **A12.** The card trial uses Stripe Checkout with the essential price,
  `trial_period_days = 3` and `payment_method_collection = 'always'`.
  `stripe-webhook` sets `trialing` and `trial_expires_at`. It converts to
  essential.
- **A13.** The old no-card `start_trial()` is no longer called from the
  client. The "3-day" / "7-day" toast mismatch is fixed.
- **A14.** `has_full_access(uid)` and `can_use_social(uid)` exist and are used
  by RLS on every social table and by social edge functions.
  `can_use_social` = full access + server-verified age + not banned + not
  `social_paused`.
- **A15.** There's a `possible_minor` report reason, sorted to the top of the
  admin queue, and the admin can set `social_paused`.
- **A16.** No photo ID or face upload exists anywhere in the flow.

## 2. Coaching loop

- **C1.** There's a coach tool `create_goal`, and goals are linked to the
  coach (`user_goals.companion_id`).
- **C2.** `activeGoalId()` ("oldest active goal") is gone. Plans and
  commitments resolve the goal from:
  1. an explicit `goal_id`,
  2. else the step's plan,
  3. else the coach's **only** goal,
  4. else an error.
- **C3.** These new tools exist with ownership checks: `update_plan`,
  `remove_step`, `reorder_steps`, `update_commitment`,
  `complete_commitment`, `cancel_commitment` (which refuses user-created
  commitments unless the user asked), and `show_in_tab`.
- **C4.** The old JSON commitment extraction (`parsed.commitment`) and fuzzy
  `ilike` status updates (`parsed.commitmentUpdate`) in `chat-turn` are
  **removed**.
- **C5.** `chat-turn` returns `coachingChanges` and `uiActions`.
  `maxCalls` is 12 in the first coaching session and 6 after.
- **C6.** `[COACHING STATE]` includes goal ids, the plan with step ids, open
  commitments, and recent `coaching_change_log` entries.
- **C7.** There's a first-session prompt that creates goal + plan (3–6 steps) +
  1–3 commitments in the same reply once the goal and timeframe are known,
  then calls `show_in_tab`.
- **C8.** Plan and Commitments tabs sit beside the coach chat.
- **C9.** An IM-style coach popup shows the **same** coaching conversation
  (not a separate bot) and opens automatically on `show_in_tab`.
- **C10.** Supabase Realtime is enabled and subscribed for `user_goals`,
  `coach_plans`, `coach_plan_steps` and `coaching_commitments`, and changes
  appear without a refresh.
- **C11.** `coaching_change_log` exists. Every coach change is logged. There's
  an "Undo" with server RPC `undo_coaching_change`, and the coach sees undos.
- **C12.** "Let's go" activates the plan; otherwise the plan activates on the
  first completed commitment.
- **C13.** Database triggers keep step ↔ commitment ↔ goal progress in sync,
  whoever makes the change.
- **C14.** `coachTools.test.ts` covers the new tools, and there's a Playwright
  test for the first-session flow.

## 3. Profiles

- **P1.** Public fields are **only**: avatar (generated, never a photo),
  display name, headline, optional gender (off by default), interests,
  progress **counts** (active goals, goals completed, commitments kept, steps
  done, streak), goals and commitments the member turned on "Show on profile"
  for (listed fields only), and posts. List **every** other column exposed by the public profile table,
  view or function, including bio and anything else.
- **P2.** No photo upload path exists. `avatar_url` (if any) can only hold our
  generated renders.
- **P3.** Profiles are **visible by default** from day 1, and every member has
  a clear **"Go invisible"** option. Invisible hides the profile, posts and
  discovery listing from everyone else, and the member can switch back any
  time.
- **P4.** Invisible members never appear in discovery, trending, search or
  Atlas introductions.
- **P5.** Every goal and every commitment has a "Show on profile" toggle,
  **off by default**, stored server-side. With it off, the item's title or
  text is unreachable by other users through any table, view, function, post
  or Atlas result.
- **P6.** There's no client-readable path from another user to `user_profiles`,
  `user_goals` notes, journals, memories, insights, location or political
  leaning.
- **P7.** There's an "as others see it" preview.

## 4. Auto-posts

- **AP1.** Auto-posts fire for every visible member with auto-posting on,
  but their text is **generic** ("Kept a commitment") unless the specific
  goal or commitment is shown on the profile. **Check specifically** that no
  trigger copies `coaching_commitments.description`, a goal title or a step
  title into a post when the item is hidden. Bolt's
  `progress_posts_and_triggers` migration did this. Report each trigger.
- **AP2.** Events covered: commitment completed, plan step completed, goal
  completed, 25/50/75 % progress, streaks (3, 7, 14, 30, 60, 100, 180, 365),
  and achievements of rarity uncommon or higher.
- **AP3.** Post text comes from templates only and is resolved at read time,
  so hiding an item later makes old posts generic. It never uses
  `extracted_from_message` or any chat or journal text.
- **AP4.** Same-goal events within 6 hours are bundled. Max 3 auto-posts per
  user per day, with overflow going to a recap.
- **AP5.** The first auto-post shows a toast with Undo and "Turn off for this
  goal". Notes and deletes work on any post.
- **AP6.** Manual posts are moderated before they're visible.

## 5. Likes, comments, DMs, safety

- **L1.** One "like" reaction. Everyone sees the **count**. No client can see
  who liked (see S5).
- **L2.** `liker_kind` (`human` / `bot`) is recorded on every like.
- **L3.** Who-can-comment setting: everyone / mutuals / nobody, enforced
  server-side.
- **L4.** Every human comment and message request is pre-screened with
  `_shared/moderation.ts` before it's visible. Borderline content is held and
  logged to `moderation_flags`.
- **L5.** Reports cover social posts, comments, profiles and message requests,
  in the existing admin queue.
- **L6.** Blocks are enforced in RLS on every social table, both directions
  (see S6).
- **L7.** Message requests: non-connected members' first DM arrives as a
  request with Accept / Decline / Block. Declines are silent. Daily cap: 10
  during the welcome window, 30 after. The "only people I follow can send
  requests" setting works. The same rules apply to welcome-window members.
- **L8.** Crisis detection on posts, comments and requests sets
  `crisis_flagged`, which means no bots, no boost, not in discovery, and
  private support resources for the author.
- **L9.** Like notifications are batched ("got 23 likes"), not one per like.

## 6. Bots

- **B1.** Bot accounts are labeled with a visible **Bot** badge on profiles
  and comments.
- **B2.** Bot likes match the post's goal type and interests, follow the
  momentum budget in `app_settings.social_bot_like_budget` (editable from the
  admin console without a deploy), and are spread over hours, not instant.
- **B3.** Question bots: one question per post at most, on about 1 in 3 posts,
  max 2 per user per day, labeled `is_ai_generated`, and they only use the
  post and public profile.
- **B4.** Bots skip crisis-flagged posts, moderation-flagged posts and users
  with bot interactions turned off.
- **B5.** The "Bots on VelvetAlpha" disclosure page exists and is linked from
  the footer and the Bot badge. The same paragraph is in the Terms and the
  Privacy Policy.
- **B6.** The admin console shows bot vs human like counts.

## 7. Follows and discovery

- **D1.** Follower and following counts are shown on profiles and discovery
  cards. They're kept accurate by triggers (follow and unfollow), never
  written by the client, and don't count follows from or to invisible or
  blocked users in any way that reveals them.
- **D2.** Shared-goal discovery cards ("12 people training for a 5K").
- **D3.** Trending ranks by effort and **human** engagement only. Bot likes
  don't count.
- **D4.** Search by interest and goal type.
- **D5.** Discovery excludes invisible, blocked, crisis-flagged and
  users without social access.
- **D6.** There's a new-member boost for the first 5 posts.

## 8. Atlas introductions

- **AT1.** The `find_people` tool reads **only** public data, through a
  SECURITY DEFINER function or view. Check that `atlas-agent` never queries
  another user's `user_goals`, `coaching_*`, memories, chats or
  `user_profiles` through the service-role client.
- **AT2.** There's an automated privacy test: user B's private goal, journal
  and coach notes never appear in user A's Atlas tool result or prompt.
- **AT3.** At most one unprompted introduction per day. The `atlas_intros` and
  invisible opt-outs are respected.
- **AT4.** Introductions render as cards with avatar, name, shared goal and a
  View profile button.
