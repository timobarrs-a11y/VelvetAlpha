# Velvet Hub Guided Tour — Rebuild Instructions (Handoff for Bolt)

This document describes every change made on branch `claude/velvet-lobby-tutorial-k4rkbn`
to replace the old Atlas AI-chat onboarding with a static, arrow-based guided tour.
Implement these exactly in the final build.

---

## 1. What changed at a high level

- **REMOVED**: The Atlas conversational tour overlay (`CompanionTourOverlay`). The old flow
  streamed an AI conversation from the `onboarding-atlas` edge function and emitted
  spotlight/pulse signals parsed from the model's text. All of that is gone from the UI.
- **ADDED**: A static coach-mark tour (`GuidedTourOverlay`). Dimmed backdrop, spotlight
  cutout around the current target, a bouncing arrow pointing at it, and a small white
  card with a title, a 1–2 sentence description, progress dots, and Back / Next buttons.
  The user just reads and clicks Next.
- **ADDED**: Two "replay the tour" entry points — a pinned footer button in the hub's
  left sidebar, and a "Tour" button in the Velvet Lobby page header.
- **UNCHANGED**: The tour trigger and persistence. First-time detection, the `?tour=1`
  URL param, `TutorialDirectorContext`, the `user_onboarding_progress` table, and
  `onboardingService` all work exactly as before. The Settings page "restart tour"
  flow still works.

---

## 2. Files added / removed

| Action  | File |
|---------|------|
| ADDED   | `src/components/hub/GuidedTourOverlay.tsx` (new tour component, ~430 lines) |
| DELETED | `src/components/hub/CompanionTourOverlay.tsx` (old Atlas chat overlay) |
| MODIFIED| `src/App.tsx` |
| MODIFIED| `src/components/hub/CompanionHubLeftRail.tsx` |
| MODIFIED| `src/components/hub/CompanionHubRightRail.tsx` |
| MODIFIED| `src/pages/CompanionLobbyPage.tsx` |

Files intentionally left in place (still referenced elsewhere or harmless):
`src/features/onboarding/onboardingPrompt.ts` (still exports `ONBOARDING_ELEMENT_IDS`),
`src/features/onboarding/signalParser.ts`, `src/context/TutorialDirectorContext.tsx`,
`src/services/onboardingService.ts`, `src/components/hub/TutorialElement.tsx`.

---

## 3. The tour steps (exact order and copy)

Steps are defined in `buildSteps()` inside `GuidedTourOverlay.tsx`. `${companionName}`
is the active companion's display name; `${petName}` comes from `usePetStore(s => s.name)`.
`isReplay` is true when `tourSource === 'manual_replay'`.

| # | id | Anchors to | Placement | Title |
|---|----|-----------|-----------|-------|
| 0 | `welcome` | none (centered card, full dim) | center | "Welcome to your space 🎉" / replay: "Welcome back 👋" |
| 1 | `sidebar_toggle` | `[data-tour-id="tour-sidebar-toggle"]` | card right of target, arrow points left | "Expand & collapse your sidebar" |
| 2 | `left_rail` | `[data-tour-id="tour-left-rail"]` | right | "Everything, one click away" |
| 3 | `velvet_lobby` | `[data-tutorial-id="hub.shortcut.lobby"]` (pre-existing attr) | right | "The Velvet Lobby" |
| 4 | `chat` | `[data-tutorial-id="hub.chat_surface"]` (pre-existing attr) | center (card centered in spotlight, no arrow) | "The heart of it all" |
| 5 | `right_rail` | `[data-tour-id="tour-right-rail"]` | left | "Your daily pulse" |
| 6 | `background` | `[data-tour-id="tour-style-bar"]` | top | "Set the scene" |
| 7 | `pet` | `[data-tour-id="tour-pet-toggle"]` | top | "Bonus: meet ${petName} 🐾" — **must stay LAST** |

Body copy (keep or tune wording, keep meaning):

- **welcome**: "This is where you and ${companionName} hang out. Here's a quick tour of the essentials — just read and hit Next." (replay variant: "Here's a quick refresher on where everything lives. Hit Next to move through.")
- **sidebar_toggle**: "This little button tucks the 'Your World' sidebar away when you want a full-width chat — and brings it right back. Click it any time."
- **left_rail**: "Your World is your launchpad: Atlas (your chief of staff), Navi for local finds, Daily Feed, Your Lens videos, Co-Author, Calendar, Insights, and the Arcade."
- **velvet_lobby**: "Your classic home base. The Lobby holds all your companions and coaches, group chats, Loyalty Rewards, and the full games collection — this shortcut takes you there any time."
- **chat**: "This is your conversation with ${companionName}. When you open Atlas, Navi, or a feature, they appear as tabs along the top — so you never lose your place here."
- **right_rail**: "Fresh news and videos picked around your interests sit right beside the chat. They update as your companions learn what you're into."
- **background**: "That soft gradient behind the chat? It's the default background — and it's all yours to change. Tap Wallpaper to pick a new scene, and use the tiles next to it to restyle fonts, bubble colors, and cursor effects."
- **pet**: "One last thing — the fun one. This toggle summons ${petName}, a tiny desk pet who roams your screen, naps, and levels up while you chat. Go on, let ${petName} loose when we're done."

---

## 4. `GuidedTourOverlay.tsx` — behavior spec

Props: `{ userId: string; companionName: string }`.
Reads `isOnboarding`, `completeOnboarding`, `tourSource` from `useTutorialDirector()`.

- **Step resolution**: 400ms after `isOnboarding` becomes true, build the step list and
  drop any step whose target element is not found or has zero size (e.g. the right rail
  on mobile, the left-rail body while collapsed). The surviving list is frozen for the
  run; progress dots reflect it.
- **Target lookup**: `document.querySelectorAll('[data-tour-id="X"], [data-tutorial-id="X"]')`,
  first visible match wins (both desktop and mobile variants carry the same attribute).
- **Rect tracking**: while a step is active, re-read the target's bounding rect every
  300ms plus on window resize/scroll, so the spotlight/arrow follow animations.
- **Spotlight**: absolutely positioned rounded div over the target (6px padding) with
  `box-shadow: 0 0 0 200vmax rgba(15,23,42,0.55)` for the dim, plus a rose border
  (`rgba(244,63,94,0.85)`); position transitions at 0.25s.
- **Arrow**: 30px rose-500 circle with a white lucide arrow icon, sits 8px off the
  target edge facing it, bobs ±6px on an infinite 0.9s ease loop (framer-motion).
- **Card**: 312px wide white card, rounded-2xl, shadow-2xl. Positioned 44px off the
  target on the step's placement side, clamped 12px inside the viewport. The card is
  measured with a callback ref (`setCardEl` state) so positioning re-runs when a new
  step's card mounts — required because `AnimatePresence mode="wait"` mounts the card
  after step state settles. Card contents: title + X (end tour), body, progress dots
  (active dot stretches to 16px, rose), Back (from step 1), Next (rose→pink gradient;
  label is "Start the tour" on step 0 and "Let's go!" on the last step). Step 0 also
  shows a "Skip for now — I'll explore on my own" text link.
- **Input**: a transparent full-screen click shield blocks the app during the tour.
  Keyboard: `→`/`Enter` = next, `←` = back, `Esc` = end tour.
- **Finish/skip**: calls `onboardingService.markComplete(userId)` (fire-and-forget) and
  `completeOnboarding()` from the director context.
- z-index `z-[100]`, rendered `fixed inset-0`.

---

## 5. `App.tsx` changes

1. Import swap: `CompanionTourOverlay` → `GuidedTourOverlay`.
2. Render swap (same guard):
   ```tsx
   {userId && companionId && companion && isOnboarding && (
     <GuidedTourOverlay userId={userId} companionName={getCharacterName()} />
   )}
   ```
3. Removed now-dead state: `tourUserName` / `tourSnapshot` useStates, and the
   `user_profiles` name fetch that only fed the old overlay. (`tourSnapshot`'s local
   `snapshot` var is still built and passed to `onboardingService.initProgress`.)
4. Added `data-tour-id="tour-pet-toggle"` to **both** Mochi/pet toggle buttons
   (desktop bottom-toolbar version and mobile icon-only version).
5. Wrapped the desktop `ChatStyleBar` in
   `<div data-tour-id="tour-style-bar" className="flex-shrink-0">…</div>`, and added the
   same `data-tour-id` to the existing mobile wrapper div.
6. The auto-start logic is untouched: first visit (no progress row / nothing completed)
   or `?tour=1` still calls `initProgress` + `startTour(...)`.

## 6. `CompanionHubLeftRail.tsx` changes

1. `data-tour-id="tour-sidebar-toggle"` on **both** collapse toggles: the
   `PanelLeftOpen` button in the collapsed 32px strip AND the `PanelLeftClose` button in
   the expanded header (same attribute — the overlay picks whichever is visible).
2. `data-tour-id="tour-left-rail"` on the expanded rail's root `motion.div` only
   (if the rail is collapsed when the tour starts, the "Your World" step auto-skips).
3. New pinned footer at the bottom of the expanded rail (after the scroll area,
   inside the root): a "Replay the tour" button — small white rounded icon chip with a
   rose `RotateCcw` icon + gray label. onClick:
   ```tsx
   const handleReplayTour = () => {
     if (userId) onboardingService.restartTour(userId, 'manual_replay').catch(() => {});
     startTour('manual_replay');
   };
   ```
   New imports: `RotateCcw` (lucide), `useTutorialDirector`, `onboardingService`.
   (`startTour` comes from the director context; the overlay is already mounted in
   App.tsx and appears as soon as `isOnboarding` flips true.)

## 7. `CompanionHubRightRail.tsx` changes

- `data-tour-id="tour-right-rail"` on the root `div` (the 240px column). Its App.tsx
  wrapper is `hidden lg:block`, so on mobile the element has zero size and the step
  is auto-skipped — no extra handling needed.

## 8. `CompanionLobbyPage.tsx` changes (Velvet Lobby page, `/lobby`)

- Added a "Tour" button in the header controls (between Loyalty Rewards and Profile),
  same pill styling as its neighbors, `HelpCircle` icon (sky-300), label hidden on
  mobile (`hidden sm:inline`). Rendered only when `companions.length > 0`. onClick:
  ```tsx
  navigateTo(`/chat?companion=${companions[0].id}&tour=1`, {
    icon: MessageCircle, label: 'Starting the tour...',
    accentColor: '#f472b6', bgColor: '#0a0410',
  })
  ```
  This rides the existing `?tour=1` handling in App.tsx (restarts progress and runs
  the tour as `manual_replay` if the user already completed it).
- New lucide import: `HelpCircle`.

---

## 9. `data-tour-id` attribute map (for reference)

| Attribute value | Element | File |
|---|---|---|
| `tour-sidebar-toggle` | both sidebar collapse/expand buttons | CompanionHubLeftRail.tsx |
| `tour-left-rail` | expanded left rail root | CompanionHubLeftRail.tsx |
| `tour-right-rail` | right rail root | CompanionHubRightRail.tsx |
| `tour-style-bar` | ChatStyleBar wrapper (desktop + mobile) | App.tsx |
| `tour-pet-toggle` | pet toggle button (desktop + mobile) | App.tsx |
| `hub.shortcut.lobby` (data-tutorial-id, pre-existing) | Lobby shortcut tile | CompanionHubLeftRail.tsx |
| `hub.chat_surface` (data-tutorial-id, pre-existing) | chat surface TutorialElement | App.tsx |

If any of these elements are moved or restyled, keep the attribute on them — the tour
finds targets purely by these attributes.

---

## 10. QA checklist

1. Fresh account → create companion → land in hub: welcome card appears (~0.4s), full
   dim, "Start the tour".
2. Step 1 arrow points at the sidebar collapse button; Next/Back/dots work; `→`, `←`,
   `Enter`, `Esc` work.
3. Velvet Lobby step spotlights the "Lobby" tile under "More" in the sidebar.
4. Final step points at the pet toggle in the bottom toolbar; button reads "Let's go!";
   finishing marks `user_onboarding_progress.onboarding_complete = true` (tour does not
   reappear on refresh).
5. X or Esc at any point ends the tour and also marks complete.
6. Sidebar footer "Replay the tour" restarts it immediately on the hub.
7. `/lobby` header "Tour" button loads the first companion's chat and runs the tour.
8. Mobile / narrow window: right-rail step is skipped automatically; dot count matches.
9. Collapse the sidebar, then replay: the "Your World" + Lobby steps skip, the
   sidebar-toggle step anchors to the slim strip's expand button.
