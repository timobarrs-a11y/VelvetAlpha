/**
 * Static-layer cache: renders floors, back walls, rugs and decals to
 * offscreen canvases keyed by (level, rotation, wallMode, zoomBucket).
 * Redrawn only when one of those changes. Furniture sprites are cached
 * per (objectType, rotation) and invalidated when the object changes.
 */

interface CacheKey {
  level: number;
  rot: number;
  wallMode: string;
  zoomBucket: number;
}

function keyStr(k: CacheKey): string {
  return `${k.level}:${k.rot}:${k.wallMode}:${k.zoomBucket}`;
}

export class LayerCache {
  private layers = new Map<string, HTMLCanvasElement>();
  private lastKey: string | null = null;
  private spriteCache = new Map<string, HTMLCanvasElement>();
  private spriteVersion = new Map<string, number>();

  /** Returns true if the cache key changed (caller should redraw static layers). */
  keyChanged(k: CacheKey): boolean {
    const s = keyStr(k);
    if (s !== this.lastKey) {
      this.lastKey = s;
      return true;
    }
    return false;
  }

  getLayer(k: CacheKey, w: number, h: number): HTMLCanvasElement {
    const s = keyStr(k);
    let cv = this.layers.get(s);
    if (!cv) {
      cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      this.layers.set(s, cv);
    }
    return cv;
  }

  getLayerCtx(k: CacheKey, w: number, h: number): CanvasRenderingContext2D | null {
    const cv = this.getLayer(k, w, h);
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    return cv.getContext('2d');
  }

  getSprite(id: string, version: number, w: number, h: number): { canvas: HTMLCanvasElement; stale: boolean } {
    const cached = this.spriteCache.get(id);
    const cachedVersion = this.spriteVersion.get(id);
    if (cached && cachedVersion === version) {
      return { canvas: cached, stale: false };
    }
    if (!cached) {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      this.spriteCache.set(id, cv);
    }
    this.spriteVersion.set(id, version);
    return { canvas: this.spriteCache.get(id)!, stale: true };
  }

  invalidateAll(): void {
    this.layers.clear();
    this.spriteCache.clear();
    this.spriteVersion.clear();
    this.lastKey = null;
  }

  invalidateSprites(): void {
    this.spriteCache.clear();
    this.spriteVersion.clear();
  }
}
