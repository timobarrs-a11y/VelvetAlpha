# Getting to know people without wearing them out

Plan for the personal, companion and coaching questionnaires. Written to be decided
on by Tim first, then built by Bolt in the phases at the bottom.

## The problem

A new person today goes through:

| Step | Screens | What it asks |
|---|---|---|
| Personal questionnaire | ~20 | name, nickname, favorite color, birthday, zodiac cusp, gender, hobbies, music, entertainment, tech, lifestyle, sports, a 6-card swipe deck, how you handle conflict, how you connect, how you decide, what motivates you, plus 3 "beat" screens |
| Atlas (coach intake) | a chat | what you want help with, then a coach recommendation |
| Coach avatar, environment setup | 2+ | looks |
| Guided tour | several | where things are |
| Companion (optional branch) | ~12 | relationship type, connection, energy, voice, warmth, interests, when it's hard, love language, name, voice pick, avatar |

That's 35+ screens before someone has had one good moment. Most of what's asked
isn't needed yet, and none of it pays off on screen when they answer.

## How games solve this

Games never front-load a form. They:

1. **Ask only what the next 5 minutes need.** Name and a goal, then play.
2. **Pay off every answer immediately and visibly.** Pick a color, see your house
   painted. Pick interests, watch your feed fill in.
3. **Teach and ask in context.** The first time you open a menu, it asks one thing about that menu.
4. **Notice, then confirm.** They watch what you do and ask "you seem to like X, right?"
   One tap, not a blank form.
5. **Make it part of the fun.** A character creator is the game, not a survey before it.

## The plan in six rules

1. **Onboarding asks only what the first session uses** (about 6 screens, under 2 minutes).
2. **Everything else is learned over the first two weeks**, one small question at a time,
   in the place it matters.
3. **Learn before asking.** Chat already pulls interests out of conversations
   (`threadSignalService.ts`), and feed, Lens and spaces show what people tap. When we're
   fairly sure, ask a one-tap confirm ("Looks like you're into F1. Add it?") instead of a question.
4. **One shared budget for all three sources** (cards, coach, companion): at most
   **1 ask a day and 3 a week**. A coach question and a companion question never land on the same day.
5. **Every answer changes something you can see within seconds:** feed, Lens, billboard,
   neighbors, how the coach or companion talks.
6. **Skipping is always fine and always remembered.** Skip once: that question waits 14 days.
   Twice: 60 days. Three times: never again unless they open their profile and answer it.

## Where each question goes

| Question | Today | Goes to | Why |
|---|---|---|---|
| Name | onboarding | **Onboarding** | needed everywhere |
| Nickname | onboarding (optional) | **Companion asks, week 1** ("What should I call you?") | feels personal from a character, cold on a form |
| Birthday | onboarding | **Onboarding** | birthday messages and zodiac; `profileComplete` needs it today |
| Gender | onboarding | **Onboarding** | `profileComplete` needs it, pronouns |
| Hobbies, music, entertainment, tech, lifestyle, sports (6 screens) | onboarding | **Onboarding: one screen**, "Pick what you're into," with category tabs | drives Daily Feed, Lens and spaces; one screen instead of six |
| Favorite color | onboarding | **Velvet World move-in** (it's the house color) | it already has a visual payoff there |
| Zodiac cusp | onboarding | **Card, day 3+**, only if birthday is near a cusp | most people never need it |
| Swipe deck (6 cards) | onboarding | **Cards, one swipe a day**, on the Daily Feed | it's fun as a daily ritual, tiring as a block |
| Conflict, connection, decision style, motivation | onboarding | **Coach asks in conversation**, weeks 1 and 2 | they shape coaching, and a coach asking feels natural |
| Companion: relationship type, energy, voice, name, avatar | companion branch | **Keep up front** | this is the character creator, the fun part |
| Companion: warmth | companion branch | **Keep**, as a live preview (the `preview` archetype already shows sample messages) | instant payoff |
| Companion: interests | companion branch | **Default to the user's interests**, with an "edit" link | removes a screen |
| Companion: when it's hard, love language | companion branch | **Companion asks, in character, week 1** | intimate questions land better from the character |
| Coach goal (Atlas) | onboarding chat | **Keep** | it's the reason they came |
| House pick | (new) | **Welcome popup after onboarding** (built) | its own payoff, never blocks the coach |

Result: **about 6 onboarding screens instead of 20+**, and the rest arrives over 14 days
as roughly 10 small moments.

## The pieces to build

### 1. A question registry (one list for everything)

`src/features/questionnaire/registry.ts` holds one entry per fact:

```ts
{
  key: 'decisionStyle',             // the existing answer key
  saveTo: 'communication_profile',  // where it's stored today (unchanged)
  askVia: ['coach', 'card'],        // who may ask it, in order of preference
  earliestDay: 3,                   // days since signup
  priority: 2,
  confirmFirst: false,              // true when we can infer it and only confirm
  usedBy: ['systemPromptBuilder', 'profileInsights'],
}
```

It reuses the existing question definitions in `personalBank.ts` and `companionBank.ts`
(same ids, same options, same save code), so nothing about storage changes.

### 2. A "curiosity" scheduler

One function, `nextAsk(userId)`, called by the three surfaces. It returns the single
question allowed right now, or nothing. It checks:

- the shared budget (1 a day, 3 a week)
- the skip cooldowns
- `earliestDay`
- **never during a hard moment**: not when the ambient profile says
  `emotional_state = needs_support`, not in a session's first 30 seconds, and not
  during a streak check-in

One small table, `profile_asks`, logs each ask with columns `user_id`, `key`, `asked_at`,
`via`, `outcome` (answered / skipped / dismissed). That's enough for budgets, cooldowns
and measurement.

### 3. Three surfaces

- **Card:** a small card at the top of the Daily Feed. It uses the existing questionnaire
  archetypes (tap, grid, swipe, scrub), so no new question UI is needed. Answering
  animates the payoff, for example "Added F1. 3 new videos in your Lens."
- **Coach:** the coach's system prompt gets an "open question" slot with
  `nextAsk('coach')`. Rules: ask only once the conversation is light or after a win,
  phrase it naturally, and never more than once a conversation. The answer is extracted
  with the existing `signal_extract` call and saved to the same field, with a quick
  "Got it, noted that you trust your gut" so the person knows it stuck.
- **Companion:** the same slot, asked in character. Love language, "when it's hard" and
  nickname live here.

### 4. Make it feel like progress, not paperwork

- **No percent-complete meters and no red badges.** Those make it homework.
- **"Things we know about you"** on the profile: each answer as a small chip they can
  edit or delete. This builds trust and lets people fill gaps when they want to.
- **A medal, "Open Book":** answer 15 get-to-know-you moments. It plugs into the existing
  medal system, shows on the billboard, and feeds the medal count.
- **Better neighbors:** interests already pick some of the Velvet World daily block
  (shared spaces). Say so on the interest card: "Your block tomorrow will have people into this."

## Guardrails we'll measure

| Number | Target |
|---|---|
| Time from sign-up to first coach reply | under 3 minutes |
| Onboarding drop-off | down at least a third from today (needs a baseline first) |
| Card skip rate | any card above 50% skips gets reworded or removed |
| Asks per user per week | never above 3 |
| Day-7 return rate | must not drop when this ships |

## Phases for Bolt

| Phase | What ships | Size |
|---|---|---|
| Q1 | Shorten onboarding: merge the six interest screens into one tabbed grid, move favorite color, zodiac, swipe deck and the four "wavelength" questions out. Companion interests default to the user's. | Small |
| Q2 | Registry, `profile_asks` table, `nextAsk()` scheduler, the Daily Feed card. Moved questions start arriving as cards. | Medium |
| Q3 | Coach and companion "open question" slots in the system prompts, saving through `signal_extract`. | Medium |
| Q4 | "Things we know about you" chips on the profile, plus the Open Book medal. | Small |

Q1 alone removes about 14 screens and can ship by itself.

## Decisions for Tim

1. **Birthday:** keep it required in onboarding or allow "skip for now"? Today the
   profile-complete check needs it, and birthday messages and zodiac use it. Recommendation:
   keep it required (one quick screen) unless the onboarding numbers say otherwise.
2. **Swipe deck:** keep it as a daily ritual (recommended) or drop it?
3. **Wavelength questions** (conflict, connection, decision, motivation): coach-only, or
   also as cards for people who rarely talk to their coach? Recommendation: coach first,
   card as a fallback after day 10.
4. **Open Book medal:** worth adding, or keep medals strictly for real progress?
