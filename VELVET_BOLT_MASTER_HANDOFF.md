# Velvet — Master Handoff for Bolt

One entry point for everything on branch `claude/velvet-lobby-tutorial-k4rkbn`.
Four workstreams. Detailed per-area docs are referenced where they exist; the
splash/lobby section is written out in full here because it has no separate doc.

**⚠️ The one step that's easy to miss:** one change is in a Supabase **edge
function**, which the frontend build does NOT ship. After merging you must run:

```bash
supabase functions deploy chat-turn
```

Everything else is frontend and ships with the normal build.

---

## Complete file manifest (this work only)

**Added**
- `src/components/hub/GuidedTourOverlay.tsx` — new arrow/coach-mark tour
- `supabase/functions/_shared/personaBuilder.ts` — companion persona compiler
- `supabase/functions/_shared/signatureVoicePrompts.ts` — voice data for edge use
- `VELVET_TOUR_REBUILD_FOR_BOLT.md`, `VELVET_PERSONA_FIX_FOR_BOLT.md`,
  `VELVET_GAMES_FIX_FOR_BOLT.md` — the detailed docs

**Modified**
- `src/App.tsx` — mount new tour, tag tour anchors (pet toggle, style bar)
- `src/components/hub/CompanionHubLeftRail.tsx` — tour anchors + "Replay tour" button
- `src/components/hub/CompanionHubRightRail.tsx` — tour anchor
- `src/pages/CompanionLobbyPage.tsx` — Friends/Companions/Coaches split + Tour button
- `src/pages/SplashPage.tsx` — expanded welcome page
- `src/pages/CheckersGame.tsx` — chat + move-sync fixes
- `src/pages/MomentumGame.tsx` — mobile swipe controls
- `supabase/functions/chat-turn/index.ts` — inject persona layer

**Deleted**
- `src/components/hub/CompanionTourOverlay.tsx` — old Atlas chat tour

---

## 1. Companion hub tour (arrows, not Atlas chat)
**Detail doc: `VELVET_TOUR_REBUILD_FOR_BOLT.md`**

Replaced the streaming-Atlas onboarding with a static coach-mark tour: dimmed
backdrop, spotlight + bouncing arrow on each target, a card you click through
with Next. Steps: welcome → sidebar expand/collapse → Your World rail → Velvet
Lobby shortcut → chat surface → right-rail feed → background/customization →
desk pet (bonus finale). Steps whose target isn't visible auto-skip. Two replay
entry points: a "Replay the tour" button pinned in the hub sidebar, and a "Tour"
button in the Velvet Lobby header (deep-links with `?tour=1`). Targets are found
by `data-tour-id` / `data-tutorial-id` attributes — keep those on the elements.

## 2. Welcome (splash) page — fuller, same styling
**No separate doc — full spec here.** File: `src/pages/SplashPage.tsx`

The page had been cut down to 3 feature cards and felt hollow. Kept the exact
look (navy gradient, orbs, particles, grain, glass cards, hero) and expanded
the content:

- **Rotating role line** under the "Your World, Projected." tagline, cycling
  `friend · companion · coach · co-author · concierge · arcade rival · culture
  curator` (component `RotatingRole`, 2.2s interval, each word in its own color).
- **"Your Circle"** section — 3 cards (Friends / Companions / Coaches) with the
  positioning line *"Velvet isn't a companion app. It's a world with people in
  it — and you decide who they are."* (data array `circle`, rendered via a new
  `GlassCard` component).
- **"The Suite"** section — a shimmer **flagship banner for The Velvet Rope**,
  then a 12-tile grid (`suite` array via `GlassCard compact`): Atlas, Navi,
  Daily Feed, Your Lens, Co-Author, Calendar, Insights, Group Chat, The Arcade,
  Signature Voices™, Made Yours (customization), Cross-Play Memory.
- **Closing CTA band** — "Step inside." + Create Your World button.
- Helper components added in-file: `SectionDivider`, `RotatingRole`,
  `GlassCard`. New lucide icon imports. No routing/behavior changes — hero CTAs
  and auth redirect logic untouched.

Implementation note for Bolt: everything is self-contained in `SplashPage.tsx`.
Copy the three helper components, the `ROTATING_ROLES` / `circle` / `suite`
data arrays, and the JSX blocks inserted between the existing feature grid and
the Terms footer.

## 3. Lobby — Friends / Companions / Coaches split
**No separate doc — spec here.** File: `src/pages/CompanionLobbyPage.tsx`

Dropped the "Velvet Voices" / "Velvet Coaches" naming (moving away from
"companion" as the umbrella term). Now three distinct sections, each with its
own add-tile:
- **Friends** (sky blue) — `relationship_type` neither `mentor` nor `romantic`;
  "Add a Friend" tile.
- **Companions** (pink, existing styling) — `relationship_type === 'romantic'`;
  "Find Another Match" tile.
- **Coaches** (emerald) — `relationship_type === 'mentor'`; unchanged apart from
  the heading.

Both friend/companion add-tiles enter the same creation flow (it already asks
"just a friend or something more"), so no flow changes were needed.

## 4. THE BIG ONE — companion persona was never used
**Detail doc: `VELVET_PERSONA_FIX_FOR_BOLT.md`** — read this one carefully.

The live chat path (`sendMessageWithSignals` → edge function `chat-turn`) built
its system prompt from a single generic line and **ignored every questionnaire
answer and the Signature Voice** stored on the companion. Every companion ran
the same generic personality. Fix: new `personaBuilder.ts` compiles the
companion row into a character sheet at chat time (each chosen trait → a direct
instruction, plus the full Signature Voice, plus a texting-rhythm block).
Reads existing columns, so **it fixes every existing companion with no schema
change or backfill**. `chat-turn` now leads with this persona. **Requires the
`supabase functions deploy chat-turn` step above.**

## 5. Games — Checkers + Momentum
**Detail doc: `VELVET_GAMES_FIX_FOR_BOLT.md`**

- **Checkers chat was dead:** `initializeGame` loaded the companion with
  `.maybeSingle()` on the whole list, which errors for any user with 2+
  companions. Now prefers `?companion=`, falls back to most-recent, and routes
  chat through `sendMessageWithSignals` (real persona/voice).
- **Checkers "pieces won't move":** a stale-closure race — the board update was
  deferred in a `setTimeout` while the turn flipped immediately, so the AI read
  a stale board and overwrote the player's move. Fixed with an authoritative
  `boardRef`, committing board+turn together after the animation, and an
  input guard during animations.
- **Momentum mobile controls:** added swipe-to-steer (relative drag on the
  canvas) + tap-to-boost, plus a large BOOST button and hint. Keyboard
  unchanged.

---

## Suggested implementation order for Bolt

1. **Persona fix (#4)** — highest impact; deploy `chat-turn` after.
2. **Games (#5)** — self-contained page edits; Checkers chat benefits from #4.
3. **Lobby split (#3)** and **Splash (#2)** — presentational, independent.
4. **Tour (#1)** — self-contained; verify `data-tour-id` anchors survive any
   refactors from the other changes.

## Global QA after everything is in
- New user → hub tour runs; replay works from sidebar and lobby.
- Two companions built oppositely feel like different people within ~3 messages
  (confirms the persona fix is live — i.e. the edge function was deployed).
- Lobby shows Friends / Companions / Coaches separately.
- Splash page is full, scrolls through all sections, CTAs work.
- Checkers: chat replies; pieces stay put after moving.
- Momentum on a phone: swipe steers, tap boosts.
