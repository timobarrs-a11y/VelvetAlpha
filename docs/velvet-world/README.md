# Velvet World (working name): build plan for Bolt

> **For Bolt:** do one phase per chat. Open only the phase file you were
> given, the SQL file it names, and the source files it lists. Everything
> else has already been looked up and is written down here. **Don't scan the
> repo, don't read old migrations, and don't redraw any art.** If something
> in a phase file doesn't match the code, stop and say so instead of
> exploring.

## The idea in one paragraph

Velvet World is a town everyone moves into. Each member owns one plot: a
**house** (the look) and a **billboard** (the info: name, headline, a goal
they chose to share, top medals, spaces). Every day you wake up on a new
block with new neighbors, so you keep seeing other people's creativity.
Zoom out and you see the whole town, every member, with you and your
friends pinned. Tap a billboard to read it and **Add friend**. That's the
only action: no knocks, no DMs from a billboard, nothing that says when
someone was last online. It's an experience. It's meant to make you feel
something, not report everything to you.

## Decisions already made (don't revisit)

| Topic | Decision |
|---|---|
| Name | "Velvet World" is a working name. The sidebar label is **Town** at `/world`. **House** at `/house` is the community spaces page, so leave it alone. |
| Plot | One per person, permanent number. The number maps to a permanent street address through `townSlot()`. |
| Houses | **Starter** (everyone): Classic, Cottage, Bungalow, Ranch, A-frame cabin. **Member** (paid): Craftsman, Modern, Brick colonial, Victorian, Villa. **Earned** (one medal each, never for sale): Lighthouse (Iron Will), Observatory (The Closer), Treehouse (Hat Trick). |
| Free vs paid | Free users pick a starter house (or one they earned) **and its colors**. Members also get billboard styles and colors, car, pet, lawn, tree and extras, plus all the animation: twinkle lights around the billboard, chimney smoke, swaying trees, pets moving. The kit already applies these rules in `resolvePlot()`. |
| Lapsed member | The saved look is kept. Viewers' clients show a starter house and plain yard until they're a member again (the kit does this). |
| Neighbors | Everyone rotates every day. Nobody repeats until the pool runs out (30-day window). Up to 3 a day share one of your community spaces. Two side-by-side houses never match in style and color. |
| Friends | Always findable: the Friends list has **Visit**, the town view pins friends, and search finds anyone with a public profile. |
| Inactivity | Never shown. No "last seen", no empty or dark plots for inactive people. Every plot looks lived in. |
| Private profiles | They still get a house in the town. Their billboard just says "A neighbor", and they're never put on someone else's daily block or in search. |
| Front vs inside | The front of the house (what the town sees) is edited only in Velvet World. The life-sim game (`VelvetHouseGame`) shows the inside and back. Nothing syncs between them. |
| Companion | The user picks which companion's game house is their "main" one (`main_companion_id`). Deleting that companion sets it to null. **The plot is never deleted.** |
| Notifications | No email for now. A friend request pops up on the site (badge and bubble on the messages button, Phase 6a step 9). Viewing a billboard never notifies anyone. |

## Phases

| Phase | File | What ships | Size |
|---|---|---|---|
| 6a | [phase-6a-plots-and-block.md](phase-6a-plots-and-block.md) | Migration, move-in, your daily block (street view), billboards with Add friend, customizer, main companion | Large |
| 6b | [phase-6b-town.md](phase-6b-town.md) | Whole-town view (every plot), pins, Friends with Visit, search, clock tower | Medium |

Requires community Phases 1–4 (already applied).

## The art kit is done. Reuse it.

Everything visual is finished and tuned: 13 houses, 4 window styles, 6
billboards, cars, pets, lawns, trees, extras, day/night lighting, seasons,
snow, the town square and the low-detail town.

| File | What it is |
|---|---|
| `src/features/velvet-world/art/streetArt.js` | The kit. Pure canvas drawing, no React, no Supabase. **Import it, never edit it to "port" it, never rewrite it in TSX.** |
| `src/features/velvet-world/art/streetArt.d.ts` | Types for the kit, so `import { drawPlot } from '../art/streetArt.js'` type-checks under `strict`. |
| `src/features/velvet-world/demo/street-test.html` | **The reference implementation.** 2,000 fake residents and every behavior that 6a and 6b need: render loop, plot caching, tap targets, panel, customizer, daily rotation and town view. The phase files tell you which function to port. Port the logic, swapping fake data for the service calls. |
| `src/features/velvet-world/demo/build.mjs` | `node src/features/velvet-world/demo/build.mjs out.html` inlines the kit into the demo, so you can open it in a browser and compare. |

How the kit draws a plot (already worked out, keep it):

- Each plot is drawn as **back layer → live animation → front layer**. Back
  and front are cached on offscreen canvases per plot (`buildPlotCache` in
  the demo). Only `drawPlotLive` runs every frame, and only for members.
- At night: draw the frame, multiply by `lightingAt(hour, season).tint`,
  then draw `drawPlotLights` on top (windows, lamps, twinkle bulbs).
- `plot._resolved` is a cache. **Set it to `null` whenever a plot's
  `member`, `config` or `profile` changes**, or the old look sticks.
- Text uses five Google fonts (`FONTS` in the kit). Phase 6a adds them to
  `index.html`.

## SQL

[`sql/phase-6-world.sql`](sql/phase-6-world.sql). **Copy it into a new
migration word for word.** It was tested on Postgres 16 against this repo's
community (Phases 1–4), goals and messaging migrations. It applies cleanly
and can be re-run safely. The test, run as real users with RLS on, checked:

- claiming twice gives the same plot
- a free user is denied member and earned houses
- a paid user can take a member house, and a medal unlocks its house
- the main companion must be yours
- direct house edits are blocked
- private billboards show "A neighbor"
- the daily block always returns the same order for the same day, shares
  spaces first, never includes private profiles, and puts people seen
  recently last
- search skips private profiles

## Who counts as a member

Pricing isn't final, so **nothing here uses plan names.** A member is anyone
whose `user_profiles.subscription_tier` is set and isn't `free` or `trial`.
The Stripe webhook sets `free` when a subscription ends, so new or renamed
plans count automatically. This lives in one place, `is_paid_member()` in
the SQL. The app reads it from the server (`is_member` from
`get_my_world_plot` / `world_cards`) and **never** from `useAccess().isPaid`,
which still checks a fixed list of names. If trial users should get member
houses too, remove `'trial'` from that one function.

## Ideas for later (not scheduled)

- More earned houses, one per legendary medal (Day One, Unbreakable).
- Seasonal town events (first snow, a festival in the square) driven by the
  calendar.
- Crew streets: a crew can claim a row for a weekend.
- The clock tower finishing (at 1,000 completed goals) unlocks something
  for everyone.
