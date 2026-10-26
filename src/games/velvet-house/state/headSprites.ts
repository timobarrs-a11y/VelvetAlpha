/**
 * Avatar heads for the game: the host sends each person's real avatar head
 * as a small sheet of SVG frames, drawn by the same renderer as the rest of
 * the site. The game turns each frame into a bitmap once and picks one per
 * frame, so faces still blink, talk and react.
 */

export const HEAD_FRAMES = ['neutral', 'smile', 'sad', 'talk', 'blink', 'blinkSmile', 'back'] as const;
export type HeadFrame = typeof HEAD_FRAMES[number];
export type HeadSvgs = Partial<Record<HeadFrame, string>>;
export type HeadImages = Partial<Record<HeadFrame, CanvasImageSource>>;

const MAX_SVG = 400_000;

// Only well-formed frames from our own renderer get through.
export function validHeadSvgs(raw: unknown): HeadSvgs | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: HeadSvgs = {};
  for (const frame of HEAD_FRAMES) {
    const v = (raw as Record<string, unknown>)[frame];
    if (typeof v === 'string' && v.startsWith('<svg') && v.length <= MAX_SVG) out[frame] = v;
  }
  return out.neutral ? out : null;
}

export interface FrameState {
  front: boolean;
  talking: boolean;
  // Seconds, for the talking mouth flap.
  t: number;
  seed: number;
  blink: boolean;
  // How they feel: from the game's expressions and overall mood.
  expr?: string;
  mood: number;
}

export function headFrameFor(s: FrameState, has: HeadImages | HeadSvgs): HeadFrame {
  if (!s.front) return has.back ? 'back' : 'neutral';
  const smiling = s.expr === 'happy' || s.expr === 'playful' || (!s.expr && s.mood > 0.6);
  const sad = s.expr === 'sad' || s.expr === 'annoyed' || (!s.expr && s.mood < 0.3);
  if (s.blink) return smiling && has.blinkSmile ? 'blinkSmile' : has.blink ? 'blink' : 'neutral';
  if (s.talking) return Math.sin(s.t * 13 + s.seed * 7) > 0 && has.talk ? 'talk' : smiling && has.smile ? 'smile' : 'neutral';
  if (smiling && has.smile) return 'smile';
  if (sad && has.sad) return 'sad';
  return 'neutral';
}

// Each frame becomes a bitmap once, at a size that stays sharp in the game.
export async function loadHeadImages(svgs: HeadSvgs, width = 160): Promise<HeadImages> {
  const out: HeadImages = {};
  await Promise.all(Object.entries(svgs).map(async ([frame, svg]) => {
    if (!svg) return;
    try {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round(width * 1.04);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      out[frame as HeadFrame] = canvas;
    } catch { /* a frame that won't load is skipped; the game falls back to neutral */ }
  }));
  return out;
}
