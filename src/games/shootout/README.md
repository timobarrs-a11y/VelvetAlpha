# 3-Point Shootout

A standalone timing game at `/shootout` (separate from Velvet House).

## Vision and core loop
Feel like a broadcast 3-point contest you can master in a minute and chase for weeks.

**Loop:** jog to the rack → hold to rise into the jump → release → watch it drop (or not) → next ball, against the clock.
The skill is the release. Everything else (scoring, rivals, graphics) exists to make that release matter and feel good.

- **Make zone.** Slightly early to slightly late always goes in. Dead centre is a **perfect** release.
- **Release point.** Each run picks its own: slightly early, the top, or slightly late (`pickRelease`). Timing can't be memorised across games.
- **Meter.** Live on the first shot of a run only. After that it flashes for about a second after each release, frozen where you let go, then fades. You learn from the flashes.
- **Modes:**
  - **Practice:** classic 1/2/3 scoring, unlocks levels and stars.
  - **Contest:** you vs 5 AI rivals, +1 per perfect. Round 1, top 3 advance to a final in reverse order; ties go to a 30s shoot-off.
  - **Score Attack:** 100 per point, ×1.5 for a perfect, and back-to-back perfects stack ×1.1…×2.

## Stack and structure
React + TypeScript + Vite, rendered with three.js 0.154 (types 0.183). State lives in each class; React only draws overlays.

| File | Owns |
|---|---|
| `engine.ts` | Pure rules: course, levels, shot window, judge, outcomes, release point, scoring. Tested. |
| `rivals.ts` | Rival roster, seeded run simulation, pace (`scoreAt`), cut/tiebreak rules. Tested. |
| `holdClock.ts` | Times your hold from input-event timestamps, independent of frame rate. Tested. |
| `three/game3d.ts` | `Shootout3D`: scene, cameras, phases (walk/aim/hold/flight/replay/done), scoring, rival autopilot, frame governor, `meterView()`. |
| `three/arena.ts`, `crowd.ts`, `net.ts`, `textures.ts` | The building, the GPU-animated crowd (`BOWL` shape), the cloth net, canvas textures. |
| `ui/RunView.tsx` | One run: canvas, input, broadcast overlay, meter. Remount with a new `key` per run. |
| `ui/Contest.tsx` | The contest flow and standings. |
| `game.ts` | The 2D court, used only when WebGL is unavailable. |
| `audio.ts`, `settings.ts` | Synthesised tones only; the Arena/Retro look setting. |
| `pages/ShootoutGame.tsx` | Title screen, mode select, results, saved progress (`velvet.shootout.v1`). |

## Decisions
- **Hold timing comes from `event.timeStamp`, not frame counting.** Before this, a flawless release was graded perfect only 53–76% of the time at 30fps on Legend, and any frame over 50ms was dropped from the hold.
- **Rival runs are simulated up front.** Watching and skipping give the same score.
- **Noise-based audio was removed** ("sounded like white noise"). Real recordings are a later task.
- **Contest scores don't feed practice bests.** A contest title unlocks the next level.

## Verifying
- `npx vitest run src/games/shootout`
- Add `?fps` to the URL for a frame counter.
- In dev builds `window.__shootout` exposes the game. `advance(seconds)` steps a synthetic clock for scripted checks.

## Known issues
1. **Buzzer.** If you're mid-hold when the clock hits 0, the run ends and that shot silently vanishes. There's no "time" feedback.
2. **Unverified on real hardware.** Feel and frame rate have only been checked in a software renderer.
3. **`pointercancel` counts as a release**, so an iOS system gesture mid-hold would shoot.
4. **The 2D fallback** ignores scoring modes and the timestamp timing (rare: WebGL missing).
5. **Contest "Result" reveal timer** keeps running if you quit mid-reveal (harmless React no-op).

## Next three
1. **iPhone playtest.** Check `?fps`, whether the timing windows feel fair, and whether the first-shot meter plus flashes are learnable.
2. **Buzzer rule.** A release before the horn counts (a slow-mo buzzer beater); a ball still in hand at 0:00 gets a clear "TIME" callout.
3. **A three-shot first-run tutorial**: the make zone, perfect releases, and what the flash means.
