# Light / Dark Theming

## What's built (foundation — done)

Dark mode is unchanged. Light mode is opt-in and works on every surface that
uses the **semantic tokens**. The machinery:

| Piece | File |
|---|---|
| Palette as CSS variables (`:root` = dark, `html[data-theme="light"]` = light) | `src/index.css` |
| Tailwind tokens wired to the variables (`surface`, `ink`, `velvet`) | `tailwind.config.js` |
| Theme store (preference + resolve + persist + follow OS) | `src/stores/themeStore.ts` |
| Toggle button | `src/components/ThemeToggle.tsx` |
| Pre-paint boot guard (no flash) | `index.html` |
| Store init on boot | `src/main.tsx` |

**Usage:** drop `<ThemeToggle />` into a header/settings menu. Preference
persists in `localStorage` under `va-theme` (`light` \| `dark` \| `system`).
Default is `dark`, so nobody who hasn't opted in sees a change.

## What remains (the repaint — the real work)

Only **14 files** used the semantic tokens. **~150 files use raw Tailwind grays**
(`bg-gray-800`, `text-gray-400`, `border-gray-700`, some `slate-*`) — 1,234
usages. Those have **fixed values baked in by Tailwind** and do **not** flip with
the theme. Until a file is migrated onto tokens, it stays dark in light mode.

### The mapping (raw gray → semantic token)

Grays are used consistently — text = muted foreground, `bg-gray-700/800/900` =
surfaces, `border-gray-*` = borders. Map by role, not by exact shade:

| Raw class | → Token |
|---|---|
| `text-gray-100`, `text-white` (body copy) | `text-ink` |
| `text-gray-200`, `text-gray-300` | `text-ink-secondary` |
| `text-gray-400`, `text-gray-500` | `text-ink-muted` |
| `text-gray-600` | `text-ink-subtle` |
| `bg-gray-900`, `bg-slate-900` | `bg-surface-0` |
| `bg-gray-800`, `bg-slate-800` | `bg-surface-100` |
| `bg-gray-700`, `bg-slate-700` | `bg-surface-200` |
| `border-gray-800` | `border-surface-100` |
| `border-gray-700`, `border-gray-600` | `border-surface-200` |
| `divide-gray-700`, `ring-gray-700` | `divide-surface-200`, `ring-surface-200` |

Hover/focus variants map the same way (`hover:bg-gray-700` → `hover:bg-surface-200`).

### ⚠️ Skip / hand-check these (already light-context components)

A blind global replace would **invert** components that already assume a light
background — verify these by hand:

- `src/components/calendar/EventModal.tsx`, `EventCard.tsx`, `CalendarGrid.tsx`
- `src/components/WorkScheduleSetupModal.tsx` (uses `text-gray-700` = dark-on-light)
- The `.atlas-md` renderer block in `src/index.css` (hard-coded light doc styling)
- Any component with `bg-white` + `text-gray-700/800/900`

### Suggested batch order (aligns with the A/B funnel priority)

1. **Questionnaire funnel** — `QuestionnairePage`, `UserProfileQuestionnairePage`,
   `ExpertQuestionnairePage`, `IntentSelectPage`, `CompanionPathSelectPage`
2. **Correspondent / chat** — `ChatHeader`, `ChatMessage`, `ChatInput`,
   `ChatContainer`, `ChatStyleBar`, hub rails
3. **Conversion** — `PricingPage`, `PricingOfferPage`, `SubscriptionBanner`,
   `PurchaseModal`
4. Everything else, screen by screen.

### Codemod (per-file, review the diff)

Run against ONE file at a time, then eyeball it. Do **not** run repo-wide blind.

```bash
# scripts/theme-codemod.sh  —  usage: ./scripts/theme-codemod.sh src/pages/QuestionnairePage.tsx
f="$1"
sed -i -E \
  -e 's/\b(text)-gray-(100)\b/\1-ink/g' \
  -e 's/\b(text)-gray-(200|300)\b/\1-ink-secondary/g' \
  -e 's/\b(text)-gray-(400|500)\b/\1-ink-muted/g' \
  -e 's/\b(text)-gray-(600)\b/\1-ink-subtle/g' \
  -e 's/\b(bg)-(gray|slate)-(900)\b/\1-surface-0/g' \
  -e 's/\b(bg)-(gray|slate)-(800)\b/\1-surface-100/g' \
  -e 's/\b(bg)-(gray|slate)-(700)\b/\1-surface-200/g' \
  -e 's/\b(border|divide|ring)-(gray|slate)-(800)\b/\1-surface-100/g' \
  -e 's/\b(border|divide|ring)-(gray|slate)-(700|600)\b/\1-surface-200/g' \
  "$f"
```

(Handles the bare classes; `hover:`/`focus:`/`md:` prefixes are preserved because
the match is anchored on the utility, not the start of the token.)

## Designer note

The light palette in `index.css` is a sensible first cut (warm off-white
surfaces, velvet-tinted ink). The glow-heavy shadows (`shadow-glow`, gradient
text) were tuned for dark and will read differently on light — worth a design
pass on `PricingPage` / hero surfaces once a few screens are migrated.
