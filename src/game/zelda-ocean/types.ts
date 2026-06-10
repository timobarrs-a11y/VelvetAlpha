import type { GameMode } from './constants';

export interface ZeldaOceanCallbacks {
  onScoreUpdate: (data: { score: number; rupees: number; lives: number }) => void;
  onGameOver: (data: { finalScore: number; rupeesCollected: number; timePlayed: number }) => void;
  onModeChange: (mode: GameMode) => void;
  onRupeeCollect: (value: number) => void;
  onHit: () => void;
}

export interface BoatState {
  x: number;
  z: number;
  rotation: number;
  tilt: number;
  velocityX: number;
  velocityZ: number;
  speed: number;
}

export interface ObstacleData {
  type: 'barrel' | 'ship' | 'wall';
  lane: number;
  z: number;
  active: boolean;
}

export interface RupeeData {
  value: 1 | 5 | 20;
  lane: number;
  z: number;
  active: boolean;
  rotationY: number;
}

export interface GameStats {
  score: number;
  rupees: number;
  lives: number;
  timePlayed: number;
  startTime: number;
}
