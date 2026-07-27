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
   the full article inside the app (the existing `/article` reader route) —
   never an external site.

## Two prompt paths (READ THIS FIRST — it's the thing most likely to trip you up)

This app builds chat prompts in **two different places**, and correspondent
logic must be added to BOTH:

- **Ongoing chat → the `chat-turn` edge function.** The live send path is
  `App.tsx` → `ChatService.sendMessageWithSignals` → `chat-turn`. The
  client-side `systemPromptBuilder.ts` is largely dead (gated by
  `USE_SERVER_PROMPT=false`). So ongoing-chat correspondent behavior + news
  grounding is added **server-side** in `chat-turn`. This mirrors where the
  coach framework already lives.
- **First message → the generic `/functions/v1/chat` passthrough, built
  CLIENT-SIDE.** `firstMessageService.ts` (line ~224) posts to
  `/functions/v1/chat`, and builds its guidance client-side
  (`buildCoachOpeningGuidance`, line ~157). It does NOT go through `chat-turn`,
  so it never hits the correspondent branch. **The opener must fetch its
  articles client-side** (via `newsService`) and pass them in the prompt. Do not
  assume server-side grounding covers the first message — it doesn't.

Because of this split, the article-grounding fetch exists in **two copies** (a
client-side one for the opener + source cards, and a Deno edge-side one for
ongoing chat) — exactly the same client/edge duplication the coach framework
already uses. That's accepted in this codebase.

## What already exists (reuse, don't rebuild)

- `news_articles` table already stores full article `content` (migration
  `20260210000801`), so in-app reading needs no new data.
- **An article reader route already exists**: `/article?id=<uuid>` →
  `ArticleDetailPage.tsx` (`src/routes/appRoutes.tsx:41`). `DailyFeedPage` cards
  just `navigate('/article?id=...')`. **There is nothing to "extract"** — a
  source card just navigates to this route.
- `article_views` (read tracking, unique index exists) and
  `article_conversations` (article_id ↔ companion_id ↔ user_id, the
  "discuss this article with a companion" loop) tables already exist.
- `src/config/voiceNewsCategories.ts` already maps voices → news
  categories/keywords/sources. `jock` → sports (espn, bleacher-report);
  `homie` → entertainment/celebrity (tmz, complex, buzzfeed). The two seed
  correspondents reuse these two voice configs directly.
- `src/services/newsService.ts` `getArticlesByCategories()` is the client-side
  article fetch. `src/services/morningBriefService.ts` `buildBrief()` already
  fetches per-voice news — model the grounding fetch/format on these.
- `src/config/coachFramework.ts` + `supabase/functions/_shared/coachFramework.ts`
  are the exact **mirror pattern** to copy for the correspondent framework
  (client source of truth + Deno edge copy kept in sync).
- `companionService.createCompanion()` (`src/services/companionService.ts:141`)
  is how a companion row is inserted — reuse it for seeding correspondents.

## The briefing loop (behavioral design)

The correspondent behavioral block encodes a **briefing loop**, NOT the coaching
loop:

1. **HOOK** — open with the single most surprising / juicy thing from today's
   stories.
2. **RIFF** — give a *take*, not just the fact. Opinion, reaction, personality.
3. **PULL IN** — end by asking the user what they think. A conversation, not a
   broadcast.
4. **GROUND (critical)** — "You may only report facts that appear in the RECENT
   STORIES provided to you. Never invent news, quotes, scores, names, dates, or
   outcomes. If you don't have a story on something, say you haven't seen
   anything on it yet. Attribute claims to the story's source." Anti-hallucination
   / anti-defamation guardrail — keep it strict.
5. **NO coaching, NO romance** — no goals for the user, no flirting/pet names.
   Warm and opinionated, not a partner and not a coach.

---

## Files

### NEW: `src/config/correspondentFramework.ts`

Client source-of-truth, mirroring `coachFramework.ts`. Beat-parameterized.

```ts
export type CorrespondentBeat = 'sports' | 'gossip' | 'tech' | 'politics' | 'culture';

interface CorrespondentFrameworkInput {
  correspondentName: string;
  userName?: string;
  beat: CorrespondentBeat;
}

// Correspondent equivalent of buildCoachBehavioralInstructions.
export const buildCorrespondentBehavioralInstructions =
  (input: CorrespondentFrameworkInput): string => { /* briefing loop, beat flavor */ };

// Correspondent equivalent of buildCoachOpeningGuidance — used CLIENT-SIDE by
// firstMessageService. Takes the already-fetched stories so the opener leads on
// a real headline.
export const buildCorrespondentOpeningGuidance =
  (input: { correspondentName: string; beat: CorrespondentBeat; storiesBlock: string }): string => { ... };

// Deterministic fallback opener (mirror buildCoachOpeningFallback) for when no
// AI generation / no articles are available.
export const buildCorrespondentOpeningFallback =
  (input: { correspondentName: string; beat: CorrespondentBeat }): string => { ... };
```

Add a beat flavor line keyed off `beat` (gossip = playful/breathless; sports =
hot-take/debate), analogous to how `coachFramework` varies by accountability
level.

### NEW: `supabase/functions/_shared/correspondentFramework.ts`

Deno edge mirror of `buildCorrespondentBehavioralInstructions` (same pattern as
`supabase/functions/_shared/coachFramework.ts`). Keep the two in sync. This copy
is used by `chat-turn` for ongoing chat.

### NEW: `src/config/signatureCorrespondents.ts`

Roster, modeled on `SIGNATURE_EXPERTS`. Each entry maps character → beat →
existing voice key (inherits news routing from `voiceNewsCategories.ts`).

```ts
export interface CorrespondentConfig {
  id: string;              // correspondent_id stored on the companion row
  name: string;
  beat: CorrespondentBeat;
  voiceKey: string;        // key into VOICE_NEWS_CATEGORIES + signatureVoices
  description: string;
  premium: boolean;        // false for both seeds
  source: 'curated' | 'user';
}

export const SIGNATURE_CORRESPONDENTS: CorrespondentConfig[] = [
  { id: 'gossip_insider', name: 'The Insider', beat: 'gossip', voiceKey: 'homie',
    description: 'Your plugged-in friend with all the pop-culture tea.', premium: false, source: 'curated' },
  { id: 'sports_sideline', name: 'The Sideline', beat: 'sports', voiceKey: 'jock',
    description: 'Hot takes and the day in sports, delivered with attitude.', premium: false, source: 'curated' },
];
```

> Keep character names original. Do NOT name/impersonate real outlets
> (TMZ/ESPN) in UI copy — those are only the underlying news *sources*.

### NEW: `src/services/correspondentNewsService.ts` (client-side grounding)

Used by the opener and by source-card assembly. Given a `voiceKey`/`beat`:
resolve the beat's categories from `VOICE_NEWS_CATEGORIES`, call
`newsService.getArticlesByCategories(categories, 6)`, and return
`{ articles, storiesBlock }` where each article contributes `id`, `title`,
`summary`, `source`. Block format:

```
=== RECENT STORIES (your only source of facts — do not report anything not here) ===
[1] (id: <uuid>) "Headline" — <one-line summary> (source: <outlet>)
[2] (id: <uuid>) ...
```

### NEW: edge-side grounding fetch inside `chat-turn`

Same logic in Deno: query `news_articles` directly (last ~7 days,
`order by published_at desc`, limit 6) filtered by the correspondent's beat
categories, build the identical `RECENT STORIES` block, and keep the returned
article `id`s to send back to the client (see chat-turn edits).

### MODIFIED: `supabase/functions/chat-turn/index.ts`

Where it already branches on relationship type / builds the coach layer, add a
`correspondent` branch:

1. Detect `companion.relationship_type === 'correspondent'`.
2. Resolve `beat` + `voice_key` from the companion row (new columns — see
   migration).
3. Fetch grounded articles (edge helper above); inject the `RECENT STORIES`
   block + `buildCorrespondentBehavioralInstructions(...)` **instead of** the
   coach/companion behavioral blocks. The Signature Voice persona still stacks
   underneath (same as coaches).
4. **Return the grounded article IDs**: add `article_ids: string[]` to the
   response body. (Existing callers ignore unknown fields.)

Untouched: moderation, tier gating, model selection, history, memory rules, time
rules, rate limiting.

### MODIFIED: `src/services/firstMessageService.ts` (CLIENT-SIDE grounding)

The opener path posts to `/functions/v1/chat`, not `chat-turn`. So for a
correspondent companion:

1. Client-side, call `correspondentNewsService` to fetch stories + block.
2. Build the prompt with `buildCorrespondentOpeningGuidance({ ..., storiesBlock })`
   (mirrors how it already special-cases coaches with
   `buildCoachOpeningGuidance`), fall back to `buildCorrespondentOpeningFallback`
   when no articles/AI.
3. Return the opener AND the fetched `article_ids` so App.tsx can persist them on
   the first assistant message (see save path below).

### Persisting `article_ids` — the save path (Hole this replaces the earlier "saveMessage" note)

`ChatService.saveMessage` is NOT the live save path. Ongoing chat saves via a
mutation. Thread `article_ids` through **all** of these:

1. **`src/services/chatService.ts` — `sendMessageWithSignals` (line ~692):**
   include `article_ids` in its return type/shape (read from the `chat-turn`
   response body).
2. **`src/features/chat/hooks/useSendMessage.ts`:** add `article_ids?: string[]`
   to `SendMessageInput` and `OptimisticMessage`; pass it into the insert.
3. **`src/shared/supabase/queries.ts` — `insertMessageByUserAndCompanion`:**
   accept and insert `article_ids`.
4. **`src/App.tsx` — the two assistant-message `sendMessageMutation.mutateAsync`
   sites** fed by `sendMessageWithSignals` (≈ lines 667–676 and 832–843, plus
   the first-message save ≈ line 774): pass `article_ids` from the result into
   `mutateAsync`.

(Also add `article_ids?: string[]` to the `Message` interface in
`chatService.ts` line ~212 so the UI can read it.)

### NEW: `src/components/SourceCard.tsx` (+ wire into the chat message renderer)

A compact card (headline + thumbnail + outlet) rendered under any assistant
message that has `article_ids`. Fetch the article rows by id (reuse
`newsService`), render each as a card, and on tap **`navigate('/article?id=<id>')`**
— the existing `ArticleDetailPage` reader logs the `article_view` and shows full
content. No reader extraction needed. Optionally add a "Talk about this" action
that continues an `article_conversations` thread with the correspondent.

### MODIFIED: type unions + branches (Hole: unions exclude correspondent)

Extend every relationship-type union to include `'correspondent'` and add a
correspondent branch wherever `mentor` is special-cased:

- `src/services/companionService.ts:15` — `Companion.relationship_type` union,
  and `CreateCompanionOptions.relationshipType`.
- `src/services/chatService.ts:729` — `sendMessage(..., relationshipType)` union
  (and the cast at line ~1011).
- `src/config/systemPromptBuilder.ts:19` — `relationshipType` union + the
  relationship-type label line (~145). (This path is mostly dead but must still
  type-check and not misroute.)

### MODIFIED: `src/services/companionService.ts` — `createCompanion` (Hole: seeding)

Curated correspondents must become real `companions` rows (config alone does
nothing). Extend `CreateCompanionOptions` + the insert (line ~146) to accept the
new fields: `correspondent_id`, `beat`, `voice_key`. Then add a **one-tap "add"
from the lobby** (see below) that calls `createCompanion` with
`relationshipType: 'correspondent'` and those fields populated from the chosen
`CorrespondentConfig`. (This is the correspondent analog of how experts become
companions via the expert flow.)

### MODIFIED: `src/pages/CompanionLobbyPage.tsx`

- Add a third rail — **"Velvet Correspondents"** — filtering
  `relationship_type === 'correspondent'` (mirror the "Velvet Coaches" rail,
  ~lines 779–787).
- Render the two `SIGNATURE_CORRESPONDENTS` as add-able cards; tapping one the
  user doesn't have yet calls the `createCompanion` add-flow above, then opens
  the chat.

---

## Database migration

New migration (additive, guarded, mirroring existing style):

1. **Extend the relationship_type CHECK constraint (required — confirmed hard
   constraint).** The constraint is named `companions_relationship_type_check`
   (created in `20251219215016`, last redefined in `20260617201807`). Drop and
   recreate to include the new value:
   ```sql
   ALTER TABLE companions DROP CONSTRAINT IF EXISTS companions_relationship_type_check;
   ALTER TABLE companions ADD CONSTRAINT companions_relationship_type_check
     CHECK (relationship_type IN ('friend', 'romantic', 'mentor', 'correspondent'));
   ```
2. **Correspondent identity on the companion row** (nullable):
   `correspondent_id text`, `beat text`, `voice_key text`.
3. **Message source citations:** add `article_ids uuid[]` (nullable) to the chat
   messages table so assistant messages persist their cited article IDs.
4. `article_conversations` / `article_views` already exist — no change.

No backfill; existing companions unaffected.

## Deployment

```bash
# run the migration in Supabase first, then:
supabase functions deploy chat-turn
supabase functions deploy chat   # if the opener passthrough needs changes
```

`_shared` files deploy with the function automatically.

## QA checklist

1. **Grounding is real.** The Sideline's scores/trades/names must all exist in
   `news_articles`. Ask about a made-up event — it must say it hasn't seen
   anything, NOT invent a story.
2. **First message is grounded too.** The opener leads on a real current
   headline (client-side fetch working), and falls back gracefully with no
   articles.
3. **Voice distinct, not coach/romantic.** Insider vs Sideline read clearly
   different; neither sets goals or flirts.
4. **Free access.** Both usable on free tier — no paywall on the character.
5. **Source cards + persistence.** A correspondent message shows tappable source
   cards; `article_ids` survive a reload (persisted through the mutation, not
   lost). Tapping opens `/article?id=` in-app, logs a view.
6. **Seeding.** Adding a correspondent from the lobby inserts a `companions` row
   with `relationship_type='correspondent'` + `correspondent_id`/`beat`/
   `voice_key`, and does NOT hit the CHECK constraint.
7. **Lobby** shows the "Velvet Correspondents" rail.
8. **Regression.** Friends, romantic companions, coaches unchanged; moderation,
   tier gating, message decrement still fire; type-check passes (all unions
   extended).

## Known follow-ups (NOT in this change)

- **Group `daily_debate` (premium).** Two correspondents reacting to the same
  story and to each other — the premium upsell. Same grounding block inside
  `supabase/functions/group-chat/index.ts` with a new turn type.
- **More beats.** `tech` (`nerd`), `culture` (`artist`), `politics` (`lawyer`).
  Each is one `SIGNATURE_CORRESPONDENTS` entry.
- **Politics = debate by default.** Ship it as a two-voice debate (e.g. `lawyer`
  evidence-lens vs `shakespearean` principle-lens on the same story), strict
  grounding, wire-service sources.
- **Proactive daily briefing.** A correspondent variant of
  `getCoachScheduledMessage` in `proactiveMessageService.ts` firing a
  real-headline hook on a daily cadence.
- **User-created correspondents** (`source: 'user'`) once the curated pair is
  validated.
```
