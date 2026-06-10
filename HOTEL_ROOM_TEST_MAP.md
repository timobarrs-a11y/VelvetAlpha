# Hotel Room Test Map - Level 1 Replacement

## Overview

Level 1 (`hotel_lobby`) has been replaced with a handcrafted **Hotel Room Test Map** designed specifically for testing the footprint-based collision system, cover mechanics, and AI behavior.

This is a stable, non-procedural testbed map that ensures consistent and predictable testing conditions.

## Map Specifications

### Dimensions
- **Size**: 36 tiles × 24 tiles (1152px × 768px)
- **Layout**: Single hotel room with realistic furnishing

### Features

#### 1. Room Structure
- **Walls**: Perimeter walls with windows on top wall
- **Floor**: Carpet main floor with wooden accent in sitting area
- **Door**: Double-door entrance at bottom center (tiles 17-18, y=23)

#### 2. Functional Areas

**Bed Area (Top-Left)**
- King bed (4×3 visual, 4×2 footprint)
- 2 nightstands (1×1 each)
- Table lamp (decorative, non-solid)

**Desk Area (Top-Center) - PRIMARY COVER**
- Long desk (6×2 visual, 5×1 footprint)
- Office chair (1×1)
- Player can take cover BEHIND (below) the desk

**Dresser Area (Mid-Left)**
- Tall dresser (2×2 visual, 2×1 footprint)
- Wall mirror (decorative, non-solid)

**Sitting Area (Right Side)**
- Couch (3×2 visual, 3×1 footprint)
- Coffee table (2×1)
- Wooden floor accent

**Additional Cover Props**
- 2 wooden crates (1×1 each)
- Small cabinet (1×1)
- All provide tactical cover for testing

**Decorative Elements (Non-Solid)**
- Potted plant (1×2 visual)
- Floor lamp (1×2 visual)
- Wall painting (2×2 visual)
- These DO NOT block movement (testing non-collision)

#### 3. Enemy Spawns
- **Enemy 1**: Near desk (tests desk cover usage)
- **Enemy 2**: Near couch (tests couch cover usage)

#### 4. Pickups
- Ammo near bed
- Health pack on coffee table

## Asset Kit v1 Integration

All assets use **footprint-based collision**:

### Example Asset Specifications

```typescript
// Bed - Visual larger than footprint
{
  visual: 4×3 tiles
  footprint: 4×2 tiles
  solid: true
  cover: false
}

// Long Desk - Primary cover prop
{
  visual: 6×2 tiles
  footprint: 5×1 tiles
  solid: true
  cover: true  // Bottom edge is cover
}

// Potted Plant - Decorative only
{
  visual: 1×2 tiles
  footprint: 0×0 (non-solid)
  solid: false
  cover: false
}
```

## Debug Visualization System

### Debug Keys

Press these keys to toggle debug overlays:

| Key | Feature | Display |
|-----|---------|---------|
| **F3** | General Debug | Entity info, stats overlay |
| **F4** | Footprints | Yellow collision boxes on solid assets |
| **F5** | Cover Edges | Cyan lines showing cover edges |
| **F6** | Line of Sight | Red/gray rays between enemies and player |

### Debug HUD

When any debug mode is active, the top-right corner shows:
```
[F4] Footprints: ON
[F5] Cover Edges: ON
```

When inactive, shows hint: `Press F3-F6 for debug views`

### Visual Indicators

#### F4: Footprints
- **Yellow filled rectangles** = collision footprint area
- **Yellow outline** = footprint border
- **Label** = asset type name
- Only shown for `is_solid: true` assets

#### F5: Cover Edges
- **Cyan line** = cover edge (bottom of asset)
- **Cyan dots** = edge endpoints
- **"COVER" label** = identifies cover objects
- Only shown for `provides_cover: true` assets

#### F6: Line of Sight
- **Red dashed line** = enemy HAS line of sight to player
- **Gray dashed line** = line of sight blocked
- **Red exclamation mark** = enemy can see player
- Updates in real-time as player moves

## Testing Scenarios

### 1. Collision Footprint Test
1. Enable **F4** (Footprints)
2. Walk around all assets
3. Verify:
   - Yellow boxes match walkable/blocked areas
   - Decorative plants don't block (no yellow box)
   - Visual sprite size ≠ collision size

### 2. Cover System Test
1. Enable **F5** (Cover Edges)
2. Walk near desk, dresser, couch, crates
3. Verify:
   - Cyan line appears on bottom edge
   - Player snaps to cover when close
   - Cover indicator appears in HUD

### 3. AI Line of Sight Test
1. Enable **F6** (Line of Sight)
2. Move around room with enemies active
3. Verify:
   - Line turns red when exposed
   - Line turns gray when behind cover
   - Enemies react to visibility changes

### 4. Combined Debug Test
1. Enable **F4 + F5 + F6** simultaneously
2. Take cover behind desk
3. Verify:
   - Footprint shows desk collision area
   - Cover edge shows where you snap
   - LOS ray shows cover blocking sight

## Path Validation

The test map includes clear walkable paths:
1. **Door → Bed area** (left path)
2. **Door → Desk area** (center path)
3. **Door → Sitting area** (right path)

All paths verified by occupancy grid validator.

## Validation Report Example

When the level loads, you'll see:
```
========== LEVEL VALIDATION REPORT: hotel_room_test ==========
Status: ✅ VALID

OCCUPANCY:
  Total tiles: 864
  Walkable: 710 (82.2%)
  Blocked by tiles: 120
  Blocked by assets: 34

SPAWN & PATHING:
  Spawn blocked: ✅ NO
  Path to exit: ✅ YES

ASSET PLACEMENT:
  Assets overlapping doors: 0
  Assets in door clearance: 0

========================================
```

## Why This Replaces Level 1

### Problems with Procedural Level 1
- ❌ Unpredictable asset placement
- ❌ Sometimes blocked spawns
- ❌ Inconsistent cover distribution
- ❌ Random bugs hard to reproduce
- ❌ "Circus" layouts

### Benefits of Test Map
- ✅ Consistent every playthrough
- ✅ Verified walkable paths
- ✅ Known cover positions
- ✅ Reproducible test scenarios
- ✅ Professional hotel room aesthetic
- ✅ Clear purpose for each asset

## Technical Implementation

### Files Created
- `src/game/noir-shooter/testLevel.ts` - Handcrafted map definition

### Files Modified
- `src/game/noir-shooter/campaign.ts` - Replaced `hotel_lobby` with test map
- `src/game/noir-shooter/types.ts` - Added debug flags
- `src/game/noir-shooter/engine.ts` - Added debug key handlers
- `src/game/noir-shooter/renderer.ts` - Added debug rendering functions
- `src/game/noir-shooter/hud.ts` - Added debug key hints

### Skip Procedural Generation

The test map bypasses procedural asset generation:
```typescript
case 'hotel_lobby':
  baseLevel = createHotelRoomTestMap();
  return baseLevel; // Skip addProceduralAssets()
```

This ensures the map stays exactly as designed.

## Usage Instructions

### Playing the Test Map
1. Start the game
2. Skip intro cutscene (or watch it)
3. Level 1 will load the hotel room test map
4. Press **F4-F6** to enable debug views

### Verifying Bug Fixes
1. Enable **F4** to see footprints
2. Walk into yellow boxes = BLOCKED ✅
3. Walk into decorative plants = NOT BLOCKED ✅
4. Compare visual sprite to yellow footprint
5. Verify they can be different sizes

### Testing Cover System
1. Enable **F5** for cover edges
2. Approach desk from below
3. Cyan line shows cover edge
4. Press **C** to snap to cover
5. Orange brackets appear on covered asset

### Testing AI Behavior
1. Enable **F6** for line of sight
2. Stand in open = red ray to enemies
3. Take cover behind desk = gray ray (blocked)
4. Enemies should not shoot when blocked

## Known Good State

This map is the **baseline** for testing. If bugs appear:
1. Test in hotel room first
2. If bug exists here = core system issue
3. If bug doesn't exist = procedural generation issue

## Future Enhancements

Potential additions:
- More asset variety (TV, minibar, etc.)
- Multiple room layouts for variety
- Scripted enemy behavior tests
- Cover-to-cover movement tutorial
- Stealth mechanics demonstration

---

**Status**: ✅ Implemented and tested
**Build**: ✅ Passing
**Level**: Replaces `hotel_lobby` (Level 1)
**Purpose**: Stable testbed for collision and cover systems
