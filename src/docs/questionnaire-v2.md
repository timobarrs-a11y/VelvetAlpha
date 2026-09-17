# Questionnaire V2 — Design & Build Spec

Status: proposed
Scope: `src/pages/UserProfileQuestionnairePage.tsx` (personal) and `src/pages/QuestionnairePage.tsx` (companion)
Related: `src/pages/GoalDiscoveryPage.tsx`, `src/pages/AnalyzingPage.tsx`, `src/services/ambientProfileService.ts`

---

## 1. The actual problem

The V1 questionnaires are not boring because they lack decoration. They are boring
because **every screen has the same shape**, and because **the answers are text
descriptions of things instead of the things themselves.**

Concretely, in today's code:

| Screen | What it asks | How it renders |
|---|---|---|
| `favoriteColor` | "What's Your Favorite Color?" | 13 rounded rectangles containing the **words** "Red", "Pink", "Orange"… |
| `communication` | "How Does She Communicate With You?" | 4 rounded rectangles containing **prose labels** about how she'd text |
| `hobbies` | "What Are Your Favorite Hobbies?" | 20 rounded rectangles in a `max-h-64 overflow-y-auto` scroller |
| every other question | — | the same rounded rectangle, stacked vertically |

A colour question rendered as a list of colour *names* is the whole problem in
miniature. The user is being asked about something intensely visual and shown
text. Same for "how does she text" — we describe a texting style in a label when
we could simply **show the message**.

Three structural issues follow from that:

1. **Format/content mismatch.** One component (`type: 'choice'` → vertical button
   stack) renders every question regardless of what the question is about.
2. **No rhythm.** 9 screens (personal) and 18 screens (companion) with an
   identical silhouette. Monotony is a property of the *sequence*, not of any
   single screen, so no amount of polish on one screen fixes it.
3. **Answers vanish.** Apart from the name/zodiac pills and the colour accent,
   answering a question produces no visible change. The user is filling a form
   rather than building something.

V2 fixes those three things. The question list barely changes in *substance* —
it changes in **form, rhythm, and payback.**

---

## 2. Three principles

### P1 — The answer options are previews of the product, not descriptions of it

This is the core bet, and it is the one thing no competitor does. Character.AI,
Nomi, Kindroid, Talkie and Replika all use text labels or trait chips. Tolan uses
voice but still asks abstractly.

When we ask "how does she communicate," the four options should be **four actual
chat bubbles**, rendered in our real `ChatMessage` styling, each written in that
voice:

```
┌────────────────────────────────────┐   ┌────────────────────────────────────┐
│  hey. you up?                      │   │  hiii 🥺 hope your day was okay?   │
│  i've been thinking about you.     │   │  tell me everything                │
│         Direct & Bold              │   │        Warm & Expressive           │
└────────────────────────────────────┘   └────────────────────────────────────┘
```

The user is not reading a description of a texting style. They are auditioning a
person. That is simultaneously: more accurate data (they pick what they actually
respond to, not what sounds good in the abstract), a visible demo of the product,
and a screen that looks nothing like a form.

Apply the same inversion everywhere the content allows:

| Question | V1 format | V2 format |
|---|---|---|
| favourite colour | list of colour names | swatch grid; picking one **re-themes the app live** |
| how she texts | 4 prose labels | 4 real chat bubbles in that voice |
| expressiveness | 4 prose labels | same bubble, with/without emoji & actions |
| energy | 3 labels | slider; the presence-orb changes tempo as you drag |
| hobbies / music / sports | scrolling text lists | icon+colour tile grid |
| light taste signals | n/a | this-or-that swipe deck |

### P2 — Every answer pays the user back inside 300ms

The zodiac line and the colour accent already do this. They are the two best
moments in the current flow and they are accidents of two individual questions.
Make it a rule enforced by the framework, not a per-question nicety.

Three payback tiers, cheapest first:

- **Tier 0 — theme response.** The UI itself changes. Colour choice re-tints the
  whole flow (already built: `COLOR_ACCENTS`). Energy changes the orb's motion.
  Free, instant, no copy needed.
- **Tier 1 — a line of reaction.** One sentence, in voice, referencing the actual
  answer. Already built for zodiac (`ZODIAC_LINES`). Extend to music, hobbies,
  connection type. ~30 lines of copy total.
- **Tier 2 — a reaction beat.** A 1.5s full-screen interstitial after a *cluster*
  of answers, quoting two or three of them back. Not a question, carries no
  input. This is the Noom "you just did a hard thing" move and it is also the
  main rhythm-breaker (see P3).

Hard rule: **no answer disappears into silence.** If a question can't earn at
least Tier 0, it is a candidate for cutting or for moving into chat.

### P3 — Sequence the screens like an album, not a form

Define a fixed set of screen archetypes and never place two of the same archetype
back to back:

- **A · Tap** — 2–4 large options, one tap, auto-advance (current behaviour)
- **B · Preview** — options rendered as live product previews (chat bubbles)
- **C · Grid** — tiles with icon + colour, multi-select
- **D · Swipe** — this-or-that deck, 5–8 cards, ~10 seconds total
- **E · Scrub** — a slider or dial with live feedback on the orb
- **F · Beat** — reaction interstitial, no input, 1.5s, tap-to-skip

Each archetype gets its own layout density, its own background treatment, and its
own motion. An 18-screen run that goes `A B A D F C E B F A…` feels like a
sequence of different moments. The same 18 questions as `A A A A A A…` feels like
a form, however pretty each A is.

---

## 3. The persistent build surface

The single biggest visual upgrade to the **companion** questionnaire: give it a
subject. Today you answer 16 questions into a void and then a separate screen
claims a match was found.

Instead, pin a **presence panel** to the top of every companion-questionnaire
screen: an abstract animated orb/aura plus a growing row of trait chips and the
name once it's given.

Each answer changes it, honestly and visibly:

| Answer | Effect on the presence |
|---|---|
| gender / connection type | base hue and silhouette weight |
| energy | motion tempo — languid vs. restless |
| humour, flirting, communication | a trait chip flies in and locks (chip copy = the trait, not the question) |
| expressiveness | particle density / bloom |
| name | the orb gets a label; everything prior re-reads as "her" |

By the last question the user has watched a person come into focus out of their
own answers. That is the same mechanic as Noom's goal-date graph moving as you
answer, and it is worth more than any amount of screen polish.

**Deliberately abstract.** Do not render an `AvatarV2` face here — the face is
chosen later in `/create-companion-avatar`, and a placeholder face that then
changes would break the illusion. An aura promises a *presence*, not a look, and
can't be contradicted by the avatar step.

The personal questionnaire gets a lighter version of the same idea: a small
"what Atlas knows" card in the corner that gains a line per answer, paying off in
§5's summary card.

---

## 4. Progress: the highest-value, lowest-effort change in this document

The strongest evidence in the research packet is about progress bars: breakoff
was **21.8%** with a slow-starting bar, **11.3%** with a fast-starting bar, and
**12.7% with no bar at all.** A bar that starts slow is worse than no bar.

Both questionnaires currently do the slow-start thing:

```ts
// UserProfileQuestionnairePage.tsx
const progress = ((currentQuestion + 1) / totalQuestions) * 100;   // starts at 11%
// QuestionnairePage.tsx
const progress = ((currentQuestion + 1) / totalQuestions) * 100;   // starts at 5.5%
```

Three fixes, all small:

1. **Count what's already done.** The intro slides, goal discovery, and the name
   question are real onboarding progress. Start the bar at ~20–25%.
2. **Say why.** The car-wash study's head-start effect **disappeared when no
   reason was given.** So label it: *"You're 20% in — Atlas already has your goal
   and your name."* Never an unexplained head start.
3. **Front-load the cheap questions** so the first few taps move the bar fast,
   and switch from `n of 18` to **chapters**: `Chapter 2 of 4 · How you connect`.
   A 4-chapter bar that visibly completes segments reads as faster than an
   18-step bar at 28%.

Keep the milestone toasts, but make them reference real answers instead of
`"You're doing great!"`.

---

## 5. Personal questionnaire V2

Current: `name → birthday → zodiacSign → gender → favoriteColor → hobbies →
musicGenre → sports → newsTopics` (9 screens, all archetype A).

Proposed: **7 screens + 2 beats**, sequenced `A → A → F → C → C → D → F → B → card`.

| # | Question | Disposition | Archetype | Payback |
|---|---|---|---|---|
| 1 | name | **keep** | A (text) | name appears in every subsequent question (already built) |
| 2 | birthday | **keep** | A (date) | Tier 1: zodiac line |
| — | zodiacSign | **derive, don't ask** | — | derive from birthday; only ask when the date is within ±2 days of a cusp. Saves a screen, keeps the good moment. |
| 3 | favourite colour | **keep, move up, re-format** | C (swatch grid) | Tier 0: the entire flow re-themes on tap. The strongest instant payback we have, currently buried at #5 and rendered as text. |
| — | *beat* | **new** | F | "Got it — {name}, {zodiac}, and a {colour} person. Noted." |
| 4 | gender | **keep** | A | neutral, no editorialising |
| 5 | hobbies | **keep, re-format** | C (icon tiles) | Tier 1 reaction on the most distinctive pick |
| 6 | music | **keep, re-format** | C (tiles) | Tier 1: one-line reaction in voice |
| 7 | taste deck | **new — absorbs `sports`** | D (swipe) | Stitch Fix pattern: 6–8 this-or-that cards, ~10s, high signal for near-zero effort. Sports interest falls out of this. |
| — | newsTopics | **move to in-chat** | — | doesn't change the first message or the memory seed; learn it from feed behaviour instead |
| — | *summary card* | **new** | — | see below |

Net: 9 screens → 7, of which 4 are visually distinct from anything in V1.

**The "what Atlas knows" card.** End with a compact card listing what we captured,
each line editable inline. This does three jobs at once: it's the Spotify-Wrapped
identity payoff, it's a correction pass that materially improves memory accuracy,
and it demonstrates the memory engine rather than describing it. Offer a
shareable variant (name, zodiac, colour, connection style, companion name) — free
launch marketing, and optional so it never blocks.

---

## 6. Companion questionnaire V2

Current: 18 screens, and — importantly — **six of the sixteen are probing the
same construct.** `flirtingStyle`, `humorStyle`, `communication`,
`emotionalOpenness`, `conversationDepth` and `expressiveness` all ask "what is her
voice like," in six near-identical 4-option text lists. That's the stretch where
the flow feels most like homework.

Proposed: **9 screens + 2 beats**, sequenced `A → A → E → B → F → B → C → A → F → A`.

| # | Question | Disposition | Archetype |
|---|---|---|---|
| 1 | relationshipType (gender) | keep | A |
| 2 | connectionType | keep | A |
| 3 | energy | keep, re-format as slider | E — orb tempo changes live |
| 4 | **her voice** | **merge** `communication` + `expressiveness` + `conversationDepth` | **B — 4 real chat bubbles** |
| — | *beat* | new — companion "speaks" for the first time in the chosen voice | F |
| 5 | **her warmth** | **merge** `flirtingStyle` + `humorStyle` | **B — 4 bubbles** |
| 6 | interests | keep, re-format | C — tiles |
| 7 | **when it's hard** | **merge** `confrontation` + `supportStyle` | A — but option text is a scenario, not an adjective |
| 8 | loveLanguage | keep | A |
| 9 | companionName | keep, make it the climax | A + hold-to-confirm |
| — | `dynamic`, `initiative`, `availability` | **merge into one** "who drives this" question, or fold into the voice preview | A |
| — | `emotionalOpenness` | **move to in-chat** — it's a trust curve that should emerge, not be declared | — |
| — | `lifeContext` | **move to goal discovery** — `GoalDiscoveryPage` already asks this conversationally; asking twice is worse than not asking | — |

16 companion questions → 9. Every remaining screen is load-bearing, and four of
them are formats V1 doesn't have.

**Naming as the climax.** Tolan's "hold to unlock" gesture is doing real work:
a deliberate, physical, two-second commitment right before the ask. Our
equivalent is the name screen — the moment the abstract presence becomes
*someone*. Type the name, press and hold, the orb resolves and the trait chips
lock. Then the bridge to the first message.

**Prerequisite refactor.** `GIRLFRIEND_QUESTIONS`, `BOYFRIEND_QUESTIONS`,
`FEMALE_FRIEND_QUESTIONS` and `MALE_FRIEND_QUESTIONS` are four near-identical
~170-line arrays differing mostly in pronouns (~680 lines of copy-paste). V2
needs per-option *preview copy*, and writing that four times is untenable. Collapse
to one bank with `{she/he}` / `{her/him}` templating and a `subject` context.
This is a precondition for §P1, not a nice-to-have.

---

## 7. The bridge to the first message

`AnalyzingPage.tsx` currently shows generic strings:

```ts
{ id: 1, text: "Processing personality profile" },
{ id: 2, text: "Analyzing communication preferences" },
{ id: 3, text: "Matching interest compatibility" },
```

…and `VelvetScanningScreen` in `QuestionnairePage.tsx` shows *"Scanning thousands
of personality combinations"* / *"MATCH FOUND"* over a locally-randomised profile.

The Harvard labor-illusion research says showing the work beats instant results —
but the effect depends on the work being **real and named**. Generic strings are
the weak version; "scanning thousands of combinations" when we are not scanning
anything is the version that costs credibility the moment a user notices.

Replace both with a 3–4 second bridge that names **only things the user actually
told us**:

```
Teaching her your 90s R&B…
Setting her to text the way you liked…
Remembering you're heads-down on work right now…
```

Then go straight into the companion's first message. No "perfect match found"
page — the payoff is the person talking, not a certificate.

---

## 8. Protecting the memory engine

The research warns that gamified formats change how people answer. The memory
engine is the moat and it runs on accurate answers, so this needs to be
structural, not a matter of care.

`ambient_profile` already carries `source` and `confidence`
(`ambientProfileService.seedFromQuestionnaire`). Formalise three tiers:

| Tier | Source | Confidence | Formats | Rule |
|---|---|---|---|---|
| **Confirmed** | `questionnaire_confirmed` | 0.95 | text input, summary-card confirmation | may overwrite anything |
| **Tapped** | `questionnaire_tap` | 0.7–0.9 | A / B / C / E screens | may overwrite Play, never Confirmed |
| **Play** | `questionnaire_play` | 0.3–0.5 | D (swipe deck) | seeds tone only; **never overwrites**, never asserted as fact in chat |

Two more rules that fall out of this:

- **Keep reactions neutral-playful.** `ZODIAC_LINES` currently includes
  *"A Scorpio? Intense in the best way."* — a fun line, but it primes people to
  perform the stereotype, and astrological inference must never be written to
  the memory store as a user-stated fact. Reaction copy may be playful about the
  *fact* ("a Scorpio, noted") and should not editorialise about the *person*.
- **Confirm before committing.** Anything written at Confirmed tier passes
  through the summary card. That is the same screen as the §5 payoff — accuracy
  and delight are the same feature here.

---

## 9. Build order

Each phase is shippable and independently measurable.

**Phase 1 — Foundations** *(no visible redesign yet; unblocks everything else)*
- Collapse the four companion question banks into one pronoun-templated bank
- Extract a shared `<QuestionnaireShell>` with archetype-aware rendering
- Chapter-based progress with head start + stated reason (§4)
- Confidence tiering in `ambientProfileService` (§8)

**Phase 2 — Format inversion** *(the visible win)*
- Swatch grid for colour; move it to screen 3
- Tile grids for hobbies / music / interests
- **Chat-bubble preview screens** for voice and warmth — the flagship
- Derive zodiac; ask only on cusp dates

**Phase 3 — The presence** *(the emotional win)*
- Presence orb + trait chips on the companion questionnaire (§3)
- Reaction beats (§P2 Tier 2)
- Hold-to-confirm on the name screen

**Phase 4 — Payoff**
- Honest bridge replacing `AnalyzingPage` strings and `VelvetScanningScreen` (§7)
- "What Atlas knows" summary card, editable, with optional shareable variant

**Phase 5 — Trim**
- Question merges and moves per §5/§6 tables
- Swipe deck absorbing `sports`

Phases 1, 2 and 5 are mostly deletion and re-rendering of existing data. Phase 3
is the only genuinely new surface.

---

## 10. Costs and risks

- **Copy is the real cost, not code.** The preview bubbles need roughly 40–60
  short lines written in four distinct voices. Bad preview copy is *worse* than an
  abstract label, because a flat bubble makes the product itself look flat. This
  should be written by whoever writes the companion voices, not generated.
- **Motion budget.** The presence orb plus framer-motion transitions on mid-range
  phones needs a ceiling. `usePrefersReducedMotion` already exists
  (`src/hooks/usePrefersReducedMotion.ts`) — every archetype must have a static
  fallback, and the orb should degrade to a still gradient.
- **Answer bias.** Mitigated structurally by §8's tiering, but worth benchmarking:
  compare trait distributions from V1 vs. V2 on the same questions. If the
  distributions shift materially, the playful formats are changing answers and
  those questions move back to neutral formats.
- **Length is still the enemy.** Velvet's value is the conversation. Every screen
  we keep delays it. The §5/§6 cuts (9→7 and 18→11) matter as much as the visual
  work; do not let the new formats become a reason to add questions back.

## 11. What we'd watch

- Per-screen drop-off — identifies which archetypes actually hold people
- Overall completion (target: >70%; below that, cut screens before adding polish)
- Summary-card edit rate — how much inaccuracy the confirmation pass is catching
- Time-to-first-message
- First-renewal rate — the real test of whether the pre-paywall investment landed
