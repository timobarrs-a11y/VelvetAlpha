import type { Position } from '../types/checkers';

export type AnimationType = 'walk' | 'fly' | 'flip' | 'jump' | 'capture' | 'victory' | 'bounce' | 'spin';

export interface AnimationFrame {
  gridCol: number;
  gridRow: number;
  rotation: number;
  scale: number;
  opacity: number;
}

export interface PieceAnimation {
  type: AnimationType;
  fromPos: Position;
  toPos: Position;
  duration: number;
  frames: AnimationFrame[];
  sound?: string;
}

class CheckersAnimationEngine {
  generateWalkAnimation(from: Position, to: Position): PieceAnimation {
    const frames: AnimationFrame[] = [];

    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const easeT = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      frames.push({
        gridCol: from.col + (to.col - from.col) * easeT,
        gridRow: from.row + (to.row - from.row) * easeT + (t > 0.5 ? 0 : Math.sin(t * Math.PI) * 0.1),
        rotation: 0,
        scale: 1,
        opacity: 1,
      });
    }

    return {
      type: 'walk',
      fromPos: from,
      toPos: to,
      duration: 600,
      frames,
      sound: 'piece-move',
    };
  }

  generateFlyAnimation(from: Position, to: Position): PieceAnimation {
    const frames: AnimationFrame[] = [];
    const midCol = (from.col + to.col) / 2;
    const midRow = Math.min(from.row, to.row) - 1.5;

    for (let i = 0; i <= 12; i++) {
      const t = i / 12;

      const gridCol = (1 - t) * (1 - t) * from.col + 2 * (1 - t) * t * midCol + t * t * to.col;
      const gridRow = (1 - t) * (1 - t) * from.row + 2 * (1 - t) * t * midRow + t * t * to.row;

      frames.push({
        gridCol,
        gridRow,
        rotation: t * 360,
        scale: 1 + Math.sin(t * Math.PI) * 0.2,
        opacity: 1,
      });
    }

    return {
      type: 'fly',
      fromPos: from,
      toPos: to,
      duration: 800,
      frames,
      sound: 'piece-fly',
    };
  }

  generateFlipAnimation(from: Position, to: Position): PieceAnimation {
    const frames: AnimationFrame[] = [];

    for (let i = 0; i <= 14; i++) {
      const t = i / 14;

      frames.push({
        gridCol: from.col + (to.col - from.col) * t,
        gridRow: from.row + (to.row - from.row) * t,
        rotation: t * 720,
        scale: 1 + Math.sin(t * Math.PI * 2) * 0.15,
        opacity: 1,
      });
    }

    return {
      type: 'flip',
      fromPos: from,
      toPos: to,
      duration: 900,
      frames,
      sound: 'piece-flip',
    };
  }

  generateCaptureAnimation(capturedPos: Position): PieceAnimation {
    const frames: AnimationFrame[] = [];

    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const bounce = Math.sin(t * Math.PI * 3) * (1 - t) * 0.3;

      frames.push({
        gridCol: capturedPos.col,
        gridRow: capturedPos.row + bounce,
        rotation: t * 540,
        scale: 1 - t * 0.3,
        opacity: 1 - t,
      });
    }

    return {
      type: 'capture',
      fromPos: capturedPos,
      toPos: capturedPos,
      duration: 700,
      frames,
      sound: 'piece-capture',
    };
  }

  generateBounceAnimation(pos: Position): PieceAnimation {
    const frames: AnimationFrame[] = [];

    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const bounce = Math.abs(Math.sin(t * Math.PI * 2)) * 0.25 * (1 - t);

      frames.push({
        gridCol: pos.col,
        gridRow: pos.row - bounce,
        rotation: t * 180,
        scale: 1,
        opacity: 1,
      });
    }

    return {
      type: 'bounce',
      fromPos: pos,
      toPos: pos,
      duration: 500,
      frames,
      sound: 'piece-bounce',
    };
  }

  generateVictoryAnimation(pos: Position): PieceAnimation {
    const frames: AnimationFrame[] = [];

    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      const float = Math.sin(t * Math.PI * 2) * 0.3;
      const pulse = 1 + Math.sin(t * Math.PI * 3) * 0.2;

      frames.push({
        gridCol: pos.col,
        gridRow: pos.row - float,
        rotation: t * 360,
        scale: pulse,
        opacity: 1,
      });
    }

    return {
      type: 'victory',
      fromPos: pos,
      toPos: pos,
      duration: 1200,
      frames,
      sound: 'piece-victory',
    };
  }

  getAnimationVariants(animation: PieceAnimation) {
    return {
      initial: {
        gridCol: animation.frames[0].gridCol,
        gridRow: animation.frames[0].gridRow,
        rotate: animation.frames[0].rotation,
        scale: animation.frames[0].scale,
        opacity: animation.frames[0].opacity,
      },
      animate: animation.frames.map((frame, index) => ({
        gridCol: frame.gridCol,
        gridRow: frame.gridRow,
        rotate: frame.rotation,
        scale: frame.scale,
        opacity: frame.opacity,
        transition: {
          duration: (animation.duration / 1000) * (index / (animation.frames.length - 1)),
          ease: 'linear',
        },
      })),
      exit: {
        opacity: 0,
      },
    };
  }
}

export const checkersAnimationEngine = new CheckersAnimationEngine();
