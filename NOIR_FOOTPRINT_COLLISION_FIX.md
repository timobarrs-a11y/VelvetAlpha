# Noir Shooter - Footprint-Based Collision System

## Problem Fixed

**Issue**: Debug visual elements and asset sprites were being treated as solid collision boxes, blocking player movement even though they should be decorative.

**Root Cause**: The collision system was using full visual dimensions (`width * TILE_SIZE`, `height * TILE_SIZE`) instead of logical footprint dimensions for solid checks.

## Solution: Footprint-Based Collision

### Design Principles

1. **Visual size ≠ Collision size**
   - Assets have a visual sprite (for rendering)
   - Assets have a collision footprint (for physics)
   - These can be different sizes!

2. **Only footprint is solid**
   - Collision checks use `footprintW` and `footprintH`
   - Rendering uses `width` and `height`
   - Debug visuals never block movement

3. **Explicit solid marking**
   - Assets must have `is_solid: true` to block
   - Non-solid assets never collide, regardless of size
   - Footprint dimensions are only checked for solid assets

## Implementation

### 1. Updated Data Structures

#### PlacedAsset Interface
```typescript
export interface PlacedAsset {
  id: string;
  asset_type: string;
  tile_x: number;
  tile_y: number;

  // Visual bounds (for rendering)
  width: number;
  height: number;

  // Collision footprint (for physics)
  footprintW: number;
  footprintH: number;
  footprintOffsetX: number;  // Offset from tile_x
  footprintOffsetY: number;  // Offset from tile_y

  is_solid: boolean;
  provides_cover: boolean;
  color: string;
  rotation: number;
}
```

#### AssetDefinition Interface
```typescript
export interface AssetDefinition {
  id: string;
  asset_type: string;

  // Visual dimensions
  width: number;
  height: number;

  // Collision footprint (optional, defaults to width/height)
  footprintW?: number;
  footprintH?: number;

  is_solid: boolean;
  provides_cover: boolean;
  // ...
}
```

### 2. Modified Collision Functions

#### `resolveEntityAssetCollisions()` (collision.ts)
```typescript
// OLD - Used visual bounds
const assetW = asset.width * TILE_SIZE;
const assetH = asset.height * TILE_SIZE;

// NEW - Uses footprint
const footprintX = (asset.tile_x + (asset.footprintOffsetX || 0)) * TILE_SIZE;
const footprintY = (asset.tile_y + (asset.footprintOffsetY || 0)) * TILE_SIZE;
const footprintW = (asset.footprintW || asset.width) * TILE_SIZE;
const footprintH = (asset.footprintH || asset.height) * TILE_SIZE;
```

#### `lineVsAsset()` (collision.ts)
```typescript
// Uses footprint for line-of-sight blocking
const footprintX = (asset.tile_x + (asset.footprintOffsetX || 0)) * TILE_SIZE;
const footprintY = (asset.tile_y + (asset.footprintOffsetY || 0)) * TILE_SIZE;
const footprintW = (asset.footprintW || asset.width) * TILE_SIZE;
const footprintH = (asset.footprintH || asset.height) * TILE_SIZE;
```

### 3. Asset Generation

#### `placeAsset()` (assetGenerator.ts)
```typescript
function placeAsset(def: AssetDefinition, tileX: number, tileY: number): PlacedAsset {
  // Use footprint if defined, otherwise default to visual size
  const footprintW = def.footprintW ?? def.width;
  const footprintH = def.footprintH ?? def.height;

  // Center footprint under visual bounds
  const footprintOffsetX = (def.width - footprintW) / 2;
  const footprintOffsetY = (def.height - footprintH) / 2;

  return {
    // ... full asset with footprint data
  };
}
```

#### `canPlaceAsset()` (assetGenerator.ts)
```typescript
// Check overlap using footprints
for (const asset of existingAssets) {
  const assetFootprintX = asset.tile_x + (asset.footprintOffsetX || 0);
  const assetFootprintY = asset.tile_y + (asset.footprintOffsetY || 0);
  const assetFootprintW = asset.footprintW || asset.width;
  const assetFootprintH = asset.footprintH || asset.height;

  // Check overlap...
}
```

### 4. Cover System Integration

#### `generateCoverEdges()` (coverEdges.ts)
```typescript
// Use visual bounds for cover edge (what player sees)
const assetX = asset.tile_x * TILE_SIZE;
const assetY = asset.tile_y * TILE_SIZE;
const assetW = asset.width * TILE_SIZE;
const assetH = asset.height * TILE_SIZE;

// Generate ONLY the bottom edge from visual bounds
const edgeA: Vec2 = { x: assetX, y: assetY + assetH };
const edgeB: Vec2 = { x: assetX + assetW, y: assetY + assetH };
```

## Level Validation System

### NEW: Occupancy Grid Validator

Created `levelValidator.ts` to validate procedural levels:

#### Features

1. **Occupancy Grid**
   - Builds from tile solids + asset footprints
   - Accurately represents walkable vs blocked tiles
   - Used for pathfinding validation

2. **Spawn Validation**
   - Checks if player spawn tile is walkable
   - Ensures spawn isn't blocked by assets

3. **Pathfinding Check**
   - BFS algorithm from spawn to doors
   - Verifies at least one exit is reachable
   - Reports if player would be trapped

4. **Asset Placement Analysis**
   - Detects assets overlapping doors
   - Finds assets in door clearance zones (3-tile radius)
   - Warns about cluttered vs empty levels

#### Validation Report

```typescript
interface ValidationReport {
  valid: boolean;                      // Overall pass/fail
  spawnBlocked: boolean;               // Spawn tile blocked?
  walkableTiles: number;               // Count of walkable tiles
  blockedByAssets: number;             // Tiles blocked by assets
  totalTiles: number;                  // Total level tiles
  assetsOverlappingDoors: PlacedAsset[]; // Assets on door tiles
  assetsOverlappingReserved: PlacedAsset[]; // Assets in clearance
  pathToExitExists: boolean;           // Can reach door from spawn?
  warnings: string[];                  // Non-critical issues
  errors: string[];                    // Critical failures
}
```

#### Console Output Example

```
========== LEVEL VALIDATION REPORT: hotel_level_01 ==========
Status: ✅ VALID

OCCUPANCY:
  Total tiles: 3200
  Walkable: 2650 (82.8%)
  Blocked by tiles: 450
  Blocked by assets: 100

SPAWN & PATHING:
  Spawn blocked: ✅ NO
  Path to exit: ✅ YES

ASSET PLACEMENT:
  Assets overlapping doors: 0
  Assets in door clearance: 2

⚠️  WARNINGS:
  - 2 assets in door clearance zones

========================================
```

### Integration

Validation runs automatically after level generation:

```typescript
// In level.ts
const finalLevel = sanitizeDoors(mergedLevel);

// VALIDATION PASS - Check level playability
import('./levelValidator').then(({ validateLevel, logValidationReport }) => {
  const report = validateLevel(finalLevel);
  logValidationReport(report, finalLevel.levelId);

  if (!report.valid) {
    console.warn(`[LEVEL] Level ${finalLevel.levelId} failed validation`);
  }
});
```

## Benefits

### 1. Accurate Collision

- Player only collides with logical footprints
- Visual decorations don't block movement
- Debug overlays are non-blocking

### 2. Better Level Design

- Can place tall sprites (lamps, plants) without blocking
- Footprint can be smaller than visual (realistic furniture)
- Easier to create visually rich but playable levels

### 3. Flexible Asset Creation

- Visual artists control sprite size freely
- Game designers control collision footprint separately
- No more "looks good but unplayable" scenarios

### 4. Validation Feedback

- Instant feedback on level playability
- Catches spawn/pathing issues before testing
- Quantifies level density and clutter

## Example Use Cases

### Tall Decorative Plant
```typescript
{
  width: 3,           // 3-tile wide sprite
  height: 4,          // 4-tile tall visual
  footprintW: 1,      // Only 1-tile wide collision
  footprintH: 1,      // Only 1-tile deep collision
  is_solid: true
}
// Result: Tall plant that you can walk behind
```

### Wide Desk with Small Footprint
```typescript
{
  width: 4,           // 4-tile wide visual
  height: 2,          // 2-tile deep visual
  footprintW: 3,      // 3-tile collision (inset)
  footprintH: 1,      // 1-tile collision
  is_solid: true
}
// Result: Desk with overhanging edges you can walk under
```

### Debug Overlay (Non-Solid)
```typescript
{
  width: 5,           // Large debug visualization
  height: 5,
  footprintW: 0,      // Irrelevant - not solid
  footprintH: 0,
  is_solid: false     // Never blocks!
}
// Result: Visual debug that never collides
```

## Files Modified

### Core System
- `src/game/noir-shooter/types.ts` - Updated PlacedAsset & AssetDefinition
- `src/game/noir-shooter/collision.ts` - Footprint-based collision
- `src/game/noir-shooter/assetGenerator.ts` - Generate footprint data
- `src/game/noir-shooter/coverEdges.ts` - Updated PlacedAsset type

### Validation System (NEW)
- `src/game/noir-shooter/levelValidator.ts` - Occupancy grid & validation
- `src/game/noir-shooter/level.ts` - Integrated validation logging

## Migration Notes

### Backward Compatibility

- Assets without `footprintW/H` default to `width/height`
- Existing levels continue to work
- No breaking changes to asset definitions

### For Asset Creators

When defining new assets:

```typescript
// Solid furniture - define footprint
{
  asset_type: 'desk_office',
  width: 4,
  height: 2,
  footprintW: 3,  // ← Add this
  footprintH: 2,  // ← Add this
  is_solid: true
}

// Decorative non-solid - footprint doesn't matter
{
  asset_type: 'poster_wall',
  width: 2,
  height: 3,
  is_solid: false  // ← Non-solid = never blocks
}
```

## Testing

### To Verify Fix

1. Start noir shooter game
2. Observe console for validation reports
3. Check that:
   - "Spawn blocked: ✅ NO"
   - "Path to exit: ✅ YES"
   - Walkable percentage is reasonable (60-85%)

4. In-game testing:
   - Walk around assets - no invisible walls
   - Cover system still works (bottom edges)
   - Debug visuals don't block movement (F3 mode)

### Validation Checks

The validator automatically checks:
- ✅ Player spawn is walkable
- ✅ Path exists to at least one door
- ✅ No assets directly on door tiles
- ✅ Level density is reasonable
- ⚠️ Warns about assets in door clearance
- ⚠️ Warns about extreme density (too empty/cluttered)

---

**Status**: ✅ Implemented and tested
**Build**: ✅ Passing
**Validation**: ✅ Running automatically
