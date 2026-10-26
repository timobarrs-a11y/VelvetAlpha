# Velvet Sims: what's free and what's paid

*Plan for later. Ideas from Tim, 26 October; nothing here is built yet.*

The aim: enough for free that someone comes back every day, and enough behind the paywall
that they want to sign up. The game should be good on its own without the AI. The AI makes it
come alive.

## Two levels of the same game

| | **Free: the game** | **Paid: the live game** |
|---|---|---|
| Your home, building, decorating, the shop | Yes | Yes |
| Daily list, chores, garden, pets | Yes | Yes |
| Your companion in the house | Yes, scripted: their own day, canned lines, "While you were at work" from the day log | Yes, with the AI: they talk back, remember, react to what happened |
| Talking to your companion in real time (the live sequences) | No | Yes |
| Coworkers and the workplace cast | Scripted lines and work tasks | Also the AI moments (bonuses, relationships, story) |
| Jobs | One base job, base pay | Every job, promotions, higher pay |

In short: free, it's just you and the game. You can do everything except change jobs and
talk to the AI companion. Paid adds the AI companion and the better jobs.

## Jobs and money

- **Free:** one base job that pays a base amount. You can always earn, just slowly.
- **Paid:** the other jobs (see `jobs.md`: IT Help Desk, Teacher, Café, Gym, Animal clinic),
  promotions, and higher pay, so in-game money comes faster.
- `jobs.md` already treats the AI part of a job as a bonus and not part of the basic paycheck.
  That fits: a free player's job runs without the AI.

## Why this shape

People have learned how AI apps work (ChatGPT, Claude). You get a few messages to see what it
can do, then it asks you to pay. We don't have to copy that, but people already expect it, so
gating the AI part is easy to understand. The game itself stays free and complete, so free
players have a reason to come back daily.

## Open decisions

1. **A taste of the AI for free?** Either none, or a small allowance (a few live
   conversations, or the first week). Today the game's daily reply allowance gives free
   players 40 AI replies a day and paid players 300 (`20261027130000_velvet_game_budget.sql`).
   That would need changing to match.
2. **Which job is the free one,** or does the free player pick one of the five and stay in it
   without promotions?
3. **The pay gap:** how much faster paid players earn, so free players don't feel stuck.
4. **What money buys** that matters to a free player (house upgrades, decor, pets), so earning
   slowly is still worth it.
5. **Which tier unlocks this.** Essential, Plus or Elite (`src/types/subscription.ts`), or a
   game-only add-on.
6. **How it fits the rest of Velvet's paywall:** coaches, assistants and the web search button
   (`WEB_SEARCH_PRO_ONLY`), so it's one clear offer and not several small ones.
