# Generic tells and their counters

An audit of what makes Project Velvet read as machine-assembled, and a plan for making it read as
owned. Every finding below points at real files. Run `bash scripts/tell-score.sh` to get the
current numbers; the baseline from the day this was written is at the bottom.

## The thesis

Nothing in this codebase is "bad". Most of it is above the median for a React app. The problem is
different: almost every decision is the *most likely* decision. A model asked to "make it beautiful,
not cookie cutter" (which is literally the prompt in `.bolt/prompt`) reaches for the statistical
centre of every polished dark-mode SaaS page it has seen. The result is not ugly. It is
unattributable. Nobody said no to anything.

A hand-built product is recognisable by its refusals. It uses one accent, not eleven. It has one
way of entering the screen, not eighteen. It knows the name of the person using it. Its error
messages say what happened. Its landing page shows the product instead of describing it with icons.

So the counter-strategy is not "more polish". More polish pushes further toward the mean. The
strategy is **constraint, specificity, and evidence of a human owner**. Each section below names a
family of tells, shows where Velvet has them, and gives the counter.

---

## Part 1: The tells, with evidence

### 1. Provenance fingerprints

These are the ones that take a reviewer ten seconds to spot and require no taste to notice.

| Tell | Where |
|---|---|
| Package is still named after the starter template | `package.json` name is `vite-react-typescript-starter`, version `0.0.0` |
| The Bolt scaffold is committed | `.bolt/config.json`, `.bolt/prompt` ("have them be beautiful, not cookie cutter") |
| Social share image is the Bolt default | `index.html` og:image and twitter:image both point at `bolt.new/static/og_default.png` |
| Footer social links go nowhere | `src/components/Footer.tsx` has four `href: '#'` entries under a `// TODO` |
| Zip files of a previous Claude session are shipped as static assets | `public/ab-testing-designs/*.zip` (two archives, one literally named "copy") |
| Orphaned images with content-hash or scratch names | `public/images/dd238fc7e6085d17dd20089a0acd1b78.png`, `image.png`, `Long_table.png`, `hotel_tile.png` (2.8 MB), `noir_props_sheet.webp`. None are referenced from `src`. |
| Manifest promises screenshots that do not exist | `public/manifest.json` lists `/screenshots/mobile-lobby.png` and `/screenshots/desktop-lobby.png`; there is no `public/screenshots` |
| Anonymous sign-ups use a made-up domain | `src/pages/AnalyzingPage.tsx:73` creates `user_<ts>@aicompanion.app` |
| Architecture doc describes a migration that never happened | `src/features/README.md` says "Phase 1: Structure creation, placeholder files created". `App.tsx` is still 1,635 lines. |
| The A/B design experiment is still live in production | `src/design/designSystem.ts` honours `?design=a` on any URL. The README says "pick the winner and delete the loser". |
| Commit history is auto-titled | 22 of 50 commits are "Updated X.tsx" / "Added Y.ts" / "Create Z.ts" |
| Four different brand pinks | `#ec4899` (index.html, manifest), `#f43f6b` (tokens), `#f43f5e` (splash orbs), `#f472b6` (title gradient) |
| Manifest background is light pink on a dark app | `manifest.json` background_color `#fdf2f8`. The splash screen flashes pale pink before a near-black app loads. |

### 2. The dialect

A specific visual vocabulary that has become the house style of every LLM-generated landing page
since 2024. Individually each is fine. Together they are a signature.

| Tell | Count | Note |
|---|---|---|
| Blurred ambient orbs floating behind the hero | 5 per page | `SplashPage.tsx` and `WelcomePage.tsx` both define an `ORBS` array |
| Random star-field particles with five "shooting stars" | 55 per page | Same two files, same `PARTICLES` generator copy-pasted |
| SVG fractal-noise grain overlay at 2.8% opacity | 1 | `SplashPage.tsx` |
| Pill badge with a sweeping shimmer ("Now in Early Access") | 1 | `SplashPage.tsx` with a `Sparkles` icon |
| Hero headline as gradient text, with a blurred duplicate behind it for glow | 1 | `SplashPage.tsx` |
| Ultra-heavy / ultra-light weight contrast in the wordmark (900 vs 200) | 1 | `SplashPage.tsx` |
| Three-up feature cards, each an icon in a tinted chip with a coloured border | 3 + 10 | `SplashPage.tsx`, `WelcomePage.tsx` |
| Section divider that is a hairline with a tiny uppercase tracked label ("What Awaits") | 1 | `SplashPage.tsx` |
| The Sparkles icon | 44 files | It is the single most recognisable LLM icon choice |
| Glassmorphism everywhere | 78 `backdrop-blur` | Header, cards, pills, modals, footers |
| Cards that grow on hover | 22 `hover:scale-*` + 20 `whileHover scale` | Nine different scale factors from 1.005 to 1.1 |
| `transition-all` | 397 | The "I do not know which property changes" transition |
| Gradient buttons in raw palette colours | 78 | `from-rose-500 to-pink-500` x16, `from-amber-500 to-orange-500` x10 |
| Entrance animation `initial={{opacity:0, y:N}}` | 18 distinct N values | 5, 6, 8, 10, 12, 16, 20, 24, -10 ... no motion system |
| Uppercase tracked micro-labels | 5 tracking variants | `tracking-[0.18em]`, `[0.2em]`, `[0.24em]`, `[0.28em]`, `tracking-wider` |
| Inter + Space Grotesk | | The default LLM font pairing |
| 21 Google Font families loaded on every route | | For a font picker used by one component |

### 3. Copy

Text is where a machine is easiest to hear, because the model fills arrays and fallbacks with the
mean sentence.

| Tell | Where |
|---|---|
| "Something went wrong" | 15 places, including the `ErrorState` default and the `ErrorBoundary` |
| "Loading..." as visible text | 12 places |
| "personalized" | 11 places in UI, plus meta description |
| "journey" | 10 |
| "Let's" openers | 77 |
| Em-dashes in UI strings | 63 (236 in source overall). Humans writing UI copy use them rarely; models use them constantly. |
| ✨ in UI | 13 |
| The canonical internet quote list | `src/config/motivationalQuotes.ts`: Jobs, Churchill, Mandela, Einstein, Confucius. This exact list is the most-generated array on the internet. |
| Fifteen permutations of the same sentence | `src/config/proactiveMessages.ts`: "good morning babe! wyd?", "morning babe! slept okay?", "hey babe, up and at em!" ... The shape (N near-identical strings) is how a model fills an array. |
| Placeholders "e.g. Sarah", "e.g. Orlando", "e.g. Blue" | Onboarding and profile forms |
| `'Companion'` as a fallback name | 11 places. If it ever renders, the illusion is over. |
| Contextual loading phrases | `LoadingState.tsx`: "Warming up your world...", "Gathering your memories..." |
| Meta description | "Your personalized AI companion experience. Chat, play games, and build meaningful connections." |
| Fake certainty | `AnalyzingPage.tsx` shows "✨ 100% Compatibility Match" after five fixed 600 ms steps. It is 100% for everyone. |

Copy that is actually good and should be kept as the seed of a voice: "Your World, Projected.",
"Project the world you want around you", "Built to actually know", "Not a bot told to act like an
expert, but one built to actually be one", the Velvet Rope concept. These are specific. Build out
from them.

### 4. Incoherence

Different sessions made different decisions, and nobody reconciled them. Users feel this as
"something is off" without being able to name it.

| Tell | Evidence |
|---|---|
| Light-theme islands inside a dark app | `Toast.tsx` is `bg-white`. `DaySeparator.tsx` uses `bg-gray-200`/`bg-rose-50`. Chat system pills use `bg-sky-50`. The scroll-to-bottom button is `bg-white/95`. The left rail hover is `rgba(255,255,255,0.95)`. |
| 259 distinct hex colours in TSX | The token file defines about 40 |
| 76 ad-hoc date/time formatting sites | 27 bare `toLocaleString()`, 12 different option objects, `en-US` hard-coded in some and not others |
| No relative time anywhere except one helper | `lobbyUtils.formatTimeAgo` returns "2m ago"; nothing else does |
| Hover implemented three ways | Tailwind `hover:`, framer `whileHover`, and 16 `onMouseEnter` handlers that mutate `style` |
| Two copies of the same particle system | `SplashPage.tsx` and `WelcomePage.tsx` |
| A/B variant tokens both still shipped | `design-system.css` |
| The companion prompt is one persona | `src/config/systemPrompt.ts` hard-codes "RILEY'S PERSONALITY CONFIGURATION", "cheer practice", "babe", "handsome", "Challenges Him", regardless of the companion actually built. A male companion built as a friend still gets cheer practice. |
| Typing effect only for short messages | `useTypingEffect.ts`: under 40 words types word-by-word; over 40 words pops instantly. Users notice the inconsistency before they notice the effect. |
| Fake compose delay layered on real latency | `typingPacer.ts` adds 250 to 2,000 ms of random jitter on top of the actual network round-trip |

### 5. Accessibility and craft

| Tell | Count |
|---|---|
| `<button>` elements | 642 |
| `aria-label` attributes | 41 |
| Files honouring `prefers-reduced-motion` | 4, against 200+ animated elements |
| TypeScript `any` | 136 |
| `console.log` in shipped code | 62 |
| Largest component | `SocialCombatRPG.tsx`, 2,575 lines |
| State hooks in the root app component | 44 `useState` in `App.tsx` |

---

## Part 2: The counters

Ordered by leverage. Tier 0 is a morning of deletion. Tier 3 is where a model can do something a
template cannot.

### Tier 0: Remove provenance (no design judgement required)

1. Rename the package to `project-velvet`, set a real version, delete `.bolt/`.
2. Replace both `og:image` URLs with a real 1200x630 image. Until one exists, remove the tags. A
   missing OG image is neutral; the Bolt default is a confession.
3. Delete `public/ab-testing-designs/` and the five unreferenced files in `public/images/`. That is
   about 4 MB out of the deploy.
4. Either add the two manifest screenshots or delete the `screenshots` array.
5. Footer socials: real URLs or delete the "Connect" column. Never `#`.
6. Pick one brand pink. Tokens say `#f43f6b`; make `index.html`, `manifest.json`, and the splash
   orbs agree. Set manifest `background_color` to `--ds-bg-base`.
7. Retire the A/B switch. Set B as the only variant, delete the A block in `design-system.css`,
   delete `designSystem.ts` query-param handling. The README already says to do this.
8. Replace `aicompanion.app` with the real domain (or a reserved `anon.projectvelvet.com`).
9. Either finish the feature-slice migration or delete `src/features/README.md`. A doc that
   describes an intention is a tell; a doc that describes reality is a signal.
10. Adopt a commit convention (Conventional Commits with a "why" line). The history is public
    evidence of how the product is made.

### Tier 1: Replace the dialect with a vocabulary

The principle: every visual decision should be a named choice from a small set, and the set should
be enforced by tooling so a future session cannot drift.

**Motion.** One primitive, three verbs.

- Create `src/shared/motion.ts` exporting exactly three transitions: `reveal` (opacity 0 to 1,
  y 6 to 0, 220 ms, the existing `--ease-spring`), `dismiss` (the reverse, 150 ms), and
  `emphasis` (a one-off scale to 1.02 and back, for confirmations only).
- Create a `<Reveal>` component and replace every inline `initial={{opacity:0, y:N}}`.
- Delete every `hover:scale-*` and `whileHover={{scale}}`. A hand-made interface in 2026 signals
  hover with colour, border, underline, or shadow tint, not growth. Buttons keep `whileTap` at
  0.98 because that is haptic feedback, not decoration.
- Replace `transition-all` with the property that actually changes. An ESLint rule
  (`no-restricted-syntax` on the literal) prevents its return.
- Honour reduced motion once, at the `<Reveal>` and `MotionConfig` level, instead of in four
  files.

**Icons.** The product already has the right instinct in `ChatMessage.tsx`, where `AtlasIcon` and
`NaviIcon` are hand-drawn SVGs. Promote that.

- Create `src/icons/` with custom glyphs for the product's own nouns: Atlas, Navi, Companion,
  Coach, Correspondent, Velvet Rope, Signature Voice, The Arcade, Co-Author, Your Lens, Daily Feed,
  Insights. Twelve glyphs on a shared 24-unit grid with a consistent 1.75 stroke.
- Keep Lucide for utilities only: X, chevrons, arrows, check, alert.
- Delete every `Sparkles`. Where it meant "AI-generated", use the Atlas glyph. Where it meant
  "new", use a dot. Where it meant nothing, use nothing.

**Colour.** Collapse to the token set and make raw palette names illegal.

- Token count is about 40. Distinct hex in TSX is 259. Target: under 60, and every one of them in
  `design-system.css` or a per-feature `accent` prop.
- ESLint rule: ban `(rose|pink|purple|violet|fuchsia|indigo|slate|gray)-[0-9]+` as a Tailwind class
  in `src/` outside `tailwind.config.js` and the games directory. Use `ink-*`, `surface-*`,
  `primary-*`, and `var(--ds-*)`.
- Per-feature accent stays, but as one `--ds-tone` variable per component, which the design
  system already supports.
- Delete the light-theme islands: `Toast` (dark surface, accent-coloured left rule), `DaySeparator`
  (hairline in `--ds-border`, label in `--ds-ink-3`), chat system pills, the scroll-to-bottom
  button, the left-rail hover.

**Surfaces.** Glass is the tell. Solid is the counter.

- Keep `backdrop-blur` in exactly two places: the sticky header and the modal scrim.
- Cards become opaque `--ds-surface-1` with the 1 px inset top highlight that variant B already
  defines. Depth comes from shadow colour (a tinted shadow reads as designed; a black shadow reads
  as default).
- Content sets card height. Delete `minHeight: 140` in `HubTile.tsx` and let the description
  determine it. Uniform card heights are a grid tell.

**Type.** Inter plus Space Grotesk is the default pairing of the era. Two options:

- Cheap: keep Inter for UI, replace Space Grotesk with a display face that has an opinion and
  matches the name. "Velvet" suggests an editorial serif at display sizes (Fraunces, Instrument
  Serif, or Newsreader). Serif display over a dark surface with rose accent is a combination the
  templates do not produce.
- Either way: stop using gradient text. Plain `--ds-ink` at weight 500 to 600, tight tracking.
  Delete the blurred duplicate glow.
- Load only the fonts the chrome uses. The 19 picker fonts load on demand when the
  `LanguageInputToolbar` font menu opens, via `document.fonts.load` or a lazy stylesheet. That is
  roughly 20 fewer requests before first paint on every route.
- Define a type scale (1.25 ratio from 15 px) and a spacing scale with intentional irregularity
  for section rhythm (for example 56, 88, 144) instead of uniform 16 and 24.

**Landing page.** Show, do not describe.

- Delete orbs, particles, shooting stars, grain, the shimmer pill, and the section divider label.
  Keep one subtle radial glow if the page feels flat without it.
- The `SplashChatPreview` is already the best thing on the page. Make it the entire first fold:
  headline left, the live preview right, at real size, actually cycling through a conversation
  that demonstrates memory ("did you get to the part with the letter?" is exactly right).
- Replace the icon-chip feature grid with the real components. Render an actual `CompanionCard`,
  an actual `HubTile`, an actual calendar week, an actual Insights card with plausible data. A
  landing page built from the product's own components cannot look like a template, because the
  template does not have those components.
- One page, not two. `SplashPage` and `WelcomePage` are the same page with different feature
  arrays. Merge them; the logged-in state shows the same page with the CTA swapped.

### Tier 2: Copy as a voice

**Write the voice doc first.** One page: who Velvet sounds like, three things it never says, five
example sentences. Every string in the app gets rewritten against it. Suggested starting position
from the copy that already works: lowercase confidence, short declaratives, second person, no
exclamation marks in chrome (companions can use them, the app cannot).

**Errors say what happened and what survives.**

- `ErrorState` default becomes a required prop. There is no generic error.
- "Something went wrong saving your profile. Please try again." becomes "Couldn't save your profile.
  Your answers are still here. Try again, or come back later and they'll be waiting."
- `ErrorBoundary` shows a short error id and "email hello@projectvelvet.com with this code", not
  "Go Home". A traceable error is a human-run product.

**Loading shows the shape of what is coming.** Replace every visible "Loading..." with the
existing `Skeleton` primitives, sized to the content. Delete the `CONTEXT_PHRASES` rotation.

**Enforce the ban list with a test.** A vitest file that greps `src/` for: Discover, journey,
seamless, unleash, elevate, empower, effortless, supercharge, personalized, Oops, "Something went
wrong", "Loading...", ✨, and an em-dash inside a JSX text node or a string literal that renders.
The test fails on any hit outside an allow-list. The presence of this test is itself a signal to
anyone reading the repo.

**Kill the quote list.** Replace `motivationalQuotes.ts` with something only Velvet can show: the
companion's own line from yesterday's conversation, an entry from `nationalDays.ts` (already in
the repo and far more distinctive), or nothing. An empty space beats a Steve Jobs quote.

**Proactive messages come from memory, not a list.** The app has a semantic memory bus. A morning
message should reference something real: "you said the deadline was today, how's it looking?"
Reduce the static fallbacks to three per slot that differ in kind (a question, an observation, a
callback), not fifteen that differ in wording.

**Placeholders use what the app knows.** After onboarding the app knows the user's name and city.
"e.g. Sarah" becomes the name of one of their companions. "e.g. Orlando" becomes their city. Where
nothing is known, use an unusual, specific example that hints at taste ("e.g. Ljubljana").

**The analyzing page tells the truth or gets shorter.** Either tie each of the five steps to the
real async call it represents (auth sign-up, profile write, companion create, avatar generate,
first-message claim) so completion is real, or cut it to a 900 ms transition. Delete "100%
Compatibility Match".

**Typing realism is either honest or consistent.** The best fix is streaming from the `chat-turn`
edge function so the typing indicator is the actual generation. Short of that: remove the random
jitter in `typingPacer.ts` (real latency already varies), and make the word-by-word reveal apply to
every message or none.

**Never render `'Companion'`.** Make `custom_name` required at the type level and at the
database level. The fallback should be impossible, not unlikely.

### Tier 3: Specificity a template cannot produce

This is where the product can go past "not detectably generic" to "obviously made for me".

**The chrome knows who is looking at it.** The lobby header says "Velvet Lobby". The app knows the
user's name, timezone, city, and the time of day, and it has a `TimeAwareSlot` component. The
header should read "Tuesday evening, Tim" and the sub-line should be a fact: "Riley messaged you
twice while you were out." Every screen-level heading gets this treatment.

**One formatter, the user's locale.** A single `src/shared/format.ts` with `formatDate`,
`formatTime`, `formatRelative` built on `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat`, taking
the user's locale and 12/24 h preference from the profile. Delete all 76 call sites. "2m ago"
becomes "2 minutes ago" or "just now" in the user's language.

**Deterministic personal variation.** Everywhere `Math.random()` currently decides layout
(particle positions, orb drift, avatar defaults, accent tints), seed it from a hash of the user id
instead. The app then looks subtly different for every user and identical every time that user
opens it. Random is anonymous; seeded is theirs.

**The companion's colour is the thread's colour.** Companions already have a favourite colour and
a bubble colour. Set `--ds-accent` at the thread root from it. Riley's chat is rose, Marcus's is
teal, Atlas is amber. Trivial to implement, and the single biggest "this app knows my people"
effect available.

**Empty states are written by memory.** "No messages yet" becomes "You and Riley haven't talked
about the trip yet" when the memory bus has a pending topic, and "Say hi to Riley" when it does
not. `EmptyState` gets an optional `memoryHint` resolved from `memoryBus`.

**A changelog.** `/whats-new`, rendered from a `CHANGELOG.md` that a human writes in the first
person. Templates do not have changelogs. Products with owners do.

**A real about page.** The current copy is good. Add one photo, one name, one date. "Built in
Orlando since 2025" is worth more than every orb.

**Keyboard.** A visible `⌘K` hint in the header that opens the existing `QuickCommandBar`,
`j/k` to move between companions, `esc` everywhere. Machine-built apps almost never ship keyboard
affordances because nobody asked for them.

**An imperfection budget.** Human layouts have one thing off-grid: a handwritten annotation, a
section that breaks the container width, an element rotated two degrees. The pet companion and the
Velvet Rope are already this kind of thing. Give the landing page one: the chat preview slightly
rotated, overlapping the headline's baseline.

### Tier 4: The repo itself as evidence

Investors, hires, and partners read code. These are the tells they check.

1. Split `App.tsx`. 44 state hooks in one component is the strongest "generated" signal in the
   repo. The thread feature module the README promises is the right shape: `useThread`,
   `useThreadModals`, `useMorningBrief`, `useAtlasThread`, `useNaviThread`.
2. Generate Supabase types (`supabase gen types typescript`) and burn down the 136 `any`.
3. A `logger` with levels, stripped in production, replacing 62 `console.log`.
4. The three enforcement tools from above (motion primitive, palette lint, copy test) live in the
   repo and run in CI. Their existence is the point.
5. Every route sets a document title through one `usePageTitle` hook. Test asserts it.

---

## Suggested order

| Step | Effort | Effect |
|---|---|---|
| Tier 0, all ten items | half a day | Removes every ten-second tell |
| Tier 1 colour + surfaces (tokens, palette lint, delete light islands) | 2 days | Fixes the "something is off" feeling |
| Tier 2 voice doc + error/loading rewrite + ban-list test | 1 day | Fixes the loudest copy tells |
| Tier 3 header greeting + single formatter + companion accent | 1 day | The first "this knows me" moments |
| Tier 1 motion primitive + icon set | 2 days | Removes the dialect |
| Tier 1 landing page rebuild from real components | 2 days | The public face stops being a template |
| Tier 2 memory-driven copy, honest analyzing page, streaming | 3 days | The product stops performing and starts being |
| Tier 4 App.tsx split, types, logger | 3 days | The repo reads as owned |

## Baseline (2026-09-15)

```
── Provenance ──────────────────────────────────────────────
     1  package.json still named after the starter template
     1  .bolt/ directory present
     2  og:image points at the bolt.new default
     2  zip archives shipped in public/
     4  footer social links pointing at "#"
     1  manifest screenshots referenced but missing
    22  auto-generated commit subjects ("Updated X.tsx")
── Visual dialect ──────────────────────────────────────────
    44  files importing the Sparkles icon
    22  hover:scale-* utilities
    20  framer whileHover scale
   397  transition-all
    78  backdrop-blur
    78  raw-palette gradients
    18  distinct entrance y-offsets (want 1)
   259  distinct hex colours in TSX (want ≈ token count)
    16  inline-style hover mutations
    21  Google Font families loaded on every page
── Copy ────────────────────────────────────────────────────
    15  "Something went wrong"
    12  "Loading..."
     1  "Discover"
    10  "journey"
    11  "personalized"
     7  marketing verbs
    13  ✨
    63  em-dashes in UI strings
    11  "Companion" used as a fallback name
── Coherence ───────────────────────────────────────────────
    76  ad-hoc date/time formatting call sites
   559  bg-white in a dark product
   136  TypeScript any
    62  console.log
  1635  lines in App.tsx
    44  useState calls in App.tsx
── Accessibility ───────────────────────────────────────────
   642  <button> elements
    41  aria-label attributes
     4  files honouring reduced motion
```
