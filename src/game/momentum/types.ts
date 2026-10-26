// Shared Momentum game types.

export interface ThemeColors {
  levelName: string;
  background: [string, string];
  playerColor: string;
  playerGlow: string;
  boostTrailColor: string;
  platforms: string[];
  glows: string[];
  checkpoint: string;
  checkpointGlow: string;
  flavorText: string;
  goalY?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

export interface PlayerState {
  x: number;
  y: number;
  prevY: number;
  vx: number;
  vy: number;
  boostCharges: number;
  isBoosting: boolean;
  boostTimer: number;
}

export type GameMode = 'freeplay' | 'career' | 'daily' | 'endless';

export interface CareerProgressRow {
  id: string;
  level_number: number;
  attempts: number;
  score_achieved?: number | null;
  completed: boolean;
  stars_earned: number;
  best_time?: number | null;
}
