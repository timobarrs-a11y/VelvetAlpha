# Phase 8: Atlas introductions

> Read `docs/social-profiles/spec.md` §9 before starting. Phases 1–7 must be
> done. Start with a short numbered plan, then build it.

## Goal

Atlas sees across all of a user's coaches and goals, so Atlas (not the coaches)
introduces members working on the same things. For example: "Sam is also
working toward a 5K and just hit a 30-day streak. Want to see their profile?"

## What exists today
- **`supabase/functions/atlas-agent/index.ts`** queries the database with the
  **service-role client (`supabaseAdmin`)**, which bypasses RLS. It reads the
  user's own `user_goals`, `user_insights` and `conversation_insights`, and has
  one tool (`add_calendar_event`).

## Build
- **SQL function `find_people_for(p_user_id uuid, p_limit int)`**
  (SECURITY DEFINER). Reads **only** the public layer:
  - `im_discovery_profiles` where `discoverable`,
  - goal types, plus goals and commitments with `show_on_profile = true`
    (listed public fields only),
  - recent `social_posts`.

  It filters by `can_use_social`, blocks both ways, `crisis_flagged`, and the
  target's `social_settings.atlas_intros`. It matches on the user's own goal
  types and interests, and returns display name, user id, goal type, a goal
  title **only if shown**, and the latest milestone.
- **Atlas tool `find_people`** in `atlas-agent` that calls only that function.
  - **The tool must not query any other user's rows directly through
    `supabaseAdmin`.** That covers `user_goals`, `coaching_*`, memories, chats
    and `user_profiles`.
  - Add a code comment stating this rule.
- **Atlas prompt.**
  - At most one unprompted introduction per day per user (track in a small
    table or `user_profiles` server-only column).
  - Respond to "find people working on X" any time.
  - Introduce with the shared goal and a recent milestone, and offer to open
    their profile. Atlas never reveals anything that isn't on the public
    profile.
- **UI.** An introduction renders as a card in the Atlas interface with the
  member's avatar, name, shared goal, and a **View profile** button.
- **Settings.**
  - `atlas_intros = false` stops a user receiving introductions.
  - `discoverable = false` stops them being suggested to others.

## Non-negotiables
- **Public data only.** Atlas learns about other members only from the public
  layer. Any information about another member that isn't on their public
  profile must never reach the model's context.
- **Limits apply.** One unprompted introduction a day, and the opt-outs are
  respected.

## Done when
- [ ] Ask Atlas "anyone else training for a 5K?" and it returns matching
      members as cards.
- [ ] **Privacy test** (automated): seed user B with a hidden goal, journal
      text and coach notes, and one shown goal. Call `find_people` as user A.
      Assert that only B's public fields appear in the tool result and in
      Atlas's prompt context.
- [ ] Blocked, non-discoverable and opted-out users never appear.
- [ ] `npm run lint`, `npx vitest run` and `npm run build` pass.
