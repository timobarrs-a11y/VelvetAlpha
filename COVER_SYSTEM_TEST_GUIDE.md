# Cover System Test Guide

## Summary
The sticky cover system is now fully implemented with clear visual feedback at every stage.

## How It Works

### 1. Detection (12px range)
- System continuously scans for solid assets with `provides_cover: true`
- Detects which side of the asset (left/right/top/bottom) is closest
- Calculates normal (direction away from cover) and tangent (slide direction)

### 2. Entry Condition
When you move towards cover and meet these conditions:
- Within 12px of a cover asset edge
- Moving input pushes into the cover normal (dot product > 0.5)
- Not on cooldown (0.3s after exiting)

**Console log:** `[COVER] ENTERING COVER at [asset_type] side: [side] dot: [value]`

### 3. While In Cover
- **Position Lock:** Snapped to edge (radius + 2px from asset)
- **Movement Constraint:** Only tangent (sliding) movement allowed, normal component removed
- **Collision:** Cover asset is excluded from collision resolution
- **Visual Feedback (ALWAYS visible):**
  - Giant orange corner brackets around the asset
  - Large "IN COVER" text above player
  - Orange background panel for text

### 4. Exit Conditions
Cover exits when ANY of these occur:
- You move away from cover (dot product < -0.3 with normal)
- You dive (Space bar)
- You move out of range of the cover asset

**Console log:** `[COVER] Exiting cover - [reason]`

## Visual Feedback Stages

### Stage 1: Approaching (ALWAYS visible)
- **Yellow dashed outline** appears on nearest cover asset when within ~20px
- **"NEAR COVER - PUSH TO STICK"** text in yellow above player
- Shows you're in range to enter cover

### Stage 2: In Cover (ALWAYS visible)
- **Giant orange corner brackets** (L-shapes) at all 4 corners of asset
- **"IN COVER"** text in large orange font above player
- **Black background panel** behind text for visibility

### Stage 3: Debug Mode (Press F3)
When in cover, additionally shows:
- **Full orange rectangle** outline of cover asset
- **Red arrow** (normal vector - direction away from cover)
- **Green arrow** (tangent vector - slide direction allowed)
- **Asset ID** and coordinate info
- **Normal/Tangent values** in text

When NOT in cover, shows:
- **"COVER: OFF"** status text
- **Yellow outlines** on all nearby cover assets
- **"C" labels** on coverable assets

## Test Scenarios

### Test 1: Basic Entry
1. Load Noir Shooter game (tutorial or story mode)
2. Walk near any furniture (desk, sofa, crate, etc.)
3. You should see: **"NEAR COVER - PUSH TO STICK"** in yellow + yellow dashed outline
4. Walk INTO the furniture (not parallel to it)
5. You should see: **Giant orange brackets + "IN COVER" text**
6. Console should show: `[COVER] ENTERING COVER at desk side: left dot: 0.87`

### Test 2: Sliding Movement
1. Enter cover (see Test 1)
2. Try moving in all directions with WASD
3. You should only be able to slide ALONG the edge (tangent direction)
4. Moving perpendicular to edge should do nothing
5. Press **F3** to see green arrow showing allowed slide direction

### Test 3: Exit by Moving Away
1. Enter cover on the LEFT side of a desk
2. Press **D** (move right, away from cover)
3. You should exit cover immediately
4. Console: `[COVER] Exiting cover - moving away (dot: -1.00)`

### Test 4: Exit by Diving
1. Enter any cover
2. Press **Space** (dive)
3. You should immediately exit cover and dive
4. Console: `[COVER] Exiting cover - diving`

### Test 5: Debug Vectors (F3)
1. Enter any cover
2. Press **F3** to toggle debug mode
3. You should see:
   - **Red arrow** pointing away from cover (normal)
   - **Green arrow** pointing along edge (tangent)
   - Full orange rectangle around asset
   - Text showing coordinates and vectors

### Test 6: Multiple Assets
1. Find an area with several desks/sofas close together
2. Enter cover on one asset
3. Slide along the edge towards another asset
4. You should smoothly transition or exit cleanly
5. Each entry/exit should log to console

## Assets That Provide Cover

All of these have `provides_cover: true`:
- Beds
- Desks
- Dressers
- Filing cabinets
- Crates
- Barrels
- Sofas
- Tables
- Bars
- Shelving

## Controls Reminder
- **WASD**: Move
- **Mouse**: Aim
- **Left Click**: Shoot
- **Right Click**: Bullet time
- **Space**: Dive
- **F3**: Toggle debug overlay
- **1/2/3**: Switch weapons
- **G**: Throw grenade

## Console Logs to Watch For

Success logs:
```
[COVER] ENTERING COVER at desk side: left dot: 0.87
[COVER] Exiting cover - moving away (dot: -0.45)
[COVER] Exiting cover - diving
[COVER] Exiting cover - lost asset
```

## Expected Behavior
- **Sticky:** Player should feel "glued" to edge when in cover
- **Smooth:** Sliding along edge should be smooth
- **Responsive:** Entry/exit should be instant
- **Visible:** You should ALWAYS know when you're in cover (orange feedback)
- **Clear:** "NEAR COVER" indicator shows when you can enter

## Known Limitations
- Can only be in cover on ONE asset at a time
- No corner peeking mechanic yet
- No crouch-in-cover yet
- Cover doesn't provide damage reduction (visual/movement only)
