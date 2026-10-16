import type { Projection, Pt3 } from './projection';

export const EDGE = 'rgba(40,20,32,.16)';

export function rgb(h: string): [number, number, number] {
  if (h[0] !== '#') {
    const m = h.match(/[\d.]+/g) || ['128', '128', '128'];
    return [+m[0], +m[1], +m[2]];
  }
  const s = h.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

/** Lightens (a > 0) or darkens (a < 0) a color by fraction |a|. */
export function shade(h: string, a: number): string {
  const [r, g, b] = rgb(h);
  const t = a < 0 ? 0 : 255;
  const p = Math.abs(a);
  const al = h.startsWith('rgba') ? +(h.match(/[\d.]+/g) || [])[3] : 1;
  const v = `${Math.round(r + (t - r) * p)},${Math.round(g + (t - g) * p)},${Math.round(b + (t - b) * p)}`;
  return al < 1 ? `rgba(${v},${al})` : `rgb(${v})`;
}

export class Painter {
  constructor(public ctx: CanvasRenderingContext2D, public proj: Projection) {}

  private path(pts: [number, number][], fill?: string | null, stroke?: string | null, lw = 1): void {
    const { ctx } = this;
    ctx.beginPath();
    pts.forEach(([sx, sy], i) => (i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy)));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  /** Polygon in world coordinates. */
  poly(pts: Pt3[], fill?: string | null, stroke?: string | null, lw = 1): void {
    this.path(pts.map((p) => this.proj.iso(p[0], p[1], p[2])), fill, stroke, lw);
  }

  /** Polygon in view coordinates. */
  polyV(pts: Pt3[], fill?: string | null, stroke?: string | null, lw = 1): void {
    this.path(pts.map((p) => this.proj.isoV(p[0], p[1], p[2])), fill, stroke, lw);
  }

  box(x: number, y: number, z: number, w: number, d: number, h: number, c: string): void {
    const [a, b, a2, b2] = this.proj.vrect(x, y, x + w, y + d);
    this.polyV([[a, b2, z], [a2, b2, z], [a2, b2, z + h], [a, b2, z + h]], shade(c, -0.08), EDGE, 0.8);
    this.polyV([[a2, b, z], [a2, b2, z], [a2, b2, z + h], [a2, b, z + h]], shade(c, -0.24), EDGE, 0.8);
    this.polyV([[a, b, z + h], [a2, b, z + h], [a2, b2, z + h], [a, b2, z + h]], shade(c, 0.1), EDGE, 0.8);
  }

  line3(p1: Pt3, p2: Pt3, color: string, width: number): void {
    const { ctx } = this;
    const [x1, y1] = this.proj.iso(...p1);
    const [x2, y2] = this.proj.iso(...p2);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
}
