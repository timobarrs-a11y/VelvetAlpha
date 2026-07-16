# Remove "Unlimited" → Honest Capped Allowances — Handoff for Bolt

Self-contained copy-paste instructions. No git checkout required — apply these
exact find/replace edits to the live project, then rebuild. All are ordinary
frontend edits except Part 5 (the Stripe webhook edge function).

**What this does:** removes the "unlimited" marketing claim and the `-1` (infinite)
message grant, replacing them with disclosed monthly caps that rise with price and
model quality. Code and copy end up saying the same numbers everywhere.

**The allowance ladder (final):**

| Tier (key) | Plan name | Price | Model | Messages/mo |
|---|---|---|---|---|
| `unlimited` | Velvet Essential | $24.99 | V1 (Haiku) | **1,500** |
| `starter` | Velvet Plus | $59 | V2 (Sonnet) | **2,000** |
| `plus` | Velvet Pro | $99 | V2 (Sonnet) | **4,000** |
| `elite` | Velvet Elite | $149 | V2 (Sonnet) | **8,000** |

> ⚠️ **Do NOT rename the tier key `unlimited`.** It's an internal identifier for
> the Essential plan, stored in `user_profiles.subscription_tier` and in Stripe
> metadata — renaming it is a data migration, not a copy change. Leave every
> `case 'unlimited':`, `SUBSCRIPTION_PLANS.unlimited`, `tier === 'unlimited'`, and
> color/icon key exactly as-is. Only the user-facing **word** "unlimited" and the
> `-1` grant change.

---

## Part 1 — `src/types/subscription.ts` (4 edits)

### 1a. Essential ($24.99)
**Find:**
```ts
      '200 messages per month with Velvet V1',
      'Fast, responsive AI companion',
      'Ask anything, learn anything, talk about everything',
      'Perfect for everyday chat'
    ],
    model: 'haiku',
    marketingLabel: 'Essential',
    messageLimit: 200
```
**Replace:**
```ts
      '1,500 messages a month with Velvet V1 — no daily limits',
      'Fast, responsive AI companion',
      'Ask anything, learn anything, talk about everything',
      'Perfect for everyday chat'
    ],
    model: 'haiku',
    marketingLabel: 'Essential',
    messageLimit: 1500
```

### 1b. Plus ($59) — tier key `starter`
**Find:**
```ts
      'Complex reasoning, creative thinking, real problem-solving',
      'Access to Insights'
    ],
    model: 'sonnet',
    marketingLabel: 'Plus',
    messageLimit: 800
```
**Replace:**
```ts
      'Complex reasoning, creative thinking, real problem-solving',
      'Access to Insights',
      '2,000 messages a month with Velvet V2'
    ],
    model: 'sonnet',
    marketingLabel: 'Plus',
    messageLimit: 2000
```

### 1c. Pro ($99) — tier key `plus`
**Find:**
```ts
      'Everything in Plus (Velvet V2, Insights, Signature Voice™)',
      'Increased V2 usage - Ask more, learn more, talk more'
    ],
    model: 'sonnet',
    marketingLabel: 'Pro',
    messageLimit: 2000
```
**Replace:**
```ts
      'Everything in Plus (Velvet V2, Insights, Signature Voice™)',
      '4,000 messages a month — room to go deep every day'
    ],
    model: 'sonnet',
    marketingLabel: 'Pro',
    messageLimit: 4000
```

### 1d. Elite ($149) — tier key `elite`
**Find:**
```ts
      'Maximum V2 usage (Highest tier)',
      'Access to VIP Support',
      'Access to new features before release'
    ],
    model: 'sonnet',
    marketingLabel: 'Elite',
    messageLimit: 5000
```
**Replace:**
```ts
      '8,000 messages a month — our highest allowance',
      'Access to VIP Support',
      'Access to new features before release'
    ],
    model: 'sonnet',
    marketingLabel: 'Elite',
    messageLimit: 8000
```

---

## Part 2 — `src/services/messageTrackingService.ts` (stop granting infinite)

**Find:**
```ts
    if (tier === 'unlimited') {
      updates.messages_remaining = -1;
      updates.haiku_model_enabled = true;
      updates.sonnet_model_enabled = false;
    } else if (tier === 'trial') {
```
**Replace:**
```ts
    if (tier === 'unlimited') {
      // "Velvet Essential" — capped Haiku allowance (no longer unlimited).
      updates.messages_remaining = plan.messageLimit ?? 1500;
      updates.haiku_model_enabled = true;
      updates.sonnet_model_enabled = false;
    } else if (tier === 'trial') {
```

---

## Part 3 — `src/components/SubscriptionBanner.tsx` (free-tier upsell copy)

**Find:**
```tsx
                Upgrade for unlimited messages and advanced AI
```
**Replace:**
```tsx
                Upgrade for more messages and Velvet V2 — our deepest AI
```

> Leave the `isUnlimited = messagesRemaining === -1` logic and the "Unlimited
> conversations" line it controls **alone**. No plan sets `-1` anymore, so that
> branch is only reachable by a manually-comped staff account — for which
> "unlimited" is literally true. It never shows to a paying customer.

---

## Part 4 — `src/pages/PricingOfferPage.tsx` (offer headline)

**Find:**
```tsx
            Get unlimited conversations, premium voices, and exclusive features
```
**Replace:**
```tsx
            Chat freely every day, with premium voices and exclusive features
```

---

## Part 5 — `supabase/functions/stripe-webhook/index.ts` (server-side enforcement)

The webhook must grant the same numbers the UI advertises. In the
`TIER_ENTITLEMENTS` map, **find:**
```ts
  unlimited: { messages: 200, haiku: true, sonnet: false },
  starter:   { messages: 800, haiku: false, sonnet: true },
  plus:      { messages: 2000, haiku: false, sonnet: true },
  elite:     { messages: 5000, haiku: false, sonnet: true },
```
**Replace:**
```ts
  unlimited: { messages: 1500, haiku: true, sonnet: false },  // "Velvet Essential" $24.99 (capped Haiku)
  starter:   { messages: 2000, haiku: false, sonnet: true },  // "Velvet Plus"      $59
  plus:      { messages: 4000, haiku: false, sonnet: true },  // "Velvet Pro"       $99
  elite:     { messages: 8000, haiku: false, sonnet: true },  // "Velvet Elite"     $149
```

> If you are applying the separate `STRIPE_HANDOFF.md` (the webhook rewrite),
> that document already contains these final numbers — this is the same change.
> If the webhook still has the older per-event logic, at minimum ensure whatever
> grants messages on `checkout.session.completed` uses these amounts and never
> `-1` for `unlimited`. Then **redeploy the `stripe-webhook` function.**

---

## Part 6 — Verify

1. **Grep check:** the word "unlimited" should now appear in the codebase only as
   (a) the tier **key** (`'unlimited'`, `SUBSCRIPTION_PLANS.unlimited`, color/icon
   maps) and (b) the `isUnlimited` / `=== -1` staff-comp branch in
   `SubscriptionBanner`. It must appear in **no** marketing/pricing copy.
2. **Pricing page:** the four paid plans show 1,500 / 2,000 / 4,000 / 8,000 and
   the phrase "no daily limits" on Essential — nowhere the word "unlimited."
3. **Purchase test (Stripe test mode):** buy Essential → profile gets
   `messages_remaining = 1500` (not `-1`). Buy Plus/Pro/Elite → 2,000 / 4,000 /
   8,000, Sonnet enabled.
4. **The rule:** code number = pricing-page number = Terms number, for every tier.
   If you change any allowance later, change all three.
