# Phase 11: Login check and resume the coaching loop

> Read `docs/social-profiles/spec.md` §14 (coaching loop) first. Start with a
> short numbered plan (files and migrations you'll touch), then build it.
> Inspect the code rather than guess.

## Goal

**Every time someone signs in**, check whether their coaching loop is complete:
a goal, an active plan, and at least one open commitment. If it isn't, send
them **straight back to where they left off** before anything else.

The pickup must feel human:

- Atlas reopens the **same** conversation and continues from the last message.
- It uses the user's **own words** about their goals and dreams, for example:
  "Last time you told me you want to finally run a half marathon before you
  turn 30. Let's figure out what that really looks like for you."
- **No generic restart, and no repeated intro lines.** Seeing the same opener
  twice makes it feel like a bot.

## What exists today
- **Coaching tables:** `user_goals`, `coach_plans` (status `proposed` /
  `active`), `coach_plan_steps`, `coaching_commitments`.
- **Coaching flow:** the first-session coaching flow and tools (phase 2,
  `_shared/coachTools.ts`, `chat-turn`).
- **Atlas:** `supabase/functions/atlas-agent`, tables `atlas_conversations` and
  `atlas_messages`, pages `src/pages/AtlasPage.tsx` and
  `AtlasConciergePage.tsx`.
- **Openers:** `supabase/functions/generate-opener`.

## Build

### 1. Loop status (server)

RPC `get_coaching_loop_status()` (SECURITY DEFINER, for the caller only)
returns `{ stage, goal_id, plan_id, companion_id, resume_route,
resume_thread_id }`. `stage` is the **first** of these that applies:

| Stage | Meaning | Where to send them |
|---|---|---|
| `no_goal` | Never got as far as a goal | Atlas, resuming the intake conversation |
| `goal_no_plan` | Goal exists, no plan | Atlas resumes, then hands off to the coach to build the plan |
| `plan_not_accepted` | Plan is still `proposed` | Coach Plan tab, with the walkthrough popup |
| `no_open_commitments` | Plan is active, but every commitment is done, missed or overdue | Coach chat, to set the next commitments |
| `complete` | Goal + active plan + at least 1 open commitment | Nothing: normal app |

Admin-flagged, banned, and lock-screen states (phase 1) take priority over this
check.

### 2. Remember their words: `coaching_intake`

Table `coaching_intake` with columns:

- `user_id` (PK)
- `dream_snapshot text`: the first 2–3 sentences the user wrote about their
  goals and dreams, **in their own words, verbatim**
- `goal_summary text`
- `last_stage text`
- `last_thread_type`: `atlas` or `coach`
- `last_thread_id`
- `last_user_message text`, `last_assistant_message text`
- `recent_openers text[]`: the last 10 resume openers used
- `updated_at`

Rules:

- **RLS:** owner-only.
- **Never public.** Never used by social, posts, or Atlas introductions.
- **Writes happen server-side:**
  - `atlas-agent` and `chat-turn` save `dream_snapshot` the **first** time the
    user describes what they want (don't overwrite it later; add
    `goal_summary` as it sharpens).
  - Both update `last_*` on every turn while the stage isn't `complete`.

### 3. On sign-in: check and push immediately
- **Timing.** Right after auth resolves (in `AuthProvider` or the app's root
  route guard), and before any other page renders, call
  `get_coaching_loop_status()`.
- **Redirect.** If `stage !== 'complete'`, redirect to `resume_route`, opening
  the exact thread (`resume_thread_id`).
- **Every time.** Also run the check when the app returns from the background
  after 30+ minutes, so it doesn't only happen on a fresh login.
- **No looping.** Once the stage reaches `complete` mid-session, release the
  user to the normal app.
- **"Not now" (recommended, small).** Offer one "not now" per day, so someone
  who only wants to check one thing isn't trapped. Make it configurable in
  `app_settings` (`resume_gate_snooze_per_day`, default 1). Set it to 0 to
  make the gate absolute.

### 4. Resume message (no bland restarts)

When the user lands back in the thread, the assistant sends **one** resume
message before they type. Generate it with Claude using:

- `dream_snapshot`, `goal_summary`, and the last 6 messages of the thread;
- the stage (what's left to do);
- how long they've been away.

Prompt rules:

- **Continue the last conversation;** don't start a new one.
- **Quote or closely paraphrase** something specific they said
  (`dream_snapshot` or their last message).
- **Name the one next step** for their stage and invite them to do it now. For
  example: "let's figure out what that looks like week to week", or "your plan's
  ready, want to walk through it?"
- **Two or three sentences** in the coach's or Atlas's usual voice.
- **No stock greetings** ("Welcome back!", "Hey there!", "Great to see you
  again"). No apologising for the gap. No guilt.
- **Must differ from every line in `recent_openers`.** Reject and regenerate
  once if it's too similar (simple word-overlap check), then save it to
  `recent_openers`.
- **If away 14+ days,** acknowledge it lightly and ask whether the goal still
  fits ("still want this, or has it shifted?") before pushing the next step.

**Handoff.** For `goal_no_plan`, after Atlas re-engages and the goal is clear,
Atlas hands off: "Let me bring in your coach to turn this into a plan". This
opens the coach thread, and the coach's first message references the same
words, so it never re-asks what the user already said.

### 5. Edge cases
- **No messages at all yet:** Atlas starts the intake fresh, which is the only
  case with no prior words to use.
- **Several goals:** check the most recently active goal first.
- **A thread that no longer exists:** fall back to Atlas with the snapshot.

## Non-negotiables
- **Checked on every sign-in, before anything else renders.**
- **Same thread.** The user returns to the exact thread they left, with history
  intact.
- **No repeats.** The resume message uses their own words and never repeats a
  previous opener.
- **Private.** `dream_snapshot` stays private to the user.

## Done when
- [ ] A user who quits after describing their goal (no plan) signs in, lands
      straight in that Atlas thread, and gets a message referencing what they
      said, then a handoff to the coach to build the plan.
- [ ] A user with a `proposed` plan signs in and lands on the Plan tab with the
      walkthrough.
- [ ] A user whose commitments are all done or overdue lands in the coach chat
      being asked to set the next ones.
- [ ] Signing out and in 5 times at the same stage produces 5 **different**
      resume messages.
- [ ] A `complete` user goes to the normal app with no redirect.
- [ ] `npm run lint`, `npx vitest run` and `npm run build` pass.
