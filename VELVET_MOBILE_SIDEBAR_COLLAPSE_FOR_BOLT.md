# Auto-collapse the companion-chat left sidebar on mobile

**Standalone change. One file: `src/App.tsx`. Frontend only — no edge function,
no redeploy, no schema.**

## Goal
On mobile, the left "Your World" rail overlaps and cuts off the chat when you
first load in — jarring, and almost everyone collapses it anyway. So on mobile,
start it **collapsed every time**. Desktop is unchanged (it works fine as-is).

## Why not just flip the saved setting
The collapse state is persisted in `customization.left_rail_collapsed`, a single
field shared by desktop and mobile. Writing to it on mobile would clobber the
desktop preference and persist. So the fix is a **session-only override that
applies on mobile only** and never touches the saved preference. The user can
still expand the rail during the session.

## Change — in `AppInner` (`src/App.tsx`)

### 1. Add the mobile override state
Put this next to the other component state (e.g. just after
`const [dailyExperience, setDailyExperience] = useState<any>(null);`). It uses
the existing `useState`/`useEffect` imports.

```tsx
// On mobile the left rail overlaps the chat, so start it collapsed on every
// load (it eats the chat width otherwise). This is a session-only override —
// it never touches the saved left_rail_collapsed preference, so desktop keeps
// whatever the user set. Users can still expand it during the session.
const [isMobileViewport, setIsMobileViewport] = useState(
  () => typeof window !== 'undefined' && window.innerWidth < 1024,
);
const [mobileRailCollapsed, setMobileRailCollapsed] = useState(true);
useEffect(() => {
  const onResize = () => setIsMobileViewport(window.innerWidth < 1024);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}, []);
const leftRailCollapsed = isMobileViewport
  ? mobileRailCollapsed
  : (customization?.left_rail_collapsed ?? false);
const toggleLeftRail = () => {
  if (isMobileViewport) setMobileRailCollapsed(v => !v);
  else setLeftRailCollapsed(!(customization?.left_rail_collapsed ?? false));
};
```

`1024` is Tailwind's `lg` breakpoint — the same threshold the chat already uses
to switch between its desktop and mobile layouts.

### 2. Wire it into the rail
In the `<CompanionHubLeftRail … />` render, replace the `collapsed` and
`onToggleCollapse` props:

```tsx
// before
collapsed={customization?.left_rail_collapsed ?? false}
onToggleCollapse={() => setLeftRailCollapsed(!(customization?.left_rail_collapsed ?? false))}

// after
collapsed={leftRailCollapsed}
onToggleCollapse={toggleLeftRail}
```

(Leave the `translucent` prop as-is.)

## Verify
- **Mobile (< 1024px):** load into a companion chat → left rail starts
  collapsed, chat is full-width. Tapping the expand button opens it; reloading
  starts collapsed again.
- **Desktop (≥ 1024px):** unchanged — the rail respects the saved
  `left_rail_collapsed` preference and the toggle still persists it.
