# Fix: tour box not clickable + cut all in-app sound

**Standalone. Frontend only — 3 files, no edge function, no redeploy, no schema.**

Two unrelated fixes bundled because they were reported together.

---

## Fix 1 — Guided tour renders but can't be interacted with

**Symptom:** at launch (mobile + desktop) the tour card appears but none of its
buttons respond to click/tap. On desktop Esc closes it (window key listener); on
mobile there's no way out.

**Cause:** the overlay was rendered deep inside the chat tree at `z-[100]`. The
chat is wrapped in many framer-motion elements that apply `transform`, each of
which creates a stacking context AND a containing block for `position: fixed`.
That trapped the overlay: the card still painted (so you saw it) but sat behind
chat chrome for pointer events, and its `fixed` coordinates could drift. Keyboard
still worked because that listener is on `window`, not the card.

**Fix:** render the overlay through a **portal to `document.body`** so it escapes
every ancestor stacking context / transformed container, and raise its z-index
above the cursor-trail layers (which use `z-[10000]`). File:
`src/components/hub/GuidedTourOverlay.tsx`.

1. Add the import:
   ```ts
   import { createPortal } from 'react-dom';
   ```
2. Wrap the returned JSX in a portal and bump the root z-index. Change the
   opening of the `return`:
   ```tsx
   // before
   return (
     <div className="fixed inset-0 z-[100]">

   // after
   return createPortal(
     <div className="fixed inset-0" style={{ zIndex: 10050 }}>
   ```
3. Close the portal at the end of the component's return:
   ```tsx
   // before
       </div>
     );
   }

   // after
       </div>,
     document.body,
   );
   }
   ```
4. Defensive layering inside the overlay (so the card always beats the shield):
   - the click-shield div: add `zIndex: 0` to its `style`
   - the card `motion.div`: add `zIndex: 2` to its `style`

No behavior/logic changes — same steps, arrows, spotlight, keyboard shortcuts.
The portal also fixes any spotlight/card misalignment from the same cause.

**Verify:** launch the tour on mobile and desktop → Next / Back / the X / "Skip
for now" all respond to tap and click; the X gives mobile users a way out.

---

## Fix 2 — Cut all in-app sound (the "buzzing")

**Symptom:** an unpleasant buzzing at launch. It's synthesized **Web Audio
oscillator drones** (ambient "scene" audio per route), not music files — hence
the buzz. There's also a short notification chime on new messages.

Two sources, both silenced at the source (reversible one-liners):

### `src/services/audioManager.ts` — kills the ambient drones (the buzz)
1. Add a master switch near the top constants:
   ```ts
   // Master switch for the synthesized ambient scene audio. Off — the oscillator
   // drones sounded like buzzing. Set to true to bring ambient audio back.
   const AMBIENT_AUDIO_ENABLED = false;
   ```
2. First line inside `play(scene: AudioScene)`:
   ```ts
   if (!AMBIENT_AUDIO_ENABLED) return;
   ```
   This stops every scene from ever starting, across all routes. The mute UI and
   the rest of the manager stay intact.

### `src/hooks/useSound.ts` — kills the message chime
Replace the body of `playSound` with a no-op (drop the AudioBufferSource
playback; keep the `useCallback`):
```ts
const playSound = useCallback(() => {
  // All in-app sound is disabled (the ambient audio buzzed and the message
  // chime was cut along with it). To restore the chime, reinstate the
  // AudioBufferSource playback body here.
}, []);
```
(Do NOT leave a bare `return;` above the old body — the unreachable code trips
TypeScript's null-narrowing on `audioContextRef.current`. Replace the body.)

**Verify:** no buzzing on load anywhere; no chime on new messages; the app is
silent. (Game-specific sound, if any, lives in each game and isn't touched here —
say the word if you want those cut too.)
