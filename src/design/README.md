# Velvet Design System

Two runtime variants, one token vocabulary, one set of primitives. Built to make every
screen *outside* the companion chat read as the same product before release.

## A / B variants

| | **A · Current** | **B · Velvet** |
|---|---|---|
| Page background | Navy → black gradient (`#0d1128 → #090c1e → #060810`), blue top glow | Deep purple gradient (`#16132b → #0f0e1a → #0a0914`), violet + rose glow |
| Surfaces | `rgba(28,25,48,.90)` cards, `rgba(80,70,130,.35)` borders | `rgba(28,25,48,.72)` glass cards, violet borders, inset top highlight |
| Hub tiles | Saturated solid colours (green / red / orange / white…) | Accent-tinted glass on the shared surface; accent only on icon chip, border and glow |
| Companion cards | Per-section tinted bodies (green coaches, amber correspondents) | Uniform surface; section tone on hover border, badges and status dot |
| Toolbar pills | `rgba(255,255,255,.08)` / blue-200 text | `rgba(255,255,255,.05)` / ink text, violet border |
| Corner radius | 16 px | 20 px |

The variant is written to `<html data-design="a|b">` and every token in
`design-system.css` resolves from it. Switch with:

- the **A / B** control in the Velvet Lobby header (desktop),
- **Settings → Appearance → Design System**,
- `?design=a` / `?design=b` on any URL (persisted),
- `localStorage.setItem('velvet.design', 'a' | 'b')`.

`DEFAULT_VARIANT` lives in `designSystem.ts` (currently `b`). To ship, pick the winner,
set it as the default, and delete the losing block in `design-system.css`; nothing else
needs to change.

The dark-purple palette is locked. Both variants stay inside it — B is a tightening of
the existing lobby language, not a new colour story.

## Tokens (`design-system.css`)

| Group | Tokens |
|---|---|
| Background | `--ds-bg-base`, `--ds-bg-page`, `--ds-bg-glow` |
| Surfaces | `--ds-surface-1` (card), `--ds-surface-2` (raised), `--ds-surface-3` (modal / header card), `--ds-surface-sunken` |
| Borders | `--ds-border`, `--ds-border-soft`, `--ds-border-strong` |
| Ink | `--ds-ink`, `--ds-ink-2` … `--ds-ink-5` (matches the Tailwind `ink` scale) |
| Accent | `--ds-accent`, `--ds-accent-fg`, `--ds-accent-soft`, `--ds-accent-line`, `--ds-violet`, `--ds-violet-soft` |
| Header | `--ds-header-bg`, `--ds-header-border`, `--ds-header-h` |
| Pills | `--ds-pill-bg`, `--ds-pill-bg-hover`, `--ds-pill-border`, `--ds-pill-fg`, `--ds-pill-fg-hover` |
| Shape / depth | `--ds-radius-sm|md|lg|xl`, `--ds-radius-card`, `--ds-radius-tile`, `--ds-shadow-card`, `--ds-shadow-card-hover`, `--ds-shadow-modal`, `--ds-shadow-glow`, `--ds-focus` |
| Type | `--ds-title-gradient`, `--ds-title-glow`, `--ds-quote-fg`, `--ds-quote-by` |

Feature accents (the per-tile / per-section colour) are **not** tokens. They are passed
in as `--ds-tone` / `--ds-tile-accent` by the component so the palette stays small.

## Component classes

| Class | Use |
|---|---|
| `.ds-page` | Root of every non-companion screen. Paints background + fixed ambient glow. |
| `.ds-header`, `.ds-header-row` | Sticky glass header bar (add `!static` for in-flow use). |
| `.ds-card`, `--interactive`, `--sunken`, `--dashed` | Surfaces. Hover border can be tinted with `--ds-card-hover-border`. |
| `.ds-pill`, `--sm`, `--icon`, `--quiet`, `--active`, `--tone`, `--solid` | Secondary / toolbar buttons and tabs. |
| `.ds-segment` | Wrapper for a mutually-exclusive pill group. |
| `.ds-badge`, `--overlay`, `--xs` | Status chips; tint via `--ds-tone`. |
| `.ds-chip` | Square icon container; tint via `--ds-tone`. |
| `.ds-section-title` | Section heading with leading icon. |
| `.ds-title-gradient` | The Velvet gradient text (page hero titles). |
| `.ds-tile` (+ `.ds-tile-icon/-title/-desc`) | Hub feature tile; variant-specific rendering. |
| `.ds-companion-card`, `.ds-companion-portrait` | Companion card; variant-specific tinting. |
| `.ds-divider`, `.ds-muted`, `.ds-subtle`, `.ds-focus` | Helpers. |

## React primitives (`src/shared/ui`)

| Component | Replaces |
|---|---|
| `PageShell` | Every hand-rolled `min-h-screen bg-…` root + centered loading / empty states |
| `PageHeader` | The five different sticky headers (Feed, Calendar, Insights, Videos, Co-Author) and the three non-sticky ones (Profile, Settings, Billing) |
| `Pill`, `Segmented` | `bg-white/8` / `bg-gray-800 border-gray-700` / inline `rgba(255,255,255,0.08)` buttons; tab strips |
| `SectionHeader` | Lobby `<h2>` + icon rows |
| `Badge` | `bg-pink-900/80 text-pink-300`-style chips |
| `DesignVariantSwitch` | — (new) |
| `Card`, `ModalShell`, `Button`, `EmptyState`, `RouteFallback` | Now token-driven; no API change |

Lobby-specific pieces live in `src/components/lobby`: `HubTile`, `CompanionCard`,
`AddCompanionCard`, `GroupChatCard`, `GameCard`, plus `lobbyUtils` (`TONE_COLOR`,
`formatTimeAgo`, `companionAvatarConfig`).

## Screen inventory

**Migrated in this pass**

Velvet Lobby · Profile · Settings · Daily Feed · Article · Insights · Calendar · Your Lens
(videos) · Co-Author · Billing · Group Chat (header) · Atlas (header) · Navi (header) ·
Person profile (header) · The Velvet Rope (roots + header) · Success · Pricing overlay ·
Login · Sign Up · Forgot / Reset password · Invite · Goal Discovery · Age verification ·
Terms · Privacy · About · Splash / Welcome (base background only) · route fallback and
feature loading splashes · footer.

**Intentionally untouched** (companion UX): `/chat` (`App.tsx`), chat header / input /
message components, hub rails, tutorial overlay, pet, games, and the avatar creators.

**Known remaining inconsistencies** (candidates for the next pass)

- Inner content of Settings / Profile / Billing still uses `text-white/40`-style greys
  rather than the `ink` scale.
- Calendar grid, Insights cards and Daily Feed article cards keep their own card styles
  (`bg-gray-800`, `bg-white/5`); they read fine on the new background but are not `ds-card`.
- Onboarding questionnaire pages (`QuestionnairePage`, `UserProfileQuestionnairePage`,
  `CreateAdditionalCompanionPage`) have their own gradients.
- The per-destination `bgColor` on the navigation loading splash is still hand-picked per
  feature; consider deriving it from the tile accent.
- `AppShell` (bottom / side nav) is token-driven but unused; adopt or delete.

## Audit summary (what this pass fixed)

- **Six different page backgrounds** across the app (navy gradient, slate gradient,
  `#0a0a0f`, `#08090d`, `#0a0f1a`, cobalt `#1e2a7a`) → one `--ds-bg-page`.
- **Eight header implementations** with different heights, back-button styles, hover
  colours and back destinations → `PageHeader`.
- **Cobalt-blue entry flow** (Login / Sign Up / Invite / Goal Discovery / legal pages /
  age gate) that did not match the purple app → retinted through `velvetTheme.ts`.
- **Three near-identical companion card blocks** (~250 lines each) in the lobby →
  `CompanionCard` with a `tone`.
- **Imperative hover styling** (`onMouseEnter` mutating `style.borderColor`) → CSS.
- **Unused design tokens**: the Tailwind `surface` / `ink` / `velvet` palettes and
  `.card-base` existed but pages used raw hex; they are now the source for variant B.
