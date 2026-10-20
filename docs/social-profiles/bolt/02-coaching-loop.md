# Phase 2: Coaching loop (conversation → goal → plan → commitments)

> Read `docs/social-profiles/spec.md` §14 before starting. Start by giving me a
> short numbered plan (files and migrations you'll touch), then build it.
> When something isn't covered here, inspect the code rather than guess.

## Goal

From the **first** coaching conversation:

1. The coach creates the user's goal, an action plan, and the first
   commitments.
2. It opens the **Plan** and **Commitments** tabs beside the chat.
3. It pops up as an **instant-messenger-style window** and walks the user
   through what it just added.

The popup is the actual coach (same conversation, same memory), so the user can
ask questions or ask for changes. The coach then edits the plan and commitments
**live**, and the tabs update in front of them.

## What exists today

- **Coach tools.** `supabase/functions/_shared/coachTools.ts` has
  `COACH_TOOLS` and `executeCoachTool`:
  - `create_plan` (creates as `proposed`), `add_step`, `adjust_step`
    (hold, accept or revise), `create_commitment`, `create_artifact`;
  - ownership checks `ownedPlan` and `ownedStep`.
- **Where tools run.** `supabase/functions/chat-turn/index.ts` gives these
  tools to mentor companions (`relationship_type === 'mentor'`), with
  `maxCalls: 6`. It builds a `[COACHING STATE]` block for the prompt. It
  returns `coachArtifacts` to the client but **not** plan or commitment
  changes.
- **Duplicate commitment path.** `chat-turn` also creates commitments from a
  separate JSON extraction (`parsed.commitment`, ~L827). It updates their
  status by fuzzy `ilike` on the description (`parsed.commitmentUpdate`,
  ~L846). This duplicates the tool and can update the wrong row.
- **Wrong goal attached.** `activeGoalId()` in `coachTools.ts` attaches new
  plans and commitments to the user's **oldest** active goal.
- **No goal creation.** The coach has no tool to create a goal; only user
  forms do (`src/services/goalService.ts`). `supabase/functions/extract-goal`
  is unused.
- **UI.**
  - Plans and commitments are on separate pages: `CoachingCommitmentsPage`,
    `CoachingProgressPage`, `GoalDetailPage`.
  - Client data access is in `src/services/coachingService.ts`.
  - The thread tab bar (`src/components/thread/ThreadTabBar.tsx`) has no Plan
    or Commitments tab.
  - The IM popup look to reuse is `src/components/MessagingOverlay.tsx`.
- **Tables.** `user_goals`, `coach_plans`, `coach_plan_steps` (has
  `override_log`, `commitment_id`), `coaching_commitments` (has `goal_id`,
  `plan_step_id`, `is_user_created`).
- **Tests.** `src/services/__tests__/coachTools.test.ts`.

## Build

### 1. Data
- **Link goals to coaches.** Add `user_goals.companion_id uuid references
  companions(id) on delete set null`. Backfill it from the companion on each
  goal's existing plans and commitments where unambiguous.
- **Change log.** New table `coaching_change_log (id, user_id, companion_id,
  entity_type text check in ('goal','plan','step','commitment'), entity_id
  uuid, actor text check in ('coach','user','system'), action text, before
  jsonb, after jsonb, reason text, created_at)`.
  - RLS: owner can select.
  - Inserts happen server-side or through the triggers below.
- **Sync triggers** (they must work no matter who makes the change: tab tick,
  coach tool, or `sweep-overdue-commitments`):
  - Completing a commitment completes its linked step, and vice versa.
  - Completing a commitment updates goal progress. Move the logic from the
    `commitmentUpdate` path in `chat-turn`.
  - Every insert, update or delete by a **user** from the client writes a
    `coaching_change_log` row with `actor = 'user'`.
- **Realtime.** Enable Realtime on `user_goals`, `coach_plans`,
  `coach_plan_steps` and `coaching_commitments`.

### 2. Coach tools (`coachTools.ts`)
- **New tools.** Each verifies ownership and writes a `coaching_change_log`
  row with `actor = 'coach'`:
  - `create_goal { title, goal_type, target_value?, unit?, target_date? }`.
    Skips duplicates by title for this user; sets `companion_id` to this
    coach; returns `goal_id`.
  - `update_plan { plan_id, title?, description?, cadence?, status? }`
  - `remove_step { step_id, reason }` (soft delete: status `skipped` plus a
    `removed_at` column)
  - `reorder_steps { plan_id, step_ids[] }`
  - `update_commitment { commitment_id, description?, due_date?,
    plan_step_id? }`
  - `complete_commitment { commitment_id }`
  - `cancel_commitment { commitment_id, reason }`. Refuse when
    `is_user_created = true`, unless the input also has
    `user_requested: true` (the coach sets it only when the user asked in this
    conversation).
  - `show_in_tab { tab: 'plan' | 'commitments', highlight_ids: string[] }`.
    UI only, no DB write. It's collected into the response as `uiActions`.
- **Changed tools.**
  - `create_plan` and `create_commitment` take an optional `goal_id`.
  - Replace `activeGoalId()`:
    1. use the given `goal_id` (verified owned);
    2. else the step's plan goal;
    3. else this coach's only active goal;
    4. else fail with "which goal? pass goal_id".
- **Ownership helpers.** Add `ownedCommitment` and `ownedGoal`, following the
  `ownedPlan` / `ownedStep` pattern.

### 3. `chat-turn`
- **Tool budget.** `maxCalls`: 12 when this is the user's first coaching
  session with this companion, 6 otherwise.
- **Response payload.** Return `coachingChanges: Array<{ entity_type,
  entity_id, action }>` and `uiActions` alongside `coachArtifacts`.
- **Single creation path.** **Remove** the separate commitment extraction
  (`parsed.commitment`) and fuzzy status updates (`parsed.commitmentUpdate`).
  Tools are now the only path.
- **`[COACHING STATE]`** includes:
  - the goal(s) owned by this coach, with ids;
  - the active plan, with step ids, titles, minimums and status;
  - open commitments with ids and due dates;
  - the last 10 `coaching_change_log` entries (who changed what).
- **First-session prompt instructions** (add to the coach system prompt when
  the coach has no goal yet):
  - Learn the goal, why it matters, the timeframe, the current level and the
    constraints. Do it conversationally, not as a form.
  - As soon as you know the goal and the timeframe, do this in the same reply:
    `create_goal`, then `create_plan` (3–6 steps with quantities and
    minimums), then `create_commitment` for 1–3 commitments due within 7 days
    (each tied to a step), then `show_in_tab('plan', [...new ids])`.
  - Don't wait for perfect information. Refine later with the edit tools.
  - Then walk through each step briefly: what it is, why that number, and what
    the minimum means. Then `show_in_tab('commitments', ...)` and cover what's
    due first.
  - When the user asks for a change, make it with a tool first, then confirm in
    one sentence.

### 4. UI
- **Plan and Commitments tabs** beside the coach chat (in the coach thread
  view; pick the place that fits the current workspace layout and tell me
  where):
  - **Plan tab:** goal header with progress, ordered steps with quantity,
    minimum and status, and an "edited by you" / "coach adjusted" history from
    `override_log` and `coaching_change_log`.
  - **Commitments tab:** open commitments by due date, tick to complete, edit
    text and date, plus a completed section.
  - User edits use the existing `coachingService` functions. Step edits below
    the minimum still go through the existing `adjust_step` flow.
- **Coach popup.** An IM-style window styled like `MessagingOverlay`, docked
  over the tabs.
  - It shows the **same** coaching conversation (same thread and messages as
    the main coach chat, sent through `chat-turn`), in compact form.
  - It opens automatically when a reply includes a `show_in_tab` action.
  - It can be minimized and reopened.
- **Live updates.**
  - Subscribe via Supabase Realtime to the four tables, filtered by `user_id`.
  - Apply `coachingChanges` from the reply immediately; don't wait for
    Realtime.
  - Changed items flash and show **"Coach updated this"** with **Undo**.
- **Undo.**
  - Calls a server RPC `undo_coaching_change(log_id)`. It restores `before`
    (owner-checked, only the latest change per entity) and logs an
    `actor = 'user'`, `action = 'undo'` entry.
  - The coach sees the undo in `[COACHING STATE]`.
- **Lock it in.**
  - The walkthrough ends with a **"Let's go"** button, which sets the plan to
    `active`.
  - If the user closes the popup instead, the plan activates when they
    complete their first commitment (trigger).

## Non-negotiables
- **One path.** Commitments are created and changed only through tools (coach)
  or `coachingService` (user). No text-matching updates.
- **Right goal.** Every plan, step and commitment is attached to the right
  goal. The coach never guesses when it owns more than one goal.
- **Ownership.** Every id from the model is verified against the user and this
  coach before any read or write.
- **Logged and undoable.** Every coach change is logged and can be undone.
- **One conversation.** The popup is the same coach and the same conversation,
  not a separate bot.
- **Don't break coaching that already works:** proactive check-ins, weekly
  reviews, `sweep-overdue-commitments` and artifacts.

## Done when
- [ ] New user, first coach conversation: within the first few replies a goal,
      a plan of 3–6 steps, and 1–3 commitments exist, all linked correctly.
- [ ] The Plan tab opens with the new items highlighted, and the popup walks
      through them, then switches to Commitments.
- [ ] "Can we make it mornings only?" in the popup changes the step or
      commitment, and the tab updates without a refresh.
- [ ] Undo restores the previous version, and the coach acknowledges it next
      turn.
- [ ] A user with two goals: the coach never attaches to the wrong one.
- [ ] Ticking a commitment completes its step and moves goal progress, and vice
      versa.
- [ ] `coachTools.test.ts` covers each new tool, the ownership checks and goal
      resolution.
- [ ] A Playwright e2e test covers the first-session flow.
- [ ] `npm run lint`, `npm run test` and `npm run build` pass.

## Manual steps for you
1. **Supabase → Database → Replication:** confirm Realtime is on for the four
   coaching tables, if Bolt's migration couldn't enable it.
