# Asset Kit v1 Documentation

## Overview

Asset Kit v1 is a unified asset system for the top-down noir tactical shooter. It provides:

- **64×64 PNG sprite standard** with consistent visual style
- **Depth sorting system** for proper visual stacking
- **Collision footprint** system (measured in tiles, independent of sprite size)
- **Cover detection** with edge normals for tactical gameplay
- **Debug visualization** for development
- **Placeholder generator** for rapid prototyping

---

## Visual Standards

### Sprite Specifications

- **Dimensions:** 64×64 pixels (all sprites)
- **Camera Angle:** True top-down (0° overhead)
- **Visual Style:** Film noir (muted palette, high contrast, strong silhouettes)
- **Lighting Direction:** Upper-left highlight, lower-right shadow (consistent across all assets)
- **Outline:** 2px black outline on all props
- **Render Pivot:** Bottom-center (0.5, 1.0) for proper depth sorting

### Noir Color Palette

The system uses muted, desaturated colors appropriate for a noir aesthetic:

- **Base colors:** Low saturation (10-25%)
- **Value range:** Dark (20-40% brightness)
- **Contrast:** High contrast between light and dark areas
- **Accents:** Minimal use of bright colors (reserved for interactive elements)

---

## Technical Architecture

### Asset Definition Structure

```typescript
interface AssetDefinition {
  id: string;                   // Unique identifier (e.g., "desk_wood")
  asset_type: AssetType;        // Category: furniture, cover, decoration, etc.
  name: string;                 // Human-readable name
  spritePath: string;           // Path to 64×64 PNG

  // Collision footprint (in tiles)
  footprintW: number;           // Width in tiles
  footprintH: number;           // Height in tiles

  // Gameplay properties
  is_solid: boolean;            // Blocks player/enemy movement
  provides_cover: boolean;      // Can be used as tactical cover
  blocks_vision: boolean;       // Blocks enemy line of sight
  coverPolicy: CoverPolicy;     // 'full' | 'half' | 'none'

  // Rendering
  renderPivot: RenderPivot;     // Anchor point for sprite (0-1 normalized)
  castsShadow: boolean;         // Should cast dynamic shadows
  renderLayerOffset: number;    // Z-index modifier (-1, 0, +1)

  // Metadata
  tags: string[];               // For filtering/searching
}
```

### Depth Sorting

Assets are sorted by their depth value for proper visual stacking:

```typescript
depth = (tileY + footprintH) + (renderLayerOffset * 0.001)
```

This ensures:
- Assets further down the screen render on top
- Taller objects (larger footprintH) render in front of shorter ones behind them
- renderLayerOffset provides fine-grained control (wall fixtures at -1, tall pillars at +1)

### Coordinate Systems

The system handles two independent coordinate systems:

1. **Tile Grid:** Collision and gameplay logic (configurable TILE_SIZE, default 48px)
2. **Sprite Space:** Visual rendering (fixed 64×64px sprites)

This separation allows:
- Tile size changes without re-exporting sprites
- Sprites to visually overlap multiple tiles
- Proper depth sorting regardless of tile size

---

## Asset Catalog

### Current Asset Count: 31

#### Furniture (8 assets)
- `desk_wood` - 2×1 tiles, provides full cover
- `desk_metal` - 2×1 tiles, provides full cover
- `office_chair` - 1×1 tile
- `filing_cabinet` - 1×1 tile, provides full cover, blocks vision
- `bookshelf_tall` - 2×1 tiles, provides full cover, blocks vision
- `table_round` - 2×2 tiles, provides half cover
- `table_conference` - 3×2 tiles, provides half cover
- `table_small` - 1×1 tile

#### Seating (2 assets)
- `couch_leather` - 3×1 tiles, provides half cover
- `armchair` - 1×1 tile

#### Cover Objects (4 assets)
- `crate_wood` - 1×1 tile, provides full cover, destructible
- `crate_metal` - 1×1 tile, provides full cover, blocks vision
- `barrel_oil` - 1×1 tile, provides full cover, explosive
- `concrete_barrier` - 2×1 tiles, provides full cover, blocks vision

#### Structural (2 assets)
- `pillar_stone` - 1×1 tile, provides full cover, blocks vision, tall
- `column_marble` - 1×1 tile, provides full cover, blocks vision, tall

#### Decoration (3 assets)
- `plant_potted` - 1×1 tile
- `lamp_floor` - 1×1 tile, tall
- `painting` - Wall fixture (no floor footprint)

#### Containers (3 assets)
- `safe_small` - 1×1 tile, provides full cover, interactive
- `vending_machine` - 1×1 tile, provides full cover, blocks vision, tall
- `luggage` - 1×1 tile

#### Bar/Hotel (3 assets)
- `bar_counter` - 3×1 tiles, provides full cover
- `piano` - 2×2 tiles, provides full cover
- `fireplace` - 2×1 tiles, blocks vision

#### Misc (2 assets)
- `rug_small` - 2×2 tiles, floor decoration (no collision)
- `mirror` - Wall fixture (no floor footprint)

---

## Usage Guide

### Basic Usage

```typescript
import { ASSET_CATALOG, getAssetById, renderAssetSprite, sortAssetsByDepth } from '../game/assets';

// Get asset definition
const desk = getAssetById('desk_wood');

// Create placed asset
const placedAsset: PlacedAsset = {
  id: 'desk_1',
  assetDef: desk,
  tileX: 5,
  tileY: 3,
  rotation: 0  // 0, 90, 180, or 270 degrees
};

// Sort multiple assets by depth
const sortedAssets = sortAssetsByDepth(placedAssets);

// Render with debug overlays
const options: RenderOptions = {
  showDebugFootprint: true,
  showDebugPivot: true,
  showDebugCoverEdges: true,
  tileSize: 48
};

for (const asset of sortedAssets) {
  renderAssetSprite(ctx, asset, options);
}
```

### Filtering Assets

```typescript
import { getAssetsByType, getAssetsByTag, getCoverAssets } from '../game/assets';

// Get all furniture
const furniture = getAssetsByType('furniture');

// Get all office-themed assets
const officeAssets = getAssetsByTag('office');

// Get all assets that provide cover
const coverAssets = getCoverAssets();
```

### Placeholder Generation

During development, placeholder sprites are automatically generated for missing assets:

```typescript
import { generatePlaceholderSprite, generateAllPlaceholders } from '../game/assets';

// Generate single placeholder
const canvas = generatePlaceholderSprite(assetDef);

// Generate all placeholders (for preloading)
const placeholders = generateAllPlaceholders(ASSET_CATALOG);
```

Placeholders follow the noir visual style and are color-coded by asset type.

---

## Debug Visualization

### Debug Overlays

The system provides three debug overlays:

1. **Footprint Rectangle**
   - Red = Solid (blocks movement)
   - Green = Passable
   - Shows exact collision bounds in world space

2. **Render Pivot**
   - Yellow dot at footprint bottom-center
   - Yellow dashed line to sprite bottom-center
   - Shows how sprite aligns to footprint

3. **Cover Edges**
   - Blue = Full cover
   - Orange = Half cover
   - Magenta arrows = Cover normals (perpendicular to edge)
   - Shows all four edges of footprint

### Preview Page

Access the interactive preview at `/asset-kit-preview`:

- Live rendering of all assets
- Toggleable debug overlays
- Filterable asset catalog
- Detailed asset specifications
- Real-time depth sorting demonstration

---

## Cover System Integration

### Cover Edge Detection

Each asset with `provides_cover: true` has four cover edges (one per footprint side):

```typescript
// Calculate cover edges from footprint
const edges = [
  { x1, y1, x2, y2 },  // Top edge
  { x1, y1, x2, y2 },  // Right edge
  { x1, y1, x2, y2 },  // Bottom edge
  { x1, y1, x2, y2 },  // Left edge
];

// Calculate edge normal (perpendicular, pointing outward)
const dx = x2 - x1;
const dy = y2 - y1;
const length = Math.sqrt(dx * dx + dy * dy);
const normalX = -dy / length;  // Perpendicular
const normalY = dx / length;

// Player enters cover when moving toward edge (dot product < -0.2)
// Player exits cover when moving away from edge (dot product > 0.3)
```

### Cover Policies

- **`full`** - Complete protection from bullets, player can duck
- **`half`** - Partial protection, can be shot over
- **`none`** - Asset doesn't provide tactical cover

---

## Asset Creation Pipeline

### For Artists

1. **Create 64×64 PNG sprite**
   - True top-down perspective (0° overhead)
   - Muted colors, high contrast
   - Upper-left highlight, lower-right shadow
   - 2px black outline
   - Bottom-center represents object's ground contact point

2. **Export placeholder as reference**
   ```typescript
   exportPlaceholderAsPNG(assetDef);  // Downloads PNG template
   ```

3. **Replace placeholder**
   - Save sprite to `/public/assets/props/[asset_id].png`
   - Sprite will automatically load on next refresh

### For Designers

1. **Define asset in catalog**
   ```typescript
   {
     id: 'new_asset',
     asset_type: 'furniture',
     name: 'New Asset',
     spritePath: '/assets/props/new_asset.png',
     renderPivot: { x: 0.5, y: 1.0 },
     footprintW: 2,
     footprintH: 1,
     is_solid: true,
     provides_cover: true,
     blocks_vision: false,
     coverPolicy: 'full',
     castsShadow: true,
     renderLayerOffset: 0,
     tags: ['office', 'cover'],
   }
   ```

2. **Test in preview page**
   - Navigate to `/asset-kit-preview`
   - Verify footprint matches intended collision
   - Check depth sorting with other assets
   - Validate cover edges align properly

---

## Best Practices

### Footprint Sizing

- **1×1:** Small objects (chairs, crates, plants)
- **2×1:** Desks, counters, horizontal furniture
- **1×2:** Vertical furniture (rare in top-down)
- **2×2:** Round tables, pianos, large objects
- **3×1 or larger:** Bar counters, long tables

### Render Layer Offsets

- **-1:** Floor decorations (rugs), wall fixtures (paintings)
- **0:** Standard objects (desks, crates, most furniture)
- **+1:** Tall objects (pillars, vending machines, floor lamps)

### Cover Design

- Full cover should block vision or be very sturdy (metal desks, concrete barriers)
- Half cover for tables, couches (can shoot over them)
- Ensure cover edges create interesting tactical scenarios (flanking routes)

### Performance

- Sprite cache handles loading/caching automatically
- Placeholders generate instantly for missing assets
- Depth sorting is O(n log n) - suitable for hundreds of assets
- Debug overlays have minimal performance impact

---

## Migration from Old System

The old system used hand-coded tile types. To migrate:

1. **Map old tile types to new asset IDs:**
   ```typescript
   const TILE_TO_ASSET_MAP = {
     'desk': 'desk_wood',
     'crate': 'crate_wood',
     'chair': 'office_chair',
     // ... etc
   };
   ```

2. **Convert tile positions to PlacedAssets:**
   ```typescript
   const placedAssets: PlacedAsset[] = [];
   for (let y = 0; y < tiles.length; y++) {
     for (let x = 0; x < tiles[y].length; x++) {
       const tile = tiles[y][x];
       const assetId = TILE_TO_ASSET_MAP[tile];
       if (assetId) {
         const assetDef = getAssetById(assetId);
         placedAssets.push({
           id: `${assetId}_${x}_${y}`,
           assetDef,
           tileX: x,
           tileY: y,
           rotation: 0
         });
       }
     }
   }
   ```

3. **Replace rendering logic:**
   - Remove old tile-based rendering
   - Use `renderAssetSprite()` for each placed asset
   - Apply depth sorting before rendering

---

## Future Enhancements

### Planned Features

- [ ] Animation support (idle animations, destruction sequences)
- [ ] Destructible assets (health system, debris spawning)
- [ ] Light emission (fireplace glow, lamp illumination)
- [ ] Procedural color variations (rust, wear, dirt)
- [ ] Asset grouping/prefabs (office set, bar set)
- [ ] Dynamic shadows (real-time shadow casting)
- [ ] Asset interactions (doors open/close, safes unlock)

### Asset Expansion

Priority additions:
- Doors (various types: wooden, metal, glass)
- Bathroom fixtures
- Kitchen equipment
- Jail cell bars
- Vehicles (car, truck) for outdoor scenes
- Street furniture (benches, mailboxes)
- Lighting fixtures (ceiling lamps, neon signs)

---

## Troubleshooting

### Sprites Not Loading

1. Check sprite path matches file location
2. Verify file is 64×64 PNG
3. Check browser console for load errors
4. System falls back to placeholder automatically

### Incorrect Depth Sorting

1. Verify `footprintH` matches visual height of object
2. Check `renderLayerOffset` if object should be in front/behind
3. Ensure `tileY` is correct position

### Cover Not Working

1. Set `provides_cover: true`
2. Set appropriate `coverPolicy` (full/half)
3. Verify footprint bounds encompass entire object
4. Check cover edges in debug visualization

### Collision Issues

1. Verify `is_solid` is set correctly
2. Check footprint size matches intended collision
3. Ensure footprint doesn't overlap other solid objects

---

## Credits

**System Design:** Asset Kit v1 Specification
**Implementation:** TypeScript, Canvas 2D
**Visual Style:** Film noir, top-down perspective
**Documentation:** Complete technical specification

For questions or contributions, see project documentation.
