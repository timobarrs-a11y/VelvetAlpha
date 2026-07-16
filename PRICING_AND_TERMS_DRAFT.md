# Pricing Copy + Terms Additions — Path C (Honest Caps + Anti-Abuse)

> ⚠️ **NOT LEGAL ADVICE.** These are plain-language drafts written to be *as
> defensible as possible*, but they are a starting point for a lawyer to review —
> **not** a substitute for one. Because Project Velvet is an adult product that
> processes intimate content and carries CSAE-reporting obligations, have a
> qualified attorney (ideally one who knows consumer-subscription and
> adult-content law in your jurisdiction) review before you publish. The one hard
> rule that keeps you out of trouble: **the numbers enforced in code must match
> the numbers shown to users.** If the webhook caps a tier at N, the pricing page
> and these Terms must say N — never "unlimited."

---

## PART A — Pricing page copy (honest, capped, no "unlimited")

The design principle: **the paid ladder is sold on AI quality (Velvet V1 → V2)
and features, not on message count.** Message allowances are disclosed plainly so
no user can be surprised, and framed around *freedom of daily use* rather than the
forbidden word.

### Recommended allowances (adjustable — see note)

| Tier | Price/mo | Model | Messages / month | One-line pitch |
|---|---|---|---|---|
| Free | $0 | Velvet V1 (Haiku) | 15 | "See what Velvet feels like." |
| **Essential** | $24.99 | Velvet V1 (Haiku) | **1,500** | "Your everyday companion — no daily limits." |
| **Plus** | $59 | Velvet V2 (Sonnet) | **2,000** | "The deepest AI — smarter, warmer, more you." |
| **Pro** | $99 | Velvet V2 (Sonnet) | **4,000** | "Everything, with room to go deep every day." |
| **Elite** | $149 | Velvet V2 (Sonnet) | **8,000** | "The full Velvet experience, uncapped for real life." |

> **Note on the numbers.** These are chosen so allowances rise with price
> (1,500 → 2,000 → 4,000 → 8,000) *and* the model upgrades from V1 to V2, so the
> ladder never looks backwards on the page, and every tier stays comfortably
> profitable at current Haiku/Sonnet rates. Tune them against real alpha usage,
> but keep two properties: (a) allowances never decrease as price increases, and
> (b) the entry allowance is high enough (~50/day) that ordinary users never feel
> it. **Do not exceed ~8,000 Sonnet messages on any tier without re-checking
> margins** — Sonnet output is ~5× Haiku.

### Per-tier copy blocks (drop-in)

**Essential — $24.99/mo**
> Your everyday AI companion. Chat freely, every day — **no daily limits, 1,500
> messages a month**. Fast, responsive, always there. *Powered by Velvet V1.*

**Plus — $59/mo**
> Meet Velvet V2 — our deepest, most emotionally present AI. Signature Voices,
> richer memory, and insights. **2,000 messages a month.**

**Pro — $99/mo**
> Velvet V2 with room to go deep every single day. All premium features included.
> **4,000 messages a month.**

**Elite — $149/mo**
> The complete Velvet experience — the deepest AI, every feature, and an
> allowance built for real daily life. **8,000 messages a month.**

### Language rules for the pricing page (keep you FTC-clean)

- ✅ Allowed, honest, still appealing: *"No daily limits,"* *"Chat every day,"*
  *"1,500 messages a month,"* *"generous monthly messages."*
- ❌ Never: *"Unlimited,"* *"Unlimited\*,"* *"Unlimited (fair use)"* in fine print,
  or any phrasing that promises no ceiling while a ceiling exists. Undisclosed or
  buried caps behind the word "unlimited" are the classic deceptive-advertising
  trap regulators pursue.
- Show the monthly number **at the point of purchase** (on the plan card and the
  checkout confirmation), not only buried in Terms. Point-of-sale disclosure is
  what defeats a "they hid it" claim.
- When a user reaches the cap, the in-app message should be honest and
  non-punitive: *"You've reached this month's message allowance. It refreshes on
  [date], or upgrade for more."* — never *"unlimited plan limit reached."*

---

## PART B — Terms of Service additions

Slots into your existing 16-section Terms. Match the current voice ("Project
Velvet," "the Service," "We may…"). Bump the `TERMS_VERSION` string and the
"Last updated" date when you publish, since these are material changes and you
re-collect consent on version change.

### B1 — Amend Section 6 (Acceptable Use)

Add these bullets to the existing list (they extend, not replace, what's there):

- *Share, sell, rent, or transfer your account or access to the Service, or use a
  single account on behalf of multiple people;*
- *Resell, sublicense, or commercially redistribute the Service or its outputs;*
- *Create multiple accounts, or use any method, to circumvent message
  allowances, free-tier limits, trial restrictions, or a suspension;*
- *Abuse, manipulate, or fraudulently obtain rewards from any referral, invitation,
  promotion, or credit program;*
- *Initiate chargebacks or payment disputes for charges you actually authorized,
  in lieu of using our cancellation and support process.*

### B2 — Add a subsection to Section 9 (Subscription and Payments): "Message Allowances and Fair Use"

> **Message Allowances.** Each plan includes a monthly message allowance, shown on
> our pricing page and at checkout before you purchase. Allowances refresh at the
> start of each billing cycle and do not roll over. Unused messages have no cash
> value. When you reach your allowance, message sending pauses until your
> allowance refreshes or you upgrade; other account access continues. **We do not
> represent any plan as "unlimited."** We may adjust plan allowances or pricing
> prospectively with reasonable advance notice; changes apply to subsequent
> billing periods, and your continued use after the effective date constitutes
> acceptance.

### B3 — New standalone section: "Fair Use and Anti-Abuse"

Insert as a new numbered section (e.g., between current §9 and §10, renumbering
the rest, or as §16A — your lawyer will place it):

> **Fair Use and Anti-Abuse.** Message allowances are intended for personal,
> human, interactive use. To protect the Service and its users, and independent of
> any plan allowance, we may investigate, rate-limit, throttle, suspend, or
> terminate any account, and may withhold or revoke rewards or credits, where we
> reasonably determine that an account is engaged in:
> (a) automated, scripted, bot-driven, or programmatic access, or access at a
> volume or pattern inconsistent with genuine individual human use;
> (b) account sharing, resale, or commercial redistribution of access or outputs;
> (c) creating multiple accounts or otherwise circumventing allowances, limits, or
> a prior suspension;
> (d) fraud, including payment fraud, chargeback abuse, or manipulation of any
> referral, invitation, or promotional program;
> (e) any conduct prohibited by Section 6, including generating or soliciting
> illegal content such as any sexual content involving minors; or
> (f) any use that materially degrades, disrupts, or imposes disproportionate cost
> on the Service or other users.
> Where practical and not prohibited by law or the nature of the abuse, we will
> give notice and an opportunity to cure before terminating a paid account for a
> Fair-Use matter; conduct under (d) and (e) may result in immediate suspension or
> termination without prior notice. This section supplements, and does not limit,
> our rights under Sections 6, 7, and 15.

*Drafting rationale (delete before publishing): keeping the enforcement triggers
tied to **defined conduct** — rather than a bare "at our sole discretion" — makes
the clause far more defensible and reduces the chance a suspension reads as
arbitrary or retaliatory. The "notice and cure" carve-out for economic matters,
with immediate action reserved for fraud and illegal content, mirrors what
enforceable consumer terms typically look like.*

### B4 — New standalone section: "Referral and Invitation Program"

You now operate a referral system that grants message rewards; it needs governing
terms:

> **Referral and Invitation Program.** We may offer programs that reward you for
> inviting others to the Service. Rewards (such as bonus messages) are promotional,
> have no cash value, are non-transferable, and are not redeemable for currency.
> Rewards are earned only when the conditions we publish are met — which may
> include that an invited person is a new, genuine user who becomes active on the
> Service — and are not earned merely by signing up. You may not obtain rewards
> through self-referral, fake or duplicate accounts, automation, or any deceptive
> or manipulative means. We may withhold, revoke, or reverse rewards obtained in
> violation of these Terms, and may modify, suspend, or discontinue any such
> program at any time. Any per-account reward caps we apply are part of the
> program's published terms.

*Drafting rationale (delete before publishing): "no cash value / non-transferable
/ we may modify or discontinue / void for fraud" are the standard, enforceable
backbone of loyalty-and-referral terms. The "genuine, active user" and
"not by signing up alone" language matches the activation-gated logic already in
your code, so your enforcement is consistent with your stated terms — which is
what keeps enforcement defensible.*

### B5 — Optional reinforcement to Section 9 (auto-renewal consent)

Many jurisdictions (e.g., California's Automatic Renewal Law and the FTC's
negative-option rules) require *clear, conspicuous* disclosure of auto-renewal
terms and an *easy* cancellation path. Your §9 already discloses auto-renewal and
easy cancellation — good. Reinforce at the **checkout screen** (not just Terms)
with a short affirmative line the user sees before paying:

> *"Your [Plan] subscription is $[price]/month and renews automatically each month
> until you cancel. You can cancel anytime from Billing; cancellation takes effect
> at the end of the current period."*

Keep the in-app "Manage / Cancel plan" path one or two taps from the account menu.

---

## PART C — Consistency checklist (the part that actually keeps you safe)

Deception claims almost always come down to a mismatch between what you *say* and
what the system *does*. Before launch, confirm all three agree on every number:

- [ ] **Code:** the Stripe webhook `TIER_ENTITLEMENTS` message numbers.
- [ ] **Pricing page + checkout:** the same numbers, shown before purchase.
- [ ] **Terms:** the "Message Allowances" subsection references the pricing page
      (don't hard-code numbers in Terms that can drift — point to the page).
- [ ] The word **"unlimited"** appears **nowhere** in product, marketing, or Terms.
- [ ] The cap-reached message and the "Account suspended" message are honest and
      distinct (allowance vs. policy).
- [ ] Referral rewards granted by code match the published program conditions.
- [ ] `TERMS_VERSION` bumped + consent re-collected on publish.
