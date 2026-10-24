# 3-Point Shootout

A standalone timing game at `/shootout` (separate from Velvet House).

## Vision and core loop
Feel like a broadcast 3-point contest you can master in a minute and chase for weeks.

**Loop:** jog to the rack → hold to rise into the jump → release → grab the next ball while that one is still in the air (catch and shoot) → next rack, against the clock.
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
| `ballSim.ts` | Ball physics (gravity, drag, backspin; rim, glass, floor, stanchion) and `planShot`: a real flight for the outcome the rules chose. Fixed 240Hz step, deterministic. Tested. |
| `three/game3d.ts` | `Shootout3D`: scene, cameras, phases (walk/aim/hold/flight/replay/done), scoring, rival autopilot, frame governor, `meterView()`. |
| `three/arena.ts`, `crowd.ts`, `net.ts`, `textures.ts` | The building, the GPU-animated crowd (`BOWL` shape), the cloth net, canvas textures. |
| `ui/RunView.tsx` | One run: canvas, input, broadcast overlay, meter. Remount with a new `key` per run. |
| `ui/Contest.tsx` | The contest flow and standings. |
| `game.ts` | The 2D court, used only when WebGL is unavailable (scripted flights, classic scoring; kept as is). |
| `audio.ts`, `settings.ts` | Synthesised tones only; the Arena/Retro look setting. |
| `pages/ShootoutGame.tsx` | Title screen, mode select, results, saved progress (`velvet.shootout.v1`). |

## Decisions
- **The rules decide every shot at release; physics stages it.** Perfects always go in. Early misses come up short and late ones go long, so the ball teaches your timing. A shot's points and callouts land when the ball does.
- **Catch and shoot.** The next ball comes `RELOAD` (0.65s) after release. The game and the rival simulation share `RELOAD`/`JOG`, so their pace can't drift apart. Before this, a flawless player reached only 20–21 of 27 balls.
- **Flights are planned ahead while you aim**, about 1.5ms a frame and never during a hold, so a release never waits on the physics.
- **Audio starts on the first tap** (iOS only allows that, and creating it mid-jump caused a hitch).
- **One replay, at the end of a run** (the last make), so the rhythm isn't interrupted. No hitstop freeze.
- **Hold timing comes from `event.timeStamp`, not frame counting.** Before this, a flawless release was graded perfect only 53–76% of the time at 30fps on Legend, and any frame over 50ms was dropped from the hold.
- **Rival runs are simulated up front.** Watching and skipping give the same score.
- **Noise-based audio was removed** ("sounded like white noise"). Real recordings are a later task.
- **Contest scores don't feed practice bests.** A contest title unlocks the next level.

## Verifying
- `npx vitest run src/games/shootout`
- Add `?fps` to the URL for a frame counter.
- In dev builds `window.__shootout` exposes the game. `advance(seconds)` steps a synthetic clock for scripted checks.

## Known issues
1. **Unverified on real hardware.** Frame rate with up to 5 balls in the air, feel, and whether sound now works on iOS.
2. **Rookie may be too forgiving.** Random ±90ms timing errors still made 27 of 27 (the make zone is ±176ms on Rookie). Needs playtest data before changing.
3. **Contest difficulty needs a playtest** now that humans can reach every ball. Rival scores didn't change; they always finished 27.
4. **No walls.** A ball that rolls far fades out after its recorded 4s flight.
5. **The 2D fallback** is out of date (rare: only without WebGL).

## Next three
1. **iPhone playtest:** `?fps`, timing feel, sound.
2. **Balance pass from that data:** Rookie make zone, rivals, stars and unlock scores.
3. **A three-shot first-run tutorial:** the make zone, perfects, and what the flash means.
