// Records what each pixel *is* (height, facing, material) while the Canvas 2D art draws,
// by mirroring path calls onto a low-res data canvas with encoded fills instead of paint.

export const ZMAX = 3.2;

export const NORMAL = { up: 0, faceB: 85, faceA: 170, billboard: 255 } as const;
export const MATERIAL = { matte: 0, gloss: 50, window: 100, emissive: 150, body: 200 } as const;

export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export type HeightPlane = { kind: 'solid'; z: number } | { kind: 'ramp'; from: Vec2; to: Vec2 };

interface Paint {
  style: string | CanvasGradient;
  stroke: boolean;
}

export interface GBuffer {
  readonly canvas: HTMLCanvasElement;
  begin(width: number, height: number, scale: number): void;
  wrap(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D;
  /** Encodes the next fill as a flat surface through these view-space points (with their screen positions). */
  plane(view: Vec3[], screen: Vec2[], material: number): void;
  /** Fills drawn freehand until the next `base(null)` are treated as upright billboards standing at groundY. */
  billboard(groundY: number, zh: number, material: number): void;
  /** Fills drawn freehand until the next `base(null)` sit at a fixed height and glow. */
  emissive(z: number): void;
  clearBase(): void;
  reset(): void;
}

export function encodeHeight(z: number): number {
  return Math.max(0, Math.min(255, Math.round((z / ZMAX) * 255)));
}

export function planeNormal(pts: Vec3[]): number | null {
  for (let i = 1; i + 1 < pts.length; i++) {
    const [a0, b0, z0] = pts[0], [a1, b1, z1] = pts[i], [a2, b2, z2] = pts[i + 1];
    const ux = a1 - a0, uy = b1 - b0, uz = z1 - z0, vx = a2 - a0, vy = b2 - b0, vz = z2 - z0;
    const nx = Math.abs(uy * vz - uz * vy), ny = Math.abs(uz * vx - ux * vz), nz = Math.abs(ux * vy - uy * vx);
    if (nx + ny + nz < 1e-6) continue;
    if (nz >= nx && nz >= ny) return NORMAL.up;
    return nx >= ny ? NORMAL.faceA : NORMAL.faceB;
  }
  return null;
}

/** Fits height as an affine function of screen position, expressed as the gradient line from z=0 to z=ZMAX. */
export function heightPlane(screen: Vec2[], z: number[]): HeightPlane | null {
  for (let i = 1; i + 1 < screen.length; i++) {
    const [x0, y0] = screen[0], [x1, y1] = screen[i], [x2, y2] = screen[i + 1];
    const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(det) < 1e-3) continue;
    const dz1 = z[i] - z[0], dz2 = z[i + 1] - z[0];
    const A = (dz1 * (y2 - y0) - dz2 * (y1 - y0)) / det;
    const B = ((x1 - x0) * dz2 - (x2 - x0) * dz1) / det;
    const g2 = A * A + B * B;
    if (g2 < 1e-8) return { kind: 'solid', z: z[0] };
    const fx = x0 - (A * z[0]) / g2, fy = y0 - (B * z[0]) / g2;
    return { kind: 'ramp', from: [fx, fy], to: [fx + (A * ZMAX) / g2, fy + (B * ZMAX) / g2] };
  }
  return null;
}

/** Opacity of a fill/stroke style; translucent overlays and gradients don't describe a surface. */
export function alphaOf(style: unknown): number {
  if (typeof style !== 'string') return 0;
  if (style.startsWith('rgba(') || style.startsWith('hsla(')) {
    const m = style.match(/[\d.]+(?=\s*\)\s*$)/);
    return m ? Number(m[0]) : 1;
  }
  return style === 'transparent' ? 0 : 1;
}

const MIRROR_METHODS = new Set([
  'beginPath', 'moveTo', 'lineTo', 'closePath', 'arc', 'arcTo', 'ellipse', 'quadraticCurveTo',
  'bezierCurveTo', 'rect', 'save', 'restore', 'clip', 'translate', 'scale', 'rotate', 'clearRect',
]);
const MIRROR_PROPS = new Set(['lineWidth', 'lineCap', 'lineJoin']);

export function createGBuffer(): GBuffer | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  const d = canvas.getContext('2d');
  if (!d) return null;

  let base: Paint | null = null;
  let cur: Paint | null = null;
  let fillA = 1, strokeA = 1;
  const solidCache = new Map<string, string>();
  const solid = (r: number, g: number, b: number) => {
    const k = `${r},${g},${b}`;
    let s = solidCache.get(k);
    if (!s) { s = `rgb(${k})`; solidCache.set(k, s); }
    return s;
  };
  const ramp = (x0: number, y0: number, x1: number, y1: number, g: number, b: number) => {
    const gr = d.createLinearGradient(x0, y0, x1, y1);
    gr.addColorStop(0, solid(0, g, b));
    gr.addColorStop(1, solid(255, g, b));
    return gr;
  };

  let real: CanvasRenderingContext2D | null = null;
  const writable = (a: number) => !!cur && !!real && a >= 0.5 && real.globalAlpha >= 0.5 && real.globalCompositeOperation === 'source-over';

  const wrapped = new Map<PropertyKey, unknown>();
  const handler: ProxyHandler<CanvasRenderingContext2D> = {
    get(t, prop) {
      const v = Reflect.get(t, prop, t);
      if (typeof v !== 'function') return v;
      let w = wrapped.get(prop);
      if (w) return w;
      const fn = v as (...args: unknown[]) => unknown;
      if (MIRROR_METHODS.has(prop as string)) {
        w = (...args: unknown[]) => { const r = fn.apply(t, args); (d as unknown as Record<string, (...a: unknown[]) => unknown>)[prop as string](...args); return r; };
      } else if (prop === 'fill' || prop === 'fillRect') {
        w = (...args: unknown[]) => {
          fn.apply(t, args);
          if (writable(fillA)) { d.fillStyle = cur!.style; (d as unknown as Record<string, (...a: unknown[]) => unknown>)[prop](...args); }
        };
      } else if (prop === 'stroke') {
        w = (...args: unknown[]) => {
          fn.apply(t, args);
          if (cur?.stroke && writable(strokeA)) { d.strokeStyle = cur.style; d.stroke(); }
        };
      } else {
        w = (...args: unknown[]) => fn.apply(t, args);
      }
      wrapped.set(prop, w);
      return w;
    },
    set(t, prop, value) {
      Reflect.set(t, prop, value, t);
      if (MIRROR_PROPS.has(prop as string)) Reflect.set(d, prop, value);
      if (prop === 'fillStyle') fillA = alphaOf(value);
      else if (prop === 'strokeStyle') strokeA = alphaOf(value);
      return true;
    },
  };
  let proxy: CanvasRenderingContext2D | null = null;

  return {
    canvas,
    begin(width, height, scale) {
      const pw = Math.max(1, Math.round(width * scale)), ph = Math.max(1, Math.round(height * scale));
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      d.setTransform(1, 0, 0, 1, 0, 0);
      d.clearRect(0, 0, pw, ph);
      d.setTransform(pw / width, 0, 0, ph / height, 0, 0);
      d.globalAlpha = 1;
      d.globalCompositeOperation = 'source-over';
      base = null; cur = null;
    },
    wrap(ctx) {
      if (real !== ctx) { real = ctx; proxy = new Proxy(ctx, handler); wrapped.clear(); }
      fillA = alphaOf(ctx.fillStyle); strokeA = alphaOf(ctx.strokeStyle);
      return proxy!;
    },
    plane(view, screen, material) {
      const n = planeNormal(view), hp = n === null ? null : heightPlane(screen, view.map(p => p[2]));
      if (n === null || !hp) { cur = base; return; }
      cur = {
        style: hp.kind === 'solid' ? solid(encodeHeight(hp.z), n, material) : ramp(hp.from[0], hp.from[1], hp.to[0], hp.to[1], n, material),
        stroke: false,
      };
    },
    billboard(groundY, zh, material) {
      base = { style: ramp(0, groundY, 0, groundY - ZMAX * zh, NORMAL.billboard, material), stroke: true };
      cur = base;
    },
    emissive(z) {
      base = { style: solid(encodeHeight(z), NORMAL.billboard, MATERIAL.emissive), stroke: true };
      cur = base;
    },
    clearBase() { base = null; cur = null; },
    reset() { cur = base; },
  };
}
