# Bolt prompts: Social Profiles, Progress Feed & Coaching Loop

Eight prompts, one per phase, in build order. Each is self-contained, but they
all point Bolt at the full spec (`docs/social-profiles/spec.md`) for detail.

## How to use

1. **Make sure Bolt can see these files.** They live on the branch
   `claude/relaxed-maxwell-lfv9fj`. If your Bolt project pulls from `main`,
   merge that branch first, or Bolt won't find the spec.
2. **Paste one prompt at a time, in order.** Don't start the next until the
   current one passes its "Done when" checklist. Later phases depend on
   earlier ones (auto-posts need the coaching loop, everything social needs
   the access gate).
3. **Do your manual steps.** Each prompt lists things Bolt can't do for you
   (Supabase dashboard settings, Stripe settings, API keys). They're at the
   bottom of each prompt under **"Manual steps for you"**.
4. **If Bolt drifts,** paste the prompt's **Non-negotiables** section again
   and ask it to check its work against them.

| # | Prompt | What it builds |
|---|---|---|
| 1 | [`01-access.md`](01-access.md) | Email verification, 48-hour welcome window, lock screen, 3-day card trial, age check, abuse protections |
| 2 | [`02-coaching-loop.md`](02-coaching-loop.md) | Coach auto-creates goal, plan and commitments from the first conversation, IM walkthrough, live edits |
| 3 | [`03-profiles.md`](03-profiles.md) | Public avatar profiles and shared goals |
| 4 | [`04-auto-posts.md`](04-auto-posts.md) | Progress events become posts automatically |
| 5 | [`05-likes-comments-dms.md`](05-likes-comments-dms.md) | Likes, comments, moderation, blocks, DM message requests |
| 6 | [`06-bots.md`](06-bots.md) | Bot likes with momentum, question bots, disclosure page |
| 7 | [`07-discovery.md`](07-discovery.md) | Follows, shared-goal discovery, trending, search |
| 8 | [`08-atlas.md`](08-atlas.md) | Atlas introduces members working on the same things |
| 9 | [`09-audit.md`](09-audit.md) | **Audit only:** checks everything above was built as decided |
