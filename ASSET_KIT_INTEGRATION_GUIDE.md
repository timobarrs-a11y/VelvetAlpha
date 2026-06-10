# Asset Kit v1 Integration Guide for Noir Shooter

## Quick Start

### 1. Import the Asset System

```typescript
import {
  ASSET_CATALOG,
  getAssetById,
  type PlacedAsset,
  sortAssetsByDepth,
  renderAssetSprite,
  type RenderOptions,
  preloadAllSprites,
} from './assets';
```

### 2. Replace Level Tile System

**Old approach (tile-based):**
```typescript
const tiles: TileType[][] = [
  ['wall', 'wall', 'wall'],
  ['wall', 'desk', 'chair'],
  ['wall', 'floor', 'floor'],
];
```

**New approach (asset-based):**
```typescript
const placedAssets: PlacedAsset[] = [
  {
    id: 'desk_1',
    assetDef: getAssetById('desk_wood')!,
    tileX: 1,
    tileY: 1,
    rotation: 0,
  },
  {
    id: 'chair_1',
    assetDef: getAssetById('office_chair')!,
    tileX: 2,
    tileY: 1,
    rotation: 0,
  },
];
```

### 3. Update Level Data Structure

```typescript
interface LevelData {
  width: number;
  height: number;
  floorTiles: FloorTileType[][];  // Keep floor tiles (carpet, wood, concrete)
  wallTiles: WallTileType[][];    // Keep walls
  placedAssets: PlacedAsset[];    // NEW: Asset system
  enemies: EnemySpawn[];
  playerStart: { x: number; y: number };
  doors: Door[];
  lights: AmbientLight[];
}
```

### 4. Implement Depth-Sorted Rendering

```typescript
function renderLevel(ctx: CanvasRenderingContext2D, level: LevelData, player: Player) {
  // 1. Render floor tiles (background)
  renderFloorTiles(ctx, level.floorTiles);

  // 2. Collect all depth-sorted entities
  const entities: Array<{ depth: number; render: () => void }> = [];

  // Add assets
  for (const asset of level.placedAssets) {
    const depth = getAssetDepth(asset.assetDef, asset.tileY);
    entities.push({
      depth,
      render: () => renderAssetSprite(ctx, asset, renderOptions),
    });
  }

  // Add player
  entities.push({
    depth: player.y / TILE_SIZE,
    render: () => renderPlayer(ctx, player),
  });

  // Add enemies
  for (const enemy of level.enemies) {
    entities.push({
      depth: enemy.y / TILE_SIZE,
      render: () => renderEnemy(ctx, enemy),
    });
  }

  // 3. Sort by depth and render
  entities.sort((a, b) => a.depth - b.depth);
  for (const entity of entities) {
    entity.render();
  }

  // 4. Render walls (foreground)
  renderWallTiles(ctx, level.wallTiles);
}
```

### 5. Update Collision Detection

```typescript
function checkCollisionWithAssets(x: number, y: number, assets: PlacedAsset[]): boolean {
  const tileX = Math.floor(x / TILE_SIZE);
  const tileY = Math.floor(y / TILE_SIZE);

  for (const asset of assets) {
    if (!asset.assetDef.is_solid) continue;

    // Check if point is inside asset footprint
    if (
      tileX >= asset.tileX &&
      tileX < asset.tileX + asset.assetDef.footprintW &&
      tileY >= asset.tileY &&
      tileY < asset.tileY + asset.assetDef.footprintH
    ) {
      return true;
    }
  }

  return false;
}
```

### 6. Integrate Cover System

```typescript
function findNearestCover(
  playerX: number,
  playerY: number,
  assets: PlacedAsset[]
): { asset: PlacedAsset; edge: Edge; normal: Vector2 } | null {
  const COVER_DETECTION_RADIUS = 32; // pixels
  let nearest: any = null;
  let minDist = Infinity;

  for (const asset of assets) {
    if (!asset.assetDef.provides_cover) continue;

    // Get all edges of asset footprint
    const edges = getAssetCoverEdges(asset, TILE_SIZE);

    for (const edge of edges) {
      // Calculate distance from player to edge
      const dist = distanceToSegment(playerX, playerY, edge.x1, edge.y1, edge.x2, edge.y2);

      if (dist < COVER_DETECTION_RADIUS && dist < minDist) {
        minDist = dist;
        nearest = {
          asset,
          edge,
          normal: calculateEdgeNormal(edge),
        };
      }
    }
  }

  return nearest;
}

function getAssetCoverEdges(asset: PlacedAsset, tileSize: number): Edge[] {
  const x = asset.tileX * tileSize;
  const y = asset.tileY * tileSize;
  const w = asset.assetDef.footprintW * tileSize;
  const h = asset.assetDef.footprintH * tileSize;

  return [
    { x1: x, y1: y, x2: x + w, y2: y },         // Top
    { x1: x + w, y1: y, x2: x + w, y2: y + h }, // Right
    { x1: x + w, y1: y + h, x2: x, y2: y + h }, // Bottom
    { x1: x, y1: y + h, x2: x, y2: y },         // Left
  ];
}

function calculateEdgeNormal(edge: Edge): Vector2 {
  const dx = edge.x2 - edge.x1;
  const dy = edge.y2 - edge.y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Normal is perpendicular to edge
  return {
    x: -dy / len,
    y: dx / len,
  };
}
```

### 7. Add Vision Blocking

```typescript
function hasLineOfSight(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  assets: PlacedAsset[]
): boolean {
  // Raycast from (x1, y1) to (x2, y2)
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(dist / 4); // Check every 4 pixels

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;

    // Check if ray hits vision-blocking asset
    for (const asset of assets) {
      if (!asset.assetDef.blocks_vision) continue;

      const bounds = getAssetFootprintBounds(
        asset.tileX,
        asset.tileY,
        asset.assetDef.footprintW,
        asset.assetDef.footprintH,
        TILE_SIZE
      );

      if (
        x >= bounds.x &&
        x < bounds.x + bounds.width &&
        y >= bounds.y &&
        y < bounds.y + bounds.height
      ) {
        return false; // Vision blocked
      }
    }
  }

  return true; // Clear line of sight
}
```

---

## Migration Checklist

### Phase 1: Rendering (No Gameplay Changes)
- [ ] Add `placedAssets: PlacedAsset[]` to LevelData
- [ ] Convert existing tile-based props to PlacedAsset instances
- [ ] Implement depth-sorted rendering (assets + player + enemies)
- [ ] Test rendering with debug overlays enabled
- [ ] Verify visual stacking (player can pass behind tall objects)

### Phase 2: Collision (Maintain Existing Behavior)
- [ ] Update collision detection to check asset footprints
- [ ] Remove old tile-based prop collision
- [ ] Test player movement around assets
- [ ] Test enemy pathfinding around assets
- [ ] Verify no regressions in existing collision

### Phase 3: Cover System (New Feature)
- [ ] Implement cover edge detection
- [ ] Add player cover state (in_cover, cover_asset, cover_edge)
- [ ] Implement cover entry/exit logic (dot product thresholds)
- [ ] Add visual feedback for cover (UI indicator, camera shift)
- [ ] Test cover mechanics with various asset types

### Phase 4: Vision Blocking (AI Enhancement)
- [ ] Implement raycast-based line of sight
- [ ] Check `blocks_vision` property for assets
- [ ] Update enemy AI to respect vision blocking
- [ ] Test stealth gameplay (hide behind tall objects)

### Phase 5: Asset Expansion
- [ ] Add doors (opening/closing)
- [ ] Add destructible assets (crates, barrels)
- [ ] Add interactive assets (safes, vending machines)
- [ ] Add lighting emitters (lamps, fireplace)

---

## Performance Considerations

### Rendering Optimization

```typescript
// Frustum culling - only render visible assets
function getVisibleAssets(
  assets: PlacedAsset[],
  cameraX: number,
  cameraY: number,
  viewWidth: number,
  viewHeight: number,
  tileSize: number
): PlacedAsset[] {
  const minTileX = Math.floor((cameraX - 64) / tileSize);
  const maxTileX = Math.ceil((cameraX + viewWidth + 64) / tileSize);
  const minTileY = Math.floor((cameraY - 64) / tileSize);
  const maxTileY = Math.ceil((cameraY + viewHeight + 64) / tileSize);

  return assets.filter(asset => {
    const assetMaxX = asset.tileX + asset.assetDef.footprintW;
    const assetMaxY = asset.tileY + asset.assetDef.footprintH;

    return (
      assetMaxX >= minTileX &&
      asset.tileX <= maxTileX &&
      assetMaxY >= minTileY &&
      asset.tileY <= maxTileY
    );
  });
}
```

### Collision Optimization

```typescript
// Spatial hash for fast collision queries
class AssetSpatialHash {
  private cellSize: number;
  private cells: Map<string, PlacedAsset[]>;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  insert(asset: PlacedAsset) {
    const cells = this.getOccupiedCells(asset);
    for (const key of cells) {
      if (!this.cells.has(key)) {
        this.cells.set(key, []);
      }
      this.cells.get(key)!.push(asset);
    }
  }

  query(x: number, y: number): PlacedAsset[] {
    const key = this.getCellKey(x, y);
    return this.cells.get(key) || [];
  }

  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return `${cellX},${cellY}`;
  }

  private getOccupiedCells(asset: PlacedAsset): string[] {
    const keys: string[] = [];
    const bounds = getAssetFootprintBounds(
      asset.tileX,
      asset.tileY,
      asset.assetDef.footprintW,
      asset.assetDef.footprintH,
      TILE_SIZE
    );

    const minCellX = Math.floor(bounds.x / this.cellSize);
    const maxCellX = Math.floor((bounds.x + bounds.width) / this.cellSize);
    const minCellY = Math.floor(bounds.y / this.cellSize);
    const maxCellY = Math.floor((bounds.y + bounds.height) / this.cellSize);

    for (let cy = minCellY; cy <= maxCellY; cy++) {
      for (let cx = minCellX; cx <= maxCellX; cx++) {
        keys.push(`${cx},${cy}`);
      }
    }

    return keys;
  }
}
```

---

## Testing Strategy

### Unit Tests

```typescript
// Test asset footprint collision
test('player collides with solid asset', () => {
  const asset = {
    id: 'test',
    assetDef: getAssetById('desk_wood')!,
    tileX: 5,
    tileY: 5,
    rotation: 0,
  };

  // Inside footprint
  expect(checkCollisionWithAssets(5.5 * TILE_SIZE, 5.5 * TILE_SIZE, [asset])).toBe(true);

  // Outside footprint
  expect(checkCollisionWithAssets(4 * TILE_SIZE, 4 * TILE_SIZE, [asset])).toBe(false);
});

// Test depth sorting
test('assets sort by depth correctly', () => {
  const assets = [
    { tileY: 10, assetDef: { footprintH: 1 } },
    { tileY: 5, assetDef: { footprintH: 1 } },
    { tileY: 7, assetDef: { footprintH: 2 } },
  ];

  const sorted = sortAssetsByDepth(assets);

  expect(sorted[0].tileY).toBe(5);  // Depth = 6
  expect(sorted[1].tileY).toBe(7);  // Depth = 9
  expect(sorted[2].tileY).toBe(10); // Depth = 11
});
```

### Visual Tests

1. **Depth Sorting:** Place assets at different Y positions, verify visual stacking
2. **Collision:** Walk player around assets, verify solid blocking
3. **Cover Detection:** Approach cover assets from all angles, verify entry/exit
4. **Vision Blocking:** Place tall assets between player and enemies, verify stealth

### Performance Benchmarks

- **Render 100 assets:** < 2ms per frame
- **Collision check (spatial hash):** < 0.1ms per query
- **Depth sort 100 entities:** < 0.5ms per frame
- **Cover detection:** < 0.5ms per frame

---

## Next Steps

1. **Review this guide** and the Asset Kit v1 specification
2. **Test the preview page** at `/asset-kit-preview`
3. **Start migration** with Phase 1 (rendering only)
4. **Iterate on asset catalog** - add missing types as needed
5. **Optimize performance** once gameplay is working

For questions or issues, refer to `ASSET_KIT_V1_DOCUMENTATION.md`.
