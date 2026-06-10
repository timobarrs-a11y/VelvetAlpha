# Noir Shooter Cover System v2 - Bottom-Edge-Only Design

## Overview

The cover system has been completely rewritten to follow strict design rules for more predictable, tactical gameplay.

## Core Design Rules

### COVER RULES (ENFORCED)

1. **Only BOTTOM (south-facing) edges** of cover objects are snappable
2. **East/West edges** are NOT snappable
3. **North/top edges** are NOT snappable
4. Player takes cover **ONLY by moving DOWN** behind objects (pressing S or down arrow)
5. Enemies are assumed to come from the **TOP** of the screen
6. Player exits cover by **moving UP** (pressing W or up arrow)

### Why These Rules?

- **Predictable**: Players always know they need to move DOWN to take cover
- **Tactical**: Cover position is always between player and enemies (from above)
- **Simple**: No ambiguity about which side of an object provides cover
- **Visual**: Matches top-down perspective - you crouch behind objects that face upward

## Implementation

### Files Modified

1. **`src/game/noir-shooter/coverEdges.ts`** (NEW)
   - Generates cover edges from placed assets
   - Only creates BOTTOM edges for cover objects
   - Validates that floor below edge is walkable
   - Provides edge query and snap position calculations
   - Includes debug rendering

2. **`src/game/noir-shooter/player.ts`**
   - Removed old `detectNearestCover()` 4-edge system
   - Added cover edge caching (regenerated per level)
   - Implemented hysteresis (150ms edge latch)
   - Cover enter: requires moving DOWN (moveY > 0.3) + behind object
   - Cover exit: moving UP (moveY < -0.3) OR too far OR asset removed
   - Locks Y position, allows X movement along edge

3. **`src/game/noir-shooter/renderer.ts`**
   - Added debug visualization imports
   - Renders cover edges in yellow (usable) or red (blocked)
   - Shows active edge in bright white
   - Displays snap distance circle around player
   - Shows cover status and latch state

### Key Data Structures

```typescript
interface CoverEdge {
  id: string;              // "assetId_bottom"
  assetId: string;         // Reference to source asset
  pointA: Vec2;            // Left endpoint (world coords)
  pointB: Vec2;            // Right endpoint (world coords)
  normal: Vec2;            // Always (0, 1) - pointing downward
  tangent: Vec2;           // Always (1, 0) - X axis movement
  centerY: number;         // Y position for quick filtering
  minX: number;            // Bounds for quick rejection
  maxX: number;
  usable: boolean;         // Whether player can stand here
}
```

## Cover System Behavior

### Entering Cover

Player enters cover when **ALL** conditions met:

1. Within `COVER_SNAP_DISTANCE` (16px) of a usable bottom edge
2. Moving **DOWN** (moveY > 0.3)
3. Player is **behind** the cover object (Y position > edge Y)
4. No cooldown active (300ms after exiting)

When entering:
- Player Y position locks to edge + player radius + padding
- Player X is clamped to stay within edge bounds
- 150ms hysteresis timer starts (edge latch)

### While In Cover

- **X movement**: Allowed along edge (clamped to bounds)
- **Y movement**: Locked (velocity forced to 0)
- Collision with all assets still active
- Player visually shows cover stance

### Exiting Cover

Player exits cover when **ANY** condition met:

1. Moving **UP** (moveY < -0.3)
2. Too far from edge (dist > COVER_SNAP_DISTANCE * 1.2)
3. No longer behind cover object
4. Cover asset removed from level

When exiting:
- 300ms cooldown before can re-enter
- Hysteresis latch released
- Normal movement restored

## Hysteresis System

**Purpose**: Prevent rapid edge switching when player is near multiple edges

**Mechanism**:
- When player enters cover, that edge is "latched" for 150ms
- During latch period, system prefers the latched edge
- If player moves too far (>1.5× snap distance), latch releases
- Prevents jittering between nearby parallel edges

## Debug Visualization (F3 Key)

When `state.showDebug` is true:

### Visual Elements

1. **Cover Edges**:
   - Yellow lines: Usable bottom edges
   - Red lines: Blocked edges (floor not walkable)
   - White line: Currently active edge (if in cover)
   - Green arrows: Edge normals (pointing away from cover)

2. **Player Indicators**:
   - Yellow dashed circle: Snap detection radius
   - Green box: "IN COVER" status + edge ID
   - Gray box: "NO COVER" status
   - Orange box: "LATCHED" indicator (during hysteresis)

3. **Console Logs**:
   - `[COVER] Generated X cover edges for level` - On level load
   - `[COVER] ENTER - edge: X moveY: Y` - When entering cover
   - `[COVER] EXIT - reason` - Why cover was exited
   - `[COVER] Cannot enter: reason` - Why cover didn't engage

### Debug Console Messages

```
[COVER] Cannot enter: not moving down (moveY=0.00)
[COVER] Cannot enter: not behind object
[COVER] ENTER - edge: desk_3_2_bottom moveY: 0.85
[COVER] EXIT - moving up (moveY=-0.75)
[COVER] EXIT - too far (dist=22.3)
[COVER] EXIT - not behind cover
[COVER] EXIT - edge removed
```

## Testing the System

### Basic Cover Test

1. Navigate to noir shooter game
2. Press **F3** to enable debug mode
3. Look for **yellow lines** below desks/crates/cover objects
4. Walk to a yellow line and press **S** (move down)
5. Should snap to cover with "IN COVER" indicator
6. Press **W** to exit cover

### Expected Behavior

✅ **Should Work**:
- Moving DOWN into yellow edge → Enter cover
- Moving UP while in cover → Exit cover
- Moving LEFT/RIGHT while in cover → Slide along edge
- Cover between multiple edges → Smooth transitions

❌ **Should NOT Work**:
- Moving UP into bottom edge → No cover
- Approaching from LEFT/RIGHT side → No cover
- Approaching TOP of object → No cover

### Edge Cases to Test

1. **Parallel Edges**: Walk along wall with multiple desks
   - Should latch to one edge for 150ms
   - Should smoothly transition when moving significantly

2. **Corner Objects**: Desk in corner
   - Only bottom edge snappable
   - Sides should not provide cover

3. **Blocked Edges**: Cover against wall
   - Red lines indicate unusable edges
   - Should not allow cover entry

## Configuration

### Constants (in `player.ts`)

```typescript
const COVER_SNAP_DISTANCE = 16;      // Detection radius
const COVER_HYSTERESIS_TIME = 0.15;  // 150ms latch
```

### Exit Cooldown

```typescript
player.coverEnterCooldown = 0.3;     // 300ms cooldown
```

## Performance

- Cover edges cached per level (regenerated only on level change)
- Edge search uses spatial bounds for quick rejection
- O(N) search through edges, but N is typically small (10-50 edges per level)
- Debug rendering only active when F3 is pressed

## Future Enhancements

### Potential Improvements

1. **Peek Mechanics**: Hold shift to peek over cover
2. **Blind Fire**: Shoot without peeking (lower accuracy)
3. **Cover Damage**: Objects can be destroyed
4. **Enemy AI**: Enemies should flank cover positions
5. **Multi-Height Cover**: Low cover (crouch) vs high cover (stand)

### Integration with Existing Systems

- Works with existing collision system
- Compatible with bullet time / diving
- No changes needed to asset system
- Enemy AI needs update to respect cover positions

## Migration from Old System

The old 4-edge system has been completely removed:

**Removed**:
- `detectNearestCover()` function
- `CoverInfo` interface
- 4-edge detection logic
- Normal-based push-into-cover mechanics

**Replaced With**:
- `generateCoverEdges()` - Bottom edge generation
- `findNearestCoverEdge()` - Edge queries
- Explicit DOWN-to-enter rules
- Edge-based snapping

All existing levels continue to work - the system automatically generates bottom edges from any asset with `provides_cover: true` and `is_solid: true`.

---

**Status**: ✅ Implemented and tested
**Build**: ✅ Passing
**Debug Tools**: ✅ Available (F3 key)
