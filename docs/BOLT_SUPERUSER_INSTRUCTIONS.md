# Bolt Task: Email-Allowlist Super-User ("god-mode" test account)

## GOAL (what "done" looks like)

Any signed-in account whose **email** is on an admin allowlist automatically
becomes a full super-user **everywhere**, with no payment and no Supabase
dashboard toggle:

- Unlimited messages (never decremented, never blocked by the quota gate)
- Top tier (`elite`) in the UI, so every premium feature is visible/usable
- Best model (Sonnet) on every chat surface
- Works on the deployed site by simply **signing in** with an allowlisted email

The allowlist is configurable via env var, with a hardcoded default seed so it
works out of the box.

### The one hard security rule
The allowlist MUST be enforced **server-side inside the edge functions**, using
the email from the verified auth token (`user.email` after
`supabaseAdmin.auth.getUser(token)`). The client-side check only controls what
UI is shown. Never grant entitlements from a client-supplied value — a client
can spoof it and rack up unlimited API spend.

This reuses the existing `is_test_user` bypass pattern already in the codebase —
we just add an email check alongside it. Do not remove or change `is_test_user`
behaviour; only extend it.

---

## STEP 1 — Create the client-side helper

**New file: `src/services/adminService.ts`**

```ts
/**
 * Admin / super-user allowlist (client-side).
 * Controls what premium UI is shown. Real enforcement is server-side in the
 * edge functions. Configure extra admins via VITE_ADMIN_EMAILS (comma-separated).
 */
const DEFAULT_ADMIN_EMAILS = ['timobarrs@gmail.com'];

function parseAdminEmails(): string[] {
  const fromEnv = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) ?? '';
  const envList = fromEnv.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set<string>([
    ...DEFAULT_ADMIN_EMAILS.map((e) => e.trim().toLowerCase()),
    ...envList,
  ]));
}

const ADMIN_EMAILS = parseAdminEmails();

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
```

---

## STEP 2 — Create the edge-function helper

**New file: `supabase/functions/_shared/admin.ts`**
(mirrors the existing `_shared/moderation.ts` pattern, uses `Deno.env`)

```ts
// Admin / super-user allowlist (server-side authority).
// Check ONLY against user.email from the verified auth token.
// Configure extra admins via the ADMIN_EMAILS secret (comma-separated).
const DEFAULT_ADMIN_EMAILS = ['timobarrs@gmail.com'];

function loadAdminEmails(): string[] {
  const fromEnv = Deno.env.get('ADMIN_EMAILS') ?? '';
  const envList = fromEnv.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set<string>([
    ...DEFAULT_ADMIN_EMAILS.map((e) => e.trim().toLowerCase()),
    ...envList,
  ]));
}

const ADMIN_EMAILS = loadAdminEmails();

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}
```

---

## STEP 3 — Wire the client

### 3a. `src/App.tsx`
Add the import near the other service imports (next to `messageTrackingService`):
```ts
import { isAdminEmail } from './services/adminService';
```

Find this block (~line 300, inside the profile-load effect):
```ts
      if (profile?.is_test_user) setCurrentTier('unlimited');
      else if (profile?.subscription_tier) setCurrentTier(profile.subscription_tier as SubscriptionTier);
```
Replace with (super-users get top tier so they see EVERY premium feature — note
`'elite'`, not `'unlimited'`, because `'unlimited'` is the Essential/Haiku tier):
```ts
      // Super-users (admin email allowlist or is_test_user) get top-tier access.
      if (isAdminEmail(user.email) || profile?.is_test_user) setCurrentTier('elite');
      else if (profile?.subscription_tier) setCurrentTier(profile.subscription_tier as SubscriptionTier);
```

### 3b. `src/services/messageTrackingService.ts`
Add the import at the top:
```ts
import { isAdminEmail } from './adminService';
```
Add this helper just below the imports:
```ts
/** True only if userId IS the current signed-in user and their email is an admin. */
async function isCurrentUserAdmin(userId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && user.id === userId && isAdminEmail(user.email);
}
```

In `getMessageTrackingInfo`, immediately AFTER the existing
`VITE_TESTING_MODE` early-return block, add:
```ts
    if (await isCurrentUserAdmin(userId)) {
      return { messagesRemaining: -1, canSendMessage: true, model: 'sonnet', tier: 'elite' };
    }
```

In `decrementMessageCount`, immediately AFTER the existing
`VITE_TESTING_MODE` early-return block, add:
```ts
    if (await isCurrentUserAdmin(userId)) {
      return true;
    }
```

---

## STEP 4 — Wire the edge functions

In EACH of the four functions below: add the import
`import { isAdminEmail } from "../_shared/admin.ts";` and extend the
`isTestUser` line to `|| isAdminEmail(user.email)`. The email is available from
the already-present `supabaseAdmin.auth.getUser(token)` call (`user.email`).

### 4a. `supabase/functions/group-chat/index.ts`
```ts
// was:
const isTestUser = profile?.is_test_user === true;
// becomes:
const isTestUser = profile?.is_test_user === true || isAdminEmail(user.email);
```

### 4b. `supabase/functions/chat/index.ts`
```ts
const isTestUser = profile?.is_test_user === true || isAdminEmail(user.email);
```
(Model selection here reads the client's model intent, and the client already
resolves admins to `elite` → requests Sonnet, so no further change needed.)

### 4c. `supabase/functions/chat-turn/index.ts`
```ts
const isTestUser = profile.is_test_user === true || isAdminEmail(user.email);
```
ALSO — this function picks the model from the DB tier, which for an admin may
still be `free`. Force top-tier model selection for super-users. Find:
```ts
    const tier = profile.subscription_tier || 'free';
    const selectedModel = selectModel(message, tier);
```
Replace with:
```ts
    // Super-users (test/admin) get top-tier model regardless of their DB tier.
    const tier = isTestUser ? 'elite' : (profile.subscription_tier || 'free');
    const selectedModel = selectModel(message, tier);
```

### 4d. `supabase/functions/atlas-agent/index.ts`
```ts
const isTestUser = profile?.is_test_user === true || isAdminEmail(user.email);
```
(This function already does `isPaid || isTestUser ? SONNET : HAIKU` and gates the
daily Atlas limit on `isTestUser`, so folding admin in gives full god-mode.)

---

## STEP 5 — Environment / config

**New file: `.env.example`** documenting the two vars:
```
# Add extra admin emails (comma-separated). A default seed is baked into code,
# so this is optional. Set BOTH — client controls UI, edge var is the authority.
VITE_ADMIN_EMAILS=you@example.com,teammate@example.com
ADMIN_EMAILS=you@example.com,teammate@example.com
```

Then:
1. Add `VITE_ADMIN_EMAILS` to the frontend build environment (Bolt/hosting env vars).
2. Set the edge-function secret:
   `supabase secrets set ADMIN_EMAILS="you@example.com,teammate@example.com"`
3. Redeploy the four edge functions so they pick up the new `_shared/admin.ts`
   and the secret.

> If you only rely on the built-in default seed (`timobarrs@gmail.com`), steps 1–2
> are optional — but you still must REDEPLOY the edge functions (Step 5.3) for the
> server-side check to take effect.

---

## STEP 6 — Verification checklist (confirm the goal is reached)

Sign in with an allowlisted email and confirm ALL of:

- [ ] Lobby shows top-tier UI — every premium tile/feature is visible.
- [ ] 1-on-1 chat sends with **no** message-count decrement, even from a fresh
      account whose `messages_remaining` is 0 or whose tier is `free`.
- [ ] Chat responses use **Sonnet** (check the edge-function logs: `Model: ...sonnet`).
- [ ] Group Chat works and never blocks on quota; `messages_remaining` does not drop.
- [ ] Atlas has no daily limit and uses Sonnet.
- [ ] A NON-allowlisted free account still hits the normal quota/paywall
      (confirm the bypass is scoped to the allowlist only).
- [ ] `grep -rn "is_test_user"` still shows the original checks intact
      (we extended them, did not replace them).
- [ ] Client typecheck introduces **no new** errors:
      `npm run typecheck` — the repo has a large pre-existing error baseline;
      confirm your added files (`adminService.ts`) and edited lines are clean.

## Files touched (summary)
- NEW `src/services/adminService.ts`
- NEW `supabase/functions/_shared/admin.ts`
- NEW `.env.example`
- EDIT `src/App.tsx`
- EDIT `src/services/messageTrackingService.ts`
- EDIT `supabase/functions/group-chat/index.ts`
- EDIT `supabase/functions/chat/index.ts`
- EDIT `supabase/functions/chat-turn/index.ts`
- EDIT `supabase/functions/atlas-agent/index.ts`
```
