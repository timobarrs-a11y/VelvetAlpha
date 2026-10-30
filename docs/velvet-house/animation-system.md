# Animation system: plan (the foundation for bespoke items, the story and visiting)

*Planning note. Nothing here is built yet; section 2 is the audit it starts from.*

**The director's goal:** a game that separates itself from The Sims and Animal Crossing, which have a million items but rarely a *new animation* for a new item.
New items arrive with their own memorable animation (the swing set because you want to see the swing; the basketball hoop because you want to shoot). So the
animation system has to be good enough that a new item is a short piece of data, not a new piece of engine. Four things sit on top of it, in this order:
(1) the animation system, (2) bespoke item animations, (3) a story that loosely wraps the game, (4) human players visiting each other's houses and sitting down together.

## 1. What an S-tier system means here

| Quality | What the player sees | What it needs |
|---|---|---|
| **Continuous** | Nobody ever pops. Walking up to a chair, turning, sitting, typing, standing and walking off is one motion | Transition clips and a state machine, not a swap of poses |
| **Grounded** | Feet stay planted while walking and sitting, hands meet the things they hold | Foot locking, hand IK to a prop's grip point |
| **Alive** | A weight shift, a breath, a glance, hair and clothes that trail the body, a laugh that moves the shoulders | Layered secondary motion over the main clip |
| **Expressive** | The same activity looks different when tired, happy or shy | Mood and need layers that bend a clip |
| **Authorable** | A new item is a few lines of data: its beats, its props, its events | A clip and choreography format, with a preview page |
| **Shared** | Two people can do something together (sit on one couch, high-five, push a swing, play one-on-one) | Multi-actor choreography with sockets, and deterministic playback so it can be synced cheaply |

## 2. What exists now (audit)

- `art/poseAnim.js` is a procedural rig per pose: `poseRig(pose, t, seed, act, actMin)` returns hand targets, elbows, a leg mode, body lean, nod, props and a
  few flags. About 35 poses plus activity clips (`ACT_CLIPS`). `walkRig` and `gaitFoot` drive the walk from distance travelled; `seatLegs`, `legIK` and
  `limbIK` solve limbs. `headTarget`, `turnHead` and `idleGlance` drive the head.
- `art/houseArt.js` smooths it per person: arms ease toward their targets (`ease2`), body-level numbers cross-fade when the clip changes (`blendClip`,
  `CLIP_BLEND`), facing turns at up to 16 rad/s with a spin that feeds a turning lean (`settle`), and a jump in position (to a seat, a bed) is absorbed and eased
  out. Props are drawn by a big `switch` in `drawProps`.
- `state/agents.ts` runs the person as a task (`walk` then `do`) with a route; the pose is a function of the activity (`poseOf`).

**What is already good:** the walk (phase from distance, arms opposite the legs), turning in place, head leading the body, hands that move with the activity,
the use-poses added for stations (operate, dispense, board, files, talk, handset).

**What is missing, seen in a frame-by-frame capture (a person crossing the room to the couch and sitting, 170 ms a frame):**

1. **Sitting has no motion.** The person walks to the stand spot and the next frame is seated: the position jump is absorbed by an offset easing out, but there
   is no turn-and-lower, no hand on the armrest, no settle. Standing up and lying down are the same.
2. **Activities start and end as a swap of poses.** A cross-fade of body numbers hides the cut; there is no anticipation (a breath in before lifting) or
   follow-through (the weight coming off the foot).
3. **Stopping and starting a walk** are eased (`amp`), but a person does not plant a foot, shift weight or take a small last step to a spot.
4. **No foot planting.** Feet follow the gait cycle, not the ground, so a slow turn or a shuffle slides.
5. **Props are pictures at a hand.** A ball cannot leave the hand and fly, a swing cannot carry its rider, a cup does not respond to the arm. There is no object
   with its own motion.
6. **Activities are one looping pose.** There is no way to say "approach, wind up, shoot, watch it go in, celebrate" as beats with durations and events.
7. **One actor only.** Two people can talk side by side, but nothing coordinates a shared motion (a hug, a high-five, one pushing another on a swing).

## 3. The target architecture

Keep the procedural rig (it is the soul of the look: one skeleton, every hand and foot solved, nothing baked). Add three layers around it.

### 3.1 A clip timeline under the rig

A **clip** is a named stretch of motion with a duration, an easing curve and keyframed *targets* (hands, feet, hips, lean, head, props) in the rig's own
terms, plus procedural parts where a loop is better (typing, stirring). Clips are data and chain through **transitions**:

- `locomotion` state machine: idle, start (a lean and a first step), walk, run, stop (a last small step and a settle), turn in place.
- `posture` transitions: stand to sit, sit to stand, stand to lie, lie to stand, each with its own beats (turn the back to the seat, reach, lower, settle,
  hands to the armrests).
- `enter` and `exit` clips for every activity: the beat before the loop and the beat after it.

### 3.2 Feet, hands and secondary motion

- **Foot locking:** a planted foot keeps its ground position until the next step; the hips follow. This ends sliding on turns and on a shuffle to a spot.
- **Hand sockets:** a prop or a piece of furniture publishes *sockets* (a grip, an armrest, a seat, a rope). The hand IK reaches a socket and attaches to it.
- **Secondary motion:** hair, collar, a loose sleeve and a held cup follow the body with springs (the spring helper exists for the hair); breathing and weight shift
  ride on every pose; a mood layer bends any clip (slower and heavier when tired, bouncier when happy).

### 3.3 Props as objects with their own motion

A **prop** is a small physical thing with a state (held, flying, resting, attached to a socket) and a tiny integrator: a ball with gravity, a bounce and a hoop
collider; a swing seat on a pendulum; a door on a hinge. A clip can release a prop ("the ball leaves the right hand at 0.42") and the prop then runs on its own,
and the clip waits for its event (`ball.rim`, `ball.in`, `ball.out`). This is what makes a basketball feel like basketball.

### 3.4 Choreography: the unit a bespoke item ships

An item's behaviour is a **choreography**: sockets, props, and a list of beats.

```
choreography: basketballHoop
  props:   ball { start: hand.right }
  beats:   approach(stand: 'line') -> dribble(x3) -> aim(0.6s) -> shoot(release 0.42s) -> watch(ball.in | ball.out)
           -> on ball.in: celebrate(fist pump) + swish particles + fun +   |   on ball.out: shrug + chase(ball) -> reset
  events:  sound, particles, need changes, object state (net sways)
```

An author writes this, previews it on a lab page, and ships it. The engine owns blending, foot planting, hand IK and the prop physics.

### 3.5 Deterministic playback (what makes visiting cheap)

Playback is a pure function of `(clip, start time, seed, parameters)`. The game never syncs poses; it syncs *intent*: "A started `swing.ride` at server time T
with seed S". Every client plays the same motion locally. That is the design rule that makes human players in one house affordable (section 6).

## 4. Build order

1. **Foundation (the first branch):** the clip timeline and transition states; sit, stand and lie clips (the most visible gap); a start and stop for the walk;
   foot planting. A **motion lab** page (dev only) that loops any clip on a person with a scrubber, so each change is judged on frames.
2. **Hands and props:** sockets, hand IK to a socket, and the prop object with gravity, bounce and a pendulum.
3. **The showcase items:** the **swing set** (sit, push off, pump with the body lean and legs, the seat on its arc, hair and clothes trailing, dismount) and the
   **basketball hoop** (dribble, aim, shoot, make or miss, rebound, celebrate). These two prove the format; the rest follow quickly.
4. **Shared choreography:** two actors on one clip with sockets (sit on one couch, high-five, push a swing, one-on-one).
5. **The item pack:** a run of items each with its own animation (a record player the person dances to, a punching bag, a telescope, a grill, a hammock, a
   piano that really plays, a skateboard ramp). Each is a shop item *because of* its animation.

## 5. Story and things to do (planned alongside; written separately)

The story is a loose wrapper, not a script for every minute: a few threads the player can pick up, each unlocked by living in the house (moving in, the
neighbourhood, the job, the companion's history), with scenes written to the scene-contract rules in `CLAUDE.md`. The more interactive items there are, the more
beats the story can hang on. It gets its own document.

## 6. Visiting: human players in one house

The platform already has what visiting needs: friends, presence (`im_presence`) and realtime broadcast channels (`useGameChannel`, used for checkers, draw and
guess, and others; the shootout plan describes the pattern). What it lacks is the house being on the server. A visit is:

1. **The house is a snapshot.** The host's layout (pieces, paint, floors, the arrangement) is saved to the cloud (a table, read-only for others) and the guest
   loads it. The host's own game stays the authority on what is in the house.
2. **The guest is a visitor avatar** in the host's house on a broadcast channel: position, facing and *intent* (the current choreography id, start time and seed).
   Because playback is deterministic (3.5), the host sees the guest sit, wave or shoot at no more than a few messages a second.
3. **Shared interactions are choreographies with two sockets** (3.4): a couch with two seats, a swing with a rider and a pusher, a hoop with a shooter and a
   rebounder. The host's game accepts or refuses an interaction (the host's rules, as with Dale's visitor chair).
4. **Presence and invites** reuse friends: "come over" is a Play-card-style invite to the host's house channel.

Decisions to make before building it: live visits only, or also visiting a house while its owner is away (a "show me your house" tour); and how much a guest
may change (nothing, move small things, or only interact).

## 7. Risks

- **Scope.** Four large things. The animation foundation is the one that pays all the others, so it goes first and everything after is written as data on it.
- **Look.** The art is a 2D procedural rig. Squash and stretch, anticipation and weight are all achievable in it; a full-body baked animation style is not, and
  is not the goal.
- **Performance.** The rig already runs per person per frame; the clip layer adds table lookups. Props with physics are tiny.
- **Networking.** Cloud house snapshots and presence are new infrastructure (Supabase tables and policies); the sync itself is small because of 3.5.
