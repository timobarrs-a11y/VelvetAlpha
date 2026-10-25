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
  - **Street (Touch, prototype):** a second way to shoot. Drag toward the hoop and let go; the **physics decides**. Random spots, 60 seconds. Scores 2 or 3 by distance, +1 for a swish, +1 off the glass, and money balls double. A dotted guide shows the start of the throw (shorter on harder levels). The camera is side-on in landscape and three-quarters from behind in portrait.
  - **Score Attack:** 100 per point, ×1.5 for a perfect, and back-to-back perfects stack ×1.1…×2.

## Stack and structure
React + TypeScript + Vite, rendered with three.js 0.154 (types 0.183). State lives in each class; React only draws overlays.

| File | Owns |
|---|---|
| `engine.ts` | Pure rules: course, levels, shot window, judge, outcomes, release point, scoring. Tested. |
| `rivals.ts` | Rival roster, seeded run simulation, pace (`scoreAt`), cut/tiebreak rules. Tested. |
| `holdClock.ts` | Times your hold from input-event timestamps, independent of frame rate. Tested. |
| `ballSim.ts` | Ball physics (gravity, drag, backspin; rim, glass, floor, stanchion) and `planShot`: a real flight for the outcome the rules chose. Fixed 240Hz step, deterministic. Tested. |
| `three/game3d.ts` | `Shootout3D`: scene, cameras, phases (walk/aim/hold/flight/wait/replay/done), live balls and catch-and-shoot, scoring, rival autopilot, frame governor, `meterView()`. |
| `three/athlete.ts` | The player figure (muscle-shaped limbs, jersey with number, shorts, fingered hands, sneakers, face and hair) and its poses: jog, dip, set point, release, celebrate. While holding the ball, two-bone IK puts each palm on the ball's surface facing its centre and the fingers curl round it; `ballCenter()` is where the game draws the ball. Used by you, rivals and Street. |
| `three/arena.ts`, `crowd.ts`, `net.ts`, `textures.ts` | The building (suites, roof, lighting rigs), the instanced cut-out crowd (`BOWL` shape), the cloth net, canvas textures. |
| `ui/RunView.tsx` | One run: canvas, input, broadcast overlay, meter. Remount with a new `key` per run. |
| `ui/Contest.tsx` | The contest flow and standings. |
| `game.ts` | The 2D court, used only when WebGL is unavailable (scripted flights, classic scoring; kept as is). |
| `audio.ts`, `settings.ts` | Synthesised tones only; the Arena/Retro look setting. |
| `pages/ShootoutGame.tsx` | Title screen, mode select, results, saved progress (`velvet.shootout.v1`). |

## Decisions
- **The ball is placed first and the hands reach it** (IK), rather than the ball following the hands, so the grip is exact in every pose. Measured: palm on the surface (within about 1mm), facing the centre, in both the chest hold and the set point.
- **Two ways to shoot, kept apart.** Jumper (timing) runs Contest, Score Attack and Practice; Touch runs Street. They share the arena, physics, sound and saves. Touch stays out of the Contest until it's balanced on its own.
- **The rules decide every shot at release; physics stages it.** Perfects always go in. Early misses come up short and late ones go long, so the ball teaches your timing. A shot's points and callouts land when the ball does.
- **Catch and shoot.** The next ball comes `RELOAD` (0.65s) after release. The game and the rival simulation share `RELOAD`/`JOG`, so their pace can't drift apart. Before this, a flawless player reached only 20–21 of 27 balls.
- **Flights are planned ahead while you aim**, about 1.5ms a frame and never during a hold, so a release never waits on the physics.
- **Audio starts on the first tap** (iOS only allows that, and creating it mid-jump caused a hitch).
- **One replay, at the end of a run** (the last make), so the rhythm isn't interrupted. No hitstop freeze.
- **Hold timing comes from `event.timeStamp`, not frame counting.** Before this, a flawless release was graded perfect only 53–76% of the time at 30fps on Legend, and any frame over 50ms was dropped from the hold.
- **Rival runs are simulated up front.** Watching and skipping give the same score.
- **Noise-based audio was removed** ("sounded like white noise"). Real recordings are a later task.
- **Lighting hierarchy: court, hoop and ball first; the building sits back.** The crowd wears a restrained home palette (wine, charcoal, navy, the odd gold) and barely reflects the environment; suites, LED ribbons and walls glow softly; the haze is near-neutral dark rather than purple; bloom is gentle (0.26, threshold 0.9). The court lights are unchanged. Measured with fixed cameras: ball-vs-background colour difference (ΔE) rose from a minimum of 44 to 55, stand brightness fell by half to three-quarters, court brightness moved by about 1%.
- **The shooter's backdrop stays calm.** Every part of the bowl that sits behind the rim from some rack (the whole baseline end, the sidelines' near end) has mostly dark suites and no LED panels; suites elsewhere come in bays between dark pillars, and the LED ribbon is broken into panels. The board behind the basket glows at 0.6 (the jumbotron 1.4). Measured around the rim in all 14 first-person views: edge density 7.5% → 4.9% (desktop), brightness about 12% lower.
- **A modern roof, not a grid.** Three dark girders, grouped lighting rigs (one per row of arena spots, a cluster of fixtures around each), and a centre-hung board with a slim wine-and-gold LED halo. The SpotLights didn't move, so the court lighting didn't change.
- **Fans are silhouette cut-outs.** One instanced quad each (8 head-and-shoulder shapes, mirrored at random), turned to face the camera, coloured from masks, with the top edge catching the light. Fans behind the rim are dimmer and barely rim-lit, so the backdrop stays calm. This took the scene from about 840k to 73k triangles on desktop (427k to 25k on phone).
- **Contest scores don't feed practice bests.** A contest title unlocks the next level.

## Verifying
- `npx vitest run src/games/shootout`
- Add `?fps` to the URL for a frame counter.
- In dev builds `window.__shootout` exposes the game. `advance(seconds)` steps a synthetic clock for scripted checks.

## Known issues
0. **Street is a prototype.** Throw power (3.1×, max 13.5 m/s), guide lengths and scoring are first guesses. Needs a playtest.
1. **Unverified on real hardware.** Frame rate with up to 5 balls in the air, feel, and whether sound now works on iOS.
2. **Rookie may be too forgiving.** Random ±90ms timing errors still made 27 of 27 (the make zone is ±176ms on Rookie). Needs playtest data before changing.
3. **Contest difficulty needs a playtest** now that humans can reach every ball. Rival scores didn't change; they always finished 27.
4. **No walls.** A ball that rolls far fades out after its recorded 4s flight.
5. **The 2D fallback** is out of date (rare: only without WebGL).


## Next three
1. **iPhone playtest:** `?fps`, timing feel, sound.
2. **Balance pass from that data:** Rookie make zone, rivals, stars and unlock scores.
3. **A three-shot first-run tutorial:** the make zone, perfects, and what the flash means.
