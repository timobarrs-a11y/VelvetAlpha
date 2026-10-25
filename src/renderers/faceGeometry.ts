import type { FaceShape } from '../types/avatar-v2';

export interface FaceGeometry {
  faceShape: FaceShape;
  fRx: number;
  fRy: number;
  chinW: number;
  faceTop: number;
  faceBottom: number;
  faceCenterY: number;
}

// The outline of the face, shared by the face itself and anything that has to
// follow the jaw (beards).
export function faceOutlinePath(g: FaceGeometry): string {
  const { faceShape, fRx, fRy, chinW, faceTop, faceBottom, faceCenterY } = g;
  switch (faceShape) {
    case 'square':
      return `M${50 - fRx},${faceTop + 6} L${50 - fRx},${faceBottom - 6} Q${50 - chinW / 2},${faceBottom + 4} 50,${faceBottom + 6} Q${50 + chinW / 2},${faceBottom + 4} ${50 + fRx},${faceBottom - 6} L${50 + fRx},${faceTop + 6} Q50,${faceTop - 2} ${50 - fRx},${faceTop + 6} Z`;
    case 'heart':
      return `M${50 - fRx},${faceTop + 4} Q50,${faceTop - 2} ${50 + fRx},${faceTop + 4} L${50 + fRx},${faceBottom - 8} Q${50 + fRx - 4},${faceBottom + 2} 50,${faceBottom + 6} Q${50 - fRx + 4},${faceBottom + 2} ${50 - fRx},${faceBottom - 8} Z`;
    case 'diamond':
      return `M${50 - fRx + 4},${faceTop + 6} Q50,${faceTop - 2} ${50 + fRx - 4},${faceTop + 6} L${50 + fRx},${faceBottom - 10} Q${50 + chinW / 2},${faceBottom + 3} 50,${faceBottom + 6} Q${50 - chinW / 2},${faceBottom + 3} ${50 - fRx},${faceBottom - 10} Z`;
    case 'oblong':
      return `M${50 - fRx},${faceTop + 8} Q50,${faceTop - 1} ${50 + fRx},${faceTop + 8} L${50 + fRx},${faceBottom - 8} Q${50 + chinW / 2},${faceBottom + 4} 50,${faceBottom + 7} Q${50 - chinW / 2},${faceBottom + 4} ${50 - fRx},${faceBottom - 8} Z`;
    default:
      return `M${50 - fRx},${faceCenterY} A${fRx},${fRy} 0 1 0 ${50 + fRx},${faceCenterY} A${fRx},${fRy} 0 1 0 ${50 - fRx},${faceCenterY} Z`;
  }
}

// Lowest point of the chin; the drawn shapes other than oval end a little below faceBottom.
export function chinY(g: FaceGeometry): number {
  switch (g.faceShape) {
    case 'oblong': return g.faceBottom + 7;
    case 'square':
    case 'heart':
    case 'diamond': return g.faceBottom + 6;
    default: return g.faceBottom;
  }
}
