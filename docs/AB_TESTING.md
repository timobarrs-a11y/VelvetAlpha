# A/B Testing — Design Spec

Targets: **questionnaire funnel**, **correspondent funnel**, **whole-product funnel**.

No third-party vendor needed. You already have the measurement layer —
`analyticsService` (`trackEvent`, `trackFunnelStep`) writing to Supabase
(`user_behavior_events`, `conversion_funnel`). A/B adds the **assignment** layer
and stamps a `variant` onto the events you already emit.

## Architecture (4 pieces)

### 1. Experiment registry (Supabase table)
```sql
create table experiments (
  key           text primary key,        -- 'questionnaire_length_v1'
  description    text,
  variants       jsonb not null,          -- [{"name":"control","weight":50},{"name":"short","weight":50}]
  active         boolean not null default false,
  surface        text,                    -- 'questionnaire' | 'correspondent' | 'product'
  created_at     timestamptz default now()
);
```
Turning a test on/off is a row update — no deploy.

### 2. Deterministic assignment (`src/lib/experiments.ts`)
Bucket by hashing `userId + experimentKey` → stable variant, no DB round-trip,
no flicker on reload.
```ts
// hash(userId + key) % 100 → pick variant by cumulative weight
export function assignVariant(userId: string, key: string, variants: Variant[]): string
```
Anonymous users (pre-signup, e.g. early questionnaire): fall back to a persisted
`localStorage` UUID so their bucket is stable across the funnel and can be
stitched to the real user id at signup.

### 3. Exposure + `useExperiment` hook
Fire **one** exposure event the first time a user sees the tested surface, then
render the variant:
```ts
const variant = useExperiment('questionnaire_length_v1'); // logs 'experiment_exposed' once
```
Exposure goes through the existing `analyticsService.trackEvent`:
```ts
trackEvent({ action_type: 'feature_used', action_target: 'experiment_exposed',
             page_path, metadata: { experiment: key, variant } });
```

### 4. Slice conversions by variant
`trackFunnelStep` already writes `conversion_funnel`. Add `experiment` + `variant`
to its metadata (or a nullable column) so read-out is one query:
```sql
select variant, count(*) filter (where completed) / count(*)::float as conv_rate
from conversion_funnel where funnel_type='onboarding' group by variant;
```
Add a significance check (two-proportion z-test) before calling a winner.

### Server-side variants (for prompt experiments)
Opener/intro tests must bucket **in the edge functions** (`generate-opener`,
`chat-turn`) where the prompt is built — hash the user id there with the same
algorithm, stamp the variant onto the response metadata so client conversions
line up.

## The three funnels

### Questionnaire funnel  (`funnel_type: 'onboarding'`)
- **Length:** full questionnaire vs. a trimmed one — does a shorter quiz raise
  completion without hurting match quality?
- **Framing:** "dating profile" vs. "tell us what you're into" copy.
- **Metric:** questionnaire-start → completion → first companion created.

### Correspondent funnel  (`funnel_type: 'first_message'`, server-side variant)
- **Intro length:** the new 2-3 sentence intro vs. the old 3-5 (we just changed
  this — measure it instead of guessing).
- **Voice/persona:** "personal reporter" framing vs. neutral columnist.
- **Free-tier cap:** dispatch length in `chat-turn` for free users.
- **Metric:** opener delivered → first reply → day-2 return.

### Whole-product funnel  (`funnel_type: 'upgrade'` + retention)
- **Paywall:** timing (message N) and copy of the upgrade prompt.
- **Metric:** the `BusinessMetric` you already track — `premium_conversions`,
  `retention_rate`.

## Guardrails
- **One experiment per surface at a time** early on — overlapping tests on the
  same funnel confound each other.
- **Powered enough:** with low DAU a test needs weeks to reach significance;
  test big obvious changes first, not subtle copy.
- **Always log exposure**, not just conversion — otherwise you can't compute a
  denominator per variant.

## Build order (when we implement)
1. `experiments` table + `assignVariant` util + `useExperiment` hook (foundation).
2. Add `variant` to `trackFunnelStep`.
3. Wire the **questionnaire length** test end to end as the first live experiment.
4. Server-side variant in `generate-opener` for the intro-length test.
5. A small admin read-out (SQL view → simple page).
