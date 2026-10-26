import { createFabric } from '../art/fabric.js';
import { garmentStyle, bodyPart, SLEEVE_BY_CUT, type Garment } from '../state/garment';

/**
 * A small mannequin that wears a recipe, for the Design Studio and the boutique. It uses the same cloth painter as
 * the people in the house, so what you design is what you get. The arms swing a little so you can see the pattern
 * follow the body.
 */
export interface GarmentPreview {
  draw(top: Garment | null, bottom: Garment | null, t?: number): void;
}

const SKIN = '#c68e6a';

export function createGarmentPreview(canvas: HTMLCanvasElement, opts: { skin?: string } = {}): GarmentPreview {
  const ctx = canvas.getContext('2d');
  const fabric = createFabric();
  const skin = opts.skin ?? SKIN;

  const limb = (c: CanvasRenderingContext2D, pts: [number, number][], w: number, col: string) => {
    c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.stroke();
  };

  function draw(top: Garment | null, bottom: Garment | null, t = 0): void {
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // The figure is drawn about 46 units tall and scaled to fill the canvas.
    const k = H / 58;
    ctx.setTransform(k, 0, 0, k, W / 2, 2 * k);
    const sway = Math.sin(t * 1.6) * 3;
    const hip: [number, number] = [0, 30], sh: [number, number] = [0, 14];
    const topCol = top?.base ?? '#8e9c96', botCol = bottom?.base ?? '#3d5b8a';
    const bottomStyle = bottom ? garmentStyle(bottom) : 'pants';
    const skirt = bottom?.cut === 'skirt', shorts = bottom?.cut === 'shorts';
    const wide = bottom?.cut === 'wide' ? 6.6 : bottom?.cut === 'slim' ? 4.4 : 5;

    // Legs
    for (const s of [-1, 1] as const) {
      const knee: [number, number] = [s * 2.6 + (s > 0 ? sway * 0.25 : -sway * 0.25), 40], foot: [number, number] = [s * 3 + (s > 0 ? sway * 0.4 : -sway * 0.4), 52];
      const bare = skirt || shorts;
      limb(ctx, [hip, knee], wide, bare ? skin : botCol);
      if (bottom && !skirt) fabric.paint(ctx, [hip, knee], wide, bottom, { hem: 0 });
      limb(ctx, [knee, foot], wide - 0.5, shorts || skirt ? skin : botCol);
      if (bottom && !skirt && !shorts) fabric.paint(ctx, [knee, foot], wide - 0.5, bottom, { hem: 0, hemEnd: true });
      limb(ctx, [[foot[0], foot[1]], [foot[0] + s * 1.5, foot[1] + 1.5]], 3.4, '#2b2b30');
    }
    if (skirt && bottom) {
      ctx.fillStyle = botCol; ctx.beginPath();
      ctx.moveTo(-5, 28); ctx.lineTo(5, 28); ctx.lineTo(8, 41); ctx.lineTo(-8, 41); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip(); fabric.fill(ctx, bottom, [-10, 26, 20, 18], [0, 0]); ctx.restore();
    }
    void bottomStyle;

    // Arms
    const sleeve = top ? (SLEEVE_BY_CUT[top.cut] ?? 1) : 0.55;
    for (const s of [-1, 1] as const) {
      const shoulder: [number, number] = [s * 6.4, 15], elbow: [number, number] = [s * 8.4, 23 + (s > 0 ? sway * 0.3 : -sway * 0.3)], hand: [number, number] = [s * 9 + sway * s * 0.6, 31 - Math.abs(sway) * 0.4];
      limb(ctx, [shoulder, elbow, hand], 3.2, skin);
      if (sleeve > 0) {
        const long = sleeve >= 1;
        const end: [number, number] = long ? [elbow[0] + (hand[0] - elbow[0]) * 0.8, elbow[1] + (hand[1] - elbow[1]) * 0.8] : [shoulder[0] + (elbow[0] - shoulder[0]) * sleeve, shoulder[1] + (elbow[1] - shoulder[1]) * sleeve];
        const pts = long ? [shoulder, elbow, end] : [shoulder, end];
        limb(ctx, pts, 4.1, topCol);
        if (top) fabric.paint(ctx, pts, 4.1, top, {});
      }
    }

    // Torso, and the skirt of a dress
    limb(ctx, [hip, sh], 11, topCol);
    if (top) fabric.paint(ctx, [hip, sh], 11, top, { torso: true, front: true });
    if (top?.cut === 'dress') {
      ctx.fillStyle = topCol; ctx.beginPath();
      ctx.moveTo(-5, 28); ctx.lineTo(5, 28); ctx.lineTo(8.5, 42); ctx.lineTo(-8.5, 42); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.clip(); fabric.fill(ctx, top, [-10, 26, 20, 18], [0, 0]); ctx.restore();
    }
    // Head
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, 6.4, 5.6, 0, 7); ctx.fill();
    ctx.fillStyle = '#2b1d16'; ctx.beginPath(); ctx.arc(0, 4.6, 5.8, Math.PI, 0); ctx.fill();
    void bodyPart;
  }

  return { draw };
}
