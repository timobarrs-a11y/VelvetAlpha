# Velvet Correspondents — Handoff Instructions for Bolt

## What we're building

A new **fourth companion archetype** — the **Correspondent** — alongside the
existing three (`friend`, `romantic`, `mentor`). A correspondent is a
conversational news personality: it briefs the user on real, current stories in
a distinct voice, has takes, and pulls the user into a back-and-forth about the
day's news. Think a personal, in-character news desk.

Two seed characters ship in this change, both as **free solo voices**:

- **The Insider** — pop-culture / celebrity / gossip desk (playful, breathless).
- **The Sideline** — sports desk (hot-take, ESPN-debate energy).

Key product decisions (already settled — do not change):

1. **Correspondents are a new `relationship_type: 'correspondent'`**, NOT a
   subtype of expert/mentor. They must not inherit the coaching loop
   (anchor/diagnose/direct/close) — that fights the reporter voice.
2. **They are free** (`premium: false`). No paywall on the character. The
   premium upsell is a *group* feature (two correspondents debating — a
   follow-up, not this change).
3. **Everything is grounded in real articles.** A correspondent may only report
   facts that are in the articles supplied to it from the `news_articles`
   table. It never invents news. Its voice is flavor; the article is the truth.
4. **The archetype is beat-parameterized.** One framework, keyed by a `beat`
   (`sports`, `gossip`, later `tech`/`politics`/etc.). Adding a new
   correspondent later = one config entry, not new code.
5. **Correspondents cite their sources in-app.** When a correspondent talks about
   stories, its message carries the source articles as tappable cards that open
   the full article inside the app (reusing the Daily Feed reader) — never an
   external site.

## What already exists (reuse, don't rebuild)

- `news_articles` table already stores full article `content` (migration
  `20260210000801`), so in-app reading needs no new data.
- `src/pages/DailyFeedPage.tsx` already renders article cards and an in-app
  reader, and tracks reads via the `article_views` table.
- `article_conversations` table already exists (article_id ↔ companion_id ↔
  user_id) — the "discuss this article with a companion" loop is pre-scaffolded.
- `src/config/voiceNewsCategories.ts` already maps voices → news
  categories/keywords/sources. `jock` → sports (espn, bleacher-report);
  `homie` → entertainment/celebrity (tmz, complex, buzzfeed). The two seed
  correspondents reuse these two voice configs directly.
- `src/services/newsService.ts` `getArticlesByCategories()` is the article
  fetch pattern. `src/services/morningBriefService.ts` `buildBrief()` already
  fetches per-voice news — model the grounding fetch on it.
- `src/config/coachFramework.ts` + `supabase/functions/_shared/coachFramework.ts`
  are the exact **mirror pattern** to copy for the correspondent framework
  (client source of truth + Deno edge copy kept in sync).

## The design

The correspondent behavior is injected **server-side in the edge function**,
because the live chat path builds its prompt there (`chat-turn` via
`buildPersonaLayer`), not from the client `systemPromptBuilder.ts` (that path is
gated off by `USE_SERVER_PROMPT=false`). So, like the coach framework, the
correspondent framework needs a client source-of-truth file AND a Deno edge
mirror, and the grounding/news fetch happens inside the edge function.

Flow per correspondent message:

```
chat-turn receives message for a companion whose relationship_type === 'correspondent'
  → resolve the correspondent's beat + voice (from the companion row / config)
  → fetch fresh articles for that beat from news_articles (edge-side query)
  → inject a RECENT_STORIES block (headlines + summaries + article IDs) into the prompt
  → inject the correspondent behavioral block (in place of coach/companion blocks)
  → model responds in-voice, grounded to those stories
  → chat-turn returns { content, article_ids }  ← the IDs it grounded on
  → client saves the assistant message WITH article_ids
  → chat UI renders a <SourceCard> per article_id under the message
  → tapping a card opens the existing Daily Feed in-app reader (full content),
    logs an article_view, and offers "talk about this" (article_conversations)
```

---

## Files

### NEW: `src/config/correspondentFramework.ts`

Client source-of-truth for correspondent behavior, mirroring
`coachFramework.ts`. Beat-parameterized.

```ts
export type CorrespondentBeat = 'sports' | 'gossip' | 'tech' | 'politics' | 'culture';

interface CorrespondentFrameworkInput {
  correspondentName: string;
  userName?: string;
  beat: CorrespondentBeat;
}

// The core behavioral block injected into a correspondent's system prompt.
// This is the correspondent equivalent of buildCoachBehavioralInstructions.
export const buildCorrespondentBehavioralInstructions =
  (input: CorrespondentFrameworkInput): string => { ... }
```

The block must encode the **briefing loop** (NOT the coaching loop):

1. **HOOK** — open with the single most surprising / juicy thing from today's
   stories.
2. **RIFF** — give a *take*, not just the fact. Opinion, reaction, personality.
3. **PULL IN** — end by asking the user what they think. It's a conversation,
   not a broadcast.
4. **GROUND (critical)** — "You may only report facts that appear in the
   RECENT STORIES provided to you. Never invent news, quotes, scores, names,
   dates, or outcomes. If you don't have a story on something, say you haven't
   seen anything on it yet. Attribute claims to the story's source." This is the
   anti-hallucination / anti-defamation guardrail — keep it strict.
5. **NO coaching, NO romance** — do not set goals for the user, do not flirt or
   use pet names. Warm and opinionated, not a partner and not a coach.

Add a beat flavor line keyed off `beat` (gossip = playful/breathless;
sports = hot-take/debate; etc.), analogous to how `coachFramework` varies by
accountability level.

Also export `buildCorrespondentOpeningGuidance({ correspondentName, beat })` for
the first message (mirrors `buildCoachOpeningGuidance`) — the correspondent
opens with a real headline from its beat, not "hi I'm your reporter."

### NEW: `supabase/functions/_shared/correspondentFramework.ts`

Deno edge mirror of the above (same pattern as
`supabase/functions/_shared/coachFramework.ts`). Keep the two in sync. This is
the copy actually used at chat time.

### NEW: `src/config/signatureCorrespondents.ts`

The correspondent roster, modeled on `SIGNATURE_EXPERTS` in
`signatureExperts.ts`. Each entry maps a character → a beat → an existing voice
key (so it inherits news routing from `voiceNewsCategories.ts` for free).

```ts
export interface CorrespondentConfig {
  id: string;
  name: string;
  beat: CorrespondentBeat;
  voiceKey: string;        // key into VOICE_NEWS_CATEGORIES + signatureVoices
  description: string;
  premium: boolean;        // false for both seeds
  source: 'curated' | 'user';
}

export const SIGNATURE_CORRESPONDENTS: CorrespondentConfig[] = [
  {
    id: 'gossip_insider',
    name: 'The Insider',
    beat: 'gossip',
    voiceKey: 'homie',     // → tmz, complex, buzzfeed (entertainment/general)
    description: 'Your plugged-in friend with all the pop-culture tea.',
    premium: false,
    source: 'curated',
  },
  {
    id: 'sports_sideline',
    name: 'The Sideline',
    beat: 'sports',
    voiceKey: 'jock',      // → espn, bleacher-report (sports)
    description: 'Hot takes and the day in sports, delivered with attitude.',
    premium: false,
    source: 'curated',
  },
];
```

> Naming note: keep character names original (The Insider / The Sideline). Do
> NOT name or impersonate real outlets (TMZ/ESPN) in UI copy — those are only
> the underlying news *sources*, not the character brand.

### NEW: correspondent news grounding helper

Add a helper the edge function calls to fetch the correspondent's fresh
articles. It resolves the beat's voice config from `VOICE_NEWS_CATEGORIES`
(categories/keywords), queries `news_articles` for the last ~5–7 days ordered by
`published_at desc`, limit ~6, and returns `{ articles, block }` where `block`
is the formatted `RECENT STORIES` text and each article contributes its `id`,
`title`, `summary/description`, and `source`.

Model the query on `newsService.getArticlesByCategories()` and the block
formatting on `morningBriefService.buildBrief()`'s news block. Implement the
fetch **inside the edge function** (Deno supabase client querying
`news_articles` directly) since correspondent prompts are assembled server-side.

The block format (example):

```
=== RECENT STORIES (your only source of facts — do not report anything not here) ===
[1] (id: <uuid>) "Headline" — <one-line summary> (source: <outlet>)
[2] (id: <uuid>) ...
```

### MODIFIED: `supabase/functions/chat-turn/index.ts`

Where the function already branches on relationship type / builds the coach
layer, add a `correspondent` branch:

1. Detect `companion.relationship_type === 'correspondent'`.
2. Resolve beat + voiceKey (store `beat`/`voice_key` on the companion row at
   creation, or look up by a `correspondent_id` column — see migration).
3. Fetch the grounded articles (helper above) and inject the `RECENT STORIES`
   block + `buildCorrespondentBehavioralInstructions(...)` **instead of** the
   coach/companion behavioral blocks. The Signature Voice layer (persona) still
   stacks underneath, same as coaches.
4. Return the grounded article IDs to the client:
   `return { content, article_ids }` (add `article_ids` to the response body;
   existing callers ignore unknown fields).

Everything else in chat-turn (moderation, tier gating, model selection, history,
memory rules, time rules, rate limiting) is untouched.

### MODIFIED: `src/services/firstMessageService.ts`

When the companion is a correspondent, use
`buildCorrespondentOpeningGuidance(...)` and the grounded stories so the first
message opens on a real headline. (Mirrors how it already special-cases coaches.)

### MODIFIED: `src/services/chatService.ts`

1. Add optional `article_ids?: string[]` to the `Message` interface (line ~212).
2. `saveMessage(...)` (line ~617) persists `article_ids` for assistant messages.
3. When calling the edge function, read `article_ids` off the response and attach
   to the saved assistant message.

### NEW: `src/components/SourceCard.tsx` (+ wire into the chat message renderer)

A compact card (headline + thumbnail + outlet) rendered under any assistant
message that has `article_ids`. Reuse the article card + reader from
`DailyFeedPage.tsx` (extract the reader into a shared component if it isn't
already). Tapping a card:

- opens the existing in-app reader with the full `content` (no external nav),
- logs an `article_view` (dedup index already exists),
- shows a "Talk about this" action that starts/continues an
  `article_conversations` thread with that correspondent.

### MODIFIED: `src/pages/CompanionLobbyPage.tsx`

Add a third rail — **"Velvet Correspondents"** — filtering
`relationship_type === 'correspondent'`, mirroring the existing "Velvet Coaches"
rail (lines ~779–787). Seed the two curated correspondents into the lobby.

---

## Database migration

New migration (mirror the additive style of existing migrations — guarded
`ALTER`s, `IF NOT EXISTS`):

1. **Allow the new relationship type.** If `companions.relationship_type` has a
   `CHECK` constraint or enum restricting values, extend it to include
   `'correspondent'`. If it's a free-text column, no change needed — verify
   first.
2. **Correspondent identity on the companion row.** Add nullable columns so the
   edge function can resolve the beat/voice without a join:
   - `correspondent_id text` (e.g. `gossip_insider`)
   - `beat text`
   - `voice_key text` (may already be derivable from `signature_voice`)
3. **Message source citations.** Add `article_ids uuid[]` (nullable) to the chat
   messages table so assistant messages persist their cited article IDs.
4. `article_conversations` and `article_views` already exist — no change.

No backfill needed; existing companions are unaffected.

## Deployment

```bash
supabase functions deploy chat-turn
# (and generate-opener / first-message function if first messages are server-side)
```

`_shared` files deploy with the function automatically. Run the migration in
Supabase before deploying the function.

## QA checklist

1. **Grounding is real.** Talk to The Sideline — every score/trade/name it
   states must appear in an actual `news_articles` row. Ask about a made-up
   event ("did the Lakers sign a Martian?") — it must say it hasn't seen
   anything on that, NOT invent a story.
2. **Voice is distinct.** The Insider (gossip) and The Sideline (sports) read
   as clearly different personalities, and neither reads like a coach (no goals,
   no "what's your next step") or a romantic companion (no flirting/pet names).
3. **Free access.** Both correspondents are usable on the free tier — no paywall
   prompt on the character.
4. **Source cards.** A correspondent message about stories shows tappable source
   cards; tapping opens the full article in-app (never a browser), logs a view,
   and offers "talk about this."
5. **First message** opens on a real, current headline from the correspondent's
   beat.
6. **Lobby** shows the "Velvet Correspondents" rail with both characters.
7. **Regression.** Friends, romantic companions, and coaches are unchanged;
   moderation, tier gating, and message decrement still fire.

## Known follow-ups (NOT in this change)

- **Group `daily_debate` (premium).** Two correspondents in a group chat riffing
  on the same story and reacting to each other — the premium upsell. Applies the
  same grounding block inside `supabase/functions/group-chat/index.ts` with a new
  turn type.
- **More beats.** `tech` (voiceKey `nerd`), `culture` (`artist`), `politics`
  (`lawyer`). Each is a single `SIGNATURE_CORRESPONDENTS` entry — no new code.
- **Politics = debate by default.** When the politics beat ships, default it to a
  two-voice debate format (e.g. `lawyer` evidence-lens vs `shakespearean`
  principle-lens on the same story) rather than one opinionated pundit — safer
  and more compelling. Keep the strict grounding rule and wire-service sources.
- **Proactive daily briefing.** A correspondent variant of the scheduled
  proactive message (mirror `getCoachScheduledMessage` in
  `proactiveMessageService.ts`) that fires a real-headline hook on a daily
  cadence — the daily-sign-in pull.
- **User-created correspondents.** `source: 'user'` correspondents (pick a beat +
  voice) once the curated pair is validated.
```
