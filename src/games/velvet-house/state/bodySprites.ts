/**
 * Avatar hands for the game: like the heads (headSprites.ts), the host sends
 * each person's hands as small SVGs in their skin tone, drawn by the same
 * art as the rest of the avatar. The game turns each into a bitmap once and
 * rotates it onto the wrist, so hands look like part of the avatar.
 */

export const HAND_PIECES = ['relaxed', 'fist', 'open', 'point'] as const;
export type HandPiece = typeof HAND_PIECES[number];
export type BodySvgs = Partial<Record<HandPiece, string>>;
export type BodyImages = Partial<Record<HandPiece, CanvasImageSource>>;

// The hand art's box and where the wrist sits in it (matches renderers/handRenderer.tsx).
export const HAND_SPRITE = { w: 60, h: 40, wristX: 5, wristY: 20 } as const;

const MAX_SVG = 60_000;

// Only well-formed pieces from our own renderer get through, and a relaxed hand must be there.
export function validBodySvgs(raw: unknown): BodySvgs | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: BodySvgs = {};
  for (const piece of HAND_PIECES) {
    const v = (raw as Record<string, unknown>)[piece];
    if (typeof v === 'string' && v.startsWith('<svg') && v.length <= MAX_SVG) out[piece] = v;
  }
  return out.relaxed ? out : null;
}

// Each piece becomes a bitmap once, at 4 pixels per art unit so it stays sharp when zoomed in.
export async function loadBodyImages(svgs: BodySvgs, scale = 4): Promise<BodyImages> {
  const out: BodyImages = {};
  await Promise.all(Object.entries(svgs).map(async ([piece, svg]) => {
    if (!svg) return;
    try {
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = HAND_SPRITE.w * scale;
      canvas.height = HAND_SPRITE.h * scale;
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      out[piece as HandPiece] = canvas;
    } catch { /* a piece that won't load is skipped; the game draws that hand itself */ }
  }));
  return out;
}

/** The hand bitmap for a grip ('relaxed', 'fist', 'open', 'point'), or null to draw it by hand. */
export function handImage(grip: string, has: BodyImages | undefined): CanvasImageSource | null {
  if (!has) return null;
  return (has as Record<string, CanvasImageSource | undefined>)[grip] ?? has.relaxed ?? null;
}
